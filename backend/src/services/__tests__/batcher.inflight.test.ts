import assert from "assert";
import prisma from "../../lib/prisma";
import { BuildLogBatcher } from "../docker.service";
import { LogStream } from "@prisma/client";

async function runInflightBatcherTests() {
  console.log("==================================================================");
  console.log("  BUILD LOG BATCHER: IN-FLIGHT CONCURRENCY & FLUSHALL REGRESSION  ");
  console.log("==================================================================\n");

  const testUser = await prisma.user.create({
    data: {
      name: "Batcher Inflight User",
      email: `batcher-inflight-${Date.now()}@example.com`,
    },
  });

  const testProject = await prisma.project.create({
    data: {
      name: "batcher-inflight-proj",
      userId: testUser.id,
    },
  });

  const originalCreateMany = prisma.buildLog.createMany;

  try {
    // ----------------------------------------------------------------
    // TEST 1: flushAll awaits in-flight flush without hang or log loss
    // ----------------------------------------------------------------
    console.log("[TEST 1/3] flushAll() cleanly awaits active in-flight flush & drains queue");
    {
      const dep1 = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo-inflight-1",
          repositoryUrl: "https://github.com/test/repo-inflight-1",
          branch: "main",
          status: "INITIALIZING",
        },
      });

      const batcher = new BuildLogBatcher(dep1.id);
      const totalLines = 75; // 50 in first batch, 25 in second batch

      for (let i = 1; i <= totalLines; i++) {
        batcher.pushLine(`Line ${i}`, LogStream.STDOUT);
      }

      // Add a simulated 60ms DB latency to createMany
      let createManyCallCount = 0;
      (prisma.buildLog as any).createMany = async (args: any) => {
        createManyCallCount++;
        await new Promise((r) => setTimeout(r, 60));
        return originalCreateMany.call(prisma.buildLog, args);
      };

      // Trigger flush() (as if from setInterval timer)
      const backgroundFlushPromise = batcher.flush();

      // Immediately call flushAll() while background flush is in-flight
      const flushAllStartTime = Date.now();
      await batcher.flushAll();
      const elapsed = Date.now() - flushAllStartTime;

      // Also ensure background promise settled
      await backgroundFlushPromise;

      assert.ok(elapsed >= 50, `flushAll must have awaited in-flight DB write (elapsed: ${elapsed}ms)`);
      assert.strictEqual(createManyCallCount, 2, "Expected 2 createMany batches (50 + 25)");

      const savedLogs = await prisma.buildLog.findMany({
        where: { deploymentId: dep1.id },
        orderBy: { sequence: "asc" },
      });

      assert.strictEqual(savedLogs.length, totalLines, `Expected ${totalLines} logs saved`);
      for (let i = 0; i < totalLines; i++) {
        assert.strictEqual(savedLogs[i].sequence, i + 1, `Log sequence must be ${i + 1}`);
        assert.strictEqual(savedLogs[i].line, `Line ${i + 1}`);
      }

      console.log("   ✓ flushAll waited for active flush, drained second batch, preserved 1..75 sequence\n");
    }

    // ----------------------------------------------------------------
    // TEST 2: flushAll when all items are in the single in-flight batch
    // ----------------------------------------------------------------
    console.log("[TEST 2/3] flushAll() waits when queue is 0 but batch is in-flight");
    {
      const dep2 = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo-inflight-2",
          repositoryUrl: "https://github.com/test/repo-inflight-2",
          branch: "main",
          status: "INITIALIZING",
        },
      });

      const batcher = new BuildLogBatcher(dep2.id);
      const totalLines = 30; // Fits entirely within 1 batch of 50

      for (let i = 1; i <= totalLines; i++) {
        batcher.pushLine(`Dep2 Line ${i}`, LogStream.SYSTEM);
      }

      let inFlightSettled = false;
      (prisma.buildLog as any).createMany = async (args: any) => {
        await new Promise((r) => setTimeout(r, 80));
        inFlightSettled = true;
        return originalCreateMany.call(prisma.buildLog, args);
      };

      // Start flush (queue becomes 0 immediately as 30 lines are spliced)
      const pFlush = batcher.flush();

      // Concurrently call flushAll
      await batcher.flushAll();
      await pFlush;

      assert.strictEqual(inFlightSettled, true, "flushAll must not return before in-flight write settles");

      const savedLogs = await prisma.buildLog.findMany({
        where: { deploymentId: dep2.id },
        orderBy: { sequence: "asc" },
      });

      assert.strictEqual(savedLogs.length, totalLines);
      console.log("   ✓ flushAll ensured in-flight batch was fully committed to DB\n");
    }

    // ----------------------------------------------------------------
    // TEST 3: Failure during in-flight write unshifts and rolls back safely
    // ----------------------------------------------------------------
    console.log("[TEST 3/3] Error during in-flight write unshifts batch back without loss");
    {
      const dep3 = await prisma.deployment.create({
        data: {
          projectId: testProject.id,
          repositoryName: "test/repo-inflight-3",
          repositoryUrl: "https://github.com/test/repo-inflight-3",
          branch: "main",
          status: "INITIALIZING",
        },
      });

      const batcher = new BuildLogBatcher(dep3.id);
      for (let i = 1; i <= 10; i++) {
        batcher.pushLine(`Rollback Line ${i}`, LogStream.STDERR);
      }

      // Simulate transient DB failure on first call
      let shouldFail = true;
      (prisma.buildLog as any).createMany = async (args: any) => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("Simulated transient PostgreSQL connection failure");
        }
        return originalCreateMany.call(prisma.buildLog, args);
      };

      // flush() should fail and unshift
      await assert.rejects(
        async () => {
          await batcher.flush();
        },
        /Simulated transient PostgreSQL connection failure/
      );

      // Now retry via flushAll
      await batcher.flushAll();

      const savedLogs = await prisma.buildLog.findMany({
        where: { deploymentId: dep3.id },
        orderBy: { sequence: "asc" },
      });

      assert.strictEqual(savedLogs.length, 10, "All 10 logs must be preserved after retry");
      for (let i = 0; i < 10; i++) {
        assert.strictEqual(savedLogs[i].sequence, i + 1);
        assert.strictEqual(savedLogs[i].line, `Rollback Line ${i + 1}`);
      }

      console.log("   ✓ Spliced batch cleanly restored on error and persisted upon retry\n");
    }

    console.log("==================================================================");
    console.log("  ALL BUILD LOG BATCHER IN-FLIGHT CONCURRENCY TESTS PASSED!       ");
    console.log("==================================================================\n");
  } finally {
    prisma.buildLog.createMany = originalCreateMany;

    // Cleanup test data
    try {
      await prisma.buildLog.deleteMany({
        where: { deployment: { project: { userId: testUser.id } } },
      });
      await prisma.deployment.deleteMany({
        where: { project: { userId: testUser.id } },
      });
      await prisma.project.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      });
    } catch {}
  }
}

runInflightBatcherTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
