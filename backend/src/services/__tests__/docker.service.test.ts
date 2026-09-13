import assert from "assert";
import path from "path";
import fs from "fs";
import prisma from "../../lib/prisma";
import {
  executeDockerBuild,
  verifyDockerDaemon,
  inspectDockerImageSize,
  deleteDockerImage,
  BuildLogBatcher,
} from "../docker.service";
import { BuildContext } from "../git.service";
import { MAX_IMAGE_SIZE_BYTES, SCRATCH_ROOT_DIR } from "../../constants/build.constants";
import { LogStream } from "@prisma/client";

async function runTests() {
  console.log("==================================================================");
  console.log("  PHASE 1.3 DOCKER BUILD ENGINE: FOCUSED SECURITY VERIFICATION    ");
  console.log("==================================================================\n");

  // Create shared test user & project in PostgreSQL
  const testUser = await prisma.user.create({
    data: {
      name: "Docker Verification User",
      email: `docker-verify-${Date.now()}@example.com`,
    },
  });

  const testProject = await prisma.project.create({
    data: {
      name: "docker-verify-proj",
      userId: testUser.id,
    },
  });

  try {
    // ----------------------------------------------------------------
    // TEST 1: TIMEOUT HANDLING
    // ----------------------------------------------------------------
    console.log("[TEST 1/7] Timeout Handling & Process Termination");
    {
      const timeoutDeployment = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo-timeout",
          repositoryUrl: "https://github.com/test/repo-timeout",
          branch: "main",
          status: "INITIALIZING",
        },
      });

      const timeoutWorkspace = path.resolve(SCRATCH_ROOT_DIR, timeoutDeployment.id);
      const timeoutRepo = path.join(timeoutWorkspace, "repo");
      await fs.promises.mkdir(timeoutRepo, { recursive: true });

      // Dockerfile runs a 10s sleep while timeout is set to 1.5s
      await fs.promises.writeFile(
        path.join(timeoutRepo, "Dockerfile"),
        "FROM alpine:latest\nRUN sleep 10\n"
      );

      const timeoutTag = `cloudforge/deployment-${timeoutDeployment.id}:timeout`;
      const timeoutContext: BuildContext = {
        deploymentId: timeoutDeployment.id,
        workspaceDir: timeoutWorkspace,
        repoDir: timeoutRepo,
        dockerfilePath: "Dockerfile",
        commitSha: "1111111111111111111111111111111111111111",
        commitMsg: "Timeout test",
        commitAuthor: "Tester <test@example.com>",
        imageTag: timeoutTag,
      };

      const startTime = Date.now();
      await assert.rejects(
        async () => executeDockerBuild(timeoutContext, undefined, { timeoutMs: 1500 }),
        /Docker build timed out/
      );
      const elapsed = Date.now() - startTime;

      // Verify execution aborted in ~1.5s (not 10 minutes or 10 seconds)
      assert.ok(elapsed < 6000, `Build should abort near timeout threshold (took ${elapsed}ms)`);

      // Verify Deployment state in DB
      const depInDb = await prisma.deployment.findUnique({
        where: { id: timeoutDeployment.id },
      });
      assert.strictEqual(depInDb?.status, "FAILED", "Deployment status must be FAILED on timeout");
      assert.strictEqual(depInDb?.exitCode, 1, "Exit code must be recorded as 1");
      assert.ok(depInDb?.errorMessage?.includes("Docker build timed out"), "Error message must reflect timeout");
      assert.ok((depInDb?.durationMs ?? 0) >= 1000, "Duration must be recorded");

      // Verify workspace cleanup on timeout
      assert.strictEqual(fs.existsSync(timeoutWorkspace), false, "Workspace must be removed on timeout");

      // Verify timeout log in DB
      const logs = await prisma.buildLog.findMany({
        where: { deploymentId: timeoutDeployment.id },
        orderBy: { sequence: "asc" },
      });
      const timeoutLog = logs.find((l) => l.line.includes("timed out"));
      assert.ok(timeoutLog, "Timeout log line must be captured and persisted");

      console.log("   ✓ Process terminated cleanly, status=FAILED, workspace removed, logs persisted\n");
    }

    // ----------------------------------------------------------------
    // TEST 2: IMAGE SIZE LIMIT ENFORCEMENT
    // ----------------------------------------------------------------
    console.log("[TEST 2/7] Image Size Limit Enforcement (> MAX_IMAGE_SIZE_BYTES)");
    {
      const sizeDeployment = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo-oversized",
          repositoryUrl: "https://github.com/test/repo-oversized",
          branch: "main",
          status: "INITIALIZING",
        },
      });

      const sizeWorkspace = path.resolve(SCRATCH_ROOT_DIR, sizeDeployment.id);
      const sizeRepo = path.join(sizeWorkspace, "repo");
      await fs.promises.mkdir(sizeRepo, { recursive: true });

      await fs.promises.writeFile(
        path.join(sizeRepo, "Dockerfile"),
        "FROM hello-world:latest\nCMD [\"echo\", \"size-test\"]\n"
      );

      const sizeTag = `cloudforge/deployment-${sizeDeployment.id}:oversized`;
      const sizeContext: BuildContext = {
        deploymentId: sizeDeployment.id,
        workspaceDir: sizeWorkspace,
        repoDir: sizeRepo,
        dockerfilePath: "Dockerfile",
        commitSha: "2222222222222222222222222222222222222222",
        commitMsg: "Oversized test",
        commitAuthor: "Tester <test@example.com>",
        imageTag: sizeTag,
      };

      // Mock inspect function returning MAX_IMAGE_SIZE_BYTES + 1024 bytes (2GB + 1KB)
      const mockOversizedSize = MAX_IMAGE_SIZE_BYTES + 1024;
      await assert.rejects(
        async () =>
          executeDockerBuild(sizeContext, undefined, {
            inspectSizeOverride: async () => mockOversizedSize,
          }),
        /Docker image size limit exceeded/
      );

      // Verify Deployment state in DB
      const depInDb = await prisma.deployment.findUnique({
        where: { id: sizeDeployment.id },
      });
      assert.strictEqual(depInDb?.status, "FAILED", "Deployment status must be FAILED for oversized image");
      assert.strictEqual(depInDb?.exitCode, 1, "Exit code must be 1");
      assert.ok(depInDb?.errorMessage?.includes("Docker image size limit exceeded"));

      // Verify oversized image was deleted from daemon
      await assert.rejects(
        async () => inspectDockerImageSize(sizeTag),
        /Failed to inspect image size/,
        "Oversized image must be purged from local daemon"
      );

      // Verify workspace is removed
      assert.strictEqual(fs.existsSync(sizeWorkspace), false, "Workspace must be cleaned up");

      // Verify system logs recorded the size rejection and deletion
      const logs = await prisma.buildLog.findMany({
        where: { deploymentId: sizeDeployment.id },
        orderBy: { sequence: "asc" },
      });
      const limitLog = logs.find((l) => l.line.includes("limit exceeded"));
      const purgeLog = logs.find((l) => l.line.includes("Oversized image removed"));
      assert.ok(limitLog, "Rejection log must be recorded");
      assert.ok(purgeLog, "Image deletion log must be recorded");

      console.log("   ✓ Oversized image rejected, tag purged, status=FAILED, workspace cleaned\n");
    }

    // ----------------------------------------------------------------
    // TEST 3: DOCKER DAEMON UNAVAILABLE
    // ----------------------------------------------------------------
    console.log("[TEST 3/7] Docker Daemon Unavailable / Unresponsive");
    {
      const daemonDeployment = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo-nodaemon",
          repositoryUrl: "https://github.com/test/repo-nodaemon",
          branch: "main",
          status: "INITIALIZING",
        },
      });

      const daemonWorkspace = path.resolve(SCRATCH_ROOT_DIR, daemonDeployment.id);
      const daemonRepo = path.join(daemonWorkspace, "repo");
      await fs.promises.mkdir(daemonRepo, { recursive: true });

      await fs.promises.writeFile(
        path.join(daemonRepo, "Dockerfile"),
        "FROM hello-world:latest\n"
      );

      const daemonTag = `cloudforge/deployment-${daemonDeployment.id}:nodaemon`;
      const daemonContext: BuildContext = {
        deploymentId: daemonDeployment.id,
        workspaceDir: daemonWorkspace,
        repoDir: daemonRepo,
        dockerfilePath: "Dockerfile",
        commitSha: "3333333333333333333333333333333333333333",
        commitMsg: "Daemon test",
        commitAuthor: "Tester <test@example.com>",
        imageTag: daemonTag,
      };

      // Mock daemon check throwing an error
      await assert.rejects(
        async () =>
          executeDockerBuild(daemonContext, undefined, {
            verifyDaemonOverride: async () => {
              throw new Error("Docker daemon is unavailable or returned exit code 1.");
            },
          }),
        /Docker daemon is unavailable/
      );

      // Verify Deployment state in DB
      const depInDb = await prisma.deployment.findUnique({
        where: { id: daemonDeployment.id },
      });
      assert.strictEqual(depInDb?.status, "FAILED", "Deployment must be FAILED on daemon error");
      assert.strictEqual(depInDb?.exitCode, 1);
      assert.ok(depInDb?.errorMessage?.includes("Docker daemon is unavailable"));

      // Verify workspace is cleaned up
      assert.strictEqual(fs.existsSync(daemonWorkspace), false, "Workspace must be cleaned up on daemon error");

      // Verify system log in DB
      const logs = await prisma.buildLog.findMany({
        where: { deploymentId: daemonDeployment.id },
      });
      assert.ok(logs.some((l) => l.line.includes("Docker daemon check failed")));

      console.log("   ✓ Daemon failure intercepted before build, status=FAILED, workspace cleaned\n");
    }

    // ----------------------------------------------------------------
    // TEST 4: BUILD LOG FINAL FLUSH
    // ----------------------------------------------------------------
    console.log("[TEST 4/7] Build Log Final Flush Verification");
    {
      const flushDeployment = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo-flush",
          repositoryUrl: "https://github.com/test/repo-flush",
          branch: "main",
          status: "INITIALIZING",
        },
      });

      const batcher = new BuildLogBatcher(flushDeployment.id);

      // Push 30 logs in rapid succession
      for (let i = 1; i <= 30; i++) {
        batcher.pushLine(`Flush test line ${i}`, LogStream.STDOUT);
      }

      // Add final system status line right before closing
      batcher.pushLine("[SYSTEM] Final log line before terminal completion", LogStream.SYSTEM);

      // Perform final flush
      await batcher.flushAll();

      // Query database
      const dbLogs = await prisma.buildLog.findMany({
        where: { deploymentId: flushDeployment.id },
        orderBy: { sequence: "asc" },
      });

      assert.strictEqual(dbLogs.length, 31, "All 31 lines including final trailing line must be in DB");
      assert.strictEqual(dbLogs[30].line, "[SYSTEM] Final log line before terminal completion");
      assert.strictEqual(dbLogs[30].sequence, 31);
      assert.strictEqual(dbLogs[30].stream, LogStream.SYSTEM);

      console.log("   ✓ All trailing log lines flushed and persisted before terminal update\n");
    }

    // ----------------------------------------------------------------
    // TEST 5: BUILD LOG CONCURRENCY & STRICT ORDERING
    // ----------------------------------------------------------------
    console.log("[TEST 5/7] Build Log Concurrency, Ordering & Gap-Free Sequence");
    {
      const concurDeployment = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo-concur",
          repositoryUrl: "https://github.com/test/repo-concur",
          branch: "main",
          status: "INITIALIZING",
        },
      });

      const batcher = new BuildLogBatcher(concurDeployment.id);
      const secret = "ghp_superSecretTokenForConcurrency123";

      // Concurrently emit stdout and stderr lines
      const totalLines = 80;
      for (let i = 1; i <= totalLines; i++) {
        const stream = i % 3 === 0 ? LogStream.SYSTEM : i % 2 === 0 ? LogStream.STDOUT : LogStream.STDERR;
        const text = i === 42 ? `Token leak check: ${secret}` : `Concurrent line ${i}`;
        batcher.pushLine(text, stream, secret);
      }

      await batcher.flushAll();

      const logs = await prisma.buildLog.findMany({
        where: { deploymentId: concurDeployment.id },
        orderBy: { sequence: "asc" },
      });

      assert.strictEqual(logs.length, totalLines, `Must contain exactly ${totalLines} logs`);

      // Verify sequence is strictly 1..totalLines with no gaps, duplicates, or negative sequences
      for (let i = 0; i < totalLines; i++) {
        assert.strictEqual(logs[i].sequence, i + 1, `Sequence must strictly be ${i + 1}`);
      }

      // Verify stream mapping integrity
      assert.strictEqual(logs[0].stream, LogStream.STDERR); // i = 1
      assert.strictEqual(logs[1].stream, LogStream.STDOUT); // i = 2
      assert.strictEqual(logs[2].stream, LogStream.SYSTEM); // i = 3

      // Verify token redaction across concurrent lines
      const line42 = logs[41];
      assert.strictEqual(line42.sequence, 42);
      assert.strictEqual(line42.line.includes(secret), false, "Secret must be redacted");
      assert.strictEqual(line42.line.includes("[REDACTED_TOKEN]"), true, "Token replaced with [REDACTED_TOKEN]");

      console.log("   ✓ Gap-free monotonic sequence 1..80 verified; streams & redaction verified\n");
    }

    // ----------------------------------------------------------------
    // TEST 6: SUCCESSFUL IMAGE RETENTION & RUNTIME READINESS
    // ----------------------------------------------------------------
    console.log("[TEST 6/7] Successful Build Image Retention & Workspace Removal");
    {
      const successDeployment = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo-retention",
          repositoryUrl: "https://github.com/test/repo-retention",
          branch: "main",
          status: "INITIALIZING",
        },
      });

      const successWorkspace = path.resolve(SCRATCH_ROOT_DIR, successDeployment.id);
      const successRepo = path.join(successWorkspace, "repo");
      await fs.promises.mkdir(successRepo, { recursive: true });

      await fs.promises.writeFile(
        path.join(successRepo, "Dockerfile"),
        "FROM hello-world:latest\nCMD [\"echo\", \"retention-test\"]\n"
      );

      const successTag = `cloudforge/deployment-${successDeployment.id}:retained`;
      const successContext: BuildContext = {
        deploymentId: successDeployment.id,
        workspaceDir: successWorkspace,
        repoDir: successRepo,
        dockerfilePath: "Dockerfile",
        commitSha: "6666666666666666666666666666666666666666",
        commitMsg: "Retention test",
        commitAuthor: "Tester <test@example.com>",
        imageTag: successTag,
      };

      const result = await executeDockerBuild(successContext);

      // Verify result and DB
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(result.imageTag, successTag);

      const depInDb = await prisma.deployment.findUnique({
        where: { id: successDeployment.id },
      });
      assert.strictEqual(depInDb?.status, "BUILT");
      assert.strictEqual(depInDb?.exitCode, 0);

      // Verify image exists in Docker daemon
      const imageSize = await inspectDockerImageSize(successTag);
      assert.ok(imageSize > 0, "Image must exist in Docker daemon");

      // Verify workspace is completely removed
      assert.strictEqual(fs.existsSync(successWorkspace), false, "Workspace directory must be cleaned up");

      console.log("   ✓ Image retained in Docker daemon for runtime phase, workspace cleaned\n");

      // ----------------------------------------------------------------
      // TEST 7: SPECIFIC OVERSIZED IMAGE CLEANUP (NO GLOBAL PRUNING)
      // ----------------------------------------------------------------
      console.log("[TEST 7/7] Specific Image Deletion (No Global Pruning)");
      {
        // Delete only the successTag
        await deleteDockerImage(successTag);

        // Verify successTag is gone
        await assert.rejects(
          async () => inspectDockerImageSize(successTag),
          /Failed to inspect image size/,
          "Specific tag must be deleted"
        );

        // Verify base images (hello-world & alpine) remain completely intact
        const helloSize = await inspectDockerImageSize("hello-world:latest");
        assert.ok(helloSize > 0, "hello-world:latest must not be deleted");

        const alpineSize = await inspectDockerImageSize("alpine:latest");
        assert.ok(alpineSize > 0, "alpine:latest must not be deleted");

        console.log("   ✓ Specific tag deleted cleanly without affecting base images or global daemon\n");
      }
    }

    // ----------------------------------------------------------------
    // TEST 8: BUILD LOG FLUSH FAILURE RECOVERY & SEQUENCE PRESERVATION
    // ----------------------------------------------------------------
    console.log("[TEST 8/8] Build Log Flush Failure Recovery & Sequence Preservation");
    {
      const failDeployment = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo-fail-flush",
          repositoryUrl: "https://github.com/test/repo-fail-flush",
          branch: "main",
          status: "INITIALIZING",
        },
      });

      const batcher = new BuildLogBatcher(failDeployment.id);

      // Push initial lines
      batcher.pushLine("Line 1", LogStream.STDOUT);
      batcher.pushLine("Line 2", LogStream.STDOUT);
      batcher.pushLine("Line 3", LogStream.STDERR);

      // Mock prisma.buildLog.createMany to simulate temporary DB failure
      const originalCreateMany = prisma.buildLog.createMany;
      let failOnce = true;
      (prisma.buildLog as any).createMany = async (...args: any[]) => {
        if (failOnce) {
          failOnce = false;
          throw new Error("Simulated database connection failure");
        }
        return (originalCreateMany as any).apply(prisma.buildLog, args);
      };

      try {
        // Attempt flush which fails
        await assert.rejects(
          async () => batcher.flush(),
          /Simulated database connection failure/
        );

        // Verify that in the database, 0 lines were persisted
        const logsAfterFail = await prisma.buildLog.findMany({
          where: { deploymentId: failDeployment.id },
        });
        assert.strictEqual(logsAfterFail.length, 0, "No logs should be persisted on failure");

        // Push another line after failure
        batcher.pushLine("Line 4 after recovery", LogStream.SYSTEM);

        // Now retry/flushAll - this should succeed and persist ALL lines in exact original sequence order
        await batcher.flushAll();

        const logsAfterSuccess = await prisma.buildLog.findMany({
          where: { deploymentId: failDeployment.id },
          orderBy: { sequence: "asc" },
        });

        assert.strictEqual(logsAfterSuccess.length, 4, "All 4 lines must be persisted without data loss");
        assert.strictEqual(logsAfterSuccess[0].line, "Line 1");
        assert.strictEqual(logsAfterSuccess[0].sequence, 1);
        assert.strictEqual(logsAfterSuccess[1].line, "Line 2");
        assert.strictEqual(logsAfterSuccess[1].sequence, 2);
        assert.strictEqual(logsAfterSuccess[2].line, "Line 3");
        assert.strictEqual(logsAfterSuccess[2].sequence, 3);
        assert.strictEqual(logsAfterSuccess[3].line, "Line 4 after recovery");
        assert.strictEqual(logsAfterSuccess[3].sequence, 4);

        console.log("   ✓ Failed batch preserved, sequence numbers gap-free, and re-flushed successfully\n");
      } finally {
        prisma.buildLog.createMany = originalCreateMany;
      }
    }

    // ----------------------------------------------------------------
    // TEST 9: DOCKER INSPECT / DELETE SPAWN ERROR EVENT HANDLING
    // ----------------------------------------------------------------
    console.log("[TEST 9/9] Docker Inspect / Delete Spawn Error Event Handling");
    {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cp = require("child_process");
      const originalSpawn = cp.spawn;

      try {
        const { EventEmitter } = await import("events");

        cp.spawn = () => {
          const fakeChild: any = new EventEmitter();
          fakeChild.stdout = new EventEmitter();
          fakeChild.stderr = new EventEmitter();
          setImmediate(() => {
            fakeChild.emit("error", new Error("spawn ENOENT: docker not found"));
          });
          return fakeChild;
        };

        // 1. Verify inspectDockerImageSize rejects cleanly on spawn error without crashing process
        await assert.rejects(
          async () => inspectDockerImageSize("test-tag:missing"),
          /Failed to spawn docker inspect for test-tag:missing: spawn ENOENT/
        );

        // 2. Verify deleteDockerImage catches spawn error and resolves without throwing unhandled error
        await deleteDockerImage("test-tag:missing");

        console.log("   ✓ Child process spawn errors handled gracefully without unhandled exceptions");

        // 3. Verify inspectDockerImageSize rejects cleanly on timeout without hanging
        cp.spawn = () => {
          const fakeChild: any = new EventEmitter();
          fakeChild.stdout = new EventEmitter();
          fakeChild.stderr = new EventEmitter();
          // Simulates unresponsive/hung child process that never emits error or close
          return fakeChild;
        };

        await assert.rejects(
          async () => inspectDockerImageSize("test-tag:hung", 100),
          /docker inspect for test-tag:hung timed out/
        );

        // 4. Verify deleteDockerImage resolves gracefully on timeout without hanging
        await deleteDockerImage("test-tag:hung", 100);

        console.log("   ✓ Process timeouts for inspect and delete handled deterministically without process hang\n");
      } finally {
        cp.spawn = originalSpawn;
      }
    }
  } finally {
    // Clean up test database records
    await prisma.user.delete({ where: { id: testUser.id } });
  }

  console.log("==================================================================");
  console.log("  ALL 9 PHASE 1.3 VERIFICATION TEST SUITES PASSED SUCCESSFULLY!   ");
  console.log("==================================================================");
}

runTests().catch(async (err) => {
  console.error("\n❌ Test execution failed:", err);
  process.exit(1);
});
