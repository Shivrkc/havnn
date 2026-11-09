import path from "path";
import fs from "fs";
import prisma from "../lib/prisma";
import { LogStream, Deployment, DeploymentStatus } from "@prisma/client";
import { prepareDeploymentWorkspace } from "./deployment.service";
import {
  executeDockerBuild,
  deleteDockerImage,
  inspectImageExposedPort,
  startApplicationContainer,
  probeApplicationReadiness,
  stopDockerContainer,
  inspectContainerState,
  inspectDockerImageSize,
} from "./docker.service";
import { sanitizeErrorMessage } from "../utils/sanitizer";
import { cleanupWorkspace } from "./git.service";
import { decryptToken } from "../utils/crypto";
import {
  SCRATCH_ROOT_DIR,
  RUNTIME_RECONCILE_INTERVAL_MS,
  DEFAULT_INTERNAL_PORT,
  STALE_STARTUP_LEASE_THRESHOLD_SECONDS,
  STALE_BUILD_LEASE_THRESHOLD_SECONDS,
  RECONCILER_LOCK_TTL_MS,
  READINESS_TIMEOUT_MS,
} from "../constants/build.constants";

export const STALE_LEASE_THRESHOLD_SECONDS = STALE_BUILD_LEASE_THRESHOLD_SECONDS;
export const HEARTBEAT_INTERVAL_MS = 10000;
export const SAFETY_POLL_INTERVAL_MS = 5000;
export const RECOVERY_INTERVAL_MS = 60000;

/**
 * Synchronizes Project.status enforcing the Newest-Only Invariant:
 * An older deployment must NEVER overwrite the project status produced by a newer deployment.
 */
export async function syncProjectStatus(
  projectId: string,
  deploymentCreatedAt: Date,
  newStatus: string
): Promise<void> {
  await prisma.project.updateMany({
    where: {
      id: projectId,
      deployments: {
        none: {
          createdAt: { gt: deploymentCreatedAt },
        },
      },
    },
    data: {
      status: newStatus,
    },
  });
}

export type PrepareWorkspaceFn = (
  deploymentId: string,
  userId: string,
  options?: { abortSignal?: AbortSignal }
) => Promise<any>;

/**
 * Database-backed Asynchronous Deployment Worker (Phase 1.4).
 * Single local runner (concurrency = 1), FIFO, atomic PostgreSQL claiming,
 * worker lease with heartbeats, resilient crash recovery, and race-safe cancellation.
 */
export class DeploymentWorker {
  public readonly workerId: string;
  private isProcessing = false;
  private isStopped = false;
  private isReconciling = false;
  private safetyPollTimer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private reconcileTimer: NodeJS.Timeout | null = null;
  private activeAborts = new Map<string, AbortController>();
  private heartbeatTimers = new Map<string, NodeJS.Timeout>();
  private prepareWorkspaceFn: PrepareWorkspaceFn;

  constructor(customWorkerId?: string, prepareWorkspaceOverride?: PrepareWorkspaceFn) {
    this.workerId =
      customWorkerId ||
      `worker-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.prepareWorkspaceFn = prepareWorkspaceOverride || prepareDeploymentWorkspace;
  }

  public get stopped(): boolean {
    return this.isStopped;
  }

  public get isRunning(): boolean {
    return !this.isStopped;
  }

  /**
   * Starts the background worker, safety poller, crash recovery reaper, and liveness reconciler.
   */
  public async start(): Promise<void> {
    this.isStopped = false;
    await this.recoverStaleDeployments();
    await this.reconcileRunningDeployments();

    if (!this.safetyPollTimer) {
      this.safetyPollTimer = setInterval(() => {
        if (this.isStopped) return;
        this.processNext().catch((err) => {
          console.error(`[DeploymentWorker ${this.workerId}] Safety poll error:`, err);
        });
      }, SAFETY_POLL_INTERVAL_MS);
    }

    if (!this.recoveryTimer) {
      this.recoveryTimer = setInterval(() => {
        if (this.isStopped) return;
        this.recoverStaleDeployments().catch((err) => {
          console.error(`[DeploymentWorker ${this.workerId}] Recovery timer error:`, err);
        });
      }, RECOVERY_INTERVAL_MS);
    }

    if (!this.reconcileTimer) {
      this.reconcileTimer = setInterval(() => {
        if (this.isStopped) return;
        this.reconcileRunningDeployments().catch((err) => {
          console.error(`[DeploymentWorker ${this.workerId}] Reconciler error:`, err);
        });
      }, RUNTIME_RECONCILE_INTERVAL_MS);
    }

    // Attempt immediate pickup
    this.notify();
  }

  /**
   * Stops the worker, clearing intervals, heartbeats, active aborts, and preventing further job claims.
   */
  public stop(): void {
    this.isStopped = true;
    if (this.safetyPollTimer) {
      clearInterval(this.safetyPollTimer);
      this.safetyPollTimer = null;
    }
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer);
      this.reconcileTimer = null;
    }

    for (const [depId, timer] of this.heartbeatTimers.entries()) {
      clearInterval(timer);
      this.heartbeatTimers.delete(depId);
    }

    for (const [depId, controller] of this.activeAborts.entries()) {
      controller.abort();
      this.activeAborts.delete(depId);
    }
  }

  /**
   * Wakes up the worker immediately when a new deployment is queued.
   */
  public notify(): void {
    if (this.isStopped) {
      return;
    }
    if (!this.isProcessing) {
      setImmediate(() => {
        if (this.isStopped) {
          return;
        }
        this.processNext().catch((err) => {
          console.error(`[DeploymentWorker ${this.workerId}] Error in notify processNext:`, err);
        });
      });
    }
  }

  /**
   * Atomically claims the oldest QUEUED deployment using PostgreSQL row-locking.
   */
  public async claimNextDeployment(): Promise<Deployment | null> {
    if (this.isStopped) {
      return null;
    }

    return await prisma.$transaction(async (tx) => {
      if (this.isStopped) {
        return null;
      }

      const candidates = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Deployment"
        WHERE "status" = 'QUEUED'::"DeploymentStatus"
        ORDER BY "updatedAt" ASC, "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
      `;

      if (!candidates || candidates.length === 0) {
        return null;
      }

      const candidateId = candidates[0].id;

      const updatedRows = await tx.$queryRaw<Deployment[]>`
        UPDATE "Deployment"
        SET 
          "status" = 'INITIALIZING'::"DeploymentStatus",
          "startedAt" = NOW(),
          "workerId" = ${this.workerId},
          "heartbeatAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "id" = ${candidateId}
          AND "status" = 'QUEUED'::"DeploymentStatus"
        RETURNING *;
      `;

      return updatedRows[0] || null;
    });
  }

  /**
   * Main worker execution loop. Processes 1 deployment at a time.
   */
  public async processNext(): Promise<void> {
    if (this.isProcessing || this.isStopped) {
      return;
    }

    this.isProcessing = true;

    let claimedDeployment: Deployment | null = null;
    try {
      if (this.isStopped) {
        this.isProcessing = false;
        return;
      }
      claimedDeployment = await this.claimNextDeployment();
    } catch (claimErr) {
      console.error(`[DeploymentWorker ${this.workerId}] Error claiming deployment:`, claimErr);
      this.isProcessing = false;
      return;
    }

    if (!claimedDeployment || this.isStopped) {
      this.isProcessing = false;
      return;
    }

    try {
      await this.executePipeline(claimedDeployment);
    } catch (pipelineErr) {
      console.error(
        `[DeploymentWorker ${this.workerId}] Unhandled pipeline exception for ${claimedDeployment.id}:`,
        pipelineErr
      );
    } finally {
      this.isProcessing = false;
      // Drain remaining queued jobs only if worker is not stopped
      if (!this.isStopped) {
        setImmediate(() => {
          if (!this.isStopped) {
            this.processNext().catch((err) => {
              console.error(`[DeploymentWorker ${this.workerId}] Next iteration error:`, err);
            });
          }
        });
      }
    }
  }

  /**
   * Orchestrates Phase 1.2 and Phase 1.3 for a claimed deployment.
   */
  private async executePipeline(deployment: Deployment): Promise<void> {
    const deploymentId = deployment.id;
    const projectId = deployment.projectId;
    const createdAt = deployment.createdAt;

    // 1. Resolve project owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        user: {
          include: { githubAccount: true },
        },
      },
    });

    if (!project || !project.user) {
      await this.failOrphanDeployment(deploymentId, "Project or user record missing.", createdAt, projectId);
      return;
    }

    const userId = project.user.id;
    const githubAccount = project.user.githubAccount;
    const githubToken = githubAccount?.accessToken ? decryptToken(githubAccount.accessToken) : undefined;

    // 2. Setup AbortController for race-safe cancellation
    const abortController = new AbortController();
    this.activeAborts.set(deploymentId, abortController);

    // 3. Start 30-second heartbeat timer
    this.startHeartbeat(deploymentId);

    // Append SYSTEM claim log
    await this.appendSystemLog(deploymentId, "[SYSTEM] Worker claimed deployment. Initializing isolated workspace...");

    // Update project status to "building" using newest-only invariant
    await syncProjectStatus(projectId, createdAt, "building");

    // Fast-path: Check if this is a durable restart of an already-built cached image
    if (deployment.imageTag) {
      let imageExists = false;
      try {
        const size = await inspectDockerImageSize(deployment.imageTag);
        imageExists = size > 0;
      } catch {
        imageExists = false;
      }

      if (imageExists) {
        await this.appendSystemLog(
          deploymentId,
          `[SYSTEM] Cached image ${deployment.imageTag} verified in local Docker daemon. Bypassing build pipeline...`
        );
        const internalPort = deployment.internalPort || (await inspectImageExposedPort(deployment.imageTag));
        await this.executeStartupAndPromotion(
          deploymentId,
          projectId,
          deployment.imageTag,
          createdAt,
          internalPort,
          abortController.signal
        );
        return;
      } else {
        await this.appendSystemLog(
          deploymentId,
          `[SYSTEM] Image ${deployment.imageTag} not found in local daemon cache. Rebuilding from repository source...`
        );
      }
    }

    let buildContext: any = null;

    try {
      // 4. Phase 1.2: Prepare isolated workspace & clone repository
      buildContext = await this.prepareWorkspaceFn(deploymentId, userId, {
        abortSignal: abortController.signal,
      });

      if (abortController.signal.aborted) {
        throw new Error("Deployment cancelled by user.");
      }

      await this.appendSystemLog(
        deploymentId,
        `[SYSTEM] Workspace ready at commit ${buildContext.commitSha.substring(0, 7)}. Handing off to Docker Build Engine...`
      );

      // 5. Phase 1.3: Execute Docker build
      // Phase 1.3 consumes BuildContext (kept strictly in memory) and owns workspace cleanup in its finally block.
      await executeDockerBuild(buildContext, githubToken, {
        abortSignal: abortController.signal,
      });

      // 6. Post-Build Container Startup & Readiness Probing
      const verified = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { status: true },
      });

      if (verified?.status === "BUILT") {
        await this.appendSystemLog(deploymentId, `[SYSTEM] Image ${buildContext.imageTag} built successfully.`);

        // Determine internal HTTP port from image EXPOSE metadata or default to 3000
        const internalPort = await inspectImageExposedPort(buildContext.imageTag);

        await this.executeStartupAndPromotion(
          deploymentId,
          projectId,
          buildContext.imageTag,
          createdAt,
          internalPort,
          abortController.signal
        );
      }
    } catch (err: any) {
      const sanitized = sanitizeErrorMessage(err, githubToken);
      const isCancelled =
        abortController.signal.aborted ||
        sanitized.includes("cancelled by user") ||
        sanitized.includes("aborted");

      // Stop and remove container if started
      await stopDockerContainer(`cloudforge-app-${deploymentId}`).catch(() => {});

      // Verify current DB status to preserve terminal immutability
      const current = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { status: true },
      });

      if (current && current.status !== "RUNNING" && current.status !== "STOPPED" && current.status !== "CANCELLED" && current.status !== "FAILED") {
        await prisma.deployment.update({
          where: { id: deploymentId },
          data: {
            status: isCancelled ? "CANCELLED" : "FAILED",
            completedAt: new Date(),
            exitCode: isCancelled ? 130 : 1,
            errorMessage: sanitized,
          },
        });
      }

      await this.appendSystemLog(
        deploymentId,
        isCancelled
          ? "[SYSTEM] Deployment execution cancelled by user."
          : `[SYSTEM] Deployment execution failed: ${sanitized}`
      );

      await syncProjectStatus(projectId, createdAt, isCancelled ? "cancelled" : "failed");

      // Fallback cleanup if Phase 1.2 succeeded but Phase 1.3 never ran or threw before owning cleanup
      const workspaceDir = path.resolve(SCRATCH_ROOT_DIR, deploymentId);
      if (fs.existsSync(workspaceDir)) {
        await cleanupWorkspace(workspaceDir);
      }
    } finally {
      // 7. Cleanup in-memory registry & heartbeat
      this.stopHeartbeat(deploymentId);
      this.activeAborts.delete(deploymentId);
    }
  }

  /**
   * Cancels a queued or active deployment.
   */
  public async cancelDeployment(
    deploymentId: string,
    userId: string
  ): Promise<{ success: boolean; notFound?: boolean; isTerminal?: boolean; status?: string; deployment?: Deployment }> {
    // 1. Verify project ownership
    const dep = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        project: { userId },
      },
    });

    if (!dep) {
      return { success: false, notFound: true };
    }

    if (
      dep.status === "RUNNING" ||
      dep.status === "STOPPED" ||
      dep.status === "CRASHED" ||
      dep.status === "FAILED" ||
      dep.status === "CANCELLED"
    ) {
      return { success: false, isTerminal: true, status: dep.status };
    }

    // 2. Cancellation for QUEUED deployment
    if (dep.status === "QUEUED") {
      const updatedRows = await prisma.$queryRaw<Deployment[]>`
        UPDATE "Deployment"
        SET 
          "status" = 'CANCELLED'::"DeploymentStatus",
          "completedAt" = NOW(),
          "errorMessage" = 'Deployment cancelled while queued.',
          "updatedAt" = NOW()
        WHERE "id" = ${deploymentId}
          AND "status" = 'QUEUED'::"DeploymentStatus"
        RETURNING *;
      `;

      if (updatedRows && updatedRows.length > 0) {
        await this.appendSystemLog(deploymentId, "[SYSTEM] Deployment cancelled while waiting in queue.");
        await syncProjectStatus(dep.projectId, dep.createdAt, "cancelled");
        return { success: true, notFound: false, isTerminal: false, status: "CANCELLED", deployment: updatedRows[0] };
      }
    }

    // 3. Cancellation for INITIALIZING, BUILDING, or STARTING deployment
    const updatedRows = await prisma.$queryRaw<Deployment[]>`
      UPDATE "Deployment"
      SET 
        "status" = 'CANCELLED'::"DeploymentStatus",
        "completedAt" = NOW(),
        "errorMessage" = 'Deployment cancelled by user.',
        "updatedAt" = NOW()
      WHERE "id" = ${deploymentId}
        AND "status" IN ('INITIALIZING'::"DeploymentStatus", 'BUILDING'::"DeploymentStatus", 'STARTING'::"DeploymentStatus")
      RETURNING *;
    `;

    if (updatedRows && updatedRows.length > 0) {
      // Trigger in-memory AbortController if worker is running it locally
      const controller = this.activeAborts.get(deploymentId);
      if (controller) {
        controller.abort();
      }

      // Stop candidate container if starting
      await stopDockerContainer(`cloudforge-app-${deploymentId}`).catch(() => {});

      await this.appendSystemLog(
        deploymentId,
        "[SYSTEM] Deployment cancellation requested. Aborting active operations..."
      );
      await syncProjectStatus(dep.projectId, dep.createdAt, "cancelled");
      return { success: true, notFound: false, isTerminal: false, status: "CANCELLED", deployment: updatedRows[0] };
    }

    // Check final status
    const current = await prisma.deployment.findUnique({ where: { id: deploymentId } });
    return {
      success: current?.status === "CANCELLED",
      notFound: false,
      isTerminal:
        current?.status === "RUNNING" ||
        current?.status === "STOPPED" ||
        current?.status === "CRASHED" ||
        current?.status === "FAILED",
      status: current?.status,
      deployment: current || undefined,
    };
  }

  /**
   * Recovers stale deployments whose worker leases have expired:
   * - STARTING deployments: 30-second lease threshold (STALE_STARTUP_LEASE_THRESHOLD_SECONDS).
   * - INITIALIZING / BUILDING deployments: 120-second lease threshold (STALE_BUILD_LEASE_THRESHOLD_SECONDS).
   * Live deployments with active heartbeats are never touched.
   */
  public async recoverStaleDeployments(): Promise<number> {
    const now = Date.now();
    const buildCutoff = new Date(now - STALE_BUILD_LEASE_THRESHOLD_SECONDS * 1000);
    const startupCutoff = new Date(now - STALE_STARTUP_LEASE_THRESHOLD_SECONDS * 1000);

    const staleRows = await prisma.deployment.findMany({
      where: {
        OR: [
          // 1. Stale builds (>120s missing heartbeat)
          {
            status: { in: [DeploymentStatus.INITIALIZING, DeploymentStatus.BUILDING] },
            OR: [
              { heartbeatAt: null },
              { heartbeatAt: { lt: buildCutoff } },
            ],
          },
          // 2. Stale container startups (>30s missing heartbeat)
          {
            status: DeploymentStatus.STARTING,
            OR: [
              { heartbeatAt: null },
              { heartbeatAt: { lt: startupCutoff } },
            ],
          },
        ],
      },
      select: { id: true, projectId: true, createdAt: true, status: true },
    });

    if (!staleRows || staleRows.length === 0) {
      return 0;
    }

    let recoveredCount = 0;

    for (const stale of staleRows) {
      const isStartup = stale.status === DeploymentStatus.STARTING;
      const cutoff = isStartup ? startupCutoff : buildCutoff;
      const thresholdSecs = isStartup ? STALE_STARTUP_LEASE_THRESHOLD_SECONDS : STALE_BUILD_LEASE_THRESHOLD_SECONDS;

      const updated = await prisma.deployment.updateMany({
        where: {
          id: stale.id,
          status: stale.status,
          OR: [
            { heartbeatAt: null },
            { heartbeatAt: { lt: cutoff } },
          ],
        },
        data: {
          status: DeploymentStatus.FAILED,
          completedAt: new Date(),
          exitCode: 1,
          errorMessage: isStartup
            ? `Deployment startup abandoned due to worker crash or lease expiration (>${thresholdSecs}s).`
            : `Deployment build abandoned due to worker crash or lease expiration (>${thresholdSecs}s).`,
        },
      });

      if (updated.count > 0) {
        recoveredCount += updated.count;

        await this.appendSystemLog(
          stale.id,
          `[SYSTEM] Worker lease expired (>${thresholdSecs}s). Deployment marked as FAILED.`
        );

        // Remove candidate container if any was started
        await stopDockerContainer(`cloudforge-app-${stale.id}`).catch(() => {});

        // Remove stranded workspace
        const workspaceDir = path.resolve(SCRATCH_ROOT_DIR, stale.id);
        if (fs.existsSync(workspaceDir)) {
          await cleanupWorkspace(workspaceDir);
        }

        // Sync project status using newest-only invariant
        await syncProjectStatus(stale.projectId, stale.createdAt, "failed");
      }
    }

    return recoveredCount;
  }

  /**
   * Periodically inspects deployments currently marked RUNNING.
   * If container exited, crashed, was OOM-killed, or disappeared, marks deployment CRASHED.
   * Synchronizes Project.status and Project.liveDeploymentId safely without overwriting newer promotions.
   *
   * Note on Architecture & Single-Docker-Host Assumption:
   * Distributed database coordination via `SystemLock` coordinates multiple backend processes.
   * However, in local engine mode, Docker runs on the local host. A database lock does not make
   * local Docker engines shared across different physical machines; running instances must share the Docker host.
   */
  public async reconcileRunningDeployments(
    inspectOverride?: (name: string) => Promise<{
      exists: boolean;
      running: boolean;
      exitCode?: number;
      oomKilled?: boolean;
      error?: string;
    }>
  ): Promise<number> {
    if (this.isReconciling) {
      return 0;
    }

    // Database-level distributed lock using SystemLock lease
    // Ensures only one worker across all instances reconciles at any given time.
    // Does NOT hold open any database transactions during subsequent Docker inspection.
    let lockAcquired = false;
    const now = new Date();
    const expiresAt = new Date(Date.now() + RECONCILER_LOCK_TTL_MS);

    try {
      const rowsUpdated = await prisma.$executeRaw`
        INSERT INTO "SystemLock" ("key", "holder", "acquiredAt", "expiresAt", "updatedAt")
        VALUES ('havn_reconciler', ${this.workerId}, ${now}, ${expiresAt}, ${now})
        ON CONFLICT ("key") DO UPDATE
        SET "holder" = ${this.workerId},
            "acquiredAt" = ${now},
            "expiresAt" = ${expiresAt},
            "updatedAt" = ${now}
        WHERE "SystemLock"."expiresAt" < ${now} OR "SystemLock"."holder" = ${this.workerId};
      `;

      lockAcquired = rowsUpdated > 0;
    } catch (dbErr) {
      console.error(`[DeploymentWorker ${this.workerId}] Error acquiring database reconciler lock:`, dbErr);
      return 0;
    }

    if (!lockAcquired) {
      return 0;
    }

    this.isReconciling = true;
    let transitionedCount = 0;

    try {
      const runningDeployments = await prisma.deployment.findMany({
        where: { status: "RUNNING" },
        select: {
          id: true,
          projectId: true,
          containerId: true,
          createdAt: true,
          project: {
            select: { liveDeploymentId: true, status: true },
          },
        },
        take: 50,
      });

      const inspector = inspectOverride || inspectContainerState;

      for (const dep of runningDeployments) {
        const containerName = `cloudforge-app-${dep.id}`;
        let state;
        try {
          state = await inspector(containerName);
        } catch {
          // Docker daemon temporarily unavailable or inspect timed out; do not make destructive assumptions
          continue;
        }

        if (state.exists && state.running) {
          // Container is alive and healthy; maintain state
          continue;
        }

        // Check if inspect timed out or daemon is unavailable before concluding dead
        if (!state.exists && (state.error?.includes("timed out") || state.error?.includes("unavailable"))) {
          continue;
        }

        // Container is confirmed dead, exited, OOM killed, or missing
        const isOom = Boolean(state.oomKilled);
        const exitCode = state.exitCode ?? (state.exists ? 1 : 137);
        const crashReason = isOom
          ? "Container terminated by host Out-Of-Memory (OOM) killer."
          : state.exists
          ? `Container process unexpectedly exited with exit code ${exitCode}.`
          : "Container instance disappeared or was stopped outside HAVN.";

        // Conditional atomic update: only update if still marked RUNNING
        const updated = await prisma.deployment.updateMany({
          where: {
            id: dep.id,
            status: "RUNNING",
          },
          data: {
            status: "CRASHED",
            completedAt: new Date(),
            exitCode,
            errorMessage: crashReason,
          },
        });

        if (updated.count > 0) {
          transitionedCount += updated.count;
          await this.appendSystemLog(dep.id, `[SYSTEM_CRASH] ${crashReason}`);

          // Synchronize Project state conditionally: only if this was the canonical live deployment at the moment of update
          await prisma.project.updateMany({
            where: {
              id: dep.projectId,
              liveDeploymentId: dep.id,
            },
            data: {
              status: "crashed",
              liveDeploymentId: null,
            },
          });
        }
      }
    } catch (err: any) {
      console.error(`[DeploymentWorker ${this.workerId}] Error during runtime reconciliation:`, err);
    } finally {
      this.isReconciling = false;
      try {
        await prisma.$executeRaw`
          UPDATE "SystemLock"
          SET "expiresAt" = '1970-01-01T00:00:00Z'::timestamptz
          WHERE "key" = 'havn_reconciler' AND "holder" = ${this.workerId};
        `;
      } catch (releaseErr) {
        console.error(`[DeploymentWorker ${this.workerId}] Error releasing reconciler lock:`, releaseErr);
      }
    }

    return transitionedCount;
  }

  private startHeartbeat(deploymentId: string): void {
    this.stopHeartbeat(deploymentId);

    const timer = setInterval(async () => {
      try {
        await prisma.$executeRaw`
          UPDATE "Deployment"
          SET "heartbeatAt" = NOW()
          WHERE "id" = ${deploymentId}
            AND "workerId" = ${this.workerId}
            AND "status" IN ('INITIALIZING'::"DeploymentStatus", 'BUILDING'::"DeploymentStatus", 'STARTING'::"DeploymentStatus");
        `;
      } catch (err) {
        console.error(`[DeploymentWorker ${this.workerId}] Heartbeat update failed for ${deploymentId}:`, err);
      }
    }, HEARTBEAT_INTERVAL_MS);

    this.heartbeatTimers.set(deploymentId, timer);
  }

  private stopHeartbeat(deploymentId: string): void {
    const timer = this.heartbeatTimers.get(deploymentId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(deploymentId);
    }
  }

  private async appendSystemLog(deploymentId: string, line: string): Promise<void> {
    try {
      const maxSeqResult = await prisma.buildLog.aggregate({
        where: { deploymentId },
        _max: { sequence: true },
      });
      const nextSequence = (maxSeqResult._max.sequence ?? 0) + 1;

      await prisma.buildLog.create({
        data: {
          deploymentId,
          line,
          stream: LogStream.SYSTEM,
          sequence: nextSequence,
        },
      });
    } catch {
      // Logging should never crash pipeline execution
    }
  }

  private async failOrphanDeployment(
    deploymentId: string,
    reason: string,
    createdAt: Date,
    projectId: string
  ): Promise<void> {
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        exitCode: 1,
        errorMessage: reason,
      },
    });
    await this.appendSystemLog(deploymentId, `[SYSTEM] ${reason}`);
    await syncProjectStatus(projectId, createdAt, "failed");
  }

  /**
   * Atomically promotes a healthy deployment to live for its project.
   * Serializes concurrent promotions on the Project row using PostgreSQL `FOR UPDATE`.
   * Enforces the Newest-Wins Deterministic Invariant:
   * - If a newer deployment is ALREADY live, this promotion is rejected, candidate container is stopped,
   *   and the live deployment is kept intact.
   * - If promoted, atomically updates Project.liveDeploymentId and Project.status = 'ready'.
   * - Only retires deployments that are strictly older than this deployment (createdAt < candidate.createdAt).
   */
  public async promoteDeployment(
    deploymentId: string,
    projectId: string,
    candidateCreatedAt: Date,
    candidateContainerName: string
  ): Promise<{ promoted: boolean; reason?: string }> {
    const promotion = await prisma.$transaction(async (tx) => {
      // 1. Lock the Project row for serialized promotion
      const projects = await tx.$queryRaw<Array<{ id: string; liveDeploymentId: string | null; status: string }>>`
        SELECT "id", "liveDeploymentId", "status"
        FROM "Project"
        WHERE "id" = ${projectId}
        FOR UPDATE;
      `;

      if (!projects || projects.length === 0) {
        return { promoted: false, reason: "Project record missing", retiredIds: [] };
      }

      const project = projects[0];

      // 2. Invariant: Check if a newer deployment has already been promoted and is currently live
      if (project.liveDeploymentId && project.liveDeploymentId !== deploymentId) {
        const liveDep = await tx.deployment.findUnique({
          where: { id: project.liveDeploymentId },
          select: { id: true, createdAt: true, status: true },
        });

        if (liveDep && liveDep.status === "RUNNING" && liveDep.createdAt > candidateCreatedAt) {
          return {
            promoted: false,
            reason: `Superseded by newer live deployment ${liveDep.id.substring(0, 8)} created at ${liveDep.createdAt.toISOString()}`,
            retiredIds: [],
          };
        }
      }

      // 3. Atomically update Project liveDeploymentId and status to ready
      await tx.project.update({
        where: { id: projectId },
        data: {
          liveDeploymentId: deploymentId,
          status: "ready",
        },
      });

      // 4. Update candidate deployment to RUNNING
      await tx.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "RUNNING",
          completedAt: new Date(),
          exitCode: 0,
          errorMessage: null,
        },
      });

      // 5. Query ONLY strictly older running deployments to retire
      const olderRunning = await tx.deployment.findMany({
        where: {
          projectId,
          id: { not: deploymentId },
          status: "RUNNING",
          createdAt: { lt: candidateCreatedAt }, // STRICT TIMESTAMP COMPARISON
        },
        select: { id: true },
      });

      const retiredIds: string[] = [];
      for (const oldDep of olderRunning) {
        await tx.deployment.update({
          where: { id: oldDep.id },
          data: {
            status: "STOPPED",
            completedAt: new Date(),
          },
        });
        retiredIds.push(oldDep.id);
      }

      return { promoted: true, retiredIds };
    });

    if (!promotion.promoted) {
      // Clean up candidate container without disturbing active live deployment
      await stopDockerContainer(candidateContainerName).catch(() => {});
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "STOPPED",
          errorMessage: promotion.reason,
        },
      });
      await this.appendSystemLog(
        deploymentId,
        `[SYSTEM] Promotion rejected: ${promotion.reason}. Candidate container stopped safely.`
      );
      return { promoted: false, reason: promotion.reason };
    }

    // Teardown retired older containers
    for (const oldId of promotion.retiredIds) {
      try {
        await stopDockerContainer(`cloudforge-app-${oldId}`);
        await this.appendSystemLog(
          oldId,
          `[SYSTEM] Container gracefully retired by newer live deployment ${deploymentId.substring(0, 8)}.`
        );
      } catch (teardownErr: any) {
        const errMsg = teardownErr?.message || String(teardownErr);
        console.error(`[Blue-Green] Failed to retire container for old deployment ${oldId}:`, errMsg);
        await this.appendSystemLog(
          oldId,
          `[SYSTEM_WARNING] Container retirement failed during blue-green handover: ${errMsg}. Container remains tracked for reconciliation.`
        );
      }
    }

    return { promoted: true };
  }

  /**
   * Starts application container, probes readiness, and performs atomic blue-green promotion.
   */
  public async executeStartupAndPromotion(
    deploymentId: string,
    projectId: string,
    imageTag: string,
    createdAt: Date,
    internalPort: number,
    abortSignal?: AbortSignal
  ): Promise<{ success: boolean; promoted: boolean; localUrl?: string; error?: string }> {
    try {
      this.startHeartbeat(deploymentId);

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "STARTING",
          internalPort,
        },
      });

      await this.appendSystemLog(
        deploymentId,
        `[SYSTEM] Starting container with internal port ${internalPort}...`
      );

      if (abortSignal?.aborted) {
        throw new Error("Deployment cancelled by user.");
      }

      const containerResult = await startApplicationContainer({
        deploymentId,
        projectId,
        imageTag,
        internalPort,
        abortSignal,
      });

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          containerId: containerResult.containerId,
          hostPort: containerResult.hostPort,
          localUrl: containerResult.localUrl,
        },
      });

      await this.appendSystemLog(
        deploymentId,
        `[SYSTEM] Container ${containerResult.containerId.substring(0, 12)} bound to ${containerResult.localUrl}. Probing application readiness...`
      );

      const probeResult = await probeApplicationReadiness(containerResult.hostPort, {
        timeoutMs: READINESS_TIMEOUT_MS,
        intervalMs: 1000,
        abortSignal,
      });

      if (probeResult.ready) {
        await this.appendSystemLog(
          deploymentId,
          `[SYSTEM] Application passed readiness probe (HTTP ${probeResult.statusCode}). Attempting promotion...`
        );

        const promoResult = await this.promoteDeployment(
          deploymentId,
          projectId,
          createdAt,
          containerResult.containerName
        );

        if (promoResult.promoted) {
          await this.appendSystemLog(
            deploymentId,
            `[SYSTEM] Deployment is LIVE at ${containerResult.localUrl}.`
          );
          return { success: true, promoted: true, localUrl: containerResult.localUrl };
        } else {
          return { success: true, promoted: false, localUrl: containerResult.localUrl, error: promoResult.reason };
        }
      } else {
        await this.appendSystemLog(
          deploymentId,
          `[SYSTEM] Application failed readiness check on port ${internalPort}: ${probeResult.error}`
        );
        await this.appendSystemLog(
          deploymentId,
          `[DIAGNOSTIC] Ensure your application binds to 0.0.0.0 instead of 127.0.0.1 so Docker port forwarding can reach your server.`
        );

        await stopDockerContainer(containerResult.containerName).catch(() => {});

        await prisma.deployment.update({
          where: { id: deploymentId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            exitCode: 1,
            errorMessage: probeResult.error,
          },
        });

        // If no other running deployment exists for the project, update project status to failed
        const otherRunning = await prisma.deployment.findFirst({
          where: {
            projectId,
            id: { not: deploymentId },
            status: "RUNNING",
          },
        });

        if (!otherRunning) {
          await syncProjectStatus(projectId, createdAt, "failed");
        }

        return { success: false, promoted: false, error: probeResult.error };
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[DeploymentWorker ${this.workerId}] Error starting container for ${deploymentId}:`, errMsg);
      await stopDockerContainer(`cloudforge-app-${deploymentId}`).catch(() => {});
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          exitCode: 1,
          errorMessage: errMsg,
        },
      });
      await this.appendSystemLog(deploymentId, `[SYSTEM] Container startup error: ${errMsg}`);
      return { success: false, promoted: false, error: errMsg };
    } finally {
      this.stopHeartbeat(deploymentId);
    }
  }

  /**
   * Executes asynchronous restart of a STOPPED or CRASHED deployment.
   * Runs container startup and readiness verification, respecting original deployment ordering.
   */
  public async executeRestart(deploymentId: string, projectId: string, imageTag: string, internalPort: number): Promise<void> {
    const dep = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { createdAt: true },
    });
    const createdAt = dep?.createdAt || new Date();
    await this.executeStartupAndPromotion(deploymentId, projectId, imageTag, createdAt, internalPort);
  }
}

// Export singleton worker instance for local backend execution
export const deploymentWorker = new DeploymentWorker();
