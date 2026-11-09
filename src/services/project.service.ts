import api from "./api";
import { DeploymentStatus } from "../types";

export interface BackendProject {
  id: string;
  name: string;
  description?: string | null;
  repositoryName?: string | null;
  repositoryUrl?: string | null;
  branch: string;
  status: string;
  userId: string;
  liveDeploymentId?: string | null;
  createdAt: string;
  updatedAt: string;
  deploymentsCount: number;
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

export interface CreateProjectPayload {
  name: string;
  repositoryName?: string;
  repositoryUrl?: string;
  branch?: string;
  description?: string;
  status?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  repositoryName?: string;
  repositoryUrl?: string;
  branch?: string;
  description?: string;
  status?: string;
}

interface ProjectsResponse {
  success: boolean;
  projects: BackendProject[];
}

interface ProjectResponse {
  success: boolean;
  project: BackendProject;
}

interface DeleteProjectResponse {
  success: boolean;
  message: string;
}

export const getProjects = async (): Promise<BackendProject[]> => {
  const response = await api.get<ProjectsResponse>("/projects");
  return response.data.projects;
};

export const createProject = async (
  data: CreateProjectPayload
): Promise<BackendProject> => {
  const response = await api.post<ProjectResponse>("/projects", data);
  return response.data.project;
};

export const getProjectById = async (
  id: string
): Promise<BackendProject> => {
  const response = await api.get<ProjectResponse>(`/projects/${id}`);
  return response.data.project;
};

export const updateProject = async (
  id: string,
  data: UpdateProjectPayload
): Promise<BackendProject> => {
  const response = await api.patch<ProjectResponse>(
    `/projects/${id}`,
    data
  );
  return response.data.project;
};

export const deleteProject = async (
  id: string
): Promise<DeleteProjectResponse> => {
  const response = await api.delete<DeleteProjectResponse>(
    `/projects/${id}`
  );
  return response.data;
};