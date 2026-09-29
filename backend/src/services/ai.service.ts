import { GoogleGenAI } from "@google/genai";
import prisma from "../lib/prisma";
import {
  AI_REQUEST_TIMEOUT_MS,
  AI_TEMPERATURE,
  BEGINNER_SYSTEM_PROMPT,
  CUSTOM_BEGINNER_SYSTEM_PROMPT,
  CUSTOM_EXPERT_SYSTEM_PROMPT,
  DEFAULT_GEMINI_MODEL,
  EXPERT_SYSTEM_PROMPT,
  MAX_OUTPUT_TOKENS,
} from "../constants/ai.constants";
import { buildDeploymentAiContext } from "./ai-context.builder";
import { aiCacheService } from "./ai-cache.service";

export type AiMode = "beginner" | "expert";
export type AiAction = "summary" | "analysis" | "optimization" | "learn" | "custom";

export interface QueryDeploymentAiOptions {
  mode: AiMode;
  action: AiAction;
  question?: string;
  bypassCache?: boolean;
}

export interface AiQueryResult {
  deploymentId: string;
  mode: AiMode;
  action: AiAction;
  question?: string;
  answer: string;
  citedSequences: number[];
  invalidCitations?: number[];
  citationsValidated: boolean;
  model: string;
  contextStats: {
    totalLogs: number;
    selectedLogs: number;
  };
  cached?: boolean;
  cachedAt?: string;
  warning?: string;
}

/**
 * Interface for AI client generation to support strict production validation
 * and injectable mock provider for automated tests.
 */
export interface AiClient {
  generateContent(params: {
    systemInstruction: string;
    prompt: string;
    model: string;
  }): Promise<string>;
}

/**
 * Production Gemini AI client using @google/genai.
 */
class GeminiAiClient implements AiClient {
  public async generateContent(params: {
    systemInstruction: string;
    prompt: string;
    model: string;
  }): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      const err: any = new Error(
        "Gemini API key is not configured on the server. Please set GEMINI_API_KEY in backend environment configuration."
      );
      err.code = "AI_CONFIG_MISSING";
      throw err;
    }

    const ai = new GoogleGenAI({ apiKey });

    // 30-second timeout using Promise.race
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const timeoutErr: any = new Error("AI provider request timed out after 30 seconds.");
        timeoutErr.code = "AI_TIMEOUT";
        reject(timeoutErr);
      }, AI_REQUEST_TIMEOUT_MS);
    });

    const callPromise = (async () => {
      const maxRetries = 2;
      let attempt = 0;
      while (true) {
        try {
          const response = await ai.models.generateContent({
            model: params.model,
            contents: params.prompt,
            config: {
              systemInstruction: params.systemInstruction,
              temperature: AI_TEMPERATURE,
              maxOutputTokens: MAX_OUTPUT_TOKENS,
            },
          });

          const text = response.text;
          if (!text || text.trim().length === 0) {
            throw new Error("AI provider returned an empty response.");
          }
          return text;
        } catch (err: any) {
          const isHighDemand =
            err?.status === 503 ||
            err?.statusCode === 503 ||
            (err?.message && (
              err.message.includes("503") ||
              err.message.includes("high demand") ||
              err.message.includes("UNAVAILABLE")
            ));

          if (isHighDemand && attempt < maxRetries) {
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
            continue;
          }

          if (isHighDemand) {
            const highDemandErr: any = new Error(
              "The AI model is currently experiencing high demand. Spikes in demand are temporary. Please retry in a few moments."
            );
            highDemandErr.code = "AI_PROVIDER_UNAVAILABLE";
            highDemandErr.statusCode = 503;
            throw highDemandErr;
          }

          throw err;
        }
      }
    })();

    return await Promise.race([callPromise, timeoutPromise]);
  }
}

// Active AI client instance (defaults to real Gemini in all production/dev paths)
let activeAiClient: AiClient = new GeminiAiClient();

/**
 * Injectable override for automated testing only.
 * Automatically clears in-memory cache to guarantee test isolation across mocks.
 */
export function setAiClientOverride(override: AiClient | null): void {
  aiCacheService.clear();
  if (override) {
    activeAiClient = override;
  } else {
    activeAiClient = new GeminiAiClient();
  }
}

/**
 * Resets AI client back to default production Gemini client.
 */
export function resetAiClientOverride(): void {
  aiCacheService.clear();
  activeAiClient = new GeminiAiClient();
}

/**
 * Constructs prompt instructions based on the requested action.
 */
function buildActionPrompt(
  action: AiAction,
  mode: AiMode,
  formattedContext: string,
  userQuestion?: string
): string {
  let taskInstruction = "";

  switch (action) {
    case "summary":
      taskInstruction =
        mode === "beginner"
          ? "Provide a clear, simple summary of what this deployment did, whether it succeeded or failed, and how long it took."
          : "Provide a concise technical deployment summary covering final state, build duration, commit, image tag, and key milestones.";
      break;

    case "analysis":
      taskInstruction =
        mode === "beginner"
          ? "Analyze this deployment. Explain what happened, why, and provide a clear step-by-step fix if there was an error."
          : "Perform a technical root cause analysis. Identify the failure stage, cite specific log sequences [Seq #N], explain impact, and provide shell commands or config remediation.";
      break;

    case "optimization":
      taskInstruction =
        mode === "beginner"
          ? "Explain how this build could be made faster or more efficient in simple, practical terms based on the observed steps."
          : "Analyze the build performance and Docker layer structure based strictly on observed log steps. Suggest evidence-based caching, layer ordering, or multi-stage build optimizations.";
      break;

    case "learn":
      taskInstruction =
        mode === "beginner"
          ? "Teach the core concepts behind the tools, commands, or errors seen in this deployment (e.g. what Docker, npm, or container build steps are doing)."
          : "Explain the underlying container mechanics, Docker directives, or error codes observed in this build to deepen architectural understanding.";
      break;

    case "custom":
    default:
      taskInstruction = `The user has asked the following specific question:
"${userQuestion || "Explain this deployment."}"

INSTRUCTIONS FOR THIS QUESTION:
1. Answer the user's actual question directly, accurately, and naturally.
2. If the question is about this deployment, its build logs, or its failure/success:
   - Ground your answer in the provided deployment metadata and build logs.
   - Reference specific log sequence numbers as [Seq #N] where supported by the logs.
   - Do NOT invent facts or events not present in the logs.
3. If the question is a general technical, conceptual, or educational question (for example: "What is Docker?", "What is Kubernetes?", "Explain containers in simple words", "Difference between image and container", etc.):
   - Answer the question normally, comprehensively, and clearly.
   - You may connect the explanation to Havn or container concepts when useful, but do NOT force unrelated deployment diagnostics or error summaries into the answer.
4. Do NOT automatically use the predefined Summary, Root Cause Analysis, Optimization, or Learn template structures or headings unless the user explicitly requested a summary.
5. In ${mode.toUpperCase()} mode:
   ${mode === "beginner" ? "- Use simple, clear language with friendly explanations and avoid unnecessary jargon." : "- Provide technical depth, precise terminology, and implementation mechanics."}
6. Answer the exact question asked by the user.`;
      break;
  }

  if (action === "custom") {
    return `
DEPLOYMENT CONTEXT (Reference when relevant to the user's question):
${formattedContext}

USER'S EXACT QUESTION:
"${userQuestion || "Explain this deployment."}"

TASK:
${taskInstruction}
`;
  }

  return `
CONTEXT:
${formattedContext}

TASK:
${taskInstruction}

REMINDER:
- Ground your answer ONLY in the provided context.
- Distinguish facts from hypotheses.
- When citing evidence, reference sequence numbers as [Seq #N].
- Follow the required structure for ${mode.toUpperCase()} mode.
`;
}

/**
 * Parses and validates sequence citations from AI text response against actual deployment logs.
 */
export function extractAndValidateCitations(
  text: string,
  logSequences: Set<number>
): {
  citedSequences: number[];
  invalidCitations: number[];
  citationsValidated: boolean;
} {
  const sequenceSet = new Set<number>();
  const seqRegex = /\[Seq\s*#(\d+)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = seqRegex.exec(text)) !== null) {
    const seq = parseInt(match[1], 10);
    if (!isNaN(seq)) {
      sequenceSet.add(seq);
    }
  }

  const allCited = Array.from(sequenceSet).sort((a, b) => a - b);
  const hasLogs = logSequences.size > 0;

  // If deployment has logs, validate cited numbers against actual sequences
  const validCited = allCited.filter((seq) => !hasLogs || logSequences.has(seq));
  const invalidCited = hasLogs ? allCited.filter((seq) => !logSequences.has(seq)) : [];
  const citationsValidated = hasLogs ? invalidCited.length === 0 : true;

  return {
    citedSequences: validCited,
    invalidCitations: invalidCited,
    citationsValidated,
  };
}

/**
 * Structured observability logging for AI assistant queries.
 * Omits all API keys, bearer tokens, passwords, and private source context.
 */
function logAiObservability(record: {
  timestamp: string;
  deploymentId: string;
  userId?: string;
  mode: AiMode;
  action: AiAction;
  hasQuestion: boolean;
  cacheHit: boolean;
  latencyMs: number;
  status: "SUCCESS" | "CACHE_HIT" | "FALLBACK_CACHE" | "PROVIDER_ERROR";
  model: string;
  totalLogs: number;
  selectedLogs: number;
  citedSequences: number[];
  invalidCitations: number[];
  citationsValidated: boolean;
  errorCode?: string;
}): void {
  console.log(`[HAVN_AI_OBSERVABILITY] ${JSON.stringify(record)}`);
}

/**
 * Queries the AI assistant about a specific deployment.
 * Supports caching, citation validation, structured observability, and graceful fallbacks.
 */
export async function queryDeploymentAi(
  deploymentId: string,
  userId: string,
  options: QueryDeploymentAiOptions
): Promise<AiQueryResult> {
  const startTime = Date.now();
  const { mode, action, question, bypassCache } = options;

  // 1. Verify deployment existence and ownership
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: deploymentId,
      project: { userId },
    },
    include: {
      project: {
        select: { name: true },
      },
    },
  });

  if (!deployment) {
    const notFoundError: any = new Error("Deployment not found or access denied.");
    notFoundError.code = "DEPLOYMENT_NOT_FOUND";
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  // 2. Check in-memory TTL Cache (if not bypassing cache)
  if (!bypassCache) {
    const cached = aiCacheService.get(deploymentId, mode, action, question);
    if (cached) {
      const latencyMs = Date.now() - startTime;
      logAiObservability({
        timestamp: new Date().toISOString(),
        deploymentId,
        userId,
        mode,
        action,
        hasQuestion: !!question,
        cacheHit: true,
        latencyMs,
        status: "CACHE_HIT",
        model: cached.model,
        totalLogs: cached.contextStats.totalLogs,
        selectedLogs: cached.contextStats.selectedLogs,
        citedSequences: cached.citedSequences,
        invalidCitations: cached.invalidCitations || [],
        citationsValidated: cached.citationsValidated,
      });

      return {
        ...cached,
        cached: true,
      };
    }
  }

  // 3. Fetch all logs for this deployment
  const allLogs = await prisma.buildLog.findMany({
    where: { deploymentId },
    orderBy: { sequence: "asc" },
  });

  // 4. Build bounded, secret-sanitized context
  const context = buildDeploymentAiContext(deployment, allLogs);

  // 5. Select mode system prompt (using dedicated open-ended prompts for custom questions)
  const systemInstruction =
    action === "custom"
      ? (mode === "beginner" ? CUSTOM_BEGINNER_SYSTEM_PROMPT : CUSTOM_EXPERT_SYSTEM_PROMPT)
      : (mode === "beginner" ? BEGINNER_SYSTEM_PROMPT : EXPERT_SYSTEM_PROMPT);

  // 6. Construct user prompt for model
  const prompt = buildActionPrompt(action, mode, context.formattedContext, question);

  // 7. Execute model call via active client
  const modelName = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  let answer: string;

  try {
    answer = await activeAiClient.generateContent({
      systemInstruction,
      prompt,
      model: modelName,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;

    // Check if we can serve a valid previously cached diagnosis as fallback
    const isProviderUnavailableOrQuota =
      err?.status === 429 ||
      err?.statusCode === 429 ||
      err?.status === 503 ||
      err?.statusCode === 503 ||
      err?.code === "AI_QUOTA_EXHAUSTED" ||
      err?.code === "AI_RATE_LIMIT_EXCEEDED" ||
      err?.code === "AI_PROVIDER_UNAVAILABLE" ||
      err?.code === "AI_TIMEOUT" ||
      (typeof err?.message === "string" && (
        err.message.includes("429") ||
        err.message.includes("quota") ||
        err.message.includes("RESOURCE_EXHAUSTED") ||
        err.message.includes("503") ||
        err.message.includes("UNAVAILABLE")
      ));

    // Custom questions must ONLY fallback to their own exact question cache entry, never another question or summary
    let cachedFallback = !bypassCache ? aiCacheService.get(deploymentId, mode, action, question) : null;
    if (!cachedFallback && !bypassCache && action !== "custom") {
      cachedFallback = aiCacheService.getAnyForDeployment(deploymentId, mode, action);
    }

    if (cachedFallback && isProviderUnavailableOrQuota) {
      logAiObservability({
        timestamp: new Date().toISOString(),
        deploymentId,
        userId,
        mode,
        action,
        hasQuestion: !!question,
        cacheHit: true,
        latencyMs,
        status: "FALLBACK_CACHE",
        model: cachedFallback.model,
        totalLogs: cachedFallback.contextStats.totalLogs,
        selectedLogs: cachedFallback.contextStats.selectedLogs,
        citedSequences: cachedFallback.citedSequences,
        invalidCitations: cachedFallback.invalidCitations || [],
        citationsValidated: cachedFallback.citationsValidated,
        errorCode: err?.code || "PROVIDER_UNAVAILABLE",
      });

      return {
        ...cachedFallback,
        cached: true,
        warning: `Live AI service temporarily unavailable (${err?.code || "high demand"}). Displaying verified cached diagnosis from ${new Date(cachedFallback.cachedAt).toLocaleTimeString()}.`,
      };
    }

    logAiObservability({
      timestamp: new Date().toISOString(),
      deploymentId,
      userId,
      mode,
      action,
      hasQuestion: !!question,
      cacheHit: false,
      latencyMs,
      status: "PROVIDER_ERROR",
      model: modelName,
      totalLogs: context.totalAvailableLogs,
      selectedLogs: context.selectedLogCount,
      citedSequences: [],
      invalidCitations: [],
      citationsValidated: false,
      errorCode: err?.code || err?.name || "UNKNOWN_ERROR",
    });

    throw err;
  }

  // Validate that provider returned a non-empty, non-whitespace answer
  if (!answer || answer.trim().length === 0) {
    const emptyErr: any = new Error("AI provider returned an empty response.");
    emptyErr.code = "AI_PROVIDER_ERROR";
    emptyErr.statusCode = 502;
    throw emptyErr;
  }

  // 8. Extract and validate sequence citations against actual logs
  const logSequenceSet = new Set(allLogs.map((l) => l.sequence));
  const { citedSequences, invalidCitations, citationsValidated } = extractAndValidateCitations(
    answer,
    logSequenceSet
  );

  const latencyMs = Date.now() - startTime;

  // 9. Store in cache
  const resultData = {
    deploymentId,
    mode,
    action,
    question,
    answer,
    citedSequences,
    invalidCitations,
    citationsValidated,
    model: modelName,
    contextStats: {
      totalLogs: context.totalAvailableLogs,
      selectedLogs: context.selectedLogCount,
    },
  };

  const cachedEntry = aiCacheService.set(
    deploymentId,
    mode,
    action,
    resultData,
    question
  );

  logAiObservability({
    timestamp: new Date().toISOString(),
    deploymentId,
    userId,
    mode,
    action,
    hasQuestion: !!question,
    cacheHit: false,
    latencyMs,
    status: "SUCCESS",
    model: modelName,
    totalLogs: context.totalAvailableLogs,
    selectedLogs: context.selectedLogCount,
    citedSequences,
    invalidCitations,
    citationsValidated,
  });

  return {
    ...resultData,
    cached: false,
    cachedAt: cachedEntry.cachedAt,
  };
}
