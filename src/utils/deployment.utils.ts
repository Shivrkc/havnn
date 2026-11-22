import { BackendDeployment, Deployment, DeploymentStatus, Project } from "../types";

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

export const isDeploymentLive = (
  status: DeploymentStatus,
  localUrl?: string | null
): boolean => {
  return status === "RUNNING" && Boolean(localUrl);
};

export interface ProjectRuntimeMetadata {
  hasLiveRuntime: boolean;
  localUrl: string | null;
  hostPort: number | null;
  internalPort: number | null;
  activeLiveDeploymentId: string | null;
}

export const getProjectLiveRuntime = (project: {
  status: string;
  localUrl?: string | null;
  hostPort?: number | null;
  internalPort?: number | null;
  liveDeploymentId?: string | null;
  latestDeployment?: {
    id: string;
    status: DeploymentStatus;
    localUrl?: string | null;
    hostPort?: number | null;
    internalPort?: number | null;
  } | null;
  liveDeployment?: {
    id: string;
    status: DeploymentStatus;
    localUrl?: string | null;
    hostPort?: number | null;
    internalPort?: number | null;
  } | null;
}): ProjectRuntimeMetadata => {
  const isStopped =
    project.status === "stopped" ||
    project.latestDeployment?.status === "STOPPED" ||
    project.liveDeployment?.status === "STOPPED";
  const isCrashed =
    project.status === "crashed" ||
    project.latestDeployment?.status === "CRASHED" ||
    project.liveDeployment?.status === "CRASHED";

  if (isStopped || isCrashed) {
    return {
      hasLiveRuntime: false,
      localUrl: null,
      hostPort: null,
      internalPort: null,
      activeLiveDeploymentId: null,
    };
  }

  // 1. Prefer explicit liveDeployment record if RUNNING
  if (project.liveDeployment && project.liveDeployment.status === "RUNNING") {
    const url = project.liveDeployment.localUrl || project.localUrl || null;
    if (url) {
      return {
        hasLiveRuntime: true,
        localUrl: url,
        hostPort: project.liveDeployment.hostPort ?? project.hostPort ?? null,
        internalPort: project.liveDeployment.internalPort ?? project.internalPort ?? null,
        activeLiveDeploymentId: project.liveDeployment.id,
      };
    }
  }

  // 2. Safe fallback: latestDeployment if it is RUNNING and matches liveDeploymentId or project is ready
  if (
    project.latestDeployment &&
    project.latestDeployment.status === "RUNNING" &&
    (project.liveDeploymentId === project.latestDeployment.id || project.status === "ready")
  ) {
    const url = project.latestDeployment.localUrl || project.localUrl || null;
    if (url) {
      return {
        hasLiveRuntime: true,
        localUrl: url,
        hostPort: project.latestDeployment.hostPort ?? project.hostPort ?? null,
        internalPort: project.latestDeployment.internalPort ?? project.internalPort ?? null,
        activeLiveDeploymentId: project.latestDeployment.id,
      };
    }
  }

  // 3. Legacy fallback: project has ready status, liveDeploymentId and localUrl without latestDeployment
  if (
    project.status === "ready" &&
    project.liveDeploymentId &&
    project.localUrl &&
    !project.latestDeployment
  ) {
    return {
      hasLiveRuntime: true,
      localUrl: project.localUrl,
      hostPort: project.hostPort ?? null,
      internalPort: project.internalPort ?? null,
      activeLiveDeploymentId: project.liveDeploymentId,
    };
  }

  return {
    hasLiveRuntime: false,
    localUrl: null,
    hostPort: null,
    internalPort: null,
    activeLiveDeploymentId: null,
  };
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

export interface BackendProjectShape {
  id: string;
  name: string;
  description?: string | null;
  repositoryName?: string | null;
  repositoryUrl?: string | null;
  branch?: string | null;
  status: string;
  userId: string;
  liveDeploymentId?: string | null;
  createdAt: string;
  updatedAt: string;
  deploymentsCount?: number;
  latestDeployment?: {
    id: string;
    status: DeploymentStatus;
    branch: string;
    commitSha?: string | null;
    commitMsg?: string | null;
    imageTag?: string | null;
    createdAt: string;
    completedAt?: string | null;
    containerId?: string | null;
    hostPort?: number | null;
    internalPort?: number | null;
    localUrl?: string | null;
  } | null;
  liveDeployment?: {
    id: string;
    status: DeploymentStatus;
    branch: string;
    commitSha?: string | null;
    commitMsg?: string | null;
    imageTag?: string | null;
    createdAt: string;
    completedAt?: string | null;
    containerId?: string | null;
    hostPort?: number | null;
    internalPort?: number | null;
    localUrl?: string | null;
  } | null;
}

export const getEligibleRestartDeployment = (project: {
  latestDeployment?: { id: string; status: DeploymentStatus } | null;
  liveDeployment?: { id: string; status: DeploymentStatus } | null;
}) => {
  if (project.latestDeployment?.status === "STOPPED" || project.latestDeployment?.status === "CRASHED") {
    return project.latestDeployment;
  }
  if (project.liveDeployment?.status === "STOPPED" || project.liveDeployment?.status === "CRASHED") {
    return project.liveDeployment;
  }
  return null;
};

export const mapBackendProjectToProject = (bp: BackendProjectShape): Project => {
  const repoName = bp.repositoryName ?? "";
  let status:
    | "ready"
    | "building"
    | "failed"
    | "queued"
    | "cancelled"
    | "idle"
    | "stopped"
    | "crashed" = "idle";

  if (bp.status === "ready") status = "ready";
  else if (bp.status === "building") status = "building";
  else if (bp.status === "queued") status = "queued";
  else if (bp.status === "failed") status = "failed";
  else if (bp.status === "cancelled") status = "cancelled";
  else if (bp.status === "stopped") status = "stopped";
  else if (bp.status === "crashed") status = "crashed";

  const activeLive = bp.liveDeployment || (bp.latestDeployment?.id === bp.liveDeploymentId ? bp.latestDeployment : null);
  const isLive = Boolean(
    bp.liveDeploymentId &&
    activeLive &&
    activeLive.id === bp.liveDeploymentId &&
    activeLive.status === "RUNNING" &&
    activeLive.localUrl &&
    activeLive.hostPort &&
    bp.status !== "stopped" &&
    bp.status !== "crashed"
  );
  const localUrl = isLive ? activeLive?.localUrl : null;
  const hostPort = isLive ? activeLive?.hostPort : null;
  const internalPort = isLive ? activeLive?.internalPort : null;

  return {
    id: bp.id,
    name: bp.name,
    repo: repoName,
    owner: repoName.includes("/") ? repoName.split("/")[0] : "dev-master",
    branch: bp.branch || "main",
    status,
    url: localUrl || bp.repositoryUrl || "",
    updatedAt: formatRelativeTime(bp.updatedAt),
    updatedAtRaw: bp.updatedAt,
    deploymentsCount: bp.deploymentsCount ?? 0,
    liveDeploymentId: bp.liveDeploymentId,
    localUrl,
    hostPort,
    internalPort,
    latestDeployment: bp.latestDeployment || null,
    liveDeployment: activeLive || null,
  };
};
