import assert from "assert";
import { queryDeploymentAiHandler } from "../../controllers/ai.controller";
import { setAiClientOverride, resetAiClientOverride, AiClient } from "../ai.service";
import prisma from "../../lib/prisma";

async function runAiUxTests() {
  console.log("==================================================================");
  console.log("  AI ASSISTANT UX & INTERACTION TEST SUITE                       ");
  console.log("==================================================================\n");

  let capturedParams: any = null;
  const mockAiClient: AiClient = {
    generateContent: async (params) => {
      capturedParams = params;
      return "### Diagnosis\nAll checks normal. Citations: [Seq #1]";
    },
  };
  setAiClientOverride(mockAiClient);

  let user: any;
  let project: any;
  let deployment: any;

  try {
    user = await prisma.user.create({
      data: {
        email: `ai-ux-test-${Date.now()}@example.com`,
        name: "AI UX Tester",
      },
    });

    project = await prisma.project.create({
      data: {
        name: "AI UX Project",
        repositoryUrl: "https://github.com/example/ai-ux",
        userId: user.id,
      },
    });

    deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        status: "FAILED",
        repositoryName: "example/ai-ux",
        repositoryUrl: "https://github.com/example/ai-ux",
        branch: "main",
      },
    });

    // 1. Custom action payload validation
    console.log("Test 1: Custom action payload requires non-empty question...");
    let res1Status: number = 0;
    let res1Body: any = null;
    await queryDeploymentAiHandler(
      {
        user: { id: user.id },
        params: { deploymentId: deployment.id },
        body: { mode: "beginner", action: "custom", question: "" },
      } as any,
      {
        status: (s: number) => { res1Status = s; return { json: (b: any) => { res1Body = b; } }; },
      } as any
    );
    assert.strictEqual(res1Status, 400);
    assert(res1Body.message.includes("non-empty question is required"));
    console.log("  ✓ Test 1 passed: Empty custom question rejected\n");

    // 2. Custom question preserved
    console.log("Test 2: Custom question preserved and passed to prompt...");
    const customQ = "Why did container build step 3 fail?";
    let res2Status: number = 0;
    let res2Body: any = null;
    await queryDeploymentAiHandler(
      {
        user: { id: user.id },
        params: { deploymentId: deployment.id },
        body: { mode: "expert", action: "custom", question: customQ },
      } as any,
      {
        status: (s: number) => { res2Status = s; return { json: (b: any) => { res2Body = b; } }; },
      } as any
    );
    assert.strictEqual(res2Status, 200);
    assert.strictEqual(res2Body.data.action, "custom");
    assert(capturedParams.prompt.includes(customQ));
    console.log("  ✓ Test 2 passed: Custom question preserved accurately\n");

    // 3. Quick actions remain independent
    console.log("Test 3: Quick actions remain independent and do not mutate to summary...");
    for (const act of ["analysis", "optimization", "learn", "summary"] as const) {
      await queryDeploymentAiHandler(
        {
          user: { id: user.id },
          params: { deploymentId: deployment.id },
          body: { mode: "beginner", action: act },
        } as any,
        {
          status: () => ({ json: () => {} }),
        } as any
      );
      if (act === "analysis") assert(capturedParams.prompt.includes("Analyze this deployment"));
      if (act === "optimization") assert(capturedParams.prompt.includes("faster or more efficient"));
      if (act === "learn") assert(capturedParams.prompt.includes("Teach the core concepts"));
      if (act === "summary") assert(capturedParams.prompt.includes("Provide a clear, simple summary"));
    }
    console.log("  ✓ Test 3 passed: All quick actions remain strictly independent\n");

    // 4. Provider 503 handling
    console.log("Test 4: Provider 503 high demand mapped cleanly...");
    const failing503: AiClient = {
      generateContent: async () => {
        const err: any = new Error("The model is currently experiencing high demand.");
        err.status = 503;
        throw err;
      },
    };
    setAiClientOverride(failing503);

    let res4Status: number = 0;
    let res4Body: any = null;
    await queryDeploymentAiHandler(
      {
        user: { id: user.id },
        params: { deploymentId: deployment.id },
        body: { mode: "expert", action: "analysis" },
      } as any,
      {
        status: (s: number) => { res4Status = s; return { json: (b: any) => { res4Body = b; } }; },
      } as any
    );
    assert.strictEqual(res4Status, 503);
    assert.strictEqual(res4Body.code, "AI_PROVIDER_UNAVAILABLE");
    assert(res4Body.message.includes("high demand"));
    console.log("  ✓ Test 4 passed: Provider 503 converted to user-friendly notice\n");

    // Reset client
    setAiClientOverride(mockAiClient);

    // 5. Retry preserves original request
    console.log("Test 5: Re-running request with original action and mode...");
    let res5Status: number = 0;
    let res5Body: any = null;
    await queryDeploymentAiHandler(
      {
        user: { id: user.id },
        params: { deploymentId: deployment.id },
        body: { mode: "expert", action: "custom", question: customQ },
      } as any,
      {
        status: (s: number) => { res5Status = s; return { json: (b: any) => { res5Body = b; } }; },
      } as any
    );
    assert.strictEqual(res5Status, 200);
    assert.strictEqual(res5Body.data.action, "custom");
    assert.strictEqual(res5Body.data.mode, "expert");
    assert(capturedParams.prompt.includes(customQ));
    console.log("  ✓ Test 5 passed: Retry preserved mode, custom action, and question\n");

    // 6. Provider 429 quota exhaustion mapping & header preservation
    console.log("Test 6: Provider 429 quota exhaustion mapped cleanly...");
    const failing429: AiClient = {
      generateContent: async () => {
        const err: any = new Error("RESOURCE_EXHAUSTED: You exceeded your current quota");
        err.status = 429;
        throw err;
      },
    };
    setAiClientOverride(failing429);

    let res6Status: number = 0;
    let res6Body: any = null;
    let res6Header: string | null = null;
    await queryDeploymentAiHandler(
      {
        user: { id: user.id },
        params: { deploymentId: deployment.id },
        body: { mode: "expert", action: "analysis" },
      } as any,
      {
        setHeader: (name: string, val: string) => {
          if (name.toLowerCase() === "retry-after") res6Header = val;
        },
        status: (s: number) => { res6Status = s; return { json: (b: any) => { res6Body = b; } }; },
      } as any
    );
    assert.strictEqual(res6Status, 429);
    assert.strictEqual(res6Body.code, "AI_QUOTA_EXHAUSTED");
    assert(res6Body.message.includes("free-tier quota has been exhausted"));
    assert.strictEqual(res6Body.retryAfterSec, undefined);
    assert.strictEqual(res6Header, null);
    console.log("  ✓ Test 6 passed: Provider 429 mapped to AI_QUOTA_EXHAUSTED cleanly without misleading wait time\n");

    // 7. Provider 429 rate limit mapping with retry-after header
    console.log("Test 7: Provider 429 per-minute rate limit mapped to AI_RATE_LIMIT_EXCEEDED...");
    const failingRateLimit: AiClient = {
      generateContent: async () => {
        const err: any = new Error("Resource exhausted: rate_limit_exceeded. Please retry in 30s");
        err.status = 429;
        throw err;
      },
    };
    setAiClientOverride(failingRateLimit);

    let res7Status: number = 0;
    let res7Body: any = null;
    let res7Header: string | null = null;
    await queryDeploymentAiHandler(
      {
        user: { id: user.id },
        params: { deploymentId: deployment.id },
        body: { mode: "expert", action: "analysis" },
      } as any,
      {
        setHeader: (name: string, val: string) => {
          if (name.toLowerCase() === "retry-after") res7Header = val;
        },
        status: (s: number) => { res7Status = s; return { json: (b: any) => { res7Body = b; } }; },
      } as any
    );
    assert.strictEqual(res7Status, 429);
    assert.strictEqual(res7Body.code, "AI_RATE_LIMIT_EXCEEDED");
    assert(res7Body.message.includes("rate limit reached"));
    assert.strictEqual(res7Body.retryAfterSec, 30);
    assert.strictEqual(res7Header, "30");
    console.log("  ✓ Test 7 passed: Provider 429 rate limit mapped to AI_RATE_LIMIT_EXCEEDED with Retry-After header\n");

    console.log("==================================================================");
    console.log("  ALL 7 UX SERVER-SIDE REGRESSION TESTS PASSED!                  ");
    console.log("==================================================================");
  } finally {
    resetAiClientOverride();
    if (project?.id) {
      await prisma.deployment.deleteMany({ where: { projectId: project.id } });
      await prisma.project.delete({ where: { id: project.id } });
    }
    if (user?.id) {
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
}

runAiUxTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("AI UX Test failed:", err);
    process.exit(1);
  });
