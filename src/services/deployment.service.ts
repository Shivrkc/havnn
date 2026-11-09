import api from "./api";
import {
  BackendDeployment,
  DeploymentLog,
  DeploymentStatus,
  DeploymentRuntime,
  DeploymentRuntimeResponse,
  DeploymentRuntimeLogsResponse,
  StopDeploymentResponse,
  RestartDeploymentResponse,
} from "../types";

export interface CreateDeploymentPayload {
  branch?: string;
  dockerfilePath?: string;
}

export interface CreateDeploymentResponse {
  success: boolean;
  message: string;
  deployment: BackendDeployment;
}

export interface ProjectDeploymentsResponse {
  success: boolean;
  deployments: BackendDeployment[];
  total: number;
  page: number;
  limit: number;
}

export interface DeploymentResponse {
  success: boolean;
  deployment: BackendDeployment;
}

export interface DeploymentLogsResponse {
  success: boolean;
  logs: DeploymentLog[];
  currentStatus: DeploymentStatus;
  isTerminal: boolean;
}

export interface CancelDeploymentResponse {
  success: boolean;
  message: string;
  deployment?: BackendDeployment;
}

/**
 * Triggers a new deployment for a project.
 * POST /api/projects/:projectId/deployments
 */
export const createDeployment = async (
  projectId: string,
  payload?: CreateDeploymentPayload
): Promise<BackendDeployment> => {
  const response = await api.post<CreateDeploymentResponse>(
    `/projects/${projectId}/deployments`,
    payload || {}
  );
  return response.data.deployment;
};

/**
 * Lists deployments for a project.
 * GET /api/projects/:projectId/deployments
 */
export const getProjectDeployments = async (
  projectId: string,
  page = 1,
  limit = 20
): Promise<ProjectDeploymentsResponse> => {
  const response = await api.get<ProjectDeploymentsResponse>(
    `/projects/${projectId}/deployments`,
    { params: { page, limit } }
  );
  return response.data;
};

/**
 * Fetches status and metadata for a specific deployment.
 * GET /api/deployments/:deploymentId
 */
export const getDeploymentById = async (
  deploymentId: string
): Promise<BackendDeployment> => {
  const response = await api.get<DeploymentResponse>(
    `/deployments/${deploymentId}`
  );
  return response.data.deployment;
};

/**
 * Fetches incremental build logs for polling.
 * GET /api/deployments/:deploymentId/logs?afterSequence=N
 */
export const getDeploymentLogs = async (
  deploymentId: string,
  afterSequence = 0
): Promise<DeploymentLogsResponse> => {
  const response = await api.get<DeploymentLogsResponse>(
    `/deployments/${deploymentId}/logs`,
    { params: { afterSequence } }
  );
  return response.data;
};

/**
 * Downloads raw plaintext build logs.
 * GET /api/deployments/:deploymentId/logs/raw
 */
export const getDeploymentRawLogs = async (
  deploymentId: string
): Promise<string> => {
  const response = await api.get<string>(
    `/deployments/${deploymentId}/logs/raw`,
    { responseType: "text" }
  );
  return response.data;
};

/**
 * Cancels a queued or active deployment.
 * POST /api/deployments/:deploymentId/cancel
 */
export const cancelDeployment = async (
  deploymentId: string
): Promise<CancelDeploymentResponse> => {
  const response = await api.post<CancelDeploymentResponse>(
    `/deployments/${deploymentId}/cancel`
  );
  return response.data;
};

/**
 * Fetches container runtime state (containerId, hostPort, internalPort, localUrl, isLive).
 * GET /api/deployments/:deploymentId/runtime
 */
export const getDeploymentRuntime = async (
  deploymentId: string
): Promise<DeploymentRuntime> => {
  const response = await api.get<DeploymentRuntimeResponse>(
    `/deployments/${deploymentId}/runtime`
  );
  return response.data.deployment;
};

/**
 * Fetches recent container runtime logs (stdout / stderr from Docker).
 * GET /api/deployments/:deploymentId/runtime-logs?tail=N
 */
export const getDeploymentRuntimeLogs = async (
  deploymentId: string,
  tail = 200
): Promise<DeploymentRuntimeLogsResponse> => {
  const response = await api.get<DeploymentRuntimeLogsResponse>(
    `/deployments/${deploymentId}/runtime-logs`,
    { params: { tail } }
  );
  return response.data;
};

/**
 * Stops an actively running or starting deployment container.
 * POST /api/deployments/:deploymentId/stop
 */
export const stopDeployment = async (
  deploymentId: string
): Promise<StopDeploymentResponse> => {
  const response = await api.post<StopDeploymentResponse>(
    `/deployments/${deploymentId}/stop`
  );
  return response.data;
};

/**
 * Initiates an asynchronous container restart for a stopped or crashed deployment.
 * POST /api/deployments/:deploymentId/restart -> returns HTTP 202 Accepted { status: 'QUEUED' }
 */
export const restartDeployment = async (
  deploymentId: string
): Promise<RestartDeploymentResponse> => {
  const response = await api.post<RestartDeploymentResponse>(
    `/deployments/${deploymentId}/restart`
  );
  return response.data;
};
