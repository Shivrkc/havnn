import assert from "assert";
import prisma from "../../lib/prisma";
import { LogStream } from "@prisma/client";
import { BuildLogBatcher } from "../docker.service";
import { sanitizeLogOutput } from "../../utils/sanitizer";
import { getDeploymentLogs, getDeploymentRawLogs } from "../../controllers/deployment.controller";

/**
 * MODULE 6: DEPLOYMENT LOGS REGRESSION & VERIFICATION SUITE
 */
async function runDeploymentLogsTests() {
  console.log("==================================================================");
  console.log("  MODULE 6: DEPLOYMENT LOGS REGRESSION & VERIFICATION SUITE      ");
  console.log("==================================================================\n");

  const timestamp = Date.now();
  const testUserAEmail = `mod6-user-a-${timestamp}@example.com`;
  const testUserBEmail = `mod6-user-b-${timestamp}@example.com`;

  let userA: any;
  let userB: any;
  let projectA: any;
  let projectB: any;
  let deploymentA: any;
  let deploymentB: any;

  try {
    // --------------------------------------------------------------------------
    // SETUP: Create test users and projects
    // --------------------------------------------------------------------------
    userA = await prisma.user.create({
      data: {
        email: testUserAEmail,
        name: "Module 6 User A",
      },
    });

    userB = await prisma.user.create({
      data: {
        email: testUserBEmail,
        name: "Module 6 User B",
      },
    });

    projectA = await prisma.project.create({
      data: {
        name: "Log Test Project A",
        repositoryName: "testowner/logs-repo-a",
        repositoryUrl: "https://github.com/testowner/logs-repo-a",
        branch: "main",
        userId: userA.id,
      },
    });

    projectB = await prisma.project.create({
      data: {
        name: "Log Test Project B",
        repositoryName: "testowner/logs-repo-b",
        repositoryUrl: "https://github.com/testowner/logs-repo-b",
        branch: "main",
        userId: userB.id,
      },
    });

    deploymentA = await prisma.deployment.create({
      data: {
        projectId: projectA.id,
        status: "BUILDING",
        repositoryName: projectA.repositoryName,
        repositoryUrl: projectA.repositoryUrl,
        branch: "main",
      },
    });

    deploymentB = await prisma.deployment.create({
      data: {
        projectId: projectB.id,
        status: "BUILDING",
        repositoryName: projectB.repositoryName,
        repositoryUrl: projectB.repositoryUrl,
        branch: "main",
      },
    });

    // --------------------------------------------------------------------------
    // Test 1: Sequence Ordering & Gapless Contiguity
    // --------------------------------------------------------------------------
    console.log("Test 1: Sequence ordering & gapless contiguity...");
    const batcher1 = new BuildLogBatcher(deploymentA.id, 0);
    for (let i = 1; i <= 25; i++) {
      batcher1.pushLine(`Build step log line #${i}`, LogStream.STDOUT);
    }
    await batcher1.flushAll();

    const dbLogs1 = await prisma.buildLog.findMany({
      where: { deploymentId: deploymentA.id },
      orderBy: { sequence: "asc" },
    });

    assert.strictEqual(dbLogs1.length, 25, "Expected 25 log lines to be persisted");
    for (let i = 0; i < 25; i++) {
      assert.strictEqual(
        dbLogs1[i].sequence,
        i + 1,
        `Expected monotonic sequence ${i + 1} but got ${dbLogs1[i].sequence}`
      );
    }
    console.log("  ✓ Test 1 passed: All 25 lines stored with strict monotonic ordering 1..25\n");

    // --------------------------------------------------------------------------
    // Test 2: Stream Segregation (SYSTEM, STDOUT, STDERR)
    // --------------------------------------------------------------------------
    console.log("Test 2: Stream segregation...");
    const currentMaxSeq = dbLogs1[dbLogs1.length - 1].sequence;
    const batcher2 = new BuildLogBatcher(deploymentA.id, currentMaxSeq);

    batcher2.pushLine("[SYSTEM] Starting compiler...", LogStream.SYSTEM);
    batcher2.pushLine("Compiling module A...", LogStream.STDOUT);
    batcher2.pushLine("Warning: deprecated syntax in module A", LogStream.STDERR);
    await batcher2.flushAll();

    const systemLogs = await prisma.buildLog.findMany({
      where: { deploymentId: deploymentA.id, stream: LogStream.SYSTEM },
    });
    const stdoutLogs = await prisma.buildLog.findMany({
      where: { deploymentId: deploymentA.id, stream: LogStream.STDOUT },
    });
    const stderrLogs = await prisma.buildLog.findMany({
      where: { deploymentId: deploymentA.id, stream: LogStream.STDERR },
    });

    assert.strictEqual(systemLogs.length, 1, "Expected 1 SYSTEM log");
    assert.strictEqual(stdoutLogs.length, 26, "Expected 26 STDOUT logs (25 from test 1 + 1 new)");
    assert.strictEqual(stderrLogs.length, 1, "Expected 1 STDERR log");
    assert.strictEqual(stderrLogs[0].stream, LogStream.STDERR);
    console.log("  ✓ Test 2 passed: SYSTEM, STDOUT, and STDERR streams segregated properly\n");

    // --------------------------------------------------------------------------
    // Test 3: Secret Masking (GitHub PAT, OAuth, Bearer, JWT, Custom Secret)
    // --------------------------------------------------------------------------
    console.log("Test 3: Secret masking...");
    const rawLinesWithSecrets = [
      "Cloning with token: ghp_123456789012345678901234567890123456 in URL",
      "OAuth token: gho_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      "Fine-grained PAT: github_pat_11AAAAAAA0123456789012345678901234567890123456789012345678901234567890123456789012",
      "Authorization: Bearer superSecretBearerToken123",
      "Session token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      "Custom project secret: custom_super_secret_token_value_xyz",
    ];

    const sanitizedResults = rawLinesWithSecrets.map((l) =>
      sanitizeLogOutput(l, "custom_super_secret_token_value_xyz")
    );

    assert(!sanitizedResults[0].includes("ghp_123456789012345678901234567890123456"));
    assert(sanitizedResults[0].includes("[REDACTED_TOKEN]"));

    assert(!sanitizedResults[1].includes("gho_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"));
    assert(sanitizedResults[1].includes("[REDACTED_TOKEN]"));

    assert(!sanitizedResults[2].includes("github_pat_11AAAAAAA0123456789012345678901234567890123456789012345678901234567890123456789012"));
    assert(sanitizedResults[2].includes("[REDACTED_TOKEN]"));

    assert(!sanitizedResults[3].includes("superSecretBearerToken123"));
    assert(sanitizedResults[3].includes("Authorization: [REDACTED]"));

    assert(!sanitizedResults[4].includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
    assert(sanitizedResults[4].includes("[REDACTED_TOKEN]"));

    assert(!sanitizedResults[5].includes("custom_super_secret_token_value_xyz"));
    assert(sanitizedResults[5].includes("[REDACTED_TOKEN]"));
    console.log("  ✓ Test 3 passed: GitHub PATs, OAuth, Bearer headers, JWTs, and custom secrets sanitized\n");

    // --------------------------------------------------------------------------
    // Test 4: Incremental afterSequence Retrieval via getDeploymentLogs
    // --------------------------------------------------------------------------
    console.log("Test 4: Incremental afterSequence retrieval...");
    // Mock req and res for getDeploymentLogs
    const createMockRes = () => {
      const res: any = {
        statusCode: 200,
        headers: {},
        data: null,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.data = payload;
          return this;
        },
        send(payload: any) {
          this.data = payload;
          return this;
        },
        setHeader(key: string, val: string) {
          this.headers[key] = val;
          return this;
        },
      };
      return res;
    };

    // Poll with afterSequence = 0
    const req0: any = {
      user: { id: userA.id },
      params: { deploymentId: deploymentA.id },
      query: { afterSequence: "0" },
    };
    const res0 = createMockRes();
    await getDeploymentLogs(req0, res0);
    assert.strictEqual(res0.statusCode, 200);
    assert.strictEqual(res0.data.success, true);
    assert.strictEqual(res0.data.logs.length, 28); // 25 from T1 + 3 from T2

    // Poll with afterSequence = 25 -> should only return the 3 logs from T2
    const req25: any = {
      user: { id: userA.id },
      params: { deploymentId: deploymentA.id },
      query: { afterSequence: "25" },
    };
    const res25 = createMockRes();
    await getDeploymentLogs(req25, res25);
    assert.strictEqual(res25.statusCode, 200);
    assert.strictEqual(res25.data.logs.length, 3);
    assert.strictEqual(res25.data.logs[0].sequence, 26);
    assert.strictEqual(res25.data.logs[2].sequence, 28);

    // Poll with afterSequence = 28 -> should return 0 logs
    const req28: any = {
      user: { id: userA.id },
      params: { deploymentId: deploymentA.id },
      query: { afterSequence: "28" },
    };
    const res28 = createMockRes();
    await getDeploymentLogs(req28, res28);
    assert.strictEqual(res28.statusCode, 200);
    assert.strictEqual(res28.data.logs.length, 0);
    console.log("  ✓ Test 4 passed: Incremental sequence pagination returns exact deltas without gaps\n");

    // --------------------------------------------------------------------------
    // Test 5: Raw Log Download Endpoint (GET /api/deployments/:id/logs/raw)
    // --------------------------------------------------------------------------
    console.log("Test 5: Raw log download endpoint...");
    const reqRaw: any = {
      user: { id: userA.id },
      params: { deploymentId: deploymentA.id },
    };
    const resRaw = createMockRes();
    await getDeploymentRawLogs(reqRaw, resRaw);

    assert.strictEqual(resRaw.statusCode, 200);
    assert.strictEqual(resRaw.headers["Content-Type"], "text/plain; charset=utf-8");
    assert(resRaw.headers["Content-Disposition"].includes(`attachment; filename="deployment-${deploymentA.id.substring(0, 8)}.log"`));
    assert(typeof resRaw.data === "string", "Expected raw response body to be text");
    assert(resRaw.data.includes("[SYSTEM] Starting compiler..."));
    assert(resRaw.data.includes("Build step log line #1"));
    const rawLines = resRaw.data.trim().split("\n");
    assert.strictEqual(rawLines.length, 28, "Expected 28 raw formatted lines");
    console.log("  ✓ Test 5 passed: Raw log download delivers plain text format with disposition header\n");

    // --------------------------------------------------------------------------
    // Test 6: Authorization Isolation (Cross-User Protection)
    // --------------------------------------------------------------------------
    console.log("Test 6: Authorization isolation...");
    // User B attempts to access User A's deployment logs
    const reqUnauthorizedLogs: any = {
      user: { id: userB.id },
      params: { deploymentId: deploymentA.id },
      query: { afterSequence: "0" },
    };
    const resUnauthorizedLogs = createMockRes();
    await getDeploymentLogs(reqUnauthorizedLogs, resUnauthorizedLogs);
    assert.strictEqual(resUnauthorizedLogs.statusCode, 404, "User B must not access User A's logs");

    // User B attempts to download User A's raw logs
    const reqUnauthorizedRaw: any = {
      user: { id: userB.id },
      params: { deploymentId: deploymentA.id },
    };
    const resUnauthorizedRaw = createMockRes();
    await getDeploymentRawLogs(reqUnauthorizedRaw, resUnauthorizedRaw);
    assert.strictEqual(resUnauthorizedRaw.statusCode, 404, "User B must not download User A's raw logs");
    console.log("  ✓ Test 6 passed: Cross-user access rejected with 404 Not Found\n");

    // --------------------------------------------------------------------------
    // Test 7: Failed Deployment Logs & Terminal Status
    // --------------------------------------------------------------------------
    console.log("Test 7: Failed deployment logs & terminal status...");
    const failedDep = await prisma.deployment.create({
      data: {
        projectId: projectA.id,
        status: "FAILED",
        repositoryName: projectA.repositoryName,
        repositoryUrl: projectA.repositoryUrl,
        branch: "feature/broken",
        errorMessage: "Docker build failed with exit code 1",
        logs: {
          createMany: {
            data: [
              { sequence: 1, stream: LogStream.SYSTEM, line: "[SYSTEM] Initializing build..." },
              { sequence: 2, stream: LogStream.STDERR, line: "SyntaxError: Unexpected token in Dockerfile" },
              { sequence: 3, stream: LogStream.SYSTEM, line: "[SYSTEM] Deployment execution failed: Docker build failed with exit code 1" },
            ],
          },
        },
      },
    });

    const reqFailed: any = {
      user: { id: userA.id },
      params: { deploymentId: failedDep.id },
      query: { afterSequence: "0" },
    };
    const resFailed = createMockRes();
    await getDeploymentLogs(reqFailed, resFailed);

    assert.strictEqual(resFailed.statusCode, 200);
    assert.strictEqual(resFailed.data.isTerminal, true, "Failed deployment must report isTerminal: true");
    assert.strictEqual(resFailed.data.currentStatus, "FAILED");
    assert.strictEqual(resFailed.data.logs.length, 3);
    assert.strictEqual(resFailed.data.logs[2].line.includes("failed"), true);
    console.log("  ✓ Test 7 passed: Failed deployment preserves full failure log trace and reports isTerminal: true\n");

    // --------------------------------------------------------------------------
    // Test 8: Cancelled Deployment Logs & Terminal Status
    // --------------------------------------------------------------------------
    console.log("Test 8: Cancelled deployment logs & terminal status...");
    const cancelledDep = await prisma.deployment.create({
      data: {
        projectId: projectA.id,
        status: "CANCELLED",
        repositoryName: projectA.repositoryName,
        repositoryUrl: projectA.repositoryUrl,
        branch: "feature/cancel",
        exitCode: 130,
        errorMessage: "Deployment cancelled by user.",
        logs: {
          createMany: {
            data: [
              { sequence: 1, stream: LogStream.SYSTEM, line: "[SYSTEM] Worker claimed deployment." },
              { sequence: 2, stream: LogStream.STDOUT, line: "Step 1/10 : FROM node:18" },
              { sequence: 3, stream: LogStream.SYSTEM, line: "[SYSTEM] Deployment execution cancelled by user." },
            ],
          },
        },
      },
    });

    const reqCancelled: any = {
      user: { id: userA.id },
      params: { deploymentId: cancelledDep.id },
      query: { afterSequence: "0" },
    };
    const resCancelled = createMockRes();
    await getDeploymentLogs(reqCancelled, resCancelled);

    assert.strictEqual(resCancelled.statusCode, 200);
    assert.strictEqual(resCancelled.data.isTerminal, true, "Cancelled deployment must report isTerminal: true");
    assert.strictEqual(resCancelled.data.currentStatus, "CANCELLED");
    assert.strictEqual(resCancelled.data.logs.length, 3);
    assert(resCancelled.data.logs[2].line.includes("cancelled"));
    console.log("  ✓ Test 8 passed: Cancelled deployment preserves cancellation breadcrumb and reports isTerminal: true\n");

    // --------------------------------------------------------------------------
    // Test 9: Log Batch Flushing & Rollback Safety
    // --------------------------------------------------------------------------
    console.log("Test 9: Log batch flushing & rollback safety...");
    const batcher9 = new BuildLogBatcher(deploymentB.id, 0);
    // Push 65 lines (more than the batch threshold of 50)
    for (let i = 1; i <= 65; i++) {
      batcher9.pushLine(`Batch item ${i}`, LogStream.STDOUT);
    }

    // Flush single batch (up to 50 items)
    await batcher9.flush();
    const countAfterFirstFlush = await prisma.buildLog.count({
      where: { deploymentId: deploymentB.id },
    });
    assert.strictEqual(countAfterFirstFlush, 50, "First flush should have persisted exactly 50 items");

    // Flush remaining items
    await batcher9.flushAll();
    const countAfterFlushAll = await prisma.buildLog.count({
      where: { deploymentId: deploymentB.id },
    });
    assert.strictEqual(countAfterFlushAll, 65, "Total 65 items should be persisted after flushAll");

    // Test error rollback preservation in batcher queue
    const failureBatcher = new BuildLogBatcher(deploymentB.id, 65);
    failureBatcher.pushLine("Line that will fail write", LogStream.STDOUT);

    // Temporarily replace createMany with mock that fails
    const originalCreateMany = prisma.buildLog.createMany;
    (prisma.buildLog as any).createMany = async () => {
      throw new Error("Simulated SQLite write error");
    };

    let threw = false;
    try {
      await failureBatcher.flush();
    } catch (e: any) {
      threw = true;
      assert(e.message.includes("Simulated SQLite write error"));
    } finally {
      // Restore original createMany
      prisma.buildLog.createMany = originalCreateMany;
    }
    assert(threw, "Batcher flush should have propagated database error");

    // Verify the unpersisted line was retained in memory and can now succeed on retry
    await failureBatcher.flush();
    const finalCount = await prisma.buildLog.count({
      where: { deploymentId: deploymentB.id },
    });
    assert.strictEqual(finalCount, 66, "Unpersisted line was successfully retried without data loss");
    console.log("  ✓ Test 9 passed: 50-item batching, flushAll, and error-rollback safety verified\n");

    // --------------------------------------------------------------------------
    // Test 10: Cascade Deletion on Deployment Cleanup
    // --------------------------------------------------------------------------
    console.log("Test 10: Deployment deletion cleanup (Cascade Delete)...");
    const preDeleteLogs = await prisma.buildLog.count({
      where: { deploymentId: deploymentB.id },
    });
    assert.strictEqual(preDeleteLogs, 66, "Expected 66 logs prior to deletion");

    // Delete parent deployment
    await prisma.deployment.delete({
      where: { id: deploymentB.id },
    });

    const postDeleteLogs = await prisma.buildLog.count({
      where: { deploymentId: deploymentB.id },
    });
    assert.strictEqual(postDeleteLogs, 0, "All associated BuildLog records must cascade-delete when deployment is removed");
    console.log("  ✓ Test 10 passed: Cascade deletion removed all associated BuildLog records\n");

    console.log("==================================================================");
    console.log("  ALL 10 MODULE 6 REGRESSION TESTS PASSED SUCCESSFULLY!          ");
    console.log("==================================================================\n");
  } finally {
    // Teardown test entities
    try {
      if (projectA?.id) {
        await prisma.deployment.deleteMany({ where: { projectId: projectA.id } });
        await prisma.project.delete({ where: { id: projectA.id } });
      }
      if (projectB?.id) {
        await prisma.deployment.deleteMany({ where: { projectId: projectB.id } });
        await prisma.project.delete({ where: { id: projectB.id } });
      }
      if (userA?.id) {
        await prisma.user.delete({ where: { id: userA.id } });
      }
      if (userB?.id) {
        await prisma.user.delete({ where: { id: userB.id } });
      }
    } catch (cleanupErr) {
      console.error("Test cleanup error (non-fatal):", cleanupErr);
    }
  }
}

runDeploymentLogsTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ MODULE 6 REGRESSION TEST SUITE FAILED:", err);
    process.exit(1);
  });
