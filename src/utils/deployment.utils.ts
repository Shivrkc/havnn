import { BackendDeployment, Deployment, DeploymentStatus } from "../types";

export const formatRelativeTime = (timestamp?: string | null): string => {
  if (!timestamp) return "Just now";
  const date = new Date(timestamp);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString();
};

export const mapBackendDeploymentToFrontend = (
  bd: BackendDeployment,
): Deployment => {
  return {
    id: bd.id,
    projectId: bd.projectId,
    projectName: bd.repositoryName || "project",
    status: bd.status,
    branch: bd.branch,
    commitMsg: bd.commitMsg || "Deployment triggered",
    commitHash: bd.commitSha ? bd.commitSha.substring(0, 7) : "pending",
    commitAuthor: bd.commitAuthor || undefined,
    deployedAt: formatRelativeTime(bd.createdAt),
    createdAt: bd.createdAt,
    url: bd.localUrl || bd.repositoryUrl || "",
    environment: "production",
    durationMs: bd.durationMs,
    errorMessage: bd.errorMessage,
    containerId: bd.containerId,
    hostPort: bd.hostPort,
    internalPort: bd.internalPort,
    localUrl: bd.localUrl,
  };
};

export const canStopDeployment = (status: DeploymentStatus): boolean => {
  return status === "RUNNING" || status === "STARTING";
};

export const canRestartDeployment = (status: DeploymentStatus): boolean => {
  return status === "STOPPED" || status === "CRASHED";
};

export const formatPortMapping = (
  hostPort?: number | null,
  internalPort?: number | null
): string | null => {
  if (!hostPort) return null;
  return `:${hostPort} → :${internalPort || 3000}`;
};

export const sortDeploymentsNewestFirst = (
  a: Deployment,
  b: Deployment,
): number => {
  const getTimestamp = (d: Deployment) => {
    if (d.createdAt) {
      const t = new Date(d.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    const t = new Date(d.deployedAt).getTime();
    return !isNaN(t) ? t : 0;
  };
  return getTimestamp(b) - getTimestamp(a);
};
