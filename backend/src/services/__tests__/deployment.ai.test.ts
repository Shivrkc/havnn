import assert from "assert";
import prisma from "../../lib/prisma";
import { LogStream } from "@prisma/client";
import {
  queryDeploymentAi,
  setAiClientOverride,
  resetAiClientOverride,
  AiClient,
} from "../ai.service";
import { buildDeploymentAiContext } from "../ai-context.builder";
import { aiRateLimiter, queryDeploymentAiHandler } from "../../controllers/ai.controller";
import {
  BEGINNER_SYSTEM_PROMPT,
  EXPERT_SYSTEM_PROMPT,
  MAX_CONTEXT_LINES,
} from "../../constants/ai.constants";

/**
 * MODULE 7: AI ASSISTANT FOR LOGS REGRESSION & VERIFICATION SUITE
 */
async function runDeploymentAiTests() {
  console.log("==================================================================");
  console.log("  MODULE 7: AI ASSISTANT FOR LOGS REGRESSION & VERIFICATION SUITE ");
  console.log("==================================================================\n");

  const timestamp = Date.now();
  const testUserAEmail = `mod7-user-a-${timestamp}@example.com`;
  const testUserBEmail = `mod7-user-b-${timestamp}@example.com`;

  let userA: any;
  let userB: any;
  let projectA: any;
  let deploymentA: any;
  let failedDep: any;

  // Mock AI Provider to intercept and verify prompt structure deterministically
  let lastCapturedParams: any = null;
  const mockAiClient: AiClient = {
    generateContent: async (params) => {
      lastCapturedParams = params;
      if (params.systemInstruction.includes("Beginner Mode") || params.prompt.includes("BEGINNER")) {
        return `### What happened?\nThe build failed during package installation.\n\n### Why?\nTwo dependencies requested conflicting versions.\n\n### What should I do?\nUpdate package.json.\n\n### Step-by-step fix\n1. Run npm install --legacy-peer-deps.\n2. Commit the lockfile.\n\n### What to learn\nPeer dependencies require compatible versions across libraries.`;
      }
      return `### Root Cause\nDependency resolution failure in layer build step.\n\n### Evidence\n- \`[Seq #2]\` npm ERR! ERESOLVE unable to resolve dependency tree\n\n### Failure Stage\nDocker Build Step 3 (RUN npm ci)\n\n### Impact\nContainer image compilation aborted.\n\n### Recommended Investigation\nInspect package-lock.json peer dependencies.\n\n### Remediation\n\`\`\`bash\nnpm install --legacy-peer-deps\n\`\`\`\n\n### Trade-offs / Notes\nUsing legacy peer deps bypasses strict peer conflicts.`;
    },
  };

  try {
    // Inject mock AI client for deterministic test verification
    setAiClientOverride(mockAiClient);

    // --------------------------------------------------------------------------
    // SETUP: Test Users, Project, and Deployments
    // --------------------------------------------------------------------------
    userA = await prisma.user.create({
      data: {
        email: testUserAEmail,
        name: "Module 7 User A",
      },
    });

    userB = await prisma.user.create({
      data: {
        email: testUserBEmail,
        name: "Module 7 User B",
      },
    });

    projectA = await prisma.project.create({
      data: {
        name: "AI Test Project A",
        repositoryName: "testowner/ai-repo-a",
        repositoryUrl: "https://github.com/testowner/ai-repo-a",
        branch: "main",
        userId: userA.id,
      },
    });

    deploymentA = await prisma.deployment.create({
      data: {
        projectId: projectA.id,
        status: "BUILT",
        repositoryName: projectA.repositoryName,
        repositoryUrl: projectA.repositoryUrl,
        branch: "main",
        imageTag: "ai-test-tag:latest",
        durationMs: 45000,
        logs: {
          createMany: {
            data: [
              { sequence: 1, stream: LogStream.SYSTEM, line: "[SYSTEM] Worker claimed deployment." },
              { sequence: 2, stream: LogStream.STDOUT, line: "Step 1/5 : FROM node:18-alpine" },
              { sequence: 3, stream: LogStream.STDOUT, line: "Step 2/5 : WORKDIR /app" },
              { sequence: 4, stream: LogStream.STDOUT, line: "Step 3/5 : COPY package*.json ./" },
              { sequence: 5, stream: LogStream.STDOUT, line: "Step 4/5 : RUN npm ci" },
              { sequence: 6, stream: LogStream.SYSTEM, line: "[SYSTEM] Image built and verified successfully." },
            ],
          },
        },
      },
    });

    failedDep = await prisma.deployment.create({
      data: {
        projectId: projectA.id,
        status: "FAILED",
        repositoryName: projectA.repositoryName,
        repositoryUrl: projectA.repositoryUrl,
        branch: "main",
        durationMs: 12000,
        exitCode: 1,
        errorMessage: "Docker build failed with exit code 1.",
        logs: {
          createMany: {
            data: [
              { sequence: 1, stream: LogStream.SYSTEM, line: "[SYSTEM] Worker claimed deployment." },
              { sequence: 2, stream: LogStream.STDERR, line: "npm ERR! ERESOLVE unable to resolve dependency tree" },
              { sequence: 3, stream: LogStream.STDERR, line: "npm ERR! Conflicting peer dependency: react@18.0.0" },
              { sequence: 4, stream: LogStream.SYSTEM, line: "[SYSTEM] Deployment execution failed: Docker build failed with exit code 1." },
            ],
          },
        },
      },
    });

    // --------------------------------------------------------------------------
    // Test 1: Beginner Mode Structure & Output
    // --------------------------------------------------------------------------
    console.log("Test 1: Beginner mode structure & tone...");
    const resBeginner = await queryDeploymentAi(failedDep.id, userA.id, {
      mode: "beginner",
      action: "analysis",
    });

    assert.strictEqual(resBeginner.mode, "beginner");
    assert(resBeginner.answer.includes("### What happened?"), "Missing 'What happened?' section");
    assert(resBeginner.answer.includes("### Why?"), "Missing 'Why?' section");
    assert(resBeginner.answer.includes("### What should I do?"), "Missing 'What should I do?' section");
    assert(resBeginner.answer.includes("### Step-by-step fix"), "Missing 'Step-by-step fix' section");
    assert(resBeginner.answer.includes("### What to learn"), "Missing 'What to learn' section");
    assert(lastCapturedParams?.systemInstruction.includes("TARGET AUDIENCE: Beginners"));
    console.log("  ✓ Test 1 passed: Beginner mode delivers 5-part educational structure\n");

    // --------------------------------------------------------------------------
    // Test 2: Expert Mode Structure & Sequence Citations
    // --------------------------------------------------------------------------
    console.log("Test 2: Expert mode structure & sequence citations...");
    const resExpert = await queryDeploymentAi(failedDep.id, userA.id, {
      mode: "expert",
      action: "analysis",
    });

    assert.strictEqual(resExpert.mode, "expert");
    assert(resExpert.answer.includes("### Root Cause"), "Missing 'Root Cause' section");
    assert(resExpert.answer.includes("### Evidence"), "Missing 'Evidence' section");
    assert(resExpert.answer.includes("### Failure Stage"), "Missing 'Failure Stage' section");
    assert(resExpert.answer.includes("### Remediation"), "Missing 'Remediation' section");
    assert(resExpert.citedSequences.includes(2), "Expected sequence #2 to be cited in evidence");
    assert(lastCapturedParams?.systemInstruction.includes("TARGET AUDIENCE: Experienced software engineers"));
    console.log("  ✓ Test 2 passed: Expert mode provides technical root cause and exact sequence citations\n");

    // --------------------------------------------------------------------------
    // Test 3: Quick Action — Summary
    // --------------------------------------------------------------------------
    console.log("Test 3: Quick Action — Summary...");
    const resSummary = await queryDeploymentAi(deploymentA.id, userA.id, {
      mode: "expert",
      action: "summary",
    });
    assert.strictEqual(resSummary.action, "summary");
    assert(lastCapturedParams?.prompt.includes("summary covering final state"), "Prompt missing summary instructions");
    console.log("  ✓ Test 3 passed: Summary action synthesized properly\n");

    // --------------------------------------------------------------------------
    // Test 4: Quick Action — Analysis
    // --------------------------------------------------------------------------
    console.log("Test 4: Quick Action — Analysis...");
    const resAnalysis = await queryDeploymentAi(failedDep.id, userA.id, {
      mode: "beginner",
      action: "analysis",
    });
    assert.strictEqual(resAnalysis.action, "analysis");
    assert(lastCapturedParams?.prompt.includes("Analyze this deployment"), "Prompt missing analysis instructions");
    console.log("  ✓ Test 4 passed: Analysis action synthesized properly\n");

    // --------------------------------------------------------------------------
    // Test 5: Quick Action — Optimization
    // --------------------------------------------------------------------------
    console.log("Test 5: Quick Action — Optimization...");
    const resOpt = await queryDeploymentAi(deploymentA.id, userA.id, {
      mode: "expert",
      action: "optimization",
    });
    assert.strictEqual(resOpt.action, "optimization");
    assert(lastCapturedParams?.prompt.includes("caching, layer ordering, or multi-stage build"), "Prompt missing optimization instructions");
    console.log("  ✓ Test 5 passed: Optimization action synthesized properly\n");

    // --------------------------------------------------------------------------
    // Test 6: Quick Action — Learn
    // --------------------------------------------------------------------------
    console.log("Test 6: Quick Action — Learn...");
    const resLearn = await queryDeploymentAi(deploymentA.id, userA.id, {
      mode: "beginner",
      action: "learn",
    });
    assert.strictEqual(resLearn.action, "learn");
    assert(lastCapturedParams?.prompt.includes("Teach the core concepts"), "Prompt missing learn instructions");
    console.log("  ✓ Test 6 passed: Learn action synthesized properly\n");

    // --------------------------------------------------------------------------
    // Test 7: Free-Form Custom Questions
    // --------------------------------------------------------------------------
    console.log("Test 7: Free-form custom questions...");
    const customPrompt = "Why did the npm peer dependency conflict happen?";
    const resCustom = await queryDeploymentAi(failedDep.id, userA.id, {
      mode: "expert",
      action: "custom",
      question: customPrompt,
    });
    assert.strictEqual(resCustom.action, "custom");
    assert(lastCapturedParams?.prompt.includes(customPrompt), "User question missing in AI prompt");
    console.log("  ✓ Test 7 passed: Free-form user question embedded into context prompt\n");

    // --------------------------------------------------------------------------
    // Test 8: Large-Log Context Pruning & Bounding
    // --------------------------------------------------------------------------
    console.log("Test 8: Large-log context pruning & bounding...");
    const mockLogs: any[] = [];
    for (let i = 1; i <= 350; i++) {
      mockLogs.push({
        id: `mock-log-${i}`,
        deploymentId: deploymentA.id,
        sequence: i,
        stream: i === 1 ? LogStream.SYSTEM : i === 350 ? LogStream.SYSTEM : LogStream.STDOUT,
        line: `Intermediate build output line #${i}`,
        timestamp: new Date(),
      });
    }

    const contextResult = buildDeploymentAiContext(deploymentA, mockLogs);
    assert(
      contextResult.selectedLogCount <= MAX_CONTEXT_LINES,
      `Expected selected logs <= ${MAX_CONTEXT_LINES}, got ${contextResult.selectedLogCount}`
    );
    assert(
      contextResult.formattedContext.length <= 32_000,
      "Context formatted characters exceeded safe window"
    );
    assert(contextResult.formattedContext.includes("[Seq #1]"), "Context must retain startup SYSTEM line");
    assert(contextResult.formattedContext.includes("[Seq #350]"), "Context must retain trailing SYSTEM line");
    console.log(`  ✓ Test 8 passed: 350 logs cleanly bounded to ${contextResult.selectedLogCount} lines (<=${MAX_CONTEXT_LINES})\n`);

    // --------------------------------------------------------------------------
    // Test 9: Secret Sanitization Defense-in-Depth
    // --------------------------------------------------------------------------
    console.log("Test 9: Secret sanitization pass before AI model...");
    const unsanitizedLogs: any[] = [
      {
        id: "sec-1",
        deploymentId: deploymentA.id,
        sequence: 1,
        stream: LogStream.STDOUT,
        line: "Cloning repo with token ghp_123456789012345678901234567890123456 in path",
        timestamp: new Date(),
      },
      {
        id: "sec-2",
        deploymentId: deploymentA.id,
        sequence: 2,
        stream: LogStream.STDERR,
        line: "Authorization: Bearer mySecretBearer123456",
        timestamp: new Date(),
      },
      {
        id: "sec-3",
        deploymentId: deploymentA.id,
        sequence: 3,
        stream: LogStream.STDOUT,
        line: "User session token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
        timestamp: new Date(),
      },
    ];

    const sanitizedContext = buildDeploymentAiContext(deploymentA, unsanitizedLogs);
    assert(!sanitizedContext.formattedContext.includes("ghp_123456789012345678901234567890123456"));
    assert(sanitizedContext.formattedContext.includes("[REDACTED_TOKEN]"));
    assert(!sanitizedContext.formattedContext.includes("mySecretBearer123456"));
    assert(sanitizedContext.formattedContext.includes("Authorization: [REDACTED]"));
    assert(!sanitizedContext.formattedContext.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
    console.log("  ✓ Test 9 passed: GitHub tokens, Bearer headers, and JWTs sanitized before AI\n");

    // --------------------------------------------------------------------------
    // Test 10: Authorization Isolation (Cross-User Rejection)
    // --------------------------------------------------------------------------
    console.log("Test 10: Authorization isolation...");
    let authThrew = false;
    try {
      // User B attempts to query AI about User A's deployment
      await queryDeploymentAi(deploymentA.id, userB.id, {
        mode: "expert",
        action: "analysis",
      });
    } catch (err: any) {
      authThrew = true;
      assert.strictEqual(err.statusCode, 404, "Must return 404 for unauthorized access");
    }
    assert(authThrew, "Cross-user deployment AI query must throw 404");
    console.log("  ✓ Test 10 passed: Cross-user access rejected with 404 Not Found\n");

    // --------------------------------------------------------------------------
    // Test 11: Production Missing Configuration & Provider Error Handling
    // --------------------------------------------------------------------------
    console.log("Test 11: Provider error & missing configuration handling...");
    // Reset override to test real production check
    resetAiClientOverride();
    const originalApiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    let configThrew = false;
    try {
      await queryDeploymentAi(deploymentA.id, userA.id, {
        mode: "beginner",
        action: "summary",
      });
    } catch (err: any) {
      configThrew = true;
      assert.strictEqual(err.code, "AI_CONFIG_MISSING", "Must throw AI_CONFIG_MISSING when GEMINI_API_KEY is not set");
    } finally {
      if (originalApiKey) process.env.GEMINI_API_KEY = originalApiKey;
      // Re-inject mock for remaining tests
      setAiClientOverride(mockAiClient);
    }
    assert(configThrew, "Must refuse to generate mock responses when GEMINI_API_KEY is absent in production");
    console.log("  ✓ Test 11 passed: Missing production configuration throws AI_CONFIG_MISSING (no fake mocks)\n");

    // --------------------------------------------------------------------------
    // Test 12: Rate Limiting (10 Queries/Minute/User)
    // --------------------------------------------------------------------------
    console.log("Test 12: Rate limiting (10 queries/minute)...");
    aiRateLimiter.reset();
    const rateTestUserId = "test-rate-limit-user";

    // 10 allowed requests
    for (let i = 1; i <= 10; i++) {
      const check = aiRateLimiter.isAllowed(rateTestUserId);
      assert.strictEqual(check.allowed, true, `Request #${i} should be allowed`);
    }

    // 11th request must be blocked
    const blockedCheck = aiRateLimiter.isAllowed(rateTestUserId);
    assert.strictEqual(blockedCheck.allowed, false, "11th request must be blocked by rate limiter");
    assert(blockedCheck.retryAfterSec! > 0, "Blocked request must indicate retryAfterSec");

    // Reset rate limiter for clean state
    aiRateLimiter.reset();
    console.log("  ✓ Test 12 passed: Rate limiter strictly enforces 10 queries per minute per user\n");

    // --------------------------------------------------------------------------
    // Test 13: Quick Actions Independence & Prompt Isolation
    // --------------------------------------------------------------------------
    console.log("Test 13: Quick actions independence & prompt isolation...");
    const actions: Array<"summary" | "analysis" | "optimization" | "learn"> = [
      "summary",
      "analysis",
      "optimization",
      "learn",
    ];
    for (const act of actions) {
      await queryDeploymentAi(deploymentA.id, userA.id, {
        mode: "expert",
        action: act,
      });
      assert.strictEqual(lastCapturedParams.model, "gemini-3.6-flash");
      if (act === "summary") {
        assert(lastCapturedParams.prompt.includes("summary covering final state"), "Summary prompt isolation failed");
      } else if (act === "analysis") {
        assert(lastCapturedParams.prompt.includes("technical root cause analysis"), "Analysis prompt isolation failed");
      } else if (act === "optimization") {
        assert(lastCapturedParams.prompt.includes("caching, layer ordering"), "Optimization prompt isolation failed");
      } else if (act === "learn") {
        assert(lastCapturedParams.prompt.includes("underlying container mechanics"), "Learn prompt isolation failed");
      }
    }
    console.log("  ✓ Test 13 passed: All quick actions remain strictly independent and correctly isolated\n");

    // --------------------------------------------------------------------------
    // Test 14: Custom Action Empty Input Rejection (400 Bad Request)
    // --------------------------------------------------------------------------
    console.log("Test 14: Custom action empty input validation...");
    let emptyQuestionStatusCode: number | null = null;
    let emptyQuestionMessage: any = null;
    const mockReqEmpty: any = {
      user: { id: userA.id },
      params: { deploymentId: deploymentA.id },
      body: { mode: "beginner", action: "custom", question: "   " },
    };
    const mockResEmpty: any = {
      status: (code: number) => {
        emptyQuestionStatusCode = code;
        return {
          json: (data: any) => {
            emptyQuestionMessage = data.message;
          },
        };
      },
    };
    await queryDeploymentAiHandler(mockReqEmpty, mockResEmpty);
    assert.strictEqual(emptyQuestionStatusCode, 400, "Must return 400 for empty custom question");
    assert(typeof emptyQuestionMessage === "string" && emptyQuestionMessage.includes("non-empty question is required"), "Must indicate non-empty question requirement");
    console.log("  ✓ Test 14 passed: Empty or whitespace-only custom question rejected with 400 Bad Request\n");

    // --------------------------------------------------------------------------
    // Test 15: Provider 503 High Demand Mapping
    // --------------------------------------------------------------------------
    console.log("Test 15: Provider 503 high demand error mapping...");
    const failing503Client: AiClient = {
      generateContent: async () => {
        const err: any = new Error("The model is currently experiencing high demand. Spikes in demand are usually temporary.");
        err.status = 503;
        err.statusCode = 503;
        throw err;
      },
    };
    setAiClientOverride(failing503Client);

    let providerStatusCode: number | null = null;
    let providerErrorCode: string | null = null;
    let providerErrorMessage: any = null;

    const mockReq503: any = {
      user: { id: userA.id },
      params: { deploymentId: deploymentA.id },
      body: { mode: "expert", action: "analysis" },
    };
    const mockRes503: any = {
      status: (code: number) => {
        providerStatusCode = code;
        return {
          json: (data: any) => {
            providerErrorCode = data.code;
            providerErrorMessage = data.message;
          },
        };
      },
    };
    await queryDeploymentAiHandler(mockReq503, mockRes503);
    assert.strictEqual(providerStatusCode, 503, "Must return HTTP 503 for Gemini high-demand error");
    assert(typeof providerErrorMessage === "string" && providerErrorMessage.includes("high demand"), "Must inform user about temporary high-demand spike");
    console.log("  ✓ Test 15 passed: Gemini 503 high demand mapped cleanly without crashing or exposing fake data\n");

    // Re-inject standard mock AI client
    setAiClientOverride(mockAiClient);

    // --------------------------------------------------------------------------
    // Test 16: Custom Question Payload Preservation
    // --------------------------------------------------------------------------
    console.log("Test 16: Custom question payload preservation...");
    const targetQuestion = "Why did container step 4 RUN npm ci fail with ERESOLVE?";
    let customStatusCode: number | null = null;
    let customResponseData: any = null;

    const mockReqCustom: any = {
      user: { id: userA.id },
      params: { deploymentId: failedDep.id },
      body: { mode: "expert", action: "custom", question: targetQuestion },
    };
    const mockResCustom: any = {
      status: (code: number) => {
        customStatusCode = code;
        return {
          json: (data: any) => {
            customResponseData = data.data;
          },
        };
      },
    };
    await queryDeploymentAiHandler(mockReqCustom, mockResCustom);
    assert.strictEqual(customStatusCode, 200, "Custom AI request must return 200");
    assert.strictEqual(customResponseData?.action, "custom");
    assert(lastCapturedParams.prompt.includes(targetQuestion), "Custom question must be faithfully passed to prompt");
    console.log("  ✓ Test 16 passed: Custom question faithfully preserved and delivered to AI engine\n");

    // --------------------------------------------------------------------------
    // Test 17: Gemini 429 Quota Exhaustion Mapping & JSON Sanitization
    // --------------------------------------------------------------------------
    console.log("Test 17: Gemini 429 quota exhaustion mapped cleanly to HTTP 429 without leaking raw JSON...");
    const quota429Error: any = new Error(
      JSON.stringify({
        error: {
          code: 429,
          message: "You exceeded your current quota, please check your plan and billing details.",
          status: "RESOURCE_EXHAUSTED",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.QuotaFailure",
              violations: [
                {
                  quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
                  quotaValue: "20",
                },
              ],
            },
          ],
        },
      })
    );
    quota429Error.status = 429;

    const failing429Client: AiClient = {
      generateContent: async () => {
        throw quota429Error;
      },
    };
    setAiClientOverride(failing429Client);

    let quotaStatusCode: number | null = null;
    let quotaResponseData: any = null;
    const mockReq429: any = {
      user: { id: userA.id },
      params: { deploymentId: failedDep.id },
      body: { mode: "beginner", action: "analysis" },
    };
    const mockRes429: any = {
      setHeader: () => {},
      status: (code: number) => {
        quotaStatusCode = code;
        return {
          json: (data: any) => {
            quotaResponseData = data;
          },
        };
      },
    };
    await queryDeploymentAiHandler(mockReq429, mockRes429);
    assert.strictEqual(quotaStatusCode, 429, "Must return HTTP 429 for Gemini RESOURCE_EXHAUSTED");
    assert.strictEqual(quotaResponseData.code, "AI_QUOTA_EXHAUSTED");
    assert(!quotaResponseData.message.includes("quotaMetric"), "Raw Google RPC details must never be leaked");
    assert(!quotaResponseData.message.includes("{"), "Raw JSON must never be leaked in error message");
    assert(
      quotaResponseData.message.includes("Gemini free-tier quota has been exhausted"),
      "User-friendly quota exhaustion message must be returned"
    );
    assert.strictEqual(quotaResponseData.retryAfterSec, undefined, "Daily quota exhaustion must not return misleading short retry delay");
    console.log("  ✓ Test 17 passed: Gemini 429 daily/free-tier quota exhaustion mapped cleanly with zero raw JSON leakage\n");

    // --------------------------------------------------------------------------
    // Test 18: Temporary Rate Limit Mapping (Per-Minute / Burst)
    // --------------------------------------------------------------------------
    console.log("Test 18: Gemini temporary per-minute rate limit mapped to AI_RATE_LIMIT_EXCEEDED with retryDelay...");
    const rateLimitError: any = new Error(
      JSON.stringify({
        error: {
          code: 429,
          message: "Resource has been exhausted (e.g. check quota). Please retry in 15.0s",
          status: "RESOURCE_EXHAUSTED",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.QuotaFailure",
              violations: [
                {
                  quotaMetric: "generativelanguage.googleapis.com/requests_per_minute",
                },
              ],
            },
            {
              "@type": "type.googleapis.com/google.rpc.RetryInfo",
              retryDelay: "15s",
            },
          ],
        },
      })
    );
    rateLimitError.status = 429;

    const failingRateLimitClient: AiClient = {
      generateContent: async () => {
        throw rateLimitError;
      },
    };
    setAiClientOverride(failingRateLimitClient);

    let rateLimitStatus: number | null = null;
    let rateLimitBody: any = null;
    let rateLimitHeader: string | null = null;
    const mockReqRate: any = {
      user: { id: userA.id },
      params: { deploymentId: failedDep.id },
      body: { mode: "beginner", action: "analysis" },
    };
    const mockResRate: any = {
      setHeader: (name: string, val: string) => {
        if (name.toLowerCase() === "retry-after") rateLimitHeader = val;
      },
      status: (code: number) => {
        rateLimitStatus = code;
        return {
          json: (data: any) => {
            rateLimitBody = data;
          },
        };
      },
    };
    await queryDeploymentAiHandler(mockReqRate, mockResRate);
    assert.strictEqual(rateLimitStatus, 429, "Rate limit error must return HTTP 429");
    assert.strictEqual(rateLimitBody.code, "AI_RATE_LIMIT_EXCEEDED");
    assert(rateLimitBody.message.includes("rate limit reached"));
    assert.strictEqual(rateLimitBody.retryAfterSec, 15);
    assert.strictEqual(rateLimitHeader, "15");
    console.log("  ✓ Test 18 passed: Per-minute rate limit mapped to AI_RATE_LIMIT_EXCEEDED with 15s retry header\n");

    console.log("==================================================================");
    console.log("  ALL 18 MODULE 7 AI ASSISTANT REGRESSION TESTS PASSED!          ");
    console.log("==================================================================");
  } finally {
    // Teardown test entities
    try {
      resetAiClientOverride();
      if (projectA?.id) {
        await prisma.deployment.deleteMany({ where: { projectId: projectA.id } });
        await prisma.project.delete({ where: { id: projectA.id } });
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

runDeploymentAiTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ MODULE 7 REGRESSION TEST SUITE FAILED:", err);
    process.exit(1);
  });
