import { GoogleGenAI } from "@google/genai";
import prisma from "../lib/prisma";
import {
  AI_REQUEST_TIMEOUT_MS,
  AI_TEMPERATURE,
  BEGINNER_SYSTEM_PROMPT,
  DEFAULT_GEMINI_MODEL,
  EXPERT_SYSTEM_PROMPT,
  MAX_OUTPUT_TOKENS,
} from "../constants/ai.constants";
import { buildDeploymentAiContext } from "./ai-context.builder";

export type AiMode = "beginner" | "expert";
export type AiAction = "summary" | "analysis" | "optimization" | "learn" | "custom";

export interface QueryDeploymentAiOptions {
  mode: AiMode;
  action: AiAction;
  question?: string;
}

export interface AiQueryResult {
  deploymentId: string;
  mode: AiMode;
  action: AiAction;
  answer: string;
  citedSequences: number[];
  model: string;
  contextStats: {
    totalLogs: number;
    selectedLogs: number;
  };
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
      const maxRetries = 1;
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
            await new Promise((resolve) => setTimeout(resolve, 1500));
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
 */
export function setAiClientOverride(override: AiClient | null): void {
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
      taskInstruction = `Answer the following specific user question about this deployment:\n"${userQuestion || "What happened in this deployment?"}"`;
      break;
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
 * Parses sequence citations from AI text response.
 */
function extractCitedSequences(text: string): number[] {
  const sequenceSet = new Set<number>();
  const seqRegex = /\[Seq\s*#(\d+)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = seqRegex.exec(text)) !== null) {
    const seq = parseInt(match[1], 10);
    if (!isNaN(seq)) {
      sequenceSet.add(seq);
    }
  }

  return Array.from(sequenceSet).sort((a, b) => a - b);
}

/**
 * Queries the AI assistant about a specific deployment.
 */
export async function queryDeploymentAi(
  deploymentId: string,
  userId: string,
  options: QueryDeploymentAiOptions
): Promise<AiQueryResult> {
  const { mode, action, question } = options;

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

  // 2. Fetch all logs for this deployment
  const allLogs = await prisma.buildLog.findMany({
    where: { deploymentId },
    orderBy: { sequence: "asc" },
  });

  // 3. Build bounded, secret-sanitized context
  const context = buildDeploymentAiContext(deployment, allLogs);

  // 4. Select mode system prompt
  const systemInstruction = mode === "beginner" ? BEGINNER_SYSTEM_PROMPT : EXPERT_SYSTEM_PROMPT;

  // 5. Construct user prompt for model
  const prompt = buildActionPrompt(action, mode, context.formattedContext, question);

  // 6. Execute model call via active client
  const modelName = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const answer = await activeAiClient.generateContent({
    systemInstruction,
    prompt,
    model: modelName,
  });

  // 7. Extract cited log sequence numbers
  const citedSequences = extractCitedSequences(answer);

  return {
    deploymentId,
    mode,
    action,
    answer,
    citedSequences,
    model: modelName,
    contextStats: {
      totalLogs: context.totalAvailableLogs,
      selectedLogs: context.selectedLogCount,
    },
  };
}
