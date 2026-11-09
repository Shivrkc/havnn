export type ActiveView = 'landing' | 'login' | 'signup' | 'dashboard';

export type DeploymentStatus =
  | 'QUEUED'
  | 'INITIALIZING'
  | 'BUILDING'
  | 'BUILT'
  | 'STARTING'
  | 'RUNNING'
  | 'STOPPED'
  | 'CRASHED'
  | 'FAILED'
  | 'CANCELLED';

export type LogStream = 'STDOUT' | 'STDERR' | 'SYSTEM';

export interface DeploymentLog {
  id: string;
  deploymentId: string;
  line: string;
  stream: LogStream;
  sequence: number;
  timestamp: string;
}

export interface BackendDeployment {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  repositoryName: string;
  repositoryUrl: string;
  branch: string;
  commitSha?: string | null;
  commitMsg?: string | null;
  commitAuthor?: string | null;
  imageTag?: string | null;
  dockerfilePath: string;
  containerId?: string | null;
  hostPort?: number | null;
  internalPort?: number | null;
  localUrl?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  exitCode?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  branch: string;
  updatedAt: string;
  language: 'typescript' | 'react' | 'nodejs' | 'python' | 'go' | 'rust';
}

export interface Deployment {
  id: string;
  projectId?: string;
  projectName: string;
  status: DeploymentStatus | 'ready' | 'building' | 'failed' | 'offline';
  branch: string;
  commitMsg: string;
  commitHash: string;
  commitAuthor?: string;
  deployedAt: string;
  createdAt?: string;
  url: string;
  environment: 'production' | 'preview';
  durationMs?: number | null;
  errorMessage?: string | null;
  containerId?: string | null;
  hostPort?: number | null;
  internalPort?: number | null;
  localUrl?: string | null;
}

export interface BuildLog {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export interface Project {
  id: string;
  name: string;
  repo: string;
  owner: string;
  branch: string;
  status: 'ready' | 'building' | 'failed' | 'queued' | 'cancelled' | 'idle';
  url: string;
  updatedAt: string;
  updatedAtRaw?: string;
  deploymentsCount: number;
  liveDeploymentId?: string | null;
  localUrl?: string | null;
  hostPort?: number | null;
  internalPort?: number | null;
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
}

export interface DeploymentRuntime {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  containerId: string | null;
  hostPort: number | null;
  internalPort: number | null;
  localUrl: string | null;
  isLive: boolean;
  containerRunning: boolean;
}

export interface DeploymentRuntimeResponse {
  success: boolean;
  deployment: DeploymentRuntime;
}

export interface DeploymentRuntimeLogsResponse {
  success: boolean;
  deploymentId: string;
  status: DeploymentStatus;
  logs: string[];
}

export interface StopDeploymentResponse {
  success: boolean;
  message: string;
  deployment: BackendDeployment;
}

export interface RestartDeploymentResponse {
  success: boolean;
  message: string;
  deploymentId: string;
  status: 'QUEUED';
}
