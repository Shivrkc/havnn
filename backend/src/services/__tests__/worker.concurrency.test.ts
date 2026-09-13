import assert from "assert";
import { DeploymentWorker } from "../deployment.worker";
import { Deployment } from "@prisma/client";

async function runTest() {
  console.log("Starting DeploymentWorker Concurrency & Race Condition Regression Tests...\n");

  const worker = new DeploymentWorker("test-worker-concurrency");

  try {
    // --------------------------------------------------------------------------
    // 1. Race condition around await claimNextDeployment()
    // --------------------------------------------------------------------------
    console.log("1. Testing concurrent processNext() calls during await claimNextDeployment()...");

    let activePipelines = 0;
    let maxObservedConcurrentPipelines = 0;
    let pipelineExecutionCount = 0;

    const mockDeployment: any = {
      id: "dep-mock-123",
      projectId: "proj-mock-123",
      status: "INITIALIZING",
      createdAt: new Date(),
    };

    // Simulate async DB query in claimNextDeployment with an intentional delay on first claim, then null for drain
    let hasClaimed = false;
    (worker as any).claimNextDeployment = async (): Promise<any> => {
      if (!hasClaimed) {
        hasClaimed = true;
        // Intentional delay to widen the race window
        await new Promise((resolve) => setTimeout(resolve, 60));
        return mockDeployment;
      }
      return null;
    };

    // Track active executions inside executePipeline
    (worker as any).executePipeline = async (_dep: Deployment): Promise<void> => {
      pipelineExecutionCount++;
      activePipelines++;
      if (activePipelines > maxObservedConcurrentPipelines) {
        maxObservedConcurrentPipelines = activePipelines;
      }
      assert.strictEqual(
        activePipelines,
        1,
        "CRITICAL: More than 1 pipeline is executing simultaneously on the same worker!"
      );
      // Simulate pipeline work
      await new Promise((resolve) => setTimeout(resolve, 30));
      activePipelines--;
    };

    // Trigger processNext, and while claimNextDeployment is in-flight, fire concurrent processNext and notify calls
    const p1 = worker.processNext();
    // Immediately attempt concurrent entry points while p1 is awaiting claimNextDeployment
    const p2 = worker.processNext();
    const p3 = worker.processNext();
    worker.notify();

    await Promise.all([p1, p2, p3]);

    // Give the drain iteration time to complete its check and find null
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(maxObservedConcurrentPipelines, 1, "Concurrency must never exceed 1");
    assert.strictEqual(pipelineExecutionCount, 1, "Exactly one pipeline execution should have occurred");
    assert.strictEqual((worker as any).isProcessing, false, "Worker isProcessing should be false after completion");
    console.log("   ✓ Worker successfully blocked concurrent executions during claimNextDeployment() await");
    console.log("   ✓ Maximum concurrent pipelines observed: " + maxObservedConcurrentPipelines);

    // --------------------------------------------------------------------------
    // 2. Recovery when claimNextDeployment throws
    // --------------------------------------------------------------------------
    console.log("\n2. Testing isProcessing reset when claimNextDeployment throws...");
    (worker as any).claimNextDeployment = async (): Promise<Deployment | null> => {
      throw new Error("Simulated DB connection failure in claim");
    };

    await worker.processNext();
    assert.strictEqual((worker as any).isProcessing, false, "isProcessing must be false after claim error");
    console.log("   ✓ isProcessing cleanly reset to false on claim exception");

    // --------------------------------------------------------------------------
    // 3. Recovery when claimNextDeployment returns null
    // --------------------------------------------------------------------------
    console.log("\n3. Testing isProcessing reset when claimNextDeployment returns null (no queued jobs)...");
    (worker as any).claimNextDeployment = async (): Promise<Deployment | null> => {
      return null;
    };

    await worker.processNext();
    assert.strictEqual((worker as any).isProcessing, false, "isProcessing must be false when no jobs found");
    console.log("   ✓ isProcessing cleanly reset to false when queue is empty");

    // --------------------------------------------------------------------------
    // 4. Worker continues processing subsequent jobs after errors / empty queue
    // --------------------------------------------------------------------------
    console.log("\n4. Testing worker can process subsequent jobs normally...");
    let secondJobProcessed = false;
    let secondClaimed = false;
    (worker as any).claimNextDeployment = async (): Promise<any> => {
      if (!secondClaimed) {
        secondClaimed = true;
        return { ...mockDeployment, id: "dep-mock-456" };
      }
      return null;
    };
    (worker as any).executePipeline = async (_dep: Deployment): Promise<void> => {
      secondJobProcessed = true;
    };

    await worker.processNext();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(secondJobProcessed, true, "Worker should process subsequent jobs");
    assert.strictEqual((worker as any).isProcessing, false, "Worker should finish with isProcessing false");
    console.log("   ✓ Worker correctly processed subsequent job and remained unstuck");

    console.log("\n==================================================================");
    console.log("  ALL DEPLOYMENT WORKER CONCURRENCY REGRESSION TESTS PASSED!      ");
    console.log("==================================================================");
  } finally {
    worker.stop();
  }
}

runTest().catch((err) => {
  console.error("Worker concurrency test failed:", err);
  process.exit(1);
});
