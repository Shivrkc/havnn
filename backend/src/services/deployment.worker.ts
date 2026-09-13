import path from "path";
import fs from "fs";
import prisma from "../lib/prisma";
import { LogStream, Deployment, DeploymentStatus } from "@prisma/client";
import { prepareDeploymentWorkspace } from "./deployment.service";
import { executeDockerBuild, deleteDockerImage } from "./docker.service";
import { sanitizeErrorMessage } from "../utils/sanitizer";
import { cleanupWorkspace } from "./git.service";
import { decryptToken } from "../utils/crypto";
import { SCRATCH_ROOT_DIR } from "../constants/build.constants";

export const STALE_LEASE_THRESHOLD_SECONDS = 120;
export const HEARTBEAT_INTERVAL_MS = 30000;
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
  private safetyPollTimer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
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
   * Starts the background worker, safety poller, and crash recovery reaper.
   */
  public async start(): Promise<void> {
    this.isStopped = false;
    await this.recoverStaleDeployments();

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
        ORDER BY "createdAt" ASC
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

      // 6. Terminal BUILT verification
      const verified = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { status: true },
      });

      if (verified?.status === "BUILT") {
        await this.appendSystemLog(deploymentId, "[SYSTEM] Deployment execution completed successfully.");
        await syncProjectStatus(projectId, createdAt, "ready");
      }
    } catch (err: any) {
      const sanitized = sanitizeErrorMessage(err, githubToken);
      const isCancelled =
        abortController.signal.aborted ||
        sanitized.includes("cancelled by user") ||
        sanitized.includes("aborted");

      // Verify current DB status to preserve terminal immutability
      const current = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { status: true },
      });

      if (current && current.status !== "BUILT" && current.status !== "CANCELLED" && current.status !== "FAILED") {
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

    if (dep.status === "BUILT" || dep.status === "FAILED" || dep.status === "CANCELLED") {
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

    // 3. Cancellation for INITIALIZING or BUILDING deployment
    const updatedRows = await prisma.$queryRaw<Deployment[]>`
      UPDATE "Deployment"
      SET 
        "status" = 'CANCELLED'::"DeploymentStatus",
        "completedAt" = NOW(),
        "errorMessage" = 'Deployment cancelled by user.',
        "updatedAt" = NOW()
      WHERE "id" = ${deploymentId}
        AND "status" IN ('INITIALIZING'::"DeploymentStatus", 'BUILDING'::"DeploymentStatus")
      RETURNING *;
    `;

    if (updatedRows && updatedRows.length > 0) {
      // Trigger in-memory AbortController if worker is running it locally
      const controller = this.activeAborts.get(deploymentId);
      if (controller) {
        controller.abort();
      }

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
      isTerminal: current?.status === "BUILT" || current?.status === "FAILED",
      status: current?.status,
      deployment: current || undefined,
    };
  }

  /**
   * Recovers stale deployments whose worker leases have expired (> 120s missing heartbeat).
   * Live deployments with active heartbeats are never touched.
   */
  public async recoverStaleDeployments(): Promise<number> {
    const staleCutoff = new Date(Date.now() - STALE_LEASE_THRESHOLD_SECONDS * 1000);

    const staleRows = await prisma.deployment.findMany({
      where: {
        status: { in: [DeploymentStatus.INITIALIZING, DeploymentStatus.BUILDING] },
        OR: [
          { heartbeatAt: null },
          { heartbeatAt: { lt: staleCutoff } },
        ],
      },
      select: { id: true, projectId: true, createdAt: true },
    });

    if (!staleRows || staleRows.length === 0) {
      return 0;
    }

    let recoveredCount = 0;

    for (const stale of staleRows) {
      const updated = await prisma.deployment.updateMany({
        where: {
          id: stale.id,
          status: { in: [DeploymentStatus.INITIALIZING, DeploymentStatus.BUILDING] },
          OR: [
            { heartbeatAt: null },
            { heartbeatAt: { lt: staleCutoff } },
          ],
        },
        data: {
          status: DeploymentStatus.FAILED,
          completedAt: new Date(),
          exitCode: 1,
          errorMessage: "Deployment abandoned due to worker crash or lease expiration.",
        },
      });

      if (updated.count > 0) {
        recoveredCount += updated.count;

        await this.appendSystemLog(
          stale.id,
          "[SYSTEM] Worker heartbeat lease expired (>120s). Deployment marked as FAILED."
        );

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

  private startHeartbeat(deploymentId: string): void {
    this.stopHeartbeat(deploymentId);

    const timer = setInterval(async () => {
      try {
        await prisma.$executeRaw`
          UPDATE "Deployment"
          SET "heartbeatAt" = NOW()
          WHERE "id" = ${deploymentId}
            AND "workerId" = ${this.workerId}
            AND "status" IN ('INITIALIZING'::"DeploymentStatus", 'BUILDING'::"DeploymentStatus");
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
}

// Export singleton worker instance for local backend execution
export const deploymentWorker = new DeploymentWorker();
