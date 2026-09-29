import api from "./api";

export type AiMode = "beginner" | "expert";
export type AiAction = "summary" | "analysis" | "optimization" | "learn" | "custom";

export interface QueryDeploymentAiPayload {
  mode: AiMode;
  action: AiAction;
  question?: string;
  bypassCache?: boolean;
}

export interface AiQueryResultData {
  deploymentId: string;
  mode: AiMode;
  action: AiAction;
  question?: string;
  answer: string;
  citedSequences: number[];
  invalidCitations?: number[];
  citationsValidated?: boolean;
  model: string;
  contextStats: {
    totalLogs: number;
    selectedLogs: number;
  };
  cached?: boolean;
  cachedAt?: string;
  warning?: string;
}

export interface AiQueryResponse {
  success: boolean;
  data: AiQueryResultData;
}

/**
 * Queries HAVN AI diagnostics assistant for a deployment.
 * POST /api/deployments/:deploymentId/ai/query
 */
export const queryDeploymentAi = async (
  deploymentId: string,
  payload: QueryDeploymentAiPayload
): Promise<AiQueryResultData> => {
  const response = await api.post<AiQueryResponse>(
    `/deployments/${deploymentId}/ai/query`,
    payload
  );
  return response.data.data;
};
