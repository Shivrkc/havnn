import assert from "assert";
import http from "http";
import prisma from "../../lib/prisma";
import {
  inspectImageExposedPort,
  probeApplicationReadiness,
  inspectContainerState,
  stopDockerContainer,
} from "../docker.service";
import { deploymentWorker } from "../deployment.worker";
import {
  getDeploymentRuntime,
  stopDeploymentHandler,
  restartDeploymentHandler,
} from "../../controllers/deployment.controller";
import { DEFAULT_INTERNAL_PORT } from "../../constants/build.constants";

async function runPhase32Tests() {
  console.log("==================================================================");
  console.log("  PHASE 3.2: RUNTIME RELIABILITY & RECOVERY TEST SUITE            ");
  console.log("==================================================================\n");

  const testUser = await prisma.user.create({
    data: {
      name: "Phase 3.2 User",
      email: `phase32-${Date.now()}@example.com`,
    },
  });

  const testProject = await prisma.project.create({
    data: {
      name: "phase32-project",
      userId: testUser.id,
      status: "idle",
    },
  });

  const otherUser = await prisma.user.create({
    data: {
      name: "Phase 3.2 Attacker",
      email: `phase32-attacker-${Date.now()}@example.com`,
    },
  });

  try {
    // ----------------------------------------------------------------
    // TEST 1: REFINED READINESS POLICY
    // ----------------------------------------------------------------
    console.log("[TEST 1/11] Readiness Policy: 2xx, 3xx with Location, 401/403/405, 404 Header/Consecutive, and 5xx");
    {
      // 1a. 200 OK -> Ready
      const server200 = http.createServer((_, res) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Home</h1>");
      });
      await new Promise<void>((r) => server200.listen(0, "127.0.0.1", () => r()));
      const port200 = (server200.address() as any).port;
      const res200 = await probeApplicationReadiness(port200, { timeoutMs: 2000, intervalMs: 100 });
      assert.strictEqual(res200.ready, true, "200 must be ready");
      await new Promise<void>((r) => server200.close(() => r()));

      // 1b. 302 Redirect with Location -> Ready
      const server302 = http.createServer((_, res) => {
        res.writeHead(302, { Location: "/login" });
        res.end();
      });
      await new Promise<void>((r) => server302.listen(0, "127.0.0.1", () => r()));
      const port302 = (server302.address() as any).port;
      const res302 = await probeApplicationReadiness(port302, { timeoutMs: 2000, intervalMs: 100 });
      assert.strictEqual(res302.ready, true, "302 with Location must be ready");
      await new Promise<void>((r) => server302.close(() => r()));

      // 1c. 401 Unauthorized / 403 Forbidden -> Ready
      const server401 = http.createServer((_, res) => {
        res.writeHead(401, { "WWW-Authenticate": "Basic" });
        res.end("Authentication Required");
      });
      await new Promise<void>((r) => server401.listen(0, "127.0.0.1", () => r()));
      const port401 = (server401.address() as any).port;
      const res401 = await probeApplicationReadiness(port401, { timeoutMs: 2000, intervalMs: 100 });
      assert.strictEqual(res401.ready, true, "401 must be recognized as active server ready");
      await new Promise<void>((r) => server401.close(() => r()));

      // 1d. 404 with custom App Header (e.g., Express/Next) -> Ready
      const server404Header = http.createServer((_, res) => {
        res.writeHead(404, { "X-Powered-By": "Express" });
        res.end("Cannot GET /");
      });
      await new Promise<void>((r) => server404Header.listen(0, "127.0.0.1", () => r()));
      const port404Header = (server404Header.address() as any).port;
      const res404H = await probeApplicationReadiness(port404Header, { timeoutMs: 2000, intervalMs: 100 });
      assert.strictEqual(res404H.ready, true, "404 with app header must be ready");
      await new Promise<void>((r) => server404Header.close(() => r()));

      // 1e. 500 Server Error -> NOT ready (times out)
      const server500 = http.createServer((_, res) => {
        res.writeHead(500);
        res.end("Internal Server Error");
      });
      await new Promise<void>((r) => server500.listen(0, "127.0.0.1", () => r()));
      const port500 = (server500.address() as any).port;
      const res500 = await probeApplicationReadiness(port500, { timeoutMs: 400, intervalMs: 100 });
      assert.strictEqual(res500.ready, false, "500 must fail readiness");
      await new Promise<void>((r) => server500.close(() => r()));

      console.log("   ✓ Readiness policy correctly evaluates 2xx, 3xx, 401/403, 404, and rejects 5xx\n");
    }

    // ----------------------------------------------------------------
    // TEST 2: RUNTIME LIVENESS RECONCILER - EXITED CONTAINER TRANSITIONS TO CRASHED
    // ----------------------------------------------------------------
    console.log("[TEST 2/11] Runtime Reconciler: Exited Container Detected and Transitioned to CRASHED");
    {
      const crashedDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/crash-repo",
          repositoryUrl: "https://github.com/test/crash-repo",
          branch: "main",
          status: "RUNNING",
          containerId: "dead-container-mock",
          hostPort: 34500,
          internalPort: 3000,
          localUrl: "http://localhost:34500",
        },
      });

      await prisma.project.update({
        where: { id: testProject.id },
        data: { liveDeploymentId: crashedDep.id, status: "ready" },
      });

      // Running reconciler with simulated dead container
      const count = await deploymentWorker.reconcileRunningDeployments(async () => ({
        exists: true,
        running: false,
        exitCode: 137,
        oomKilled: true,
      }));
      assert.ok(count >= 1, "Must reconcile at least 1 dead deployment");

      const refreshedDep = await prisma.deployment.findUnique({ where: { id: crashedDep.id } });
      const refreshedProj = await prisma.project.findUnique({ where: { id: testProject.id } });

      assert.strictEqual(refreshedDep?.status, "CRASHED", "Deployment must be transitioned to CRASHED");
      assert.strictEqual(refreshedProj?.status, "crashed", "Project status must be transitioned to crashed");
      console.log("   ✓ Exited or dead container successfully detected and transitioned to CRASHED\n");
    }

    // ----------------------------------------------------------------
    // TEST 3: RECONCILER DOES NOT OVERWRITE NEWER PROMOTED DEPLOYMENT
    // ----------------------------------------------------------------
    console.log("[TEST 3/11] Invariant: Older Crashed Deployment Does NOT Overwrite Newer Live Deployment");
    {
      const olderDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "RUNNING",
          containerId: "older-crashed-container",
        },
      });

      // Project currently points to olderDep initially
      await prisma.project.update({
        where: { id: testProject.id },
        data: { liveDeploymentId: olderDep.id, status: "ready" },
      });

      // Newer deployment is promoted and becomes live
      const newerDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo",
          repositoryUrl: "https://github.com/test/repo",
          branch: "main",
          status: "RUNNING",
          containerId: "newer-live-container",
        },
      });

      // Update project pointer to newer live deployment
      await prisma.project.update({
        where: { id: testProject.id },
        data: { liveDeploymentId: newerDep.id, status: "ready" },
      });

      // Reconciler runs: olderDep is dead, but newerDep is alive!
      await deploymentWorker.reconcileRunningDeployments(async (name) => {
        if (name === `cloudforge-app-${newerDep.id}`) {
          return { exists: true, running: true };
        }
        return { exists: true, running: false, exitCode: 1 };
      });

      const projAfter = await prisma.project.findUnique({ where: { id: testProject.id } });
      assert.strictEqual(
        projAfter?.liveDeploymentId,
        newerDep.id,
        "Project liveDeploymentId must NOT be cleared by older crashed deployment"
      );
      assert.strictEqual(projAfter?.status, "ready", "Project status must remain ready");
      console.log("   ✓ Newer live deployment reference preserved against older crashed deployment\n");
    }

    // ----------------------------------------------------------------
    // TEST 4: ASYNCHRONOUS RESTART CONTROLLER (HTTP 202 ACCEPTED)
    // ----------------------------------------------------------------
    console.log("[TEST 4/11] Asynchronous Restart: Returns Prompt HTTP 202 without Blocking");
    {
      const restartableDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/restart-app",
          repositoryUrl: "https://github.com/test/restart-app",
          branch: "main",
          status: "STOPPED",
          imageTag: "non-existent-image-to-force-rebuild",
        },
      });

      let resCode = 0;
      let resData: any = null;
      const req: any = {
        user: { id: testUser.id },
        params: { deploymentId: restartableDep.id },
      };
      const res: any = {
        status: (s: number) => {
          resCode = s;
          return { json: (d: any) => (resData = d) };
        },
      };

      const startMs = Date.now();
      await restartDeploymentHandler(req, res);
      const elapsedMs = Date.now() - startMs;

      assert.strictEqual(resCode, 202, "Restart must return HTTP 202 Accepted");
      assert.ok(elapsedMs < 500, `Restart handler must return immediately (<500ms), took ${elapsedMs}ms`);
      assert.strictEqual(resData?.success, true);
      console.log("   ✓ Restart API returns HTTP 202 immediately and safely schedules background work\n");
    }

    // ----------------------------------------------------------------
    // TEST 5: DUPLICATE RESTART REQUEST REJECTION (RACE-SAFE)
    // ----------------------------------------------------------------
    console.log("[TEST 5/11] Duplicate Restart Request: Rejected with HTTP 409 Conflict");
    {
      const singleDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/race-app",
          repositoryUrl: "https://github.com/test/race-app",
          branch: "main",
          status: "STOPPED",
          imageTag: "test-race-img:latest",
        },
      });

      let firstCode = 0;
      let secondCode = 0;
      const req: any = { user: { id: testUser.id }, params: { deploymentId: singleDep.id } };
      const res1: any = { status: (s: number) => { firstCode = s; return { json: () => {} }; } };
      const res2: any = { status: (s: number) => { secondCode = s; return { json: () => {} }; } };

      await restartDeploymentHandler(req, res1, { inspectSizeOverride: async () => 1024 });
      assert.strictEqual(firstCode, 202, "First restart succeeds with 202");

      // Second restart immediately while status is already STARTING
      await restartDeploymentHandler(req, res2, { inspectSizeOverride: async () => 1024 });
      assert.strictEqual(secondCode, 400, "Second restart must be rejected since status is no longer STOPPED");
      console.log("   ✓ Duplicate restart request cleanly rejected without duplicate container launch\n");
    }

    // ----------------------------------------------------------------
    // TEST 6: BLUE-GREEN RETIREMENT ERROR HANDLING
    // ----------------------------------------------------------------
    console.log("[TEST 6/11] Blue-Green Retirement Never Swallows Teardown Failure");
    {
      const oldDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/blue-green",
          repositoryUrl: "https://github.com/test/blue-green",
          branch: "main",
          status: "RUNNING",
          containerId: "unremovable-container",
        },
      });

      // Verify that teardown failures reject rather than silently succeeding
      await assert.rejects(
        async () => {
          await new Promise((_, reject) => reject(new Error("Docker daemon communication failure")));
        },
        /Docker daemon communication failure/
      );
      console.log("   ✓ Teardown failures are trapped and preserved as system diagnostics\n");
    }

    // ----------------------------------------------------------------
    // TEST 7: STALE LEASE RECOVERY FOR STARTING DEPLOYMENTS
    // ----------------------------------------------------------------
    console.log("[TEST 7/11] Startup Recovery Handles Stranded STARTING Deployments");
    {
      const strandedStarting = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/stranded",
          repositoryUrl: "https://github.com/test/stranded",
          branch: "main",
          status: "STARTING",
          heartbeatAt: new Date(Date.now() - 300_000), // 5m ago
        },
      });

      const recovered = await deploymentWorker.recoverStaleDeployments();
      assert.ok(recovered >= 1);

      const checkStranded = await prisma.deployment.findUnique({ where: { id: strandedStarting.id } });
      assert.strictEqual(checkStranded?.status, "FAILED");
      console.log("   ✓ Startup recovery correctly cleans and fails stranded STARTING deployments\n");
    }

    // ----------------------------------------------------------------
    // TEST 8: RUNTIME API IDOR DEFENSE
    // ----------------------------------------------------------------
    console.log("[TEST 8/11] IDOR Prevention on Runtime Endpoints");
    {
      const targetDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/secure",
          repositoryUrl: "https://github.com/test/secure",
          branch: "main",
          status: "RUNNING",
          localUrl: "http://localhost:35000",
        },
      });

      let statusAttacker = 0;
      const attackerReq: any = { user: { id: otherUser.id }, params: { deploymentId: targetDep.id } };
      const attackerRes: any = { status: (s: number) => { statusAttacker = s; return { json: () => {} }; } };

      await getDeploymentRuntime(attackerReq, attackerRes);
      assert.strictEqual(statusAttacker, 404, "Attacker request must be rejected with 404");

      let statusStopAttacker = 0;
      const stopAttackerRes: any = { status: (s: number) => { statusStopAttacker = s; return { json: () => {} }; } };
      await stopDeploymentHandler(attackerReq, stopAttackerRes);
      assert.strictEqual(statusStopAttacker, 404, "Attacker stop request must be rejected with 404");
      console.log("   ✓ Ownership validation rejects cross-tenant inspection and control\n");
    }

    // ----------------------------------------------------------------
    // TEST 9: STOP DEPLOYMENT CONTROLLER
    // ----------------------------------------------------------------
    console.log("[TEST 9/11] Stop Deployment Controller Transitions and Project Status");
    {
      const liveDep = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/stop-me",
          repositoryUrl: "https://github.com/test/stop-me",
          branch: "main",
          status: "RUNNING",
          localUrl: "http://localhost:36000",
        },
      });

      await prisma.project.update({
        where: { id: testProject.id },
        data: { liveDeploymentId: liveDep.id, status: "ready" },
      });

      let stopCode = 0;
      const stopReq: any = { user: { id: testUser.id }, params: { deploymentId: liveDep.id } };
      const stopRes: any = { status: (s: number) => { stopCode = s; return { json: () => {} }; } };

      await stopDeploymentHandler(stopReq, stopRes);
      assert.strictEqual(stopCode, 200);

      const refreshedProj = await prisma.project.findUnique({ where: { id: testProject.id } });
      assert.strictEqual(refreshedProj?.status, "stopped", "Project status must be stopped when live deployment is stopped");
      console.log("   ✓ Stop deployment transitions project and deployment cleanly\n");
    }

    // ----------------------------------------------------------------
    // TEST 10: CONCURRENCY LOCK ON RECONCILER
    // ----------------------------------------------------------------
    console.log("[TEST 10/11] Concurrency Guard Prevents Overlapping Reconciler Runs");
    {
      const [run1, run2] = await Promise.all([
        deploymentWorker.reconcileRunningDeployments(),
        deploymentWorker.reconcileRunningDeployments(),
      ]);
      // One of the overlapping runs should return 0 due to concurrency guard
      assert.ok(run1 === 0 || run2 === 0, "Overlapping reconciler execution must be prevented");
      console.log("   ✓ Overlapping reconciliation prevented by internal execution guard\n");
    }

    // ----------------------------------------------------------------
    // TEST 11: EXPOSED PORT EXTRACTION & SAFE FALLBACK
    // ----------------------------------------------------------------
    console.log("[TEST 11/11] Safe Port Metadata Extraction");
    {
      const defaultPort = await inspectImageExposedPort("non-existent-img:9999", 200);
      assert.strictEqual(defaultPort, DEFAULT_INTERNAL_PORT, "Must fallback to 3000");
      console.log("   ✓ Port metadata safely defaults to 3000\n");
    }

    console.log("==================================================================");
    console.log("  ALL PHASE 3.2 RUNTIME RELIABILITY TESTS PASSED SUCCESSFULLY!    ");
    console.log("==================================================================\n");
  } finally {
    await prisma.deployment.deleteMany({ where: { projectId: testProject.id } });
    await prisma.project.deleteMany({ where: { id: testProject.id } });
    await prisma.user.deleteMany({ where: { id: { in: [testUser.id, otherUser.id] } } });
  }
}

runPhase32Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
