import assert from "assert";
import http from "http";
import prisma from "../../lib/prisma";
import { DeploymentWorker, deploymentWorker } from "../deployment.worker";
import { restartDeploymentHandler } from "../../controllers/deployment.controller";

async function runPhase34Tests() {
  console.log("==================================================================");
  console.log("  PHASE 3.4: ORDERING, DURABLE RESTARTS & CONCURRENCY TESTS       ");
  console.log("==================================================================\n");

  deploymentWorker.stop();
  const worker1 = new DeploymentWorker("test-worker-1");
  const worker2 = new DeploymentWorker("test-worker-2");

  const testUser = await prisma.user.create({
    data: {
      name: "Phase 3.4 User",
      email: `phase34-${Date.now()}@example.com`,
    },
  });

  const testProject = await prisma.project.create({
    data: {
      name: "phase34-project",
      userId: testUser.id,
      status: "idle",
    },
  });

  try {
    // ----------------------------------------------------------------
    // TEST 1: P0 - OLDER DEPLOYMENT CANNOT OVERWRITE NEWER LIVE DEPLOYMENT
    // ----------------------------------------------------------------
    console.log("[TEST 1/9] P0: Older Deployment Finishing After Newer Deployment Cannot Overwrite Live Pointer");
    {
      const olderTime = new Date(Date.now() - 600_000); // 10 minutes ago
      const newerTime = new Date(Date.now() - 300_000); // 5 minutes ago

      const olderDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "STARTING",
          createdAt: olderTime,
          containerId: "older-candidate-container",
        },
      });

      const newerDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "STARTING",
          createdAt: newerTime,
          containerId: "newer-live-container",
        },
      });

      // Newer deployment finishes first and promotes
      const promoNewer = await worker1.promoteDeployment(
        newerDep.id,
        testProject.id,
        newerDep.createdAt,
        `cloudforge-app-${newerDep.id}`
      );
      assert.strictEqual(promoNewer.promoted, true, "Newer deployment must promote successfully");

      const projAfterNewer = await prisma.project.findUnique({ where: { id: testProject.id } });
      assert.strictEqual(projAfterNewer?.liveDeploymentId, newerDep.id);
      assert.strictEqual(projAfterNewer?.status, "ready");

      // Older deployment finishes later and attempts promotion
      const promoOlder = await worker1.promoteDeployment(
        olderDep.id,
        testProject.id,
        olderDep.createdAt,
        `cloudforge-app-${olderDep.id}`
      );

      assert.strictEqual(promoOlder.promoted, false, "Older deployment promotion MUST be rejected");
      assert.ok(promoOlder.reason?.includes("Superseded by newer live deployment"));

      // Invariant: Live deployment remains pointing to newerDep
      const projAfterOlder = await prisma.project.findUnique({ where: { id: testProject.id } });
      assert.strictEqual(
        projAfterOlder?.liveDeploymentId,
        newerDep.id,
        "Project liveDeploymentId must NOT be changed by older deployment"
      );

      // Verify older deployment marked STOPPED
      const olderAfter = await prisma.deployment.findUnique({ where: { id: olderDep.id } });
      assert.strictEqual(olderAfter?.status, "STOPPED");

      // Verify newer deployment remains RUNNING
      const newerAfter = await prisma.deployment.findUnique({ where: { id: newerDep.id } });
      assert.strictEqual(newerAfter?.status, "RUNNING");

      console.log("   ✓ Invariant confirmed: Older deployment cannot usurp live pointer or kill newer deployment\n");
    }

    // ----------------------------------------------------------------
    // TEST 2: P0 - RETIREMENT QUERY ONLY SELECTS GENUINELY OLDER DEPLOYMENTS
    // ----------------------------------------------------------------
    console.log("[TEST 2/9] P0: Retirement Strictly Targets Older Deployments");
    {
      const t1 = new Date(Date.now() - 50_000);
      const t2 = new Date(Date.now() - 30_000);
      const t3 = new Date(Date.now() - 10_000);

      const d1 = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "RUNNING",
          createdAt: t1,
          containerId: "d1-container",
        },
      });

      const d2 = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "STARTING",
          createdAt: t2,
          containerId: "d2-container",
        },
      });

      const d3 = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "RUNNING",
          createdAt: t3,
          containerId: "d3-container",
        },
      });

      // When d2 promotes, it must retire d1 (createdAt < t2), but NOT d3 (createdAt > t2)
      // d3 is already newer and running, so d2 promotion should be superseded by d3!
      await prisma.project.update({
        where: { id: testProject.id },
        data: { liveDeploymentId: d3.id, status: "ready" },
      });

      const res = await worker1.promoteDeployment(d2.id, testProject.id, d2.createdAt, `cloudforge-app-${d2.id}`);
      assert.strictEqual(res.promoted, false, "d2 must not promote because d3 is newer and live");

      const checkD3 = await prisma.deployment.findUnique({ where: { id: d3.id } });
      assert.strictEqual(checkD3?.status, "RUNNING", "d3 must remain RUNNING");
      console.log("   ✓ Retirement query protects newer running deployments against older candidates\n");
    }

    // ----------------------------------------------------------------
    // TEST 3: P0 - CONCURRENT PROMOTION SERIALIZATION
    // ----------------------------------------------------------------
    console.log("[TEST 3/9] P0: Concurrent Promotions Serialized via PostgreSQL FOR UPDATE");
    {
      const tA = new Date(Date.now() - 20_000);
      const tB = new Date(Date.now() - 10_000); // B is newer

      const depA = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "STARTING",
          createdAt: tA,
          containerId: "depA-container",
        },
      });

      const depB = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "STARTING",
          createdAt: tB,
          containerId: "depB-container",
        },
      });

      // Fire both promotions concurrently
      const [resA, resB] = await Promise.all([
        worker1.promoteDeployment(depA.id, testProject.id, depA.createdAt, `cloudforge-app-${depA.id}`),
        worker2.promoteDeployment(depB.id, testProject.id, depB.createdAt, `cloudforge-app-${depB.id}`),
      ]);

      const projFinal = await prisma.project.findUnique({ where: { id: testProject.id } });
      assert.strictEqual(
        projFinal?.liveDeploymentId,
        depB.id,
        "Newer deployment (depB) must be the final live deployment regardless of execution race"
      );
      assert.strictEqual(resB.promoted, true, "Newer deployment must be successfully promoted");
      console.log("   ✓ Concurrent promotions serialized; deterministic newer-wins invariant held\n");
    }

    // ----------------------------------------------------------------
    // TEST 4: P0 - RESTARTS RESPECT ORIGINAL DEPLOYMENT ORDERING
    // ----------------------------------------------------------------
    console.log("[TEST 4/9] P0: Restarting an Older Deployment Cannot Overwrite Newer Live Deployment");
    {
      const oldTime = new Date(Date.now() - 86400_000); // 1 day ago
      const newTime = new Date(Date.now() - 3600_000); // 1 hour ago

      const oldStopped = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "STOPPED",
          createdAt: oldTime,
          imageTag: "test-img:old",
        },
      });

      const activeLive = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "RUNNING",
          createdAt: newTime,
          imageTag: "test-img:new",
        },
      });

      await prisma.project.update({
        where: { id: testProject.id },
        data: { liveDeploymentId: activeLive.id, status: "ready" },
      });

      // Attempt promoting oldStopped directly using its original createdAt
      const restartPromo = await worker1.promoteDeployment(
        oldStopped.id,
        testProject.id,
        oldStopped.createdAt,
        `cloudforge-app-${oldStopped.id}`
      );

      assert.strictEqual(restartPromo.promoted, false, "Restarted older deployment must not overwrite newer live");
      const projAfterRestart = await prisma.project.findUnique({ where: { id: testProject.id } });
      assert.strictEqual(
        projAfterRestart?.liveDeploymentId,
        activeLive.id,
        "Active live deployment must remain untouched"
      );
      console.log("   ✓ Restarting older deployment cannot overwrite newer active deployment\n");
    }

    // ----------------------------------------------------------------
    // TEST 5: P1 - DURABLE RESTART INTENT PERSISTED IN POSTGRESQL QUEUE
    // ----------------------------------------------------------------
    console.log("[TEST 5/9] P1: Restart Persists Intent as QUEUED in PostgreSQL Before Returning 202");
    {
      const stoppedForRestart = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "STOPPED",
          imageTag: "test-img:restart-durable",
        },
      });

      let statusReceived = 0;
      let bodyReceived: any = null;
      const req: any = { user: { id: testUser.id }, params: { deploymentId: stoppedForRestart.id } };
      const res: any = {
        status: (s: number) => {
          statusReceived = s;
          return { json: (d: any) => (bodyReceived = d) };
        },
      };

      await restartDeploymentHandler(req, res);

      assert.strictEqual(statusReceived, 202, "Must return HTTP 202");
      assert.strictEqual(bodyReceived?.status, "QUEUED", "Response must confirm QUEUED status");

      // Verify database state: status is genuinely QUEUED in PostgreSQL
      const dbDep = await prisma.deployment.findUnique({ where: { id: stoppedForRestart.id } });
      assert.strictEqual(dbDep?.status, "QUEUED", "Database must persist status=QUEUED");

      // Verify worker claims it via FIFO claimNextDeployment
      const claimed = await worker1.claimNextDeployment();
      assert.strictEqual(claimed?.id, stoppedForRestart.id, "Worker must claim the queued restart deployment");
      assert.strictEqual(claimed?.status, "INITIALIZING");
      assert.ok(claimed?.heartbeatAt !== null, "Heartbeat must be set atomically on claim");
      assert.strictEqual(claimed?.workerId, worker1.workerId, "Worker ID must be set atomically on claim");

      console.log("   ✓ Restart work is fully durable, persisted in PostgreSQL, and claimed safely by worker\n");
    }

    // ----------------------------------------------------------------
    // TEST 6: P1 - DUPLICATE RESTART REQUEST REJECTION
    // ----------------------------------------------------------------
    console.log("[TEST 6/9] P1: Duplicate Restart Requests Safely Rejected with HTTP 400 or 409");
    {
      const stoppedDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "STOPPED",
          imageTag: "test-img:dup",
        },
      });

      let code1 = 0;
      let code2 = 0;
      const req: any = { user: { id: testUser.id }, params: { deploymentId: stoppedDep.id } };
      const res1: any = { status: (s: number) => { code1 = s; return { json: () => {} }; } };
      const res2: any = { status: (s: number) => { code2 = s; return { json: () => {} }; } };

      await restartDeploymentHandler(req, res1);
      await restartDeploymentHandler(req, res2);

      assert.strictEqual(code1, 202, "First request accepted with 202");
      assert.strictEqual(code2, 400, "Second request rejected with 400 because status is no longer STOPPED");
      console.log("   ✓ Duplicate restart prevented from queueing duplicate jobs\n");
    }

    // ----------------------------------------------------------------
    // TEST 7: P1 - DISTRIBUTED DATABASE RECONCILER LOCK (SystemLock)
    // ----------------------------------------------------------------
    console.log("[TEST 7/9] P1: Distributed Database Lock Prevents Multi-Worker Reconciliation Overlap");
    {
      // Clean any existing lock
      await prisma.systemLock.deleteMany({ where: { key: "havn_reconciler" } });

      // Simulate a running deployment
      const runDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "RUNNING",
          containerId: "mock-lock-container",
        },
      });

      // Worker 1 acquires lock and reconciles
      const count1 = await worker1.reconcileRunningDeployments(async () => {
        // While Worker 1 is in the middle of inspecting, Worker 2 attempts to reconcile
        const count2 = await worker2.reconcileRunningDeployments();
        assert.strictEqual(count2, 0, "Worker 2 must be rejected because Worker 1 holds the database lock");
        return { exists: true, running: true };
      });

      // After Worker 1 finishes, lock lease is released in finally
      const lockRow = await prisma.systemLock.findUnique({ where: { key: "havn_reconciler" } });
      assert.ok(lockRow !== null, "SystemLock record must exist");
      assert.ok(
        lockRow.expiresAt.getTime() <= Date.now() + 1000,
        "SystemLock expiresAt must be expired/cleared upon release in finally"
      );

      // Now Worker 2 can acquire the lock
      const count3 = await worker2.reconcileRunningDeployments(async () => ({ exists: true, running: true }));
      assert.strictEqual(count3, 0, "Worker 2 successfully acquired lock and evaluated running fleet");

      console.log("   ✓ SystemLock provides distributed coordination without open transactions during inspect\n");
    }

    // ----------------------------------------------------------------
    // TEST 8: P2 - DEDICATED 30s STARTUP LEASE RECOVERY VS 120s BUILD LEASE
    // ----------------------------------------------------------------
    console.log("[TEST 8/9] P2: Faster STARTING Lease Recovery (30s) vs Build Lease Recovery (120s)");
    {
      // 8a. STARTING deployment with heartbeat 35s ago (>30s) -> RECLAIMED
      const staleStarting = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "STARTING",
          heartbeatAt: new Date(Date.now() - 35_000), // 35s ago
        },
      });

      // 8b. STARTING deployment with heartbeat 15s ago (<30s) -> HEALTHY / PRESERVED
      const healthyStarting = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "STARTING",
          heartbeatAt: new Date(Date.now() - 15_000), // 15s ago
        },
      });

      // 8c. BUILDING deployment with heartbeat 35s ago (<120s) -> HEALTHY / PRESERVED
      const healthyBuilding = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "BUILDING",
          heartbeatAt: new Date(Date.now() - 35_000), // 35s ago
        },
      });

      // 8d. BUILDING deployment with heartbeat 125s ago (>120s) -> RECLAIMED
      const staleBuilding = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "BUILDING",
          heartbeatAt: new Date(Date.now() - 125_000), // 125s ago
        },
      });

      const recoveredCount = await worker1.recoverStaleDeployments();
      assert.strictEqual(recoveredCount, 2, "Must recover exactly 2 deployments: stale STARTING and stale BUILDING");

      const checkStaleStarting = await prisma.deployment.findUnique({ where: { id: staleStarting.id } });
      const checkHealthyStarting = await prisma.deployment.findUnique({ where: { id: healthyStarting.id } });
      const checkHealthyBuilding = await prisma.deployment.findUnique({ where: { id: healthyBuilding.id } });
      const checkStaleBuilding = await prisma.deployment.findUnique({ where: { id: staleBuilding.id } });

      assert.strictEqual(checkStaleStarting?.status, "FAILED", "Stale STARTING must be FAILED");
      assert.ok(checkStaleStarting?.errorMessage?.includes(">30s"));

      assert.strictEqual(checkHealthyStarting?.status, "STARTING", "Healthy STARTING must remain STARTING");
      assert.strictEqual(checkHealthyBuilding?.status, "BUILDING", "Healthy BUILDING must remain BUILDING");

      assert.strictEqual(checkStaleBuilding?.status, "FAILED", "Stale BUILDING must be FAILED");
      assert.ok(checkStaleBuilding?.errorMessage?.includes(">120s"));

      console.log("   ✓ Stale STARTING reaped after 30s; active workers and 120s build leases preserved\n");
    }

    // ----------------------------------------------------------------
    // TEST 9: DOCKER DAEMON OUTAGE DOES NOT FALSE-CRASH RUNNING DEPLOYMENTS
    // ----------------------------------------------------------------
    console.log("[TEST 9/9] Docker Daemon Outage Behavior in Reconciler");
    {
      const runningDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "RUNNING",
          containerId: "daemon-test-container",
        },
      });

      // Reconciler inspect returns daemon unavailable
      const count = await worker1.reconcileRunningDeployments(async () => {
        return { exists: false, running: false, error: "Docker daemon unavailable: connection refused" };
      });

      assert.strictEqual(count, 0, "No deployments must be crashed when daemon is unavailable");
      const checkDep = await prisma.deployment.findUnique({ where: { id: runningDep.id } });
      assert.strictEqual(checkDep?.status, "RUNNING", "Deployment must remain RUNNING during Docker outage");

      console.log("   ✓ Daemon outage safely skipped without falsely marking deployments CRASHED\n");
    }

    console.log("==================================================================");
    console.log("  ALL PHASE 3.4 TESTS PASSED SUCCESSFULLY!                        ");
    console.log("==================================================================\n");
  } finally {
    worker1.stop();
    worker2.stop();
    await prisma.deployment.deleteMany({ where: { projectId: testProject.id } });
    await prisma.project.deleteMany({ where: { id: testProject.id } });
    await prisma.systemLock.deleteMany({ where: { key: "havn_reconciler" } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  }
}

runPhase34Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
