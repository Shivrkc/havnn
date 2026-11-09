import path from "path";
import http from "http";
import { spawn, spawnSync } from "child_process";
import readline from "readline";
import prisma from "../lib/prisma";
import { LogStream } from "@prisma/client";
import { BuildContext, assertWorkspaceBoundary, cleanupWorkspace } from "./git.service";
import {
  DOCKER_BUILD_TIMEOUT_MS,
  DOCKER_DAEMON_CHECK_TIMEOUT_MS,
  DOCKER_INSPECT_TIMEOUT_MS,
  DOCKER_RMI_TIMEOUT_MS,
  MAX_IMAGE_SIZE_BYTES,
  SCRATCH_ROOT_DIR,
  DEFAULT_INTERNAL_PORT,
  READINESS_TIMEOUT_MS,
  READINESS_INTERVAL_MS,
  CONTAINER_CPU_LIMIT,
  CONTAINER_MEMORY_LIMIT,
  CONTAINER_MEMORY_SWAP_LIMIT,
  CONTAINER_PIDS_LIMIT,
  CONTAINER_STOP_TIMEOUT_SECS,
} from "../constants/build.constants";
import { sanitizeErrorMessage, sanitizeLogOutput } from "../utils/sanitizer";

export interface DockerBuildResult {
  deploymentId: string;
  imageTag: string;
  imageSizeBytes: number;
  durationMs: number;
  exitCode: number;
  startedAt: Date;
  completedAt: Date;
}

/**
 * In-memory concurrency semaphore: enforces max 1 active Docker build at a time for local engine.
 */
class BuildConcurrencyLock {
  private active = false;
  private queue: Array<() => void> = [];

  public async acquire(): Promise<void> {
    if (!this.active) {
      this.active = true;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  public release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.active = false;
    }
  }
}

export const buildLock = new BuildConcurrencyLock();

/**
 * Log Batcher ensuring monotonically increasing, gap-free, unique sequence ordering
 * per deployment across concurrently emitting stdout and stderr streams.
 */
export class BuildLogBatcher {
  private sequence = 0;
  private queue: Array<{
    line: string;
    stream: LogStream;
    timestamp: Date;
    sequence: number;
  }> = [];

  constructor(private deploymentId: string, initialSequence = 0) {
    this.sequence = initialSequence;
  }

  /**
   * Pushes a single line into the queue.
   * Single-threaded JS event loop ensures sequence increment is strictly atomic.
   */
  public pushLine(rawText: string, stream: LogStream, tokenToRedact?: string): void {
    const clean = sanitizeLogOutput(rawText, tokenToRedact);
    if (!clean || clean.trim().length === 0) return;

    this.sequence += 1;
    this.queue.push({
      line: clean,
      stream,
      timestamp: new Date(),
      sequence: this.sequence,
    });
  }

  private inFlight: Promise<void> | null = null;

  /**
   * Flushes accumulated logs to PostgreSQL in batches of 50.
   * Concurrency-guarded: avoids interleaving concurrent flush calls; callers await active DB write.
   * Failure-safe: if createMany fails, the batch is unshifted back onto the front of the queue
   * preserving exact sequence numbers, ordering, and preventing data loss.
   */
  public async flush(): Promise<void> {
    if (this.inFlight) {
      await this.inFlight;
      return;
    }
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, 50);
    this.inFlight = (async () => {
      try {
        await prisma.buildLog.createMany({
          data: batch.map((item) => ({
            deploymentId: this.deploymentId,
            line: item.line,
            stream: item.stream,
            sequence: item.sequence,
            timestamp: item.timestamp,
          })),
        });
      } catch (err) {
        // Put the unpersisted batch back at the front of the queue
        this.queue.unshift(...batch);
        throw err;
      } finally {
        this.inFlight = null;
      }
    })();

    await this.inFlight;
  }

  /**
   * Flushes all remaining items in the queue and waits for in-flight writes to settle.
   */
  public async flushAll(): Promise<void> {
    while (this.queue.length > 0 || this.inFlight !== null) {
      await this.flush();
    }
  }

  public getNextSequence(): number {
    return this.sequence + 1;
  }
}

/**
 * Verifies that the Docker daemon is responsive within a short timeout.
 */
export async function verifyDockerDaemon(timeoutMs = DOCKER_DAEMON_CHECK_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    let isSettled = false;

    const child = spawn("docker", ["version", "--format", "{{.Server.Os}}"], {
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (child.pid) {
          terminateProcessTree(child.pid);
        }
        reject(new Error("Docker daemon check timed out. Please ensure Docker Desktop/daemon is running."));
      }
    }, timeoutMs);

    child.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(new Error(`Docker CLI not found or unavailable: ${err.message}`));
      }
    });

    child.on("close", (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docker daemon is unavailable or returned exit code ${code}.`));
        }
      }
    });
  });
}

/**
 * Cross-platform process-tree termination for Docker CLI.
 */
function terminateProcessTree(pid: number): void {
  if (!pid) return;

  if (process.platform === "win32") {
    try {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        shell: false,
        windowsHide: true,
      });
    } catch (e) {
      console.error(`Failed to taskkill PID ${pid}:`, e);
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // process may have already exited
      }
    }
  }
}

/**
 * Inspects the uncompressed image size in bytes using `docker inspect`.
 */
export async function inspectDockerImageSize(
  imageTag: string,
  timeoutMs: number = DOCKER_INSPECT_TIMEOUT_MS
): Promise<number> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let isSettled = false;

    const child = spawn("docker", ["inspect", imageTag, "--format", "{{.Size}}"], {
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (child.pid) {
          terminateProcessTree(child.pid);
        }
        reject(new Error(`docker inspect for ${imageTag} timed out after ${Math.round(timeoutMs / 1000)}s.`));
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to spawn docker inspect for ${imageTag}: ${err.message}`));
      }
    });

    child.on("close", (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        if (code === 0) {
          const parsed = parseInt(stdout.trim(), 10);
          if (isNaN(parsed)) {
            reject(new Error(`Unable to parse image size from docker inspect: "${stdout.trim()}"`));
          } else {
            resolve(parsed);
          }
        } else {
          reject(new Error(`Failed to inspect image size for ${imageTag}: ${stderr.trim()}`));
        }
      }
    });
  });
}

/**
 * Deletes a Docker image from the local daemon.
 */
export async function deleteDockerImage(
  imageTag: string,
  timeoutMs: number = DOCKER_RMI_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve) => {
    let isSettled = false;

    const child = spawn("docker", ["rmi", "--force", imageTag], {
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (child.pid) {
          terminateProcessTree(child.pid);
        }
        console.warn(`[SYSTEM] docker rmi for ${imageTag} timed out after ${Math.round(timeoutMs / 1000)}s.`);
        resolve();
      }
    }, timeoutMs);

    child.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        console.warn(`[SYSTEM] Failed to spawn docker rmi for ${imageTag}: ${err.message}`);
        resolve();
      }
    });

    child.on("close", () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

/**
 * Executes a Docker build on the validated BuildContext from Phase 1.2.
 * Enforces:
 *  - Concurrency lock (1 active build)
 *  - Daemon responsiveness check
 *  - Strict context boundary (repoDir only, never workspaceDir)
 *  - Scrubbed clean environment (no backend secrets passed to docker)
 *  - Approved CLI command model (--load, --progress plain, --no-cache, --network default)
 *  - Atomic status transitions (INITIALIZING -> BUILDING -> BUILT / FAILED)
 *  - Real-time log capture & monotonic sequence batch persistence
 *  - 10-minute timeout with process-tree termination
 *  - Image size limit (<= 2GB) with automated rmi rejection on overflow
 *  - Workspace cleanup in finally
 */
export interface DockerBuildExecutionOptions {
  timeoutMs?: number;
  verifyDaemonOverride?: () => Promise<void>;
  inspectSizeOverride?: (tag: string) => Promise<number>;
  abortSignal?: AbortSignal;
}

export async function executeDockerBuild(
  buildContext: BuildContext,
  tokenToRedact?: string,
  options?: DockerBuildExecutionOptions
): Promise<DockerBuildResult> {
  const { deploymentId, workspaceDir, repoDir, dockerfilePath, imageTag } = buildContext;

  // Revalidate boundaries
  assertWorkspaceBoundary(workspaceDir);
  const relativeRepo = path.relative(workspaceDir, repoDir);
  if (relativeRepo !== "repo" && relativeRepo !== "repo/") {
    throw new Error("Security violation: Docker context directory is invalid.");
  }

  // Acquire concurrency lock
  await buildLock.acquire();

  const maxSeqResult = await prisma.buildLog.aggregate({
    where: { deploymentId },
    _max: { sequence: true },
  });
  const initialSequence = maxSeqResult._max.sequence ?? 0;

  const logBatcher = new BuildLogBatcher(deploymentId, initialSequence);
  const startedAt = new Date();

  // Periodic flush interval (every 100ms)
  const flushInterval = setInterval(() => {
    logBatcher.flush().catch((err) => {
      console.error("Error flushing build logs:", err);
    });
  }, 100);

  try {
    // 1. Verify Docker daemon responsiveness before proceeding
    const daemonCheck = options?.verifyDaemonOverride || verifyDockerDaemon;
    try {
      await daemonCheck();
    } catch (daemonErr) {
      const errorMsg = sanitizeErrorMessage(daemonErr, tokenToRedact);
      logBatcher.pushLine(`[SYSTEM] Docker daemon check failed: ${errorMsg}`, LogStream.SYSTEM);
      await logBatcher.flushAll();

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "FAILED",
          startedAt,
          completedAt: new Date(),
          durationMs: 0,
          exitCode: 1,
          errorMessage: errorMsg,
        },
      });

      // Update project status if relation exists
      const dep = await prisma.deployment.findUnique({ where: { id: deploymentId }, select: { projectId: true, createdAt: true } });
      if (dep) {
        await prisma.project.updateMany({
          where: {
            id: dep.projectId,
            deployments: {
              none: {
                createdAt: { gt: dep.createdAt },
              },
            },
          },
          data: { status: "failed" },
        });
      }

      throw new Error(errorMsg);
    }

    // 2. Transition status: INITIALIZING -> BUILDING
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "BUILDING",
        startedAt,
        errorMessage: null,
      },
    });

    const depRecord = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { projectId: true, createdAt: true },
    });
    if (depRecord) {
      await prisma.project.updateMany({
        where: {
          id: depRecord.projectId,
          deployments: {
            none: {
              createdAt: { gt: depRecord.createdAt },
            },
          },
        },
        data: { status: "building" },
      });
    }

    logBatcher.pushLine(`[SYSTEM] Starting Docker image build for tag ${imageTag}`, LogStream.SYSTEM);
    logBatcher.pushLine(`[SYSTEM] Build context: repo/ (Dockerfile: ${dockerfilePath})`, LogStream.SYSTEM);

    // 3. Prepare clean environment (scrub backend secrets, tokens, DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY)
    const cleanEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      SystemDrive: process.env.SystemDrive,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
      ProgramFiles: process.env.ProgramFiles,
      ProgramData: process.env.ProgramData,
      LOCALAPPDATA: process.env.LOCALAPPDATA,
      APPDATA: process.env.APPDATA,
      DOCKER_CONFIG: process.env.DOCKER_CONFIG,
    };

    // 4. Construct approved Docker build CLI arguments
    const dockerArgs = [
      "build",
      "--file", path.resolve(repoDir, dockerfilePath),
      "--tag", imageTag,
      "--load",
      "--progress", "plain",
      "--no-cache",
      "--network", "default",
      repoDir, // STRICT CONTEXT: workspaceDir/repo ONLY
    ];

    // 5. Spawn Docker process
    let isSettled = false;
    let childPid: number | undefined;
    const timeoutMs = options?.timeoutMs ?? DOCKER_BUILD_TIMEOUT_MS;

    const buildPromise = new Promise<{ exitCode: number }>((resolve, reject) => {
      const child = spawn("docker", dockerArgs, {
        cwd: repoDir,
        env: cleanEnv,
        shell: false,
        windowsHide: true,
        detached: process.platform !== "win32",
      });

      childPid = child.pid;

      if (options?.abortSignal) {
        if (options.abortSignal.aborted) {
          isSettled = true;
          logBatcher.pushLine("[SYSTEM] Build cancelled by user before execution.", LogStream.SYSTEM);
          if (childPid) terminateProcessTree(childPid);
          reject(new Error("Deployment cancelled by user."));
          return;
        }

        options.abortSignal.addEventListener("abort", () => {
          if (!isSettled) {
            isSettled = true;
            logBatcher.pushLine("[SYSTEM] Build process cancelled by user. Terminating...", LogStream.SYSTEM);
            if (childPid) terminateProcessTree(childPid);
            reject(new Error("Deployment cancelled by user."));
          }
        });
      }

      const stdoutRl = readline.createInterface({ input: child.stdout });
      stdoutRl.on("line", (line) => {
        logBatcher.pushLine(line, LogStream.STDOUT, tokenToRedact);
      });

      const stderrRl = readline.createInterface({ input: child.stderr });
      stderrRl.on("line", (line) => {
        logBatcher.pushLine(line, LogStream.STDERR, tokenToRedact);
      });

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          logBatcher.pushLine(
            `[SYSTEM] Build process timed out after ${Math.round(timeoutMs / 1000)} seconds. Terminating...`,
            LogStream.SYSTEM
          );
          if (childPid) terminateProcessTree(childPid);
          reject(new Error(`Docker build timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
        }
      }, timeoutMs);

      child.on("error", (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          reject(new Error(`Failed to spawn Docker build process: ${sanitizeErrorMessage(err, tokenToRedact)}`));
        }
      });

      child.on("close", (code) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          resolve({ exitCode: code ?? -1 });
        }
      });
    });

    let exitCode: number;
    try {
      const res = await buildPromise;
      exitCode = res.exitCode;
    } catch (procErr: any) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      const sanitizedErr = sanitizeErrorMessage(procErr, tokenToRedact);

      await logBatcher.flushAll();

      const isCancelled = options?.abortSignal?.aborted || sanitizedErr.includes("cancelled by user");

      const current = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { status: true },
      });

      if (current?.status !== "CANCELLED") {
        await prisma.deployment.update({
          where: { id: deploymentId },
          data: {
            status: isCancelled ? "CANCELLED" : "FAILED",
            completedAt,
            durationMs,
            exitCode: isCancelled ? 130 : 1,
            errorMessage: sanitizedErr,
          },
        });
      }

      if (depRecord) {
        await prisma.project.updateMany({
          where: {
            id: depRecord.projectId,
            deployments: {
              none: {
                createdAt: { gt: depRecord.createdAt },
              },
            },
          },
          data: { status: isCancelled ? "cancelled" : "failed" },
        });
      }

      throw new Error(sanitizedErr);
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // 6. Handle failure exit code
    if (exitCode !== 0) {
      logBatcher.pushLine(`[SYSTEM] Docker build exited with failure code ${exitCode}`, LogStream.SYSTEM);
      await logBatcher.flushAll();

      const errorMessage = `Docker build failed with exit code ${exitCode}.`;
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "FAILED",
          completedAt,
          durationMs,
          exitCode,
          errorMessage,
        },
      });

      if (depRecord) {
        await prisma.project.updateMany({
          where: {
            id: depRecord.projectId,
            deployments: {
              none: {
                createdAt: { gt: depRecord.createdAt },
              },
            },
          },
          data: { status: "failed" },
        });
      }

      throw new Error(errorMessage);
    }

    // 7. Inspect image and enforce image size limits
    logBatcher.pushLine("[SYSTEM] Build compilation succeeded. Inspecting generated container image...", LogStream.SYSTEM);
    let imageSizeBytes: number;

    const inspectFn = options?.inspectSizeOverride || inspectDockerImageSize;
    try {
      imageSizeBytes = await inspectFn(imageTag);
    } catch (inspectErr) {
      const errClean = sanitizeErrorMessage(inspectErr, tokenToRedact);
      logBatcher.pushLine(`[SYSTEM] Failed to verify image in local Docker daemon: ${errClean}`, LogStream.SYSTEM);
      await logBatcher.flushAll();

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "FAILED",
          completedAt,
          durationMs,
          exitCode: 1,
          errorMessage: `Image verification failed: ${errClean}`,
        },
      });

      if (depRecord) {
        await prisma.project.updateMany({
          where: {
            id: depRecord.projectId,
            deployments: {
              none: {
                createdAt: { gt: depRecord.createdAt },
              },
            },
          },
          data: { status: "failed" },
        });
      }

      throw new Error(`Image verification failed: ${errClean}`);
    }

    if (imageSizeBytes > MAX_IMAGE_SIZE_BYTES) {
      const sizeMB = Math.round(imageSizeBytes / (1024 * 1024));
      const limitMB = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
      const sizeError = `Docker image size limit exceeded: generated image is ${sizeMB}MB (maximum permitted limit is ${limitMB}MB).`;

      logBatcher.pushLine(`[SYSTEM] ${sizeError} Deleting oversized image...`, LogStream.SYSTEM);
      await deleteDockerImage(imageTag);
      logBatcher.pushLine("[SYSTEM] Oversized image removed from Docker daemon.", LogStream.SYSTEM);
      await logBatcher.flushAll();

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "FAILED",
          completedAt,
          durationMs,
          exitCode: 1,
          errorMessage: sizeError,
        },
      });

      if (depRecord) {
        await prisma.project.updateMany({
          where: {
            id: depRecord.projectId,
            deployments: {
              none: {
                createdAt: { gt: depRecord.createdAt },
              },
            },
          },
          data: { status: "failed" },
        });
      }

      throw new Error(sizeError);
    }

    // Check cancellation race before marking BUILT
    const currentStatus = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true },
    });

    if (currentStatus?.status === "CANCELLED" || options?.abortSignal?.aborted) {
      await deleteDockerImage(imageTag);
      throw new Error("Deployment cancelled by user.");
    }

    // 8. Mark BUILT (Terminal Success)
    logBatcher.pushLine(
      `[SYSTEM] Image ${imageTag} built and verified successfully (${Math.round(imageSizeBytes / 1024)} KB).`,
      LogStream.SYSTEM
    );
    await logBatcher.flushAll();

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "BUILT",
        completedAt,
        durationMs,
        exitCode: 0,
        errorMessage: null,
      },
    });

    if (depRecord) {
      await prisma.project.updateMany({
        where: {
          id: depRecord.projectId,
          deployments: {
            none: {
              createdAt: { gt: depRecord.createdAt },
            },
          },
        },
        data: { status: "ready" },
      });
    }

    return {
      deploymentId,
      imageTag,
      imageSizeBytes,
      durationMs,
      exitCode: 0,
      startedAt,
      completedAt,
    };
  } finally {
    clearInterval(flushInterval);
    try {
      await logBatcher.flushAll();
    } catch (flushErr) {
      console.error("Error in final logBatcher.flushAll:", flushErr);
    }
    buildLock.release();

    // Always clean up the workspace directory on completion/failure
    await cleanupWorkspace(workspaceDir);
  }
}

/**
 * Inspects exposed ports in an image's Docker configuration metadata.
 * Returns the lowest valid TCP port between 1 and 65535, or DEFAULT_INTERNAL_PORT (3000) fallback.
 */
export async function inspectImageExposedPort(
  imageTag: string,
  timeoutMs: number = DOCKER_INSPECT_TIMEOUT_MS
): Promise<number> {
  return new Promise((resolve) => {
    let stdout = "";
    let isSettled = false;

    const child = spawn("docker", ["inspect", imageTag, "--format", "{{json .Config.ExposedPorts}}"], {
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (child.pid) terminateProcessTree(child.pid);
        resolve(DEFAULT_INTERNAL_PORT);
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.on("error", () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve(DEFAULT_INTERNAL_PORT);
      }
    });

    child.on("close", (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        if (code === 0 && stdout.trim() && stdout.trim() !== "null") {
          try {
            const portsObj = JSON.parse(stdout.trim());
            if (portsObj && typeof portsObj === "object") {
              const parsedPorts: number[] = [];
              for (const key of Object.keys(portsObj)) {
                const portPart = key.split("/")[0];
                const num = parseInt(portPart, 10);
                if (Number.isInteger(num) && num >= 1 && num <= 65535) {
                  parsedPorts.push(num);
                }
              }
              if (parsedPorts.length > 0) {
                parsedPorts.sort((a, b) => a - b);
                return resolve(parsedPorts[0]);
              }
            }
          } catch {
            // fallback
          }
        }
        resolve(DEFAULT_INTERNAL_PORT);
      }
    });
  });
}

export interface StartContainerOptions {
  deploymentId: string;
  projectId: string;
  imageTag: string;
  internalPort?: number;
  envVars?: Record<string, string>;
  abortSignal?: AbortSignal;
}

export interface ContainerStartResult {
  containerId: string;
  containerName: string;
  hostPort: number;
  internalPort: number;
  localUrl: string;
}

/**
 * Spawns an isolated application container with least-privilege security flags,
 * resource quotas, loopback-only dynamic port publishing, and havn labels.
 */
export async function startApplicationContainer(
  options: StartContainerOptions
): Promise<ContainerStartResult> {
  const { deploymentId, projectId, imageTag } = options;
  const rawPort = options.internalPort || DEFAULT_INTERNAL_PORT;
  const internalPort =
    Number.isInteger(rawPort) && rawPort >= 1 && rawPort <= 65535
      ? rawPort
      : DEFAULT_INTERNAL_PORT;

  const containerName = `cloudforge-app-${deploymentId}`;

  // If container with same name already exists from previous attempt, clean it first
  await stopDockerContainer(containerName).catch(() => {});

  const args: string[] = [
    "run",
    "-d",
    "--name", containerName,
    "--label", "managed-by=havn",
    "--label", `project-id=${projectId}`,
    "--label", `deployment-id=${deploymentId}`,
    "-p", `127.0.0.1::${internalPort}`,
    "--security-opt", "no-new-privileges:true",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
    "--memory", CONTAINER_MEMORY_LIMIT,
    "--memory-swap", CONTAINER_MEMORY_SWAP_LIMIT,
    "--cpus", CONTAINER_CPU_LIMIT,
    "--pids-limit", String(CONTAINER_PIDS_LIMIT),
    "-e", `PORT=${internalPort}`,
    "-e", "HOST=0.0.0.0",
  ];

  if (options.envVars) {
    for (const [key, val] of Object.entries(options.envVars)) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        args.push("-e", `${key}=${val}`);
      }
    }
  }

  args.push(imageTag);

  const containerId = await new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let isSettled = false;

    const child = spawn("docker", args, {
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (child.pid) terminateProcessTree(child.pid);
        reject(new Error("docker run timed out after 30 seconds."));
      }
    }, 30_000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to spawn docker run: ${err.message}`));
      }
    });

    child.on("close", (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        if (code === 0 && stdout.trim()) {
          resolve(stdout.trim().split("\n")[0].trim());
        } else {
          reject(new Error(`docker run failed with exit code ${code}: ${stderr.trim()}`));
        }
      }
    });
  });

  // Inspect the dynamic host port allocated by Docker
  const hostPort = await inspectContainerHostPort(containerName, internalPort);
  const localUrl = `http://localhost:${hostPort}`;

  return {
    containerId,
    containerName,
    hostPort,
    internalPort,
    localUrl,
  };
}

/**
 * Inspects the loopback host port mapped to the internal container port.
 */
export async function inspectContainerHostPort(
  containerNameOrId: string,
  internalPort: number,
  timeoutMs = 10_000
): Promise<number> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let isSettled = false;

    const child = spawn("docker", ["port", containerNameOrId, `${internalPort}/tcp`], {
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (child.pid) terminateProcessTree(child.pid);
        reject(new Error(`docker port inspect timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to run docker port: ${err.message}`));
      }
    });

    child.on("close", (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        if (code === 0 && stdout.trim()) {
          const match = stdout.trim().match(/:(\d+)$/m);
          if (match && match[1]) {
            const port = parseInt(match[1], 10);
            if (Number.isInteger(port) && port >= 1 && port <= 65535) {
              return resolve(port);
            }
          }
          reject(new Error(`Could not parse mapped host port from docker port output: "${stdout.trim()}"`));
        } else {
          reject(new Error(`docker port failed with code ${code}: ${stderr.trim()}`));
        }
      }
    });
  });
}

/**
 * Periodically probes http://127.0.0.1:${hostPort}/ with strict HTTP policy:
 * - 2xx (200-299): Ready (success)
 * - 3xx (300-399): Ready if redirect location header is provided (app server is routing)
 * - 401, 403, 405: Ready (app server is running and enforcing auth / method restrictions)
 * - 404: Not initially ready; requires 3 consecutive 404 responses or custom app headers to avoid false positives on unmounted SPAs
 * - 5xx (500-599): Not ready (server crash/error)
 * - Connection errors & timeouts: Not ready (retry within bounded window)
 */
export async function probeApplicationReadiness(
  hostPort: number,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    abortSignal?: AbortSignal;
  }
): Promise<{ ready: boolean; statusCode?: number; durationMs: number; error?: string }> {
  const timeoutMs = options?.timeoutMs ?? READINESS_TIMEOUT_MS;
  const intervalMs = options?.intervalMs ?? READINESS_INTERVAL_MS;
  const startTime = Date.now();
  let consecutive404Count = 0;

  while (Date.now() - startTime < timeoutMs) {
    if (options?.abortSignal?.aborted) {
      return {
        ready: false,
        durationMs: Date.now() - startTime,
        error: "Readiness probe cancelled by user.",
      };
    }

    try {
      const probeResult = await new Promise<{ statusCode: number; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${hostPort}/`,
          { timeout: 1500 },
          (res) => {
            resolve({ statusCode: res.statusCode ?? 200, headers: res.headers });
          }
        );
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Probe request timed out."));
        });
      });

      const { statusCode, headers } = probeResult;

      // 1. 2xx Success: Definitive readiness
      if (statusCode >= 200 && statusCode < 300) {
        return {
          ready: true,
          statusCode,
          durationMs: Date.now() - startTime,
        };
      }

      // 2. 3xx Redirect: Ready if redirection target is emitted
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        return {
          ready: true,
          statusCode,
          durationMs: Date.now() - startTime,
        };
      }

      // 3. 401, 403, 405: App is running and actively enforcing endpoint constraints
      if (statusCode === 401 || statusCode === 403 || statusCode === 405) {
        return {
          ready: true,
          statusCode,
          durationMs: Date.now() - startTime,
        };
      }

      // 4. 404: If custom application framework header exists or 3 consecutive 404s observed, mark ready
      if (statusCode === 404) {
        const hasAppHeader = Boolean(headers["x-powered-by"] || headers["server"] || headers["content-type"]);
        consecutive404Count++;
        if (hasAppHeader || consecutive404Count >= 3) {
          return {
            ready: true,
            statusCode,
            durationMs: Date.now() - startTime,
          };
        }
      } else {
        consecutive404Count = 0;
      }
    } catch {
      consecutive404Count = 0;
      // Server not accepting connections yet
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return {
    ready: false,
    durationMs: Date.now() - startTime,
    error: `Readiness check timed out after ${Math.round(timeoutMs / 1000)}s on port ${hostPort}.`,
  };
}

/**
 * Inspects real-time state of a container (running, exitCode, oomKilled, etc.).
 */
export async function inspectContainerState(
  containerNameOrId: string,
  timeoutMs = DOCKER_INSPECT_TIMEOUT_MS
): Promise<{
  exists: boolean;
  running: boolean;
  exitCode?: number;
  oomKilled?: boolean;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let isSettled = false;

    const child = spawn("docker", ["inspect", containerNameOrId, "--format", "{{json .State}}"], {
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (child.pid) terminateProcessTree(child.pid);
        resolve({ exists: false, running: false, error: "inspect timed out" });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve({ exists: false, running: false, error: `Docker daemon unavailable: ${err.message}` });
      }
    });

    child.on("close", (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        if (code === 0 && stdout.trim()) {
          try {
            const state = JSON.parse(stdout.trim());
            return resolve({
              exists: true,
              running: Boolean(state.Running),
              exitCode: typeof state.ExitCode === "number" ? state.ExitCode : undefined,
              oomKilled: Boolean(state.OOMKilled),
              startedAt: state.StartedAt,
              finishedAt: state.FinishedAt,
              error: state.Error || undefined,
            });
          } catch {
            return resolve({ exists: true, running: false });
          }
        }

        const errLower = stderr.toLowerCase();
        if (
          errLower.includes("failed to connect") ||
          errLower.includes("cannot connect") ||
          errLower.includes("daemon running") ||
          errLower.includes("error during connect") ||
          errLower.includes("pipe")
        ) {
          return resolve({ exists: false, running: false, error: "Docker daemon unavailable" });
        }

        resolve({ exists: false, running: false });
      }
    });
  });
}

/**
 * Gracefully stops then force-removes a container.
 * Rejects with an error if stopping/removing fails so callers never silently assume success.
 */
export async function stopDockerContainer(
  containerNameOrId: string,
  timeoutSecs = CONTAINER_STOP_TIMEOUT_SECS
): Promise<void> {
  return new Promise((resolve, reject) => {
    let stopStderr = "";
    const stopChild = spawn("docker", ["stop", "-t", String(timeoutSecs), containerNameOrId], {
      shell: false,
      windowsHide: true,
    });

    stopChild.stderr.on("data", (chunk: Buffer) => {
      stopStderr += chunk.toString("utf8");
    });

    const finish = () => {
      let rmStderr = "";
      const rmChild = spawn("docker", ["rm", "-f", containerNameOrId], {
        shell: false,
        windowsHide: true,
      });

      rmChild.stderr.on("data", (chunk: Buffer) => {
        rmStderr += chunk.toString("utf8");
      });

      rmChild.on("close", (rmCode) => {
        // Exit code 0 or container not found (already gone) is considered clean removal
        if (rmCode === 0 || rmStderr.includes("No such container") || rmStderr.includes("not found")) {
          resolve();
        } else {
          reject(new Error(`Failed to remove container ${containerNameOrId}: ${rmStderr.trim()}`));
        }
      });

      rmChild.on("error", (err) => {
        reject(new Error(`Failed to spawn docker rm for ${containerNameOrId}: ${err.message}`));
      });
    };

    stopChild.on("close", finish);
    stopChild.on("error", (err) => {
      // Even if stop fails to spawn, attempt rm -f
      console.warn(`[docker.service] Warning during docker stop for ${containerNameOrId}: ${err.message}`);
      finish();
    });
  });
}

/**
 * Retrieves the last N runtime stdout/stderr log lines from a container with token redaction.
 */
export async function getContainerRuntimeLogs(
  containerNameOrId: string,
  tailLines = 200,
  timeoutMs = 5000
): Promise<string[]> {
  return new Promise((resolve) => {
    let output = "";
    let isSettled = false;

    const child = spawn("docker", ["logs", "--tail", String(tailLines), containerNameOrId], {
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (child.pid) terminateProcessTree(child.pid);
        resolve([]);
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });

    child.on("error", () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve([]);
      }
    });

    child.on("close", () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        const lines = output
          .split("\n")
          .map((line) => sanitizeLogOutput(line))
          .filter((line) => line.trim().length > 0);
        resolve(lines);
      }
    });
  });
}

/**
 * Cleans up all HAVN-managed containers for a given project.
 */
export async function cleanupProjectContainers(projectId: string): Promise<string[]> {
  return new Promise((resolve) => {
    let stdout = "";
    let isSettled = false;

    const child = spawn(
      "docker",
      [
        "ps",
        "-a",
        "--filter", "label=managed-by=havn",
        "--filter", `label=project-id=${projectId}`,
        "--format", "{{.ID}}",
      ],
      { shell: false, windowsHide: true }
    );

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.on("error", () => {
      if (!isSettled) {
        isSettled = true;
        resolve([]);
      }
    });

    child.on("close", async () => {
      if (!isSettled) {
        isSettled = true;
        const containerIds = stdout
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);

        for (const cid of containerIds) {
          await stopDockerContainer(cid).catch(() => {});
        }
        resolve(containerIds);
      }
    });
  });
}
