import assert from "assert";
import prisma from "../../lib/prisma";
import { LogStream } from "@prisma/client";
import {
  queryDeploymentAi,
  setAiClientOverride,
  resetAiClientOverride,
  AiClient,
  extractAndValidateCitations,
} from "../ai.service";
import { aiCacheService } from "../ai-cache.service";
import { queryDeploymentAiHandler, aiRateLimiter } from "../../controllers/ai.controller";

/**
 * AI CACHE, OBSERVABILITY & DEMO RELIABILITY VERIFICATION SUITE
 * Configured for gemini-3.1-flash-lite
 */
async function runAiCacheTests() {
  console.log("==================================================================");
  console.log("  AI CACHE, OBSERVABILITY & DEMO RELIABILITY TEST SUITE           ");
  console.log("  Target Model: gemini-3.1-flash-lite                             ");
  console.log("==================================================================\n");

  const timestamp = Date.now();
  let user: any;
  let project: any;
  let deploymentA: any;
  let deploymentB: any;

  let providerCallCount = 0;
  let lastCapturedParams: any = null;

  const mockAiClient: AiClient = {
    generateContent: async (params) => {
      providerCallCount++;
      lastCapturedParams = params;
      if (params.prompt.includes('USER\'S EXACT QUESTION:\n"What is Docker?"')) {
        return "Docker is an open-source platform that enables developers to automate application deployment in lightweight containers.";
      }
      if (params.prompt.includes('USER\'S EXACT QUESTION:\n"What is Kubernetes?"')) {
        return "Kubernetes is an open-source container orchestration engine for automating deployment, scaling, and operations of application containers.";
      }
      if (params.prompt.includes('USER\'S EXACT QUESTION:\n"Why did my build fail?"')) {
        return "The build failed because of an error at [Seq #2] during execution.";
      }
      return `### Technical Diagnosis\nDocker build completed successfully.\n\n### Evidence\n- [Seq #2] Node 18 base image\n- [Seq #3] Working directory /app\n- [Seq #999] Hallucinated sequence`;
    },
  };

  try {
    setAiClientOverride(mockAiClient);

    // --------------------------------------------------------------------------
    // SETUP: Test User, Project, and Deployments with Logs
    // --------------------------------------------------------------------------
    user = await prisma.user.create({
      data: {
        email: `ai-cache-test-${timestamp}@example.com`,
        name: "AI Cache Tester",
      },
    });

    project = await prisma.project.create({
      data: {
        name: "AI Cache Project",
        repositoryUrl: "https://github.com/example/ai-cache",
        userId: user.id,
      },
    });

    deploymentA = await prisma.deployment.create({
      data: {
        projectId: project.id,
        status: "BUILT",
        repositoryName: "example/ai-cache",
        repositoryUrl: "https://github.com/example/ai-cache",
        branch: "main",
        durationMs: 30000,
        logs: {
          createMany: {
            data: [
              { sequence: 1, stream: LogStream.SYSTEM, line: "[SYSTEM] Worker claimed deployment." },
              { sequence: 2, stream: LogStream.STDOUT, line: "Step 1/3 : FROM node:18-alpine" },
              { sequence: 3, stream: LogStream.STDOUT, line: "Step 2/3 : WORKDIR /app" },
              { sequence: 4, stream: LogStream.SYSTEM, line: "[SYSTEM] Image built successfully." },
            ],
          },
        },
      },
    });

    deploymentB = await prisma.deployment.create({
      data: {
        projectId: project.id,
        status: "FAILED",
        repositoryName: "example/ai-cache",
        repositoryUrl: "https://github.com/example/ai-cache",
        branch: "feature",
        durationMs: 15000,
        logs: {
          createMany: {
            data: [
              { sequence: 1, stream: LogStream.SYSTEM, line: "[SYSTEM] Worker claimed deployment." },
              { sequence: 2, stream: LogStream.STDERR, line: "Error: Build failed." },
            ],
          },
        },
      },
    });

    // --------------------------------------------------------------------------
    // Test 1: Summary with gemini-3.1-flash-lite (Cache Miss & Hit)
    // --------------------------------------------------------------------------
    console.log("Test 1: Summary with gemini-3.1-flash-lite (Cache Miss & Hit)...");
    providerCallCount = 0;

    const res1 = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "expert",
      action: "summary",
    });
    assert.strictEqual(res1.cached, false, "First call must be a cache miss (cached: false)");
    assert.strictEqual(res1.model, "gemini-3.1-flash-lite", "Model must be gemini-3.1-flash-lite");
    assert.strictEqual(lastCapturedParams.model, "gemini-3.1-flash-lite");
    assert.strictEqual(providerCallCount, 1, "Provider should be called once on cache miss");

    const res2 = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "expert",
      action: "summary",
    });
    assert.strictEqual(res2.cached, true, "Second identical call must be a cache hit (cached: true)");
    assert.strictEqual(res2.model, "gemini-3.1-flash-lite");
    assert.strictEqual(providerCallCount, 1, "Provider must NOT be called again on cache hit");
    assert.strictEqual(res1.answer, res2.answer, "Answers must match exactly");
    console.log("  ✓ Test 1 passed: Summary runs with gemini-3.1-flash-lite and caches reliably\n");

    // --------------------------------------------------------------------------
    // Test 2: Analysis with gemini-3.1-flash-lite (Separate Cache Entry)
    // --------------------------------------------------------------------------
    console.log("Test 2: Analysis with gemini-3.1-flash-lite (Separate Cache Entry)...");
    const resAnalysis = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "expert",
      action: "analysis",
    });
    assert.strictEqual(resAnalysis.cached, false, "Analysis must be a cache miss");
    assert.strictEqual(resAnalysis.model, "gemini-3.1-flash-lite");
    assert.strictEqual(providerCallCount, 2, "Provider must be called for different action");
    console.log("  ✓ Test 2 passed: Analysis generates distinct cache entry with gemini-3.1-flash-lite\n");

    // --------------------------------------------------------------------------
    // Test 3: Optimization & Learn Actions
    // --------------------------------------------------------------------------
    console.log("Test 3: Optimization and Learn actions maintain distinct cache entries...");
    const resOpt = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "expert",
      action: "optimization",
    });
    assert.strictEqual(resOpt.cached, false);
    assert.strictEqual(resOpt.action, "optimization");
    assert.strictEqual(resOpt.model, "gemini-3.1-flash-lite");
    assert.strictEqual(providerCallCount, 3);

    const resLearn = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "beginner",
      action: "learn",
    });
    assert.strictEqual(resLearn.cached, false);
    assert.strictEqual(resLearn.action, "learn");
    assert.strictEqual(resLearn.model, "gemini-3.1-flash-lite");
    assert.strictEqual(providerCallCount, 4);
    console.log("  ✓ Test 3 passed: Optimization and Learn actions execute and cache independently\n");

    // --------------------------------------------------------------------------
    // Test 4: Cache Isolation Across Deployments
    // --------------------------------------------------------------------------
    console.log("Test 4: Cache isolation between different deployments...");
    const resDepB = await queryDeploymentAi(deploymentB.id, user.id, {
      mode: "expert",
      action: "summary",
    });
    assert.strictEqual(resDepB.cached, false, "Different deployment must be a cache miss");
    assert.strictEqual(providerCallCount, 5, "Provider must be called for different deployment");
    assert.strictEqual(resDepB.deploymentId, deploymentB.id);
    console.log("  ✓ Test 4 passed: Cache is strictly partitioned by deploymentId\n");

    // --------------------------------------------------------------------------
    // Test 5: Question Normalization on Custom Questions
    // --------------------------------------------------------------------------
    console.log("Test 5: Custom question whitespace and casing normalization...");
    const q1 = "  Why did   the Docker BUILD Fail?  ";
    const q2 = "why did the docker build fail?";

    const resQ1 = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "expert",
      action: "custom",
      question: q1,
    });
    assert.strictEqual(resQ1.cached, false, "First custom question is cache miss");
    assert.strictEqual(providerCallCount, 6);

    const resQ2 = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "expert",
      action: "custom",
      question: q2,
    });
    assert.strictEqual(resQ2.cached, true, "Normalized question should hit cache");
    assert.strictEqual(providerCallCount, 6, "Provider should NOT be called for normalized equivalent question");
    console.log("  ✓ Test 5 passed: Whitespace and casing normalized for custom questions\n");

    // --------------------------------------------------------------------------
    // Test 5b: Open-Ended Custom Questions Independence & Zero Cross-Contamination
    // Sequence: 1. Summary, 2. What is Docker?, 3. What is Kubernetes?, 4. Why did my build fail?, 5. What is Docker? (cached)
    // --------------------------------------------------------------------------
    console.log("Test 5b: Open-ended custom questions execute and cache independently...");
    const callsBefore = providerCallCount;

    // 1. Predefined summary check
    const summaryCheck = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "expert",
      action: "summary",
    });
    assert.strictEqual(summaryCheck.cached, true, "Existing summary should hit cache");
    assert.strictEqual(summaryCheck.action, "summary");

    // 2. Custom: What is Docker?
    const resDocker = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "beginner",
      action: "custom",
      question: "What is Docker?",
    });
    assert.strictEqual(resDocker.cached, false, "What is Docker? must be fresh provider call");
    assert(resDocker.answer.includes("Docker is an open-source platform"), "Must return Docker answer");
    assert.strictEqual(resDocker.action, "custom");
    assert.strictEqual(resDocker.question, "What is Docker?");
    assert.notStrictEqual(resDocker.answer, summaryCheck.answer, "Docker answer must not be Summary");
    assert(lastCapturedParams.systemInstruction.includes("CUSTOM_BEGINNER") || lastCapturedParams.systemInstruction.includes("custom question"), "Must use custom prompt instruction");

    // 3. Custom: What is Kubernetes?
    const resK8s = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "beginner",
      action: "custom",
      question: "What is Kubernetes?",
    });
    assert.strictEqual(resK8s.cached, false, "What is Kubernetes? must be fresh provider call");
    assert(resK8s.answer.includes("Kubernetes is an open-source container orchestration"), "Must return Kubernetes answer");
    assert.strictEqual(resK8s.action, "custom");
    assert.strictEqual(resK8s.question, "What is Kubernetes?");
    assert.notStrictEqual(resK8s.answer, resDocker.answer, "Kubernetes answer must not equal Docker answer");
    assert.notStrictEqual(resK8s.answer, summaryCheck.answer, "Kubernetes answer must not equal Summary");

    // 4. Custom: Why did my build fail?
    const resFail = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "beginner",
      action: "custom",
      question: "Why did my build fail?",
    });
    assert.strictEqual(resFail.cached, false, "Why did my build fail? must be fresh provider call");
    assert(resFail.answer.includes("The build failed because of an error"), "Must return failure explanation");
    assert.strictEqual(resFail.action, "custom");
    assert.strictEqual(resFail.question, "Why did my build fail?");
    assert.notStrictEqual(resFail.answer, resDocker.answer);
    assert.notStrictEqual(resFail.answer, resK8s.answer);

    // 5. Custom: What is Docker? again (must hit cache!)
    const resDockerCached = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "beginner",
      action: "custom",
      question: "What is Docker?",
    });
    assert.strictEqual(resDockerCached.cached, true, "Repeat question 'What is Docker?' must be a cache hit");
    assert.strictEqual(resDockerCached.answer, resDocker.answer, "Cached answer must match original Docker answer");
    assert.strictEqual(providerCallCount, callsBefore + 3, "Provider must only have been called for 3 new custom questions");
    console.log("  ✓ Test 5b passed: Custom questions are truly open-ended, distinct, and never cross-contaminate\n");

    // --------------------------------------------------------------------------
    // Test 6: Citation Validation against actual logs
    // --------------------------------------------------------------------------
    console.log("Test 6: Citation validation against deployment logs...");
    // Deployment A has logs with sequence numbers: 1, 2, 3, 4
    // Mock returned citations for [Seq #2], [Seq #3], and [Seq #999]
    assert(res1.citedSequences.includes(2), "Sequence 2 should be in valid citedSequences");
    assert(res1.citedSequences.includes(3), "Sequence 3 should be in valid citedSequences");
    assert(!res1.citedSequences.includes(999), "Sequence 999 is invalid and must not be in citedSequences");
    assert(res1.invalidCitations?.includes(999), "Sequence 999 must be recorded in invalidCitations");
    assert.strictEqual(res1.citationsValidated, false, "citationsValidated must be false when hallucinated sequence cited");

    // Direct unit test of extractAndValidateCitations
    const logSet = new Set([1, 2, 3, 4]);
    const validExtraction = extractAndValidateCitations(
      "All good here at [Seq #2] and [Seq #4].",
      logSet
    );
    assert.deepStrictEqual(validExtraction.citedSequences, [2, 4]);
    assert.deepStrictEqual(validExtraction.invalidCitations, []);
    assert.strictEqual(validExtraction.citationsValidated, true);
    console.log("  ✓ Test 6 passed: Citations validated against actual deployment log sequence numbers\n");

    // --------------------------------------------------------------------------
    // Test 7: Rate Limiter Does Not Block Cache Hits
    // --------------------------------------------------------------------------
    console.log("Test 7: Cache hits do not consume sliding-window rate limit tokens...");
    aiRateLimiter.reset();

    // Send 15 consecutive requests for a cached action (expert summary on deploymentA)
    let controllerSuccessCount = 0;
    for (let i = 0; i < 15; i++) {
      let status = 0;
      let body: any = null;
      await queryDeploymentAiHandler(
        {
          user: { id: user.id },
          params: { deploymentId: deploymentA.id },
          body: { mode: "expert", action: "summary" },
          headers: {},
        } as any,
        {
          setHeader: () => {},
          status: (s: number) => { status = s; return { json: (b: any) => { body = b; } }; },
        } as any
      );
      if (status === 200 && body?.data?.cached === true) {
        controllerSuccessCount++;
      }
    }
    assert.strictEqual(controllerSuccessCount, 15, "All 15 cache hits must succeed with 200 without rate limit block");
    console.log("  ✓ Test 7 passed: 15 cached requests served without hitting 10 RPM rate limiter\n");

    // --------------------------------------------------------------------------
    // Test 8: Fallback to Cached Diagnosis on Provider 503 / 429
    // --------------------------------------------------------------------------
    console.log("Test 8: Fallback to cached diagnosis when provider fails with 503/429...");
    setAiClientOverride(mockAiClient); // clear & re-prime cache
    await queryDeploymentAi(deploymentA.id, user.id, { mode: "expert", action: "summary" });

    // Switch client to failing mock without clearing cache
    const failingClient: AiClient = {
      generateContent: async () => {
        const err: any = new Error("The model is currently experiencing high demand.");
        err.status = 503;
        err.code = "AI_PROVIDER_UNAVAILABLE";
        throw err;
      },
    };
    (mockAiClient.generateContent as any) = failingClient.generateContent;

    const fallbackResult = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "expert",
      action: "summary",
    });
    assert.strictEqual(fallbackResult.cached, true, "Must serve cached diagnosis during provider outage");
    assert(fallbackResult.answer.length > 0, "Must contain previously cached answer");
    console.log("  ✓ Test 8 passed: Gracefully falls back to cached diagnosis during provider outage\n");

    // --------------------------------------------------------------------------
    // Test 9: Strict Error Propagation on Cache Miss with Provider Outage
    // --------------------------------------------------------------------------
    console.log("Test 9: Strict error propagation when uncached request encounters outage...");
    let caughtOutage = false;
    try {
      // analysis was never cached for deploymentB
      await queryDeploymentAi(deploymentB.id, user.id, {
        mode: "beginner",
        action: "analysis",
      });
    } catch (err: any) {
      caughtOutage = true;
      assert.strictEqual(err.status, 503);
    }
    assert(caughtOutage, "Must throw 503 when no cache exists (never fake AI responses)");
    console.log("  ✓ Test 9 passed: Uncached queries never fabricate fake responses on provider failure\n");

    // --------------------------------------------------------------------------
    // Test 10: Malformed/Empty Provider Response Handling
    // --------------------------------------------------------------------------
    console.log("Test 10: Malformed or empty provider response handling...");
    const emptyClient: AiClient = {
      generateContent: async () => {
        return ""; // empty response from upstream
      },
    };
    setAiClientOverride(emptyClient);

    let emptyResStatus = 0;
    let emptyResBody: any = null;
    await queryDeploymentAiHandler(
      {
        user: { id: user.id },
        params: { deploymentId: deploymentB.id },
        body: { mode: "expert", action: "optimization", bypassCache: true },
        headers: {},
      } as any,
      {
        setHeader: () => {},
        status: (s: number) => { emptyResStatus = s; return { json: (b: any) => { emptyResBody = b; } }; },
      } as any
    );
    assert.strictEqual(emptyResStatus, 502, "Must return HTTP 502 Bad Gateway for empty/malformed upstream response");
    assert.strictEqual(emptyResBody.code, "AI_PROVIDER_ERROR");
    console.log("  ✓ Test 10 passed: Empty/malformed provider response mapped cleanly to HTTP 502\n");

    // --------------------------------------------------------------------------
    // Test 11: Deployment Cache Invalidation
    // --------------------------------------------------------------------------
    console.log("Test 11: Invalidate deployment cache...");
    mockAiClient.generateContent = async () => "New build diagnosis";
    setAiClientOverride(mockAiClient);

    await queryDeploymentAi(deploymentA.id, user.id, { mode: "expert", action: "summary" });
    const evicted = aiCacheService.invalidateDeployment(deploymentA.id);
    assert(evicted > 0, "Should have evicted entries for deploymentA");

    const freshQuery = await queryDeploymentAi(deploymentA.id, user.id, {
      mode: "expert",
      action: "summary",
    });
    assert.strictEqual(freshQuery.cached, false, "Must be a cache miss after deployment invalidation");
    console.log("  ✓ Test 11 passed: Deployment cache successfully invalidated\n");

    console.log("==================================================================");
    console.log("  ALL 12 AI CACHE & RELIABILITY TESTS PASSED!                     ");
    console.log("==================================================================");
  } finally {
    resetAiClientOverride();
    if (project?.id) {
      await prisma.buildLog.deleteMany({ where: { deployment: { projectId: project.id } } });
      await prisma.deployment.deleteMany({ where: { projectId: project.id } });
      await prisma.project.delete({ where: { id: project.id } });
    }
    if (user?.id) {
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
}

runAiCacheTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("AI Cache Test failed:", err);
    process.exit(1);
  });
