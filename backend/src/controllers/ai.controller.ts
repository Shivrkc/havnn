import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  AI_RATE_LIMIT_WINDOW_MS,
  DEFAULT_GEMINI_MODEL,
  MAX_USER_AI_REQUESTS_PER_MINUTE,
} from "../constants/ai.constants";
import { queryDeploymentAi, AiAction, AiMode } from "../services/ai.service";

/**
 * In-memory sliding-window rate limiter per user ID.
 * Tracks timestamps of recent queries within the 60s window.
 */
class AiRateLimiter {
  private userRequests = new Map<string, number[]>();

  public isAllowed(userId: string): { allowed: boolean; retryAfterSec?: number } {
    const now = Date.now();
    const windowStart = now - AI_RATE_LIMIT_WINDOW_MS;

    const timestamps = this.userRequests.get(userId) || [];
    // Keep only timestamps within the active sliding window
    const recent = timestamps.filter((t) => t > windowStart);

    if (recent.length >= MAX_USER_AI_REQUESTS_PER_MINUTE) {
      const oldestInWindow = recent[0];
      const retryAfterSec = Math.ceil((oldestInWindow + AI_RATE_LIMIT_WINDOW_MS - now) / 1000);
      this.userRequests.set(userId, recent);
      return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
    }

    recent.push(now);
    this.userRequests.set(userId, recent);
    return { allowed: true };
  }

  public reset(): void {
    this.userRequests.clear();
  }
}

export const aiRateLimiter = new AiRateLimiter();

/**
 * POST /api/deployments/:deploymentId/ai/query
 * Analyzes deployment logs and metadata with HAVN AI.
 */
export const queryDeploymentAiHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 1. Rate Limiting Check
    const rateCheck = aiRateLimiter.isAllowed(userId);
    if (!rateCheck.allowed) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSec || 60));
      return res.status(429).json({
        success: false,
        message: `Too many AI requests. Maximum ${MAX_USER_AI_REQUESTS_PER_MINUTE} queries per minute allowed. Please wait ${rateCheck.retryAfterSec} seconds.`,
      });
    }

    const deploymentId = Array.isArray(req.params.deploymentId)
      ? req.params.deploymentId[0]
      : req.params.deploymentId;

    if (!deploymentId) {
      return res.status(400).json({ success: false, message: "Missing deploymentId parameter." });
    }

    const { mode, action, question } = req.body;

    // 2. Validate Mode
    const validModes: AiMode[] = ["beginner", "expert"];
    const selectedMode: AiMode = validModes.includes(mode) ? mode : "beginner";

    // 3. Validate Action
    const validActions: AiAction[] = ["summary", "analysis", "optimization", "learn", "custom"];
    const selectedAction: AiAction = validActions.includes(action) ? action : "analysis";

    // 4. Validate Custom Question
    if (selectedAction === "custom") {
      if (!question || typeof question !== "string" || question.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "A non-empty question is required when action is 'custom'.",
        });
      }
    }

    // 5. Query AI Service
    const result = await queryDeploymentAi(deploymentId, userId, {
      mode: selectedMode,
      action: selectedAction,
      question: typeof question === "string" ? question.trim() : undefined,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.statusCode === 404 || error.code === "DEPLOYMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Deployment not found or access denied.",
      });
    }

    if (error.code === "AI_CONFIG_MISSING") {
      return res.status(503).json({
        success: false,
        message: error.message || "AI diagnostics service is temporarily unconfigured.",
      });
    }

    if (error.code === "AI_TIMEOUT") {
      return res.status(504).json({
        success: false,
        message: "AI diagnostics request timed out. Please retry.",
      });
    }

    const rawMessage = typeof error?.message === "string" ? error.message : "";
    let parsedErrorObj: any = null;
    if (rawMessage.trim().startsWith("{")) {
      try {
        parsedErrorObj = JSON.parse(rawMessage);
      } catch {
        // ignore parse error
      }
    }

    // Inspect details array if present
    const details = Array.isArray(parsedErrorObj?.error?.details) ? parsedErrorObj.error.details : [];
    const quotaViolations = details
      .flatMap((d: any) => (Array.isArray(d?.violations) ? d.violations : []))
      .map((v: any) => String(v?.quotaMetric || ""));

    const hasFreeTierOrDailyViolation = quotaViolations.some((m: string) =>
      m.includes("free_tier") || m.includes("daily")
    );
    const hasPerMinuteViolation = quotaViolations.some((m: string) =>
      m.includes("per_minute") || m.includes("rate_limit") || m.includes("concurrent")
    );

    // Check RetryInfo
    const retryInfo = details.find((d: any) => d?.["@type"]?.includes("RetryInfo"));
    let retryDelaySec: number | undefined;
    if (retryInfo?.retryDelay) {
      const match = String(retryInfo.retryDelay).match(/^([\d.]+)/);
      if (match) retryDelaySec = Math.ceil(parseFloat(match[1]));
    }
    if (!retryDelaySec) {
      const match = rawMessage.match(/retry in\s+([\d.]+)\s*s/i);
      if (match) retryDelaySec = Math.ceil(parseFloat(match[1]));
    }

    // 1. Quota Exhaustion vs Rate Limit (429 / RESOURCE_EXHAUSTED)
    const is429 =
      error.code === "AI_QUOTA_EXHAUSTED" ||
      error.code === "AI_RATE_LIMIT_EXCEEDED" ||
      error.status === 429 ||
      error.statusCode === 429 ||
      parsedErrorObj?.error?.code === 429 ||
      parsedErrorObj?.error?.status === "RESOURCE_EXHAUSTED" ||
      rawMessage.includes("RESOURCE_EXHAUSTED") ||
      rawMessage.includes("429") ||
      rawMessage.includes("quota") ||
      rawMessage.toLowerCase().includes("rate limit");

    if (is429) {
      const isDailyOrFreeTier =
        hasFreeTierOrDailyViolation ||
        rawMessage.includes("free_tier_requests") ||
        rawMessage.includes("daily_requests") ||
        rawMessage.includes("exceeded your current quota") ||
        (rawMessage.includes("quota") && !hasPerMinuteViolation && !retryDelaySec);

      if (isDailyOrFreeTier) {
        return res.status(429).json({
          success: false,
          code: "AI_QUOTA_EXHAUSTED",
          message:
            "Gemini free-tier quota has been exhausted. Please try again after the quota resets or check your Google AI Studio quota.",
        });
      }

      // Otherwise, temporary rate limit
      if (retryDelaySec) {
        res.setHeader("Retry-After", String(retryDelaySec));
      }
      return res.status(429).json({
        success: false,
        code: "AI_RATE_LIMIT_EXCEEDED",
        message: "AI rate limit reached. Please wait a moment before retrying.",
        retryAfterSec: retryDelaySec,
      });
    }

    // 2. High Demand / Service Unavailable (503 / UNAVAILABLE)
    const isHighDemand =
      error.code === "AI_PROVIDER_UNAVAILABLE" ||
      error.status === 503 ||
      error.statusCode === 503 ||
      parsedErrorObj?.error?.code === 503 ||
      parsedErrorObj?.error?.status === "UNAVAILABLE" ||
      rawMessage.includes("503") ||
      rawMessage.includes("high demand") ||
      rawMessage.includes("UNAVAILABLE");

    if (isHighDemand) {
      return res.status(503).json({
        success: false,
        code: "AI_PROVIDER_UNAVAILABLE",
        message:
          "The AI model is currently experiencing high demand. Spikes in demand are temporary. Please retry in a few moments.",
      });
    }

    // 3. Model Not Available / Deprecated (404)
    const isModelNotFound =
      error.status === 404 ||
      error.statusCode === 404 ||
      parsedErrorObj?.error?.code === 404 ||
      rawMessage.includes("is not found") ||
      rawMessage.includes("is no longer available");

    if (isModelNotFound) {
      const modelName = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
      return res.status(502).json({
        success: false,
        code: "AI_MODEL_UNAVAILABLE",
        message: `The configured AI model (${modelName}) is currently unavailable from the provider. Please verify your GEMINI_MODEL setting in backend environment configuration.`,
      });
    }

    // 4. Other Upstream Provider Failures (never leak raw JSON)
    console.error("HAVN AI query error:", error);
    let userFacingMessage = "Failed to process AI diagnostics request. Please retry in a moment.";
    if (rawMessage && !rawMessage.trim().startsWith("{") && !rawMessage.includes('"error":{')) {
      userFacingMessage = rawMessage;
    }

    return res.status(502).json({
      success: false,
      code: "AI_PROVIDER_ERROR",
      message: userFacingMessage,
    });
  }
};
