import path from "path";
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

  private isFlushing = false;

  /**
   * Flushes accumulated logs to PostgreSQL in batches of 50.
   * Concurrency-guarded: avoids interleaving concurrent flush calls.
   * Failure-safe: if createMany fails, the batch is unshifted back onto the front of the queue
   * preserving exact sequence numbers, ordering, and preventing data loss.
   */
  public async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return;

    this.isFlushing = true;
    const batch = this.queue.splice(0, 50);

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
      this.isFlushing = false;
    }
  }

  /**
   * Flushes all remaining items in the queue.
   */
  public async flushAll(): Promise<void> {
    while (this.queue.length > 0) {
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
