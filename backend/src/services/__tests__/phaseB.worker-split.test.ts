import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import prisma from "../../lib/prisma";
import { LogStream } from "@prisma/client";
import {
  DeploymentWorker,
  isDeploymentWorkerEnabled,
} from "../deployment.worker";
import { BuildLogBatcher, executeDockerBuild } from "../docker.service";
import { SCRATCH_ROOT_DIR } from "../../constants/build.constants";
import {
  getDeploymentRuntime,
  getDeploymentRuntimeLogs,
  stopDeploymentHandler,
} from "../../controllers/deployment.controller";
import { deleteUserProject } from "../project.service";
import {
  validateWorkerEnvironment,
  runWorkerPreflights,
  startStandaloneWorker,
} from "../../worker";

function createMockResponse() {
  let statusCode = 200;
  let body: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: any) {
      body = payload;
      return res;
    },
  };
  return {
    res,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

async function runPhaseBTests() {
  console.log("==================================================================");
  console.log("  PHASE B: API/WORKER SPLIT & DOCKER RUNNER REGRESSION SUITE      ");
  console.log("==================================================================\n");

  const savedEnv = {
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_DEPLOYMENT_WORKER: process.env.ENABLE_DEPLOYMENT_WORKER,
    DATABASE_URL: process.env.DATABASE_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  };

  const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const createdUserIds: string[] = [];

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Environment Gating Matrix
    // ------------------------------------------------------------------------
    console.log("[TEST 1/6] Checking ENABLE_DEPLOYMENT_WORKER gating matrix...");
    assert.strictEqual(isDeploymentWorkerEnabled({ NODE_ENV: "development" }), true);
    assert.strictEqual(isDeploymentWorkerEnabled({ NODE_ENV: "test" }), true);
    assert.strictEqual(isDeploymentWorkerEnabled({ NODE_ENV: "production" }), false);
    assert.strictEqual(
      isDeploymentWorkerEnabled({ NODE_ENV: "development", ENABLE_DEPLOYMENT_WORKER: "false" }),
      false
    );
    assert.strictEqual(
      isDeploymentWorkerEnabled({ NODE_ENV: "production", ENABLE_DEPLOYMENT_WORKER: "true" }),
      true
    );
    assert.strictEqual(
      isDeploymentWorkerEnabled({ NODE_ENV: "production", ENABLE_DEPLOYMENT_WORKER: "1" }),
      true
    );
    assert.strictEqual(
      isDeploymentWorkerEnabled({ NODE_ENV: "development", ENABLE_DEPLOYMENT_WORKER: "0" }),
      false
    );
    console.log("   ✓ Environment gating matrix enforced cleanly\n");

    // ------------------------------------------------------------------------
    // TEST 2: API-Only Mode Never Claims Jobs & Gates Docker Calls
    // ------------------------------------------------------------------------
    console.log("[TEST 2/6] Verifying API-only mode never claims jobs or requires local Docker...");
    const apiUser = await prisma.user.create({
      data: {
        name: "PhaseB API User",
        email: `phaseb-api-${unique}@example.com`,
        provider: "credentials",
      },
    });
    createdUserIds.push(apiUser.id);

    const apiProject = await prisma.project.create({
      data: {
        userId: apiUser.id,
        name: `phaseb-api-proj-${unique}`,
        status: "building",
      },
    });

    const queuedDep = await prisma.deployment.create({
      data: {
        projectId: apiProject.id,
        status: "QUEUED",
        repositoryName: "havn-test/api-only",
        repositoryUrl: "https://github.com/havn-test/api-only",
        branch: "main",
      },
    });

    const staleDep = await prisma.deployment.create({
      data: {
        projectId: apiProject.id,
        status: "BUILDING",
        workerId: "remote-local-worker",
        heartbeatAt: new Date(Date.now() - 10 * 60 * 1000),
        startedAt: new Date(Date.now() - 11 * 60 * 1000),
        repositoryName: "havn-test/api-only",
        repositoryUrl: "https://github.com/havn-test/api-only",
        branch: "main",
      },
    });

    const runningDep = await prisma.deployment.create({
      data: {
        projectId: apiProject.id,
        status: "RUNNING",
        containerId: "deadbeef12345678",
        hostPort: 49155,
        internalPort: 3000,
        localUrl: "http://localhost:49155",
        repositoryName: "havn-test/api-only",
        repositoryUrl: "https://github.com/havn-test/api-only",
        branch: "main",
      },
    });

    await prisma.project.update({
      where: { id: apiProject.id },
      data: { liveDeploymentId: runningDep.id, status: "ready" },
    });

    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_DEPLOYMENT_WORKER;

    const apiWorker = new DeploymentWorker(`api-only-${unique}`);
    await apiWorker.start();
    assert.strictEqual(apiWorker.stopped, true, "Worker must remain stopped in API-only mode");
    apiWorker.notify();
    await apiWorker.processNext();
    await apiWorker.recoverStaleDeployments();

    let inspectCalled = false;
    const apiReconcileCount = await apiWorker.reconcileRunningDeployments(async () => {
      inspectCalled = true;
      return { exists: false, running: false };
    });
    assert.strictEqual(apiReconcileCount, 0);
    assert.strictEqual(inspectCalled, false, "API-only process must not run container reconciler");

    const queuedCheck = await prisma.deployment.findUnique({ where: { id: queuedDep.id } });
    const staleCheck = await prisma.deployment.findUnique({ where: { id: staleDep.id } });
    const runningCheck = await prisma.deployment.findUnique({ where: { id: runningDep.id } });
    assert.strictEqual(queuedCheck?.status, "QUEUED");
    assert.strictEqual(queuedCheck?.workerId, null);
    assert.strictEqual(staleCheck?.status, "BUILDING");
    assert.strictEqual(runningCheck?.status, "RUNNING");

    // Controller runtime & log endpoints remain responsive in API-only mode
    const runtimeMock = createMockResponse();
    await getDeploymentRuntime(
      { user: { id: apiUser.id }, params: { deploymentId: runningDep.id } } as any,
      runtimeMock.res
    );
    assert.strictEqual(runtimeMock.getStatus(), 200);
    assert.strictEqual(runtimeMock.getBody()?.workerAvailable, false);
    assert.strictEqual(runtimeMock.getBody()?.deployment?.containerRunning, true);

    const logsMock = createMockResponse();
    await getDeploymentRuntimeLogs(
      { user: { id: apiUser.id }, params: { deploymentId: runningDep.id } } as any,
      logsMock.res
    );
    assert.strictEqual(logsMock.getStatus(), 200);
    assert.strictEqual(logsMock.getBody()?.workerAvailable, false);
    assert.deepStrictEqual(logsMock.getBody()?.logs, []);

    // Stop updates DB cleanly without requiring local Docker
    const stopMock = createMockResponse();
    await stopDeploymentHandler(
      { user: { id: apiUser.id }, params: { deploymentId: runningDep.id } } as any,
      stopMock.res
    );
    assert.strictEqual(stopMock.getStatus(), 200);
    const stoppedRow = await prisma.deployment.findUnique({ where: { id: runningDep.id } });
    assert.strictEqual(stoppedRow?.status, "STOPPED");

    // Cancel updates QUEUED -> CANCELLED on API host
    const cancelRes = await apiWorker.cancelDeployment(queuedDep.id, apiUser.id);
    assert.strictEqual(cancelRes.success, true);
    const cancelledRow = await prisma.deployment.findUnique({ where: { id: queuedDep.id } });
    assert.strictEqual(cancelledRow?.status, "CANCELLED");

    // Delete project succeeds in API-only mode without invoking local Docker cleanup
    const deletedProject = await deleteUserProject(apiProject.id, apiUser.id);
    assert.ok(deletedProject);
    console.log("   ✓ API-only mode stays inert for jobs and safe for controller endpoints\n");

    // ------------------------------------------------------------------------
    // TEST 3: Worker Preflights & Standalone Entrypoint Lifecycle
    // ------------------------------------------------------------------------
    console.log("[TEST 3/6] Verifying standalone worker env validation, preflights & stop signal...");
    const badDbUrl = "postgresql://user:supersecretpassword@localhost:5432/havn";
    const missingEnvCheck = validateWorkerEnvironment({ DATABASE_URL: "", ENCRYPTION_KEY: "" });
    assert.strictEqual(missingEnvCheck.valid, false);
    assert.strictEqual(missingEnvCheck.errors.length, 2);

    const invalidProtoCheck = validateWorkerEnvironment({
      DATABASE_URL: "http://user:supersecretpassword@localhost:5432/havn",
      ENCRYPTION_KEY: "too-short-secret-value",
    });
    assert.strictEqual(invalidProtoCheck.valid, false);
    const combinedErrors = invalidProtoCheck.errors.join(" ");
    assert.strictEqual(combinedErrors.includes("supersecretpassword"), false);
    assert.strictEqual(combinedErrors.includes("too-short-secret-value"), false);

    const validEnvCheck = validateWorkerEnvironment({
      DATABASE_URL: badDbUrl,
      ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    });
    assert.strictEqual(validEnvCheck.valid, true);

    await assert.rejects(
      runWorkerPreflights({
        env: {
          DATABASE_URL: badDbUrl,
          ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        },
        checkDatabase: async () => {
          throw new Error(`Cannot reach ${badDbUrl}`);
        },
        checkDocker: async () => {},
      }),
      (err: any) => {
        assert.ok(err.message.includes("PostgreSQL connectivity check failed"));
        assert.strictEqual(err.message.includes("supersecretpassword"), false);
        return true;
      }
    );

    await assert.rejects(
      runWorkerPreflights({
        env: {
          DATABASE_URL: badDbUrl,
          ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        },
        checkDatabase: async () => {},
        checkDocker: async () => {
          throw new Error("Docker daemon stopped");
        },
      }),
      /Docker daemon availability check failed/
    );

    const tempRuntimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "havn-worker-runtime-"));
    try {
      await assert.rejects(
        startStandaloneWorker({
          runtimeDir: tempRuntimeDir,
          preflights: {
            env: {
              DATABASE_URL: badDbUrl,
              ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
              ENABLE_DEPLOYMENT_WORKER: "false",
            },
            checkDatabase: async () => {},
            checkDocker: async () => {},
          },
        }),
        /ENABLE_DEPLOYMENT_WORKER is disabled/
      );

      let disconnected = false;
      const standaloneEnv: NodeJS.ProcessEnv = {
        NODE_ENV: "production",
        DATABASE_URL: process.env.DATABASE_URL,
        ENCRYPTION_KEY:
          process.env.ENCRYPTION_KEY ||
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      };
      // Ensure global worker gate reflects worker startup cleanly
      process.env.ENABLE_DEPLOYMENT_WORKER = "true";
      const standaloneWorker = new DeploymentWorker(`standalone-${unique}`);
      // Prevent immediate reconciler collision if SystemLock exists; use empty test project state
      const handle = await startStandaloneWorker({
        worker: standaloneWorker,
        runtimeDir: tempRuntimeDir,
        pollStopSignalMs: 25,
        disconnectDb: async () => {
          disconnected = true;
        },
        preflights: {
          env: standaloneEnv,
          checkDatabase: async () => {
            await prisma.$queryRaw`SELECT 1`;
          },
          checkDocker: async () => {},
        },
      });

      assert.strictEqual(standaloneEnv.ENABLE_DEPLOYMENT_WORKER, "true");
      assert.strictEqual(standaloneWorker.stopped, false);
      assert.strictEqual(fs.existsSync(handle.pidFile), true);

      // Simulate `npm run worker:stop` writing the stop signal file
      fs.writeFileSync(handle.stopFile, "stop", "utf8");
      await new Promise((resolve) => setTimeout(resolve, 150));

      assert.strictEqual(standaloneWorker.stopped, true);
      assert.strictEqual(disconnected, true);
      assert.strictEqual(fs.existsSync(handle.pidFile), false);
      assert.strictEqual(fs.existsSync(handle.stopFile), false);
    } finally {
      fs.rmSync(tempRuntimeDir, { recursive: true, force: true });
    }
    console.log("   ✓ Standalone worker preflights, PID file, and stop-signal shutdown verified\n");

    // ------------------------------------------------------------------------
    // TEST 4: Cross-Process Atomic Claiming & Concurrency
    // ------------------------------------------------------------------------
    console.log("[TEST 4/6] Verifying cross-process PostgreSQL FIFO claiming & concurrency safety...");
    process.env.NODE_ENV = "development";
    process.env.ENABLE_DEPLOYMENT_WORKER = "true";

    const raceUser = await prisma.user.create({
      data: {
        name: "PhaseB Worker User",
        email: `phaseb-worker-${unique}@example.com`,
        provider: "credentials",
      },
    });
    createdUserIds.push(raceUser.id);

    const raceProj = await prisma.project.create({
      data: {
        userId: raceUser.id,
        name: `phaseb-race-proj-${unique}`,
        status: "idle",
      },
    });

    const d1 = await prisma.deployment.create({
      data: {
        projectId: raceProj.id,
        status: "QUEUED",
        repositoryName: "havn-test/race",
        repositoryUrl: "https://github.com/havn-test/race",
        branch: "main",
        createdAt: new Date(Date.now() - 2000),
      },
    });

    const d2 = await prisma.deployment.create({
      data: {
        projectId: raceProj.id,
        status: "QUEUED",
        repositoryName: "havn-test/race",
        repositoryUrl: "https://github.com/havn-test/race",
        branch: "main",
        createdAt: new Date(Date.now() - 1000),
      },
    });

    const wA = new DeploymentWorker(`workerA-${unique}`);
    const wB = new DeploymentWorker(`workerB-${unique}`);

    const [claimedA, claimedB] = await Promise.all([
      (wA as any).claimNextDeployment(),
      (wB as any).claimNextDeployment(),
    ]);

    assert.ok(claimedA && claimedB, "Both concurrent workers should claim disjoint jobs");
    assert.notStrictEqual(claimedA.id, claimedB.id, "SKIP LOCKED must prevent duplicate claims");
    assert.deepStrictEqual(
      new Set([claimedA.id, claimedB.id]),
      new Set([d1.id, d2.id])
    );
    console.log("   ✓ Concurrent PostgreSQL SKIP LOCKED claiming verified\n");

    // ------------------------------------------------------------------------
    // TEST 5: Cross-Process Remote Cancellation via Heartbeat & Terminal Guard
    // ------------------------------------------------------------------------
    console.log("[TEST 5/6] Verifying heartbeat remote-cancellation abort & promotion immutability...");
    const cancelDep = await prisma.deployment.create({
      data: {
        projectId: raceProj.id,
        status: "QUEUED",
        repositoryName: "havn-test/cancel-sync",
        repositoryUrl: "https://github.com/havn-test/cancel-sync",
        branch: "main",
      },
    });

    let workspaceStartedResolve: () => void;
    const workspaceStartedPromise = new Promise<void>((resolve) => {
      workspaceStartedResolve = resolve;
    });

    let abortedInsideBuild = false;
    const buildWorker = new DeploymentWorker(`cancel-worker-${unique}`, async (_depId, _userId, opts) => {
      workspaceStartedResolve();
      await new Promise<void>((_, reject) => {
        if (opts?.abortSignal?.aborted) {
          abortedInsideBuild = true;
          return reject(new Error("Deployment cancelled by user."));
        }
        opts?.abortSignal?.addEventListener(
          "abort",
          () => {
            abortedInsideBuild = true;
            reject(new Error("Deployment cancelled by user."));
          },
          { once: true }
        );
      });
    });

    const processPromise = buildWorker.processNext();
    await workspaceStartedPromise;

    // Render API cancels deployment in DB while local worker is executing build
    await apiWorker.cancelDeployment(cancelDep.id, raceUser.id);
    const beatContinued = await buildWorker.pulseHeartbeat(cancelDep.id);
    assert.strictEqual(beatContinued, false, "Heartbeat must detect remote CANCELLED state");

    await processPromise;
    assert.strictEqual(abortedInsideBuild, true, "Heartbeat must abort in-flight local execution");

    const cancelAfterRun = await prisma.deployment.findUnique({ where: { id: cancelDep.id } });
    assert.strictEqual(cancelAfterRun?.status, "CANCELLED");

    // Verify promoteDeployment also refuses to overwrite CANCELLED
    const latePromo = await buildWorker.promoteDeployment(
      cancelDep.id,
      raceProj.id,
      cancelDep.createdAt,
      `cloudforge-app-${cancelDep.id}`
    );
    assert.strictEqual(latePromo.promoted, false);
    const cancelAfterPromo = await prisma.deployment.findUnique({ where: { id: cancelDep.id } });
    assert.strictEqual(cancelAfterPromo?.status, "CANCELLED");
    buildWorker.stop();
    console.log("   ✓ Remote cancellation abort and terminal state immutability verified\n");

    // ------------------------------------------------------------------------
    // TEST 6: Cross-Process Container Reconciliation Sweep
    // ------------------------------------------------------------------------
    console.log("[TEST 6/6] Verifying local reconciler cleans up containers stopped/deleted on API...");
    await prisma.systemLock.deleteMany({ where: { key: "havn_reconciler" } }).catch(() => {});

    const stoppedDep = await prisma.deployment.create({
      data: {
        projectId: raceProj.id,
        status: "STOPPED",
        repositoryName: "havn-test/reconcile",
        repositoryUrl: "https://github.com/havn-test/reconcile",
        branch: "main",
      },
    });
    const cancelledDep = await prisma.deployment.create({
      data: {
        projectId: raceProj.id,
        status: "CANCELLED",
        repositoryName: "havn-test/reconcile",
        repositoryUrl: "https://github.com/havn-test/reconcile",
        branch: "main",
      },
    });
    const liveDep = await prisma.deployment.create({
      data: {
        projectId: raceProj.id,
        status: "RUNNING",
        repositoryName: "havn-test/reconcile",
        repositoryUrl: "https://github.com/havn-test/reconcile",
        branch: "main",
      },
    });
    const deletedDepId = `deleted-${unique}`;

    const reconcilerWorker = new DeploymentWorker(`reconciler-${unique}`);
    const stoppedContainers: string[] = [];

    const transitioned = await reconcilerWorker.reconcileRunningDeployments(
      async () => ({ exists: true, running: true }),
      undefined,
      async () => [
        { containerName: `cloudforge-app-${stoppedDep.id}`, deploymentId: stoppedDep.id, state: "running" },
        { containerName: `cloudforge-app-${cancelledDep.id}`, deploymentId: cancelledDep.id, state: "running" },
        { containerName: `cloudforge-app-${deletedDepId}`, deploymentId: deletedDepId, state: "running" },
        { containerName: `cloudforge-app-${liveDep.id}`, deploymentId: liveDep.id, state: "running" },
      ],
      async (containerName) => {
        stoppedContainers.push(containerName);
      }
    );

    assert.strictEqual(transitioned, 0);
    assert.deepStrictEqual(new Set(stoppedContainers), new Set([
      `cloudforge-app-${stoppedDep.id}`,
      `cloudforge-app-${cancelledDep.id}`,
      `cloudforge-app-${deletedDepId}`,
    ]));
    assert.strictEqual(stoppedContainers.includes(`cloudforge-app-${liveDep.id}`), false);
    console.log("   ✓ Container reconciliation removes remote-stopped/cancelled/deleted containers safely\n");

    // ------------------------------------------------------------------------
    // TEST 7: BUG 1 — activeAborts Cleanup After Cached-Image Fast-Path Restart
    // ------------------------------------------------------------------------
    console.log("[TEST 7/8] Verifying activeAborts cleanup on cached-image restart fast path...");
    process.env.ENABLE_DEPLOYMENT_WORKER = "true";
    const fastProj = await prisma.project.create({
      data: {
        userId: raceUser.id,
        name: `phaseb-fastpath-${unique}`,
        status: "stopped",
      },
    });

    const cachedImageTag = `cloudforge/deployment-fast-${unique}:abc1234`;
    const fastDepSuccess = await prisma.deployment.create({
      data: {
        projectId: fastProj.id,
        status: "INITIALIZING",
        imageTag: cachedImageTag,
        internalPort: 3000,
        repositoryName: "havn-test/fastpath",
        repositoryUrl: "https://github.com/havn-test/fastpath",
        branch: "main",
      },
    });

    const fastWorker = new DeploymentWorker(
      `fast-worker-${unique}`,
      undefined,
      {
        inspectImageSize: async () => 1024 * 1024,
        inspectExposedPort: async () => 3000,
      }
    );

    let sawActiveAbortInsideFastPath = false;
    (fastWorker as any).executeStartupAndPromotion = async (
      depId: string,
      projId: string,
      _img: string,
      _createdAt: Date,
      _port: number,
      signal?: AbortSignal
    ) => {
      sawActiveAbortInsideFastPath = fastWorker.hasActiveAbort(depId) && Boolean(signal);
      if (depId === fastDepSuccess.id) {
        await prisma.deployment.update({
          where: { id: depId },
          data: { status: "RUNNING", containerId: `cid-${depId}`, hostPort: 45123, localUrl: "http://localhost:45123" },
        });
        await prisma.project.update({
          where: { id: projId },
          data: { status: "ready", liveDeploymentId: depId },
        });
        return { success: true, promoted: true, localUrl: "http://localhost:45123" };
      }
      throw new Error("Simulated fast-path startup exception");
    };

    await (fastWorker as any).executePipeline(fastDepSuccess);
    assert.strictEqual(sawActiveAbortInsideFastPath, true, "activeAborts must remain present while restart is active");
    assert.strictEqual(fastWorker.hasActiveAbort(fastDepSuccess.id), false, "activeAborts must be cleared after fast-path success");

    // Verify fast-path exception / failure also cleans activeAborts
    const fastDepErr = await prisma.deployment.create({
      data: {
        projectId: fastProj.id,
        status: "INITIALIZING",
        imageTag: cachedImageTag,
        internalPort: 3000,
        repositoryName: "havn-test/fastpath",
        repositoryUrl: "https://github.com/havn-test/fastpath",
        branch: "main",
      },
    });
    await assert.rejects(
      (fastWorker as any).executePipeline(fastDepErr),
      /Simulated fast-path startup exception/
    );
    assert.strictEqual(fastWorker.hasActiveAbort(fastDepErr.id), false, "activeAborts must be cleared after fast-path exception");

    // Verify fast-path cancellation also cleans activeAborts
    const fastDepCancel = await prisma.deployment.create({
      data: {
        projectId: fastProj.id,
        status: "INITIALIZING",
        imageTag: cachedImageTag,
        internalPort: 3000,
        repositoryName: "havn-test/fastpath",
        repositoryUrl: "https://github.com/havn-test/fastpath",
        branch: "main",
      },
    });
    (fastWorker as any).executeStartupAndPromotion = async (depId: string, _p: string, _i: string, _c: Date, _pt: number, signal?: AbortSignal) => {
      await fastWorker.cancelDeployment(depId, raceUser.id);
      assert.strictEqual(signal?.aborted, true);
      return { success: false, promoted: false, error: "Deployment cancelled by user." };
    };
    await (fastWorker as any).executePipeline(fastDepCancel);
    assert.strictEqual(fastWorker.hasActiveAbort(fastDepCancel.id), false, "activeAborts must be cleared after fast-path cancellation");

    // Verify remote project deletion cleans container on SAME worker without restarting worker
    process.env.ENABLE_DEPLOYMENT_WORKER = "false";
    await deleteUserProject(fastProj.id, raceUser.id);
    process.env.ENABLE_DEPLOYMENT_WORKER = "true";

    const cleanedOnSameWorker: string[] = [];
    await fastWorker.reconcileRunningDeployments(
      async () => ({ exists: true, running: true }),
      undefined,
      async () => [
        { containerName: `cloudforge-app-${fastDepSuccess.id}`, deploymentId: fastDepSuccess.id, state: "running" },
      ],
      async (name) => {
        cleanedOnSameWorker.push(name);
      }
    );
    assert.strictEqual(
      cleanedOnSameWorker.includes(`cloudforge-app-${fastDepSuccess.id}`),
      true,
      "Same worker must clean up restarted deployment container after remote project deletion"
    );

    // Verify remote stop & crashed reconciliation still work
    const reconProj2 = await prisma.project.create({
      data: { userId: raceUser.id, name: `phaseb-fastrecon-${unique}`, status: "ready" },
    });
    const remoteStoppedDep = await prisma.deployment.create({
      data: {
        projectId: reconProj2.id,
        status: "STOPPED",
        repositoryName: "havn-test/fastpath",
        repositoryUrl: "https://github.com/havn-test/fastpath",
        branch: "main",
      },
    });
    const crashedDep = await prisma.deployment.create({
      data: {
        projectId: reconProj2.id,
        status: "RUNNING",
        repositoryName: "havn-test/fastpath",
        repositoryUrl: "https://github.com/havn-test/fastpath",
        branch: "main",
      },
    });
    await prisma.project.update({
      where: { id: reconProj2.id },
      data: { liveDeploymentId: crashedDep.id },
    });
    const cleanedStopped: string[] = [];
    const crashedTransitions = await fastWorker.reconcileRunningDeployments(
      async (name) =>
        name === `cloudforge-app-${crashedDep.id}`
          ? { exists: true, running: false, exitCode: 137 }
          : { exists: true, running: true },
      undefined,
      async () => [
        { containerName: `cloudforge-app-${remoteStoppedDep.id}`, deploymentId: remoteStoppedDep.id, state: "running" },
        { containerName: `cloudforge-app-${crashedDep.id}`, deploymentId: crashedDep.id, state: "running" },
      ],
      async (name) => {
        cleanedStopped.push(name);
      }
    );
    const crashedAfter = await prisma.deployment.findUnique({ where: { id: crashedDep.id } });
    assert.strictEqual(crashedTransitions, 1);
    assert.strictEqual(crashedAfter?.status, "CRASHED");
    assert.strictEqual(cleanedStopped.includes(`cloudforge-app-${remoteStoppedDep.id}`), true);
    fastWorker.stop();
    console.log("   ✓ activeAborts fast-path cleanup and post-restart reconciliation verified\n");

    // ------------------------------------------------------------------------
    // TEST 8: BUG 2 — BuildLogBatcher P2002 Race Prevention During Cancellation
    // ------------------------------------------------------------------------
    console.log("[TEST 8/8] Verifying BuildLogBatcher & cancelDeployment concurrent sequence safety...");
    const raceLogDep = await prisma.deployment.create({
      data: {
        projectId: reconProj2.id,
        status: "BUILDING",
        workerId: "log-race-worker",
        repositoryName: "havn-test/lograce",
        repositoryUrl: "https://github.com/havn-test/lograce",
        branch: "main",
      },
    });

    const raceBatcher = new BuildLogBatcher(raceLogDep.id, 0);
    for (let i = 1; i <= 20; i++) {
      raceBatcher.pushLine(`Docker build step #${i}`, LogStream.STDOUT);
    }

    // Concurrent cancellation inserts sequence=1 before batcher flushes lines queued at 1..20
    await apiWorker.cancelDeployment(raceLogDep.id, raceUser.id);
    for (let i = 21; i <= 25; i++) {
      raceBatcher.pushLine(`Docker trailing line #${i}`, LogStream.STDERR);
    }

    // Concurrently flush buffered build logs while worker also appends cancellation completion system log
    await Promise.all([
      raceBatcher.flushAll(),
      reconcilerWorker.appendSystemLog(raceLogDep.id, "[SYSTEM] Deployment execution cancelled by user."),
    ]);

    const persistedRaceLogs = await prisma.buildLog.findMany({
      where: { deploymentId: raceLogDep.id },
      orderBy: { sequence: "asc" },
    });

    const raceSeqs = persistedRaceLogs.map((l) => l.sequence);
    assert.strictEqual(new Set(raceSeqs).size, persistedRaceLogs.length, "All BuildLog sequence numbers must be strictly unique");
    assert.strictEqual(persistedRaceLogs.length, 27, "All 25 buffered build lines + 2 cancellation system logs must persist");
    for (let i = 1; i <= 25; i++) {
      const expectedLine = i <= 20 ? `Docker build step #${i}` : `Docker trailing line #${i}`;
      assert.strictEqual(
        persistedRaceLogs.some((l) => l.line === expectedLine),
        true,
        `Buffered build log "${expectedLine}" must not be lost`
      );
    }
    assert.strictEqual(
      persistedRaceLogs.some((l) => l.line.includes("Deployment cancellation requested")),
      true
    );
    assert.strictEqual(
      persistedRaceLogs.some((l) => l.line.includes("Deployment execution cancelled by user")),
      true
    );
    // Relative order of batcher lines 1..25 must remain strictly increasing
    const buildLineSeqs = persistedRaceLogs
      .filter((l) => l.line.startsWith("Docker "))
      .map((l) => l.sequence);
    for (let i = 1; i < buildLineSeqs.length; i++) {
      assert.ok(buildLineSeqs[i] > buildLineSeqs[i - 1], "Build log sequences must stay strictly increasing");
    }

    // Also test executeDockerBuild aborted mid-flight concurrently with cancelDeployment
    const execBuildDep = await prisma.deployment.create({
      data: {
        projectId: reconProj2.id,
        status: "INITIALIZING",
        workerId: "docker-exec-worker",
        repositoryName: "havn-test/exec-cancel",
        repositoryUrl: "https://github.com/havn-test/exec-cancel",
        branch: "main",
      },
    });
    const execWorkspaceDir = path.resolve(SCRATCH_ROOT_DIR, execBuildDep.id);
    const execRepoDir = path.join(execWorkspaceDir, "repo");
    fs.mkdirSync(execRepoDir, { recursive: true });
    fs.writeFileSync(path.join(execRepoDir, "Dockerfile"), "FROM alpine:latest\n");

    const buildAbort = new AbortController();
    await assert.rejects(
      executeDockerBuild(
        {
          deploymentId: execBuildDep.id,
          workspaceDir: execWorkspaceDir,
          repoDir: execRepoDir,
          dockerfilePath: "Dockerfile",
          commitSha: "abcdef1234567890",
          commitMsg: "test",
          commitAuthor: "test",
          imageTag: `cloudforge/deployment-${execBuildDep.id}:abcdef1`,
        },
        undefined,
        {
          abortSignal: buildAbort.signal,
          verifyDaemonOverride: async () => {
            // Cancel deployment concurrently while executeDockerBuild initializes and starts log batcher
            await apiWorker.cancelDeployment(execBuildDep.id, raceUser.id);
            buildAbort.abort();
          },
        }
      ),
      /cancelled by user/
    );

    const execLogs = await prisma.buildLog.findMany({
      where: { deploymentId: execBuildDep.id },
      orderBy: { sequence: "asc" },
    });
    const execSeqs = execLogs.map((l) => l.sequence);
    assert.strictEqual(new Set(execSeqs).size, execLogs.length, "executeDockerBuild cancel logs must have unique sequences");
    assert.strictEqual(execLogs.some((l) => l.line.includes("Starting Docker image build")), true);
    assert.strictEqual(execLogs.some((l) => l.line.includes("Deployment cancellation requested")), true);
    assert.strictEqual(execLogs.some((l) => l.line.includes("cancelled by user")), true);
    console.log("   ✓ Concurrent log flush & cancellation sequence collision cleanly resolved without data loss\n");

    console.log("==================================================================");
    console.log("  ALL PHASE B WORKER-SPLIT & SYNC REGRESSION TESTS PASSED!        ");
    console.log("==================================================================");
  } finally {
    for (const userId of createdUserIds) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
    await prisma.systemLock.deleteMany({ where: { key: "havn_reconciler" } }).catch(() => {});
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    await prisma.$disconnect();
  }
}

runPhaseBTests().catch(async (err) => {
  console.error("Phase B test failed:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
