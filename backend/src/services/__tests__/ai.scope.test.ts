import assert from "assert";
import prisma from "../../lib/prisma";
import { LogStream } from "@prisma/client";
import {
  queryDeploymentAi,
  setAiClientOverride,
  resetAiClientOverride,
  AiClient,
} from "../ai.service";
import { classifyQuestionScope } from "../ai-scope.router";
import { queryDeploymentAiHandler } from "../../controllers/ai.controller";
import { UNSUPPORTED_SCOPE_RESPONSE } from "../../constants/ai.constants";

/**
 * MODULE 7: HAVN AI SCOPE GUARD & TECHNICAL LEARNING ROUTER TEST SUITE
 */
async function runAiScopeTests() {
  console.log("==================================================================");
  console.log("  HAVN AI SCOPE GUARD & TECHNICAL LEARNING ROUTER TEST SUITE      ");
  console.log("==================================================================\n");

  // --------------------------------------------------------------------------
  // PART 1: DETERMINISTIC SCOPE CLASSIFICATION TESTS
  // --------------------------------------------------------------------------
  console.log("--- PART 1: Testing Local Scope Classification ---");

  const deploymentQuestions = [
    "Why did my Docker build fail?",
    "Why is this deployment failing?",
    "Explain this build error.",
    "What happened in build log sequence 42?",
    "How can I optimize this deployment?",
    "Why is my deployment stuck?",
    "Which log caused the failure?",
  ];

  for (const q of deploymentQuestions) {
    const res = classifyQuestionScope(q);
    assert.strictEqual(
      res.scope,
      "deployment",
      `Expected "${q}" to be classified as DEPLOYMENT, got ${res.scope}`
    );
    console.log(`  ✓ DEPLOYMENT: "${q}" -> ${res.scope}`);
  }

  const learningQuestions = [
    "What is Docker?",
    "Why do we use Docker?",
    "Explain CI/CD.",
    "What is Kubernetes?",
    "Explain cloud networking.",
    "What is a VPC?",
    "Explain REST APIs.",
    "What is PostgreSQL indexing?",
    "What is authentication?",
    "Explain Prometheus and Grafana.",
    "What is container orchestration?",
    "Explain GitHub Actions.",
    "What is Docker Compose?",
    "Why do containers need networking?",
    "How does a reverse proxy work?",
    "Explain horizontal scaling.",
  ];

  for (const q of learningQuestions) {
    const res = classifyQuestionScope(q);
    assert.strictEqual(
      res.scope,
      "learning",
      `Expected "${q}" to be classified as LEARNING, got ${res.scope}`
    );
    console.log(`  ✓ LEARNING: "${q}" -> ${res.scope} (${res.domain || "Technical Domain"})`);
  }

  const unsupportedQuestions = [
    "How can I approach a girl?",
    "Write me a poem.",
    "Tell me a joke.",
    "What should I eat tonight?",
    "Give me dating advice.",
    "Recommend a movie.",
    "Write a romantic message.",
    "Who should I date?",
  ];

  for (const q of unsupportedQuestions) {
    const res = classifyQuestionScope(q);
    assert.strictEqual(
      res.scope,
      "unsupported",
      `Expected "${q}" to be classified as UNSUPPORTED, got ${res.scope}`
    );
    console.log(`  ✓ UNSUPPORTED: "${q}" -> ${res.scope} (${res.reason})`);
  }

  console.log("\n--- PART 2: Testing Critical Nuance & Edge Cases ---");

  // Nuance 1: "Tell me a joke about Docker" - Must NOT pass simply because Docker appears
  const jokeAboutDocker = classifyQuestionScope("Tell me a joke about Docker.");
  assert.strictEqual(
    jokeAboutDocker.scope,
    "unsupported",
    "Jokes about technical topics must be rejected as UNSUPPORTED."
  );
  console.log('  ✓ Nuance 1 passed: "Tell me a joke about Docker." -> UNSUPPORTED');

  // Nuance 2: "Write a poem about Kubernetes" - Must be rejected as UNSUPPORTED
  const poemAboutK8s = classifyQuestionScope("Write a poem about Kubernetes.");
  assert.strictEqual(
    poemAboutK8s.scope,
    "unsupported",
    "Poems about technical topics must be rejected as UNSUPPORTED."
  );
  console.log('  ✓ Nuance 2 passed: "Write a poem about Kubernetes." -> UNSUPPORTED');

  // Nuance 3: "How do I secure a dating website API?" - Substantive security question about an API
  const datingApi = classifyQuestionScope("How do I secure a dating website API?");
  assert.strictEqual(
    datingApi.scope,
    "learning",
    "Questions with technical substance (API security) must pass as LEARNING even if non-tech nouns are present."
  );
  console.log('  ✓ Nuance 3 passed: "How do I secure a dating website API?" -> LEARNING');

  // Nuance 4: "How do I optimize my Docker container for a game server?" - Substantive container engineering
  const gameServerContainer = classifyQuestionScope("How do I optimize my Docker container for a game server?");
  assert.strictEqual(
    gameServerContainer.scope,
    "learning",
    "Container optimization question must pass as LEARNING."
  );
  console.log('  ✓ Nuance 4 passed: "How do I optimize my Docker container for a game server?" -> LEARNING');

  // --------------------------------------------------------------------------
  // PART 3: GEMINI CALL & CONTEXT CONSTRUCTION VERIFICATION
  // --------------------------------------------------------------------------
  console.log("\n--- PART 3: Verifying Gemini Provider Call & Context Isolation ---");

  const timestamp = Date.now();
  let user: any;
  let project: any;
  let deployment: any;
  let geminiCalls = 0;
  let lastCapturedParams: any = null;

  const mockAiClient: AiClient = {
    generateContent: async (params) => {
      geminiCalls++;
      lastCapturedParams = params;
      return "Mock AI response for testing.";
    },
  };

  try {
    setAiClientOverride(mockAiClient);

    user = await prisma.user.create({
      data: {
        email: `scope-user-${timestamp}@example.com`,
        name: "Scope Guard User",
      },
    });

    project = await prisma.project.create({
      data: {
        name: "Scope Guard Project",
        repositoryName: "testowner/scope-repo",
        repositoryUrl: "https://github.com/testowner/scope-repo",
        branch: "main",
        userId: user.id,
      },
    });

    deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        status: "FAILED",
        repositoryName: project.repositoryName,
        repositoryUrl: project.repositoryUrl,
        branch: "main",
        imageTag: "test-tag:v1",
        logs: {
          createMany: {
            data: [
              { sequence: 1, stream: LogStream.SYSTEM, line: "[SYSTEM] Building image..." },
              { sequence: 2, stream: LogStream.STDOUT, line: "Step 1/3 : FROM node:18" },
              { sequence: 3, stream: LogStream.STDERR, line: "npm ERR! Missing dependencies" },
              { sequence: 4, stream: LogStream.SYSTEM, line: "[SYSTEM] Build exited with status 1." },
            ],
          },
        },
      },
    });

    // TEST A: Unsupported question -> ZERO Gemini calls, returns local refusal
    geminiCalls = 0;
    lastCapturedParams = null;
    const unsupportedResult = await queryDeploymentAi(deployment.id, user.id, {
      mode: "beginner",
      action: "custom",
      question: "How can I approach a girl?",
      bypassCache: true,
    });

    assert.strictEqual(geminiCalls, 0, "Gemini MUST NOT be called for unsupported questions!");
    assert.strictEqual(unsupportedResult.scope, "unsupported");
    assert.strictEqual(unsupportedResult.answer, UNSUPPORTED_SCOPE_RESPONSE);
    assert.strictEqual(unsupportedResult.model, "local-scope-guard");
    assert.strictEqual(unsupportedResult.contextStats.totalLogs, 0, "No logs should be loaded for unsupported questions.");
    console.log("  ✓ Test A passed: UNSUPPORTED question intercepted locally -> 0 Gemini calls, 0 logs queried.");

    // TEST B: Unsupported question at controller level -> Zero Gemini calls, HTTP 200 with local response
    let controllerStatus = 0;
    let controllerData: any = null;
    const mockReqUnsupported: any = {
      user: { id: user.id },
      params: { deploymentId: deployment.id },
      body: {
        mode: "expert",
        action: "custom",
        question: "Tell me a joke about Docker.",
      },
    };
    const mockResUnsupported: any = {
      status: (code: number) => {
        controllerStatus = code;
        return {
          json: (body: any) => {
            controllerData = body;
          },
        };
      },
    };

    geminiCalls = 0;
    await queryDeploymentAiHandler(mockReqUnsupported, mockResUnsupported);
    assert.strictEqual(controllerStatus, 200);
    assert.strictEqual(controllerData.success, true);
    assert.strictEqual(controllerData.data.scope, "unsupported");
    assert.strictEqual(controllerData.data.answer, UNSUPPORTED_SCOPE_RESPONSE);
    assert.strictEqual(geminiCalls, 0, "Controller must intercept unsupported questions before AI service and Gemini call!");
    console.log("  ✓ Test B passed: Direct API request for unsupported query blocked at controller level -> 0 Gemini calls.");

    // TEST C: Learning question -> Gemini IS called, but deployment logs are NOT loaded/included
    geminiCalls = 0;
    lastCapturedParams = null;
    const learningResult = await queryDeploymentAi(deployment.id, user.id, {
      mode: "beginner",
      action: "custom",
      question: "What is Docker and why do we use it?",
      bypassCache: true,
    });

    assert.strictEqual(geminiCalls, 1, "Gemini MUST be called for learning questions!");
    assert.strictEqual(learningResult.scope, "learning");
    assert.strictEqual(learningResult.contextStats.totalLogs, 0, "Deployment logs MUST NOT be fetched for learning queries!");
    assert(!lastCapturedParams.prompt.includes("=== DEPLOYMENT METADATA ==="), "Learning prompt must not contain deployment metadata!");
    assert(!lastCapturedParams.prompt.includes("npm ERR!"), "Learning prompt must not contain deployment logs!");
    assert(lastCapturedParams.systemInstruction.includes("HAVN AI, a specialized technical learning educator"), "Learning prompt must use dedicated learning educator system instruction!");
    console.log("  ✓ Test C passed: LEARNING question calls Gemini with 0 unnecessary log tokens!");

    // TEST D: Deployment question -> Gemini IS called, and deployment logs ARE included
    geminiCalls = 0;
    lastCapturedParams = null;
    const deploymentResult = await queryDeploymentAi(deployment.id, user.id, {
      mode: "expert",
      action: "custom",
      question: "Why did my build fail?",
      bypassCache: true,
    });

    assert.strictEqual(geminiCalls, 1, "Gemini MUST be called for deployment questions!");
    assert.strictEqual(deploymentResult.scope, "deployment");
    assert(deploymentResult.contextStats.totalLogs > 0, "Deployment logs MUST be fetched for deployment questions!");
    assert(lastCapturedParams.prompt.includes("DEPLOYMENT CONTEXT"), "Deployment prompt must contain deployment context!");
    assert(lastCapturedParams.prompt.includes("npm ERR!"), "Deployment prompt must contain actual failure logs!");
    console.log("  ✓ Test D passed: DEPLOYMENT question calls Gemini with full grounded build logs!");

    // TEST E: Preset modes remain DEPLOYMENT
    geminiCalls = 0;
    lastCapturedParams = null;
    const summaryResult = await queryDeploymentAi(deployment.id, user.id, {
      mode: "beginner",
      action: "summary",
      bypassCache: true,
    });
    assert.strictEqual(geminiCalls, 1);
    assert.strictEqual(summaryResult.scope, "deployment");
    assert(summaryResult.contextStats.totalLogs > 0);
    console.log("  ✓ Test E passed: Preset 'summary' mode remains DEPLOYMENT with full build context.");

    console.log("\n==================================================================");
    console.log("  ALL HAVN AI SCOPE GUARD & ROUTER TESTS PASSED SUCCESSFULLY!    ");
    console.log("==================================================================");
  } finally {
    resetAiClientOverride();
    try {
      if (project?.id) {
        await prisma.deployment.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } });
      }
      if (user?.id) {
        await prisma.user.delete({ where: { id: user.id } });
      }
    } catch (cleanupErr) {
      console.error("Cleanup error (non-fatal):", cleanupErr);
    }
  }
}

runAiScopeTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ HAVN AI SCOPE GUARD TEST SUITE FAILED:", err);
    process.exit(1);
  });
