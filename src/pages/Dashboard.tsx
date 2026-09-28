import { useState, useEffect, FormEvent, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Github,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  RefreshCcw,
  Database,
  Key,
  Trash,
  ExternalLink,
  Activity,
  Layers,
  Server,
  Clock,
  TrendingUp,
  Lock,
  AlertCircle,
  Play,
  User,
  Globe,
  ChevronDown,
  LayoutGrid,
  List,
  Filter,
  Folder,
  Mail,
  Shield,
  Calendar,
  KeyRound,
  Sparkles,
  Link2,
  Unlink,
  Eye,
  EyeOff,
  Terminal,
  Cpu,
  Settings as SettingsIcon,
  BarChart2,
  LogOut,
} from "lucide-react";
import {
  Project,
  Deployment,
  BackendDeployment,
  DeploymentStatus,
} from "../types";
import { ROUTES } from "../constants/routes";
import {
  getProjects,
  createProject,
  deleteProject,
  BackendProject,
} from "../services/project.service";
import {
  createDeployment,
  getProjectDeployments,
  getDeploymentById,
  getDeploymentLogs,
} from "../services/deployment.service";
import {
  getCurrentUser,
  logout,
  changePassword,
} from "../services/auth.service";
import {
  getGithubStatus,
  getGithubConnectUrl,
  disconnectGithub,
  getGithubRepositories,
  getGithubBranches,
  GithubRepository,
  GithubBranch,
} from "../services/github.service";
import api from "../services/api";
import { BuildLogModal } from "../components/dashboard/BuildLogModal";
import { ProjectCard } from "../components/dashboard/ProjectCard";
import {
  DashboardSidebar,
  DashboardNavTab,
} from "../components/dashboard/DashboardSidebar";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardMetrics } from "../components/dashboard/DashboardMetrics";
import { RecentDeploymentActivity } from "../components/dashboard/RecentDeploymentActivity";
import { DeploymentActivityChart } from "../components/dashboard/DeploymentActivityChart";
import { SystemStatusCard } from "../components/dashboard/SystemStatusCard";
import { QuickActionsCard } from "../components/dashboard/QuickActionsCard";
import { useCanvasSky } from "../utils/useCanvasSky";

const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const mapBackendProjectToProject = (bp: BackendProject): Project => {
  const repoName = bp.repositoryName ?? "";
  let status:
    "ready" | "building" | "failed" | "queued" | "cancelled" | "idle" = "idle";

  if (bp.status === "ready") status = "ready";
  else if (bp.status === "building") status = "building";
  else if (bp.status === "queued") status = "queued";
  else if (bp.status === "failed") status = "failed";
  else if (bp.status === "cancelled") status = "cancelled";

  return {
    id: bp.id,
    name: bp.name,
    repo: repoName,
    owner: repoName.includes("/") ? repoName.split("/")[0] : "dev-master",
    branch: bp.branch || "main",
    status,
    url: bp.repositoryUrl ?? "",
    updatedAt: formatRelativeTime(bp.updatedAt),
    deploymentsCount: bp.deploymentsCount ?? 0,
    latestDeployment: bp.latestDeployment || null,
  };
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
    url: bd.repositoryUrl || "",
    environment: "production",
    durationMs: bd.durationMs,
    errorMessage: bd.errorMessage,
  };
};

export default function Dashboard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reloadRequestIdRef = useRef<number>(0);
  const handledTerminalDeploymentsRef = useRef<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    provider?: string;
    githubConnected?: boolean;
    githubAccount?: {
      username: string;
      githubUserId: string;
      scope: string;
    } | null;
  } | null>(null);
  const [avatarError, setAvatarError] = useState<boolean>(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [githubConnected, setGithubConnected] = useState<boolean>(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [loadingGithubStatus, setLoadingGithubStatus] = useState<boolean>(true);
  const [githubStatusError, setGithubStatusError] = useState<string | null>(
    null,
  );

  const [githubRepos, setGithubRepos] = useState<GithubRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [requiresReconnect, setRequiresReconnect] = useState<boolean>(false);

  const [selectedRepo, setSelectedRepo] = useState<GithubRepository | null>(
    null,
  );
  const [branches, setBranches] = useState<GithubBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [loadingBranches, setLoadingBranches] = useState<boolean>(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  const [deployments, setDeployments] = useState<Deployment[]>([]);

  const validTabs: DashboardNavTab[] = [
    "overview",
    "deployments",
    "projects",
    "databases",
    "domains",
    "env-vars",
    "secrets",
    "integrations",
    "logs",
    "monitoring",
    "analytics",
    "settings",
    "account",
  ];

  const tabParam = searchParams.get("tab");
  const activeTab: DashboardNavTab =
    tabParam && validTabs.includes(tabParam as DashboardNavTab)
      ? (tabParam as DashboardNavTab)
      : "overview";

  const setActiveTab = useCallback(
    (tab: DashboardNavTab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      });
    },
    [setSearchParams],
  );

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] =
    useState<boolean>(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(true);

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [searchRepoQuery, setSearchRepoQuery] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [connectModalError, setConnectModalError] = useState<string | null>(
    null,
  );

  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(
    null,
  );
  const [activeProjectName, setActiveProjectName] = useState<string>("");
  const [deployingProjectId, setDeployingProjectId] = useState<string | null>(
    null,
  );

  // Integrations state
  const [githubActionLoading, setGithubActionLoading] = useState(false);
  const [githubMessage, setGithubMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Settings / Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Dedicated Logs state
  const [selectedLogDepId, setSelectedLogDepId] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<
    Array<{ id: string; line: string; stream: string; timestamp: string }>
  >([]);
  const [loadingLogLines, setLoadingLogLines] = useState(false);

  const [databases, setDatabases] = useState<
    Array<{
      id: string;
      name: string;
      status: "active" | "provisioning";
      url: string;
      size: string;
    }>
  >([]);
  const [isProvisioningDb, setIsProvisioningDb] = useState(false);
  const [newDbName, setNewDbName] = useState("");

  const [envVars, setEnvVars] = useState<
    Array<{ id: string; key: string; value: string; project: string }>
  >([]);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [newEnvProject, setNewEnvProject] = useState("");

  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [searchProjectQuery, setSearchProjectQuery] = useState("");
  const [timeframe, setTimeframe] = useState<"30d" | "7d" | "90d" | "all">(
    "30d",
  );
  const [projectStatusFilter, setProjectStatusFilter] = useState<
    "all" | "ready" | "building" | "failed"
  >("all");
  const [projectSortBy, setProjectSortBy] = useState<
    "updated" | "name" | "deployments"
  >("updated");
  const [projectViewMode, setProjectViewMode] = useState<"grid" | "list">(
    "grid",
  );

  const fetchGithubStatus = useCallback(async () => {
    setLoadingGithubStatus(true);
    setGithubStatusError(null);
    try {
      const status = await getGithubStatus();
      setGithubConnected(status.connected);
      if (status.connected && status.github) {
        setGithubUsername(status.github.username);
      } else {
        setGithubUsername(null);
      }
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        errorObj.response?.data?.message ||
        errorObj.message ||
        "Failed to fetch GitHub status";
      const isAuth =
        errMsg.toLowerCase().includes("access token is required") ||
        errMsg.toLowerCase().includes("unauthorized") ||
        errMsg.toLowerCase().includes("jwt");
      if (!isAuth) {
        setGithubStatusError(errMsg);
      }
      setGithubConnected(false);
    } finally {
      setLoadingGithubStatus(false);
    }
  }, []);

  useEffect(() => {
    const success = searchParams.get("github_success");
    const error = searchParams.get("github_error");

    if (error) {
      if (error === "account_already_linked") {
        setGithubStatusError(
          "This GitHub account is already connected to another HAVN account.",
        );
      } else {
        setGithubStatusError("Failed to connect GitHub account.");
      }
      fetchGithubStatus();
      navigate("/dashboard", { replace: true });
    } else if (success) {
      setGithubStatusError(null);
      fetchGithubStatus();
      navigate("/dashboard", { replace: true });
    } else {
      fetchGithubStatus();
    }
  }, [searchParams, navigate, fetchGithubStatus]);

  useEffect(() => {
    getCurrentUser()
      .then((data) => {
        if (data?.success && data?.user) {
          setCurrentUser(data.user);
          if (data.user.githubConnected && data.user.githubAccount) {
            setGithubConnected(true);
            setGithubUsername(data.user.githubAccount.username);
          }
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/health")
      .then((res) => {
        if (isMounted) {
          setIsBackendHealthy(res.status === 200);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsBackendHealthy(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const reloadProjects = useCallback(async () => {
    const currentRequestId = ++reloadRequestIdRef.current;
    try {
      const data = await getProjects();
      if (currentRequestId !== reloadRequestIdRef.current) {
        return [];
      }
      const mapped = data.map(mapBackendProjectToProject);
      setProjects(mapped);

      const projectsWithDeployments = data.filter(
        (p) => (p.deploymentsCount ?? 0) > 0,
      );
      const deploymentBatches = await Promise.all(
        projectsWithDeployments.map(async (p) => {
          try {
            const depListRes = await getProjectDeployments(p.id, 1, 10);
            return depListRes.deployments.map(mapBackendDeploymentToFrontend);
          } catch {
            return [];
          }
        }),
      );

      if (currentRequestId !== reloadRequestIdRef.current) {
        return mapped;
      }

      const allDeps = deploymentBatches.flat();
      allDeps.sort(sortDeploymentsNewestFirst);
      setDeployments(allDeps);
      setProjectError(null);

      return mapped;
    } catch (err: any) {
      if (currentRequestId !== reloadRequestIdRef.current) {
        return [];
      }
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to fetch projects from server";
      setProjectError(msg);
      return [];
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoadingProjects(true);
    setProjectError(null);

    reloadProjects().finally(() => {
      if (isMounted) {
        setLoadingProjects(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [reloadProjects]);

  useEffect(() => {
    if (projects.length === 0 || activeDeploymentId) return;

    for (const p of projects) {
      if (
        p.latestDeployment &&
        ["QUEUED", "INITIALIZING", "BUILDING"].includes(
          p.latestDeployment.status,
        )
      ) {
        setActiveDeploymentId(p.latestDeployment.id);
        setActiveProjectName(p.name);
        setIsLogModalOpen(true);
        break;
      }
    }
  }, [projects, activeDeploymentId]);

  const handleDeleteProject = async (
    projectId: string,
    projectName: string,
  ) => {
    if (
      !window.confirm(
        `Are you sure you want to delete project "${projectName}"? This will delete all associated deployments and local images.`,
      )
    ) {
      return;
    }
    setDeletingProjectId(projectId);
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setDeployments((prev) => prev.filter((d) => d.projectId !== projectId));
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      alert(
        errorObj.response?.data?.message ||
          errorObj.message ||
          "Failed to delete project",
      );
    } finally {
      setDeletingProjectId(null);
    }
  };

  useEffect(() => {
    if (isConnectModalOpen && githubConnected) {
      setLoadingRepos(true);
      setRepoError(null);
      setRequiresReconnect(false);
      getGithubRepositories()
        .then((repos) => {
          setGithubRepos(repos);
        })
        .catch((err) => {
          const isReconnect =
            err.response?.status === 401 ||
            err.response?.data?.requiresReconnect === true;
          setRequiresReconnect(isReconnect);
          const msg =
            err.response?.data?.message ||
            err.message ||
            "Failed to load GitHub repositories";
          setRepoError(msg);
        })
        .finally(() => {
          setLoadingRepos(false);
        });
    }
  }, [isConnectModalOpen, githubConnected]);

  useEffect(() => {
    if (selectedRepo) {
      setLoadingBranches(true);
      setBranchError(null);
      getGithubBranches(selectedRepo.owner, selectedRepo.name)
        .then((branchList) => {
          setBranches(branchList);
          if (branchList.length > 0) {
            const defBranch = branchList.find(
              (b) => b.name === selectedRepo.defaultBranch,
            );
            setSelectedBranch(defBranch ? defBranch.name : branchList[0].name);
          } else {
            setSelectedBranch("main");
          }
        })
        .catch((err) => {
          const msg =
            err.response?.data?.message ||
            err.message ||
            "Failed to load repository branches";
          setBranchError(msg);
        })
        .finally(() => {
          setLoadingBranches(false);
        });
    }
  }, [selectedRepo]);

  const handleTriggerDeploy = async (project: Project) => {
    setDeployingProjectId(project.id);
    try {
      const newDeployment = await createDeployment(project.id, {
        branch: project.branch || "main",
        dockerfilePath: "Dockerfile",
      });

      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id
            ? {
                ...p,
                status: "queued",
                deploymentsCount: p.deploymentsCount + 1,
                latestDeployment: {
                  id: newDeployment.id,
                  status: newDeployment.status,
                  branch: newDeployment.branch,
                  commitSha: newDeployment.commitSha,
                  commitMsg: newDeployment.commitMsg,
                  imageTag: newDeployment.imageTag,
                  createdAt: newDeployment.createdAt,
                  completedAt: newDeployment.completedAt,
                },
              }
            : p,
        ),
      );

      setActiveDeploymentId(newDeployment.id);
      setActiveProjectName(project.name);
      setIsLogModalOpen(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to trigger deployment.";
      alert(msg);
    } finally {
      setDeployingProjectId(null);
    }
  };

  const handleCreateAndDeploy = async () => {
    if (!selectedRepo) return;
    setIsCreatingProject(true);
    setConnectModalError(null);

    try {
      const targetBranch =
        selectedBranch || selectedRepo.defaultBranch || "main";

      const createdBackendProject = await createProject({
        name: selectedRepo.name,
        repositoryName: selectedRepo.fullName,
        repositoryUrl: selectedRepo.url,
        branch: targetBranch,
        status: "queued",
      });

      const initialDep = await createDeployment(createdBackendProject.id, {
        branch: targetBranch,
        dockerfilePath: "Dockerfile",
      });

      setIsConnectModalOpen(false);
      setSelectedRepo(null);
      setSelectedBranch("");
      setBranches([]);

      await reloadProjects();

      setActiveDeploymentId(initialDep.id);
      setActiveProjectName(createdBackendProject.name);
      setIsLogModalOpen(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to create project and queue deployment";
      setConnectModalError(msg);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeploymentTerminal = useCallback(
    async (finalDep?: BackendDeployment) => {
      if (!finalDep) {
        await reloadProjects();
        return;
      }

      if (handledTerminalDeploymentsRef.current.has(finalDep.id)) {
        return;
      }
      handledTerminalDeploymentsRef.current.add(finalDep.id);

      try {
        const depListRes = await getProjectDeployments(
          finalDep.projectId,
          1,
          10,
        );
        const newProjDeps = depListRes.deployments.map(
          mapBackendDeploymentToFrontend,
        );

        setDeployments((prev) => {
          const otherDeps = prev.filter(
            (d) => d.projectId !== finalDep.projectId,
          );
          const merged = [...otherDeps, ...newProjDeps];
          merged.sort(sortDeploymentsNewestFirst);
          return merged;
        });

        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== finalDep.projectId) return p;
            let newStatus:
              | "ready"
              | "building"
              | "failed"
              | "queued"
              | "cancelled"
              | "idle" = p.status;
            if (finalDep.status === "BUILT") newStatus = "ready";
            else if (finalDep.status === "FAILED") newStatus = "failed";
            else if (finalDep.status === "CANCELLED") newStatus = "cancelled";
            return {
              ...p,
              status: newStatus,
              latestDeployment: {
                id: finalDep.id,
                status: finalDep.status,
                branch: finalDep.branch,
                commitSha: finalDep.commitSha,
                commitMsg: finalDep.commitMsg,
                imageTag: finalDep.imageTag,
                createdAt: finalDep.createdAt,
                completedAt: finalDep.completedAt,
              },
            };
          }),
        );
      } catch {
        await reloadProjects();
      }
    },
    [reloadProjects],
  );

  const handleOpenDeploymentLogs = (depId: string, projName: string) => {
    setActiveDeploymentId(depId);
    setActiveProjectName(projName);
    setIsLogModalOpen(true);
  };

  const handleConnectGithubOAuth = async () => {
    try {
      const url = await getGithubConnectUrl();
      if (url) {
        window.location.href = url;
      }
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setGithubStatusError(
        errorObj.response?.data?.message ||
          errorObj.message ||
          "Failed to initiate GitHub connection",
      );
    }
  };

  useCanvasSky(canvasRef, { cloudCount: 18, baseSpeed: 0.8 });

  const handleProvisionDb = (e: FormEvent) => {
    e.preventDefault();
    if (!newDbName.trim()) return;

    setIsProvisioningDb(true);
    const dbNameClean = newDbName.toLowerCase().replace(/[^a-z0-9-_]/g, "");

    setTimeout(() => {
      setDatabases((prev) => [
        ...prev,
        {
          id: `db-${Date.now()}`,
          name: dbNameClean,
          status: "active",
          url: `postgresql://havn_admin:hv_sec_${Math.random().toString(36).substring(7)}@db.havn.internal:5432/${dbNameClean}`,
          size: "128 MB (Tier: Hobby)",
        },
      ]);
      setNewDbName("");
      setIsProvisioningDb(false);
    }, 1200);
  };

  const handleAddEnvVar = (e: FormEvent) => {
    e.preventDefault();
    if (!newEnvKey.trim() || !newEnvValue.trim() || !newEnvProject) return;

    const newVar = {
      id: `ev-${Date.now()}`,
      key: newEnvKey.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
      value: newEnvValue,
      project: newEnvProject,
    };

    setEnvVars((prev) => [...prev, newVar]);
    setNewEnvKey("");
    setNewEnvValue("");
  };

  const handleDeleteEnvVar = (id: string) => {
    setEnvVars((prev) => prev.filter((ev) => ev.id !== id));
  };

  const handleDisconnectGithub = async () => {
    setGithubActionLoading(true);
    setGithubMessage(null);
    try {
      const res = await disconnectGithub();
      setGithubConnected(false);
      setGithubUsername(null);
      setShowDisconnectConfirm(false);
      setGithubMessage({
        type: "success",
        text: res.message || "GitHub account disconnected successfully!",
      });
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setGithubMessage({
        type: "error",
        text:
          errorObj.response?.data?.message ||
          errorObj.message ||
          "Failed to disconnect GitHub account.",
      });
    } finally {
      setGithubActionLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "New password must be at least 8 characters long.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "New password and confirm password do not match.",
      });
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await changePassword({ currentPassword, newPassword });
      setPasswordMessage({
        type: "success",
        text: res.message || "Password changed successfully!",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setPasswordMessage({
        type: "error",
        text:
          errorObj.response?.data?.message ||
          errorObj.message ||
          "Failed to update password.",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "logs") return;
    const targetDepId =
      selectedLogDepId || (deployments.length > 0 ? deployments[0].id : null);
    if (!targetDepId) {
      setLogLines([]);
      return;
    }
    let isMounted = true;
    setLoadingLogLines(true);
    getDeploymentLogs(targetDepId)
      .then((res) => {
        if (isMounted) {
          setLogLines(res.logs || []);
        }
      })
      .catch(() => {
        if (isMounted) setLogLines([]);
      })
      .finally(() => {
        if (isMounted) setLoadingLogLines(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, selectedLogDepId, deployments]);

  const isAuthError = (msg: string | null) => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return (
      lower.includes("access token is required") ||
      lower.includes("unauthorized") ||
      lower.includes("jwt") ||
      lower.includes("401")
    );
  };

  // Timeframe calculation for real deployment metrics
  const now = Date.now();
  const timeframeDays =
    timeframe === "7d"
      ? 7
      : timeframe === "30d"
        ? 30
        : timeframe === "90d"
          ? 90
          : null;
  const timeframeFilteredDeployments = deployments.filter((d) => {
    if (!timeframeDays) return true;
    const createdTime = d.createdAt ? new Date(d.createdAt).getTime() : 0;
    return (
      createdTime === 0 ||
      now - createdTime <= timeframeDays * 24 * 60 * 60 * 1000
    );
  });

  // Filter and sort projects based on search query, status filter, and sort order
  const displayedProjects = projects
    .filter((p) => {
      // 1. Search filter
      const matchesSearch =
        !searchProjectQuery ||
        p.name.toLowerCase().includes(searchProjectQuery.toLowerCase()) ||
        (p.repo &&
          p.repo.toLowerCase().includes(searchProjectQuery.toLowerCase()));
      if (!matchesSearch) return false;

      // 2. Status filter
      if (projectStatusFilter === "all") return true;
      const projStatus = p.status;
      const depStatus = p.latestDeployment?.status;
      if (projectStatusFilter === "ready") {
        return projStatus === "ready" || depStatus === "BUILT";
      }
      if (projectStatusFilter === "building") {
        return (
          projStatus === "building" ||
          projStatus === "queued" ||
          depStatus === "BUILDING" ||
          depStatus === "INITIALIZING" ||
          depStatus === "QUEUED"
        );
      }
      if (projectStatusFilter === "failed") {
        return projStatus === "failed" || depStatus === "FAILED";
      }
      return true;
    })
    .sort((a, b) => {
      if (projectSortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (projectSortBy === "deployments") {
        return (b.deploymentsCount || 0) - (a.deploymentsCount || 0);
      }
      // 'updated'
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

  const activeProjectsCount = projects.length;
  const totalDeploymentsCount = timeframeFilteredDeployments.length;

  const builtDeployments = timeframeFilteredDeployments.filter(
    (d) => d.status === "BUILT" || d.status === "ready",
  );
  const failedDeployments = timeframeFilteredDeployments.filter(
    (d) => d.status === "FAILED" || d.status === "failed",
  );
  const terminalDeploymentsCount =
    builtDeployments.length + failedDeployments.length;

  const successRateText =
    terminalDeploymentsCount > 0
      ? `${Math.round((builtDeployments.length / terminalDeploymentsCount) * 100)}%`
      : "--";

  const deploymentsWithDuration = builtDeployments.filter(
    (d) => typeof d.durationMs === "number" && d.durationMs > 0,
  );
  const avgDurationMs =
    deploymentsWithDuration.length > 0
      ? deploymentsWithDuration.reduce(
          (acc, d) => acc + (d.durationMs || 0),
          0,
        ) / deploymentsWithDuration.length
      : 0;

  const avgDeployTimeText =
    avgDurationMs > 0 ? `${Math.round(avgDurationMs / 1000)}s` : "--";

  return (
    <div
      id="dashboard-workspace"
      className="min-h-screen flex relative overflow-x-hidden font-sans selection:bg-sky-200 dark:selection:bg-slate-700 bg-gradient-to-b from-sky-50/20 via-transparent to-sky-100/20 dark:from-sky-950/20 dark:via-blue-950/25 dark:to-[#0b0e14]"
    >
      {/* Living Sky Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Subtle Atmospheric Radial Depth (soft blue/sky glow in dark mode) */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(56,189,248,0.08),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(14,165,233,0.12),rgba(11,14,20,0))]" />

      {/* Persistent Glassmorphic Sidebar */}
      <DashboardSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLatestLogs={() => {
          if (deployments.length > 0) {
            handleOpenDeploymentLogs(
              deployments[0].id,
              deployments[0].projectName,
            );
          } else {
            setActiveTab("deployments");
          }
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 relative z-20 transition-all duration-300">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Top Glassmorphic Header */}
          <DashboardHeader
            searchQuery={globalSearchQuery}
            onSearchChange={setGlobalSearchQuery}
            projects={projects}
            deployments={deployments}
            databases={databases}
            onViewLogs={handleOpenDeploymentLogs}
            githubConnected={githubConnected}
            githubUsername={githubUsername}
            onConnectGithub={handleConnectGithubOAuth}
            currentUser={
              currentUser
                ? { name: currentUser.name, avatar: currentUser.avatar }
                : null
            }
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            onTabChange={setActiveTab}
            isBackendHealthy={isBackendHealthy}
          />

          {/* GitHub Status Error Notification */}
          {githubStatusError && !isConnectModalOpen && (
            <div className="backdrop-blur-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 rounded-2xl p-4 flex items-center justify-between text-xs font-semibold shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span>{githubStatusError}</span>
              </div>
              <button
                type="button"
                onClick={() => setGithubStatusError(null)}
                className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 font-bold ml-2 cursor-pointer text-sm"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-6 motion-safe:animate-fade-in-up">
              {/* Header Title & Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-[#f1f3f5] tracking-tight">
                    Overview
                  </h1>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mt-0.5">
                    Your deployments and infrastructure at a glance
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Timeframe Selector */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value as any)}
                      aria-label="Filter timeframe"
                      className="appearance-none bg-white/70 dark:bg-[#16191f]/80 backdrop-blur-xl border border-slate-200/80 dark:border-[#282d37] hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold py-2.5 pl-3.5 pr-8 rounded-xl transition-all shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="all">All time</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 pointer-events-none absolute right-2.5" />
                  </div>

                  {/* Contextual Connect GitHub Button if not connected */}
                  {!githubConnected && (
                    <button
                      type="button"
                      onClick={handleConnectGithubOAuth}
                      className="bg-slate-900 hover:bg-black dark:bg-[#1e222b] dark:hover:bg-[#282d37] text-white font-bold text-xs py-2.5 px-3.5 rounded-xl transition-all shadow-md flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                      title="Connect your GitHub account"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Connect GitHub</span>
                    </button>
                  )}

                  {/* Solid Blue + New Project CTA (Permanent) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (githubConnected) {
                        setIsConnectModalOpen(true);
                      } else {
                        handleConnectGithubOAuth();
                      }
                    }}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md shadow-blue-600/30 hover:shadow-blue-600/40 flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Project</span>
                  </button>
                </div>
              </div>

              {/* 4 Overview Metrics */}
              <DashboardMetrics
                activeProjectsCount={activeProjectsCount}
                totalDeploymentsCount={totalDeploymentsCount}
                successfulDeploymentsCount={builtDeployments.length}
                successRateText={successRateText}
                avgDeployTimeText={avgDeployTimeText}
              />

              {/* 2-Column Responsive Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column (8 cols): Active Projects Grid + Recent Activity Feed */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Active Projects Header & Sub-toolbar */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">
                          Active Projects
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                          Deployed codebases and container environments
                        </p>
                      </div>
                      {projects.length > 0 && (
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-[#16191f]/70 px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-[#282d37]">
                          {displayedProjects.length} of {projects.length}{" "}
                          {projects.length === 1 ? "Project" : "Projects"}
                        </span>
                      )}
                    </div>

                    {/* Sub-toolbar: Search, Status Filter, Sort, Grid/List view toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl backdrop-blur-xl bg-white/40 dark:bg-[#16191f]/40 border border-slate-200/70 dark:border-[#282d37]">
                      {/* Search projects */}
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={searchProjectQuery}
                          onChange={(e) =>
                            setSearchProjectQuery(e.target.value)
                          }
                          placeholder="Search projects..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-white/70 dark:bg-[#12151a]/80 text-slate-800 dark:text-slate-200 placeholder-slate-400 border border-slate-200/80 dark:border-[#282d37] rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        {searchProjectQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchProjectQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Filter, Sort & View controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Filter */}
                        <div className="relative inline-flex items-center">
                          <select
                            value={projectStatusFilter}
                            onChange={(e) =>
                              setProjectStatusFilter(e.target.value as any)
                            }
                            aria-label="Filter by project status"
                            className="appearance-none bg-white/70 dark:bg-[#12151a]/80 border border-slate-200/80 dark:border-[#282d37] text-slate-700 dark:text-slate-300 text-xs font-bold py-1.5 pl-3 pr-7 rounded-xl transition-all cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="all">All Projects</option>
                            <option value="ready">Ready</option>
                            <option value="building">Building</option>
                            <option value="failed">Failed</option>
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2" />
                        </div>

                        {/* Sort Dropdown */}
                        <div className="relative inline-flex items-center">
                          <select
                            value={projectSortBy}
                            onChange={(e) =>
                              setProjectSortBy(e.target.value as any)
                            }
                            aria-label="Sort projects"
                            className="appearance-none bg-white/70 dark:bg-[#12151a]/80 border border-slate-200/80 dark:border-[#282d37] text-slate-700 dark:text-slate-300 text-xs font-bold py-1.5 pl-3 pr-7 rounded-xl transition-all cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="updated">Last Updated</option>
                            <option value="name">Name (A-Z)</option>
                            <option value="deployments">Most Deployed</option>
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2" />
                        </div>

                        {/* Grid / List Toggle */}
                        <div className="flex items-center p-0.5 bg-slate-200/60 dark:bg-[#12151a]/80 border border-slate-200/80 dark:border-[#282d37] rounded-xl">
                          <button
                            type="button"
                            onClick={() => setProjectViewMode("grid")}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              projectViewMode === "grid"
                                ? "bg-white dark:bg-[#1e222b] text-blue-600 dark:text-blue-400 shadow-sm font-bold"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            }`}
                            title="Grid View"
                            aria-label="Grid View"
                          >
                            <LayoutGrid className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProjectViewMode("list")}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              projectViewMode === "list"
                                ? "bg-white dark:bg-[#1e222b] text-blue-600 dark:text-blue-400 shadow-sm font-bold"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            }`}
                            title="List View"
                            aria-label="List View"
                          >
                            <List className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {loadingProjects ? (
                      <div className="text-center py-16 backdrop-blur-xl bg-white/50 dark:bg-[#16191f]/80 border border-slate-200/80 dark:border-[#282d37] rounded-3xl p-8 space-y-3">
                        <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Loading projects from server...
                        </p>
                      </div>
                    ) : projectError && !isAuthError(projectError) ? (
                      <div className="text-center py-16 backdrop-blur-xl bg-white/50 dark:bg-[#16191f]/80 border border-red-200/80 dark:border-red-900/40 rounded-3xl p-8 space-y-3">
                        <AlertTriangle className="w-10 h-10 text-red-500 dark:text-red-400 mx-auto" />
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Unable to load projects
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                          {projectError}
                        </p>
                      </div>
                    ) : displayedProjects.length === 0 ? (
                      <div className="text-center py-16 backdrop-blur-xl bg-white/50 dark:bg-[#16191f]/80 border border-dashed border-slate-300 dark:border-[#282d37] rounded-3xl p-8 space-y-3">
                        <Folder className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto" />
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {searchProjectQuery || projectStatusFilter !== "all"
                            ? "No matching projects"
                            : "No projects deployed yet"}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                          {searchProjectQuery || projectStatusFilter !== "all"
                            ? "Try clearing your filters or searching with a different term."
                            : "Connect a GitHub repository to trigger your first cloud deployment and begin monitoring infrastructure."}
                        </p>
                        {searchProjectQuery || projectStatusFilter !== "all" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchProjectQuery("");
                              setProjectStatusFilter("all");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-[#1e222b] text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-300 dark:hover:bg-[#282d37] cursor-pointer"
                          >
                            Reset filters
                          </button>
                        ) : githubConnected ? (
                          <button
                            type="button"
                            onClick={() => setIsConnectModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-500 cursor-pointer shadow-md"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Deploy Your First App
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleConnectGithubOAuth}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-[#1e222b] text-white font-bold text-xs rounded-xl hover:bg-black cursor-pointer shadow-md"
                          >
                            <Github className="w-3.5 h-3.5" />
                            Connect GitHub
                          </button>
                        )}
                      </div>
                    ) : (
                      <div
                        className={
                          projectViewMode === "grid"
                            ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                            : "flex flex-col gap-3"
                        }
                      >
                        {displayedProjects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            onDeploy={handleTriggerDeploy}
                            onViewLogs={handleOpenDeploymentLogs}
                            onDelete={handleDeleteProject}
                            isDeploying={deployingProjectId === project.id}
                            isDeleting={deletingProjectId === project.id}
                            viewMode={projectViewMode}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Deployment Activity Feed */}
                  <RecentDeploymentActivity
                    deployments={timeframeFilteredDeployments}
                    onViewLogs={handleOpenDeploymentLogs}
                    onViewAllDeployments={() => setActiveTab("deployments")}
                  />
                </div>

                {/* Right Column (4 cols): Activity Curve, System Status, Quick Actions */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Deployment Activity Chart */}
                  <DeploymentActivityChart
                    variant="overview"
                    deployments={timeframeFilteredDeployments}
                    onViewAll={() => setActiveTab("deployments")}
                    onViewAnalytics={() => setActiveTab("analytics")}
                  />

                  {/* System Status Card */}
                  <SystemStatusCard
                    isBackendHealthy={isBackendHealthy}
                    githubConnected={githubConnected}
                    activeDeploymentsCount={
                      deployments.filter((d) =>
                        ["QUEUED", "INITIALIZING", "BUILDING"].includes(
                          d.status,
                        ),
                      ).length
                    }
                  />

                  {/* Quick Actions Card */}
                  <QuickActionsCard
                    onNewProject={() => {
                      if (githubConnected) setIsConnectModalOpen(true);
                      else handleConnectGithubOAuth();
                    }}
                    onConnectRepository={() => {
                      if (githubConnected) setIsConnectModalOpen(true);
                      else handleConnectGithubOAuth();
                    }}
                    onAddDatabase={() => setActiveTab("databases")}
                    onManageDomains={() => setActiveTab("domains")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: Projects (Dedicated Projects Workspace) */}
          {activeTab === "projects" && (
            <div className="space-y-6 motion-safe:animate-fade-in-up">
              {/* Header Title & Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-[#f1f3f5] tracking-tight">
                    Projects
                  </h1>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mt-0.5">
                    Manage your deployed applications, environments, and
                    container workloads
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {!githubConnected && (
                    <button
                      type="button"
                      onClick={handleConnectGithubOAuth}
                      className="bg-slate-900 hover:bg-black dark:bg-[#1e222b] dark:hover:bg-[#282d37] text-white font-bold text-xs py-2.5 px-3.5 rounded-xl transition-all shadow-md flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                      title="Connect your GitHub account"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Connect GitHub</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (githubConnected) {
                        setIsConnectModalOpen(true);
                      } else {
                        handleConnectGithubOAuth();
                      }
                    }}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md shadow-blue-600/30 hover:shadow-blue-600/40 flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Project</span>
                  </button>
                </div>
              </div>

              {/* Sub-toolbar: Search, Status Filter, Sort, Grid/List view toggle */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl backdrop-blur-xl bg-white/40 dark:bg-[#16191f]/40 border border-slate-200/70 dark:border-[#282d37]">
                  {/* Search projects */}
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchProjectQuery}
                      onChange={(e) => setSearchProjectQuery(e.target.value)}
                      placeholder="Search projects..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-white/70 dark:bg-[#12151a]/80 text-slate-800 dark:text-slate-200 placeholder-slate-400 border border-slate-200/80 dark:border-[#282d37] rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    {searchProjectQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchProjectQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter, Sort & View controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Filter */}
                    <div className="relative inline-flex items-center">
                      <select
                        value={projectStatusFilter}
                        onChange={(e) =>
                          setProjectStatusFilter(e.target.value as any)
                        }
                        aria-label="Filter by project status"
                        className="appearance-none bg-white/70 dark:bg-[#12151a]/80 border border-slate-200/80 dark:border-[#282d37] text-slate-700 dark:text-slate-300 text-xs font-bold py-1.5 pl-3 pr-7 rounded-xl transition-all cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="all">All Projects</option>
                        <option value="ready">Ready</option>
                        <option value="building">Building</option>
                        <option value="failed">Failed</option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2" />
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative inline-flex items-center">
                      <select
                        value={projectSortBy}
                        onChange={(e) =>
                          setProjectSortBy(e.target.value as any)
                        }
                        aria-label="Sort projects"
                        className="appearance-none bg-white/70 dark:bg-[#12151a]/80 border border-slate-200/80 dark:border-[#282d37] text-slate-700 dark:text-slate-300 text-xs font-bold py-1.5 pl-3 pr-7 rounded-xl transition-all cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="updated">Last Updated</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="deployments">Most Deployed</option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2" />
                    </div>

                    {/* Grid / List Toggle */}
                    <div className="flex items-center p-0.5 bg-slate-200/60 dark:bg-[#12151a]/80 border border-slate-200/80 dark:border-[#282d37] rounded-xl">
                      <button
                        type="button"
                        onClick={() => setProjectViewMode("grid")}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          projectViewMode === "grid"
                            ? "bg-white dark:bg-[#1e222b] text-blue-600 dark:text-blue-400 shadow-sm font-bold"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        }`}
                        title="Grid View"
                        aria-label="Grid View"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectViewMode("list")}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          projectViewMode === "list"
                            ? "bg-white dark:bg-[#1e222b] text-blue-600 dark:text-blue-400 shadow-sm font-bold"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        }`}
                        title="List View"
                        aria-label="List View"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {loadingProjects ? (
                  <div className="text-center py-20 backdrop-blur-xl bg-white/50 dark:bg-[#16191f]/80 border border-slate-200/80 dark:border-[#282d37] rounded-3xl p-8 space-y-3">
                    <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Loading projects from server...
                    </p>
                  </div>
                ) : projectError && !isAuthError(projectError) ? (
                  <div className="text-center py-20 backdrop-blur-xl bg-white/50 dark:bg-[#16191f]/80 border border-red-200/80 dark:border-red-900/40 rounded-3xl p-8 space-y-3">
                    <AlertTriangle className="w-10 h-10 text-red-500 dark:text-red-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Unable to load projects
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {projectError}
                    </p>
                  </div>
                ) : displayedProjects.length === 0 ? (
                  <div className="text-center py-20 backdrop-blur-xl bg-white/50 dark:bg-[#16191f]/80 border border-dashed border-slate-300 dark:border-[#282d37] rounded-3xl p-8 space-y-3">
                    <Folder className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {searchProjectQuery || projectStatusFilter !== "all"
                        ? "No matching projects"
                        : "No projects deployed yet"}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                      {searchProjectQuery || projectStatusFilter !== "all"
                        ? "Try clearing your filters or searching with a different term."
                        : "Connect a GitHub repository to trigger your first cloud deployment and begin monitoring infrastructure."}
                    </p>
                    {searchProjectQuery || projectStatusFilter !== "all" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchProjectQuery("");
                          setProjectStatusFilter("all");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-[#1e222b] text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-300 dark:hover:bg-[#282d37] cursor-pointer"
                      >
                        Reset filters
                      </button>
                    ) : githubConnected ? (
                      <button
                        type="button"
                        onClick={() => setIsConnectModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-500 cursor-pointer shadow-md"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Deploy Your First App
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectGithubOAuth}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-[#1e222b] text-white font-bold text-xs rounded-xl hover:bg-black cursor-pointer shadow-md"
                      >
                        <Github className="w-3.5 h-3.5" />
                        Connect GitHub
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className={
                      projectViewMode === "grid"
                        ? "grid grid-cols-1 md:grid-cols-2 gap-5"
                        : "flex flex-col gap-3"
                    }
                  >
                    {displayedProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onDeploy={handleTriggerDeploy}
                        onViewLogs={handleOpenDeploymentLogs}
                        onDelete={handleDeleteProject}
                        isDeploying={deployingProjectId === project.id}
                        isDeleting={deletingProjectId === project.id}
                        viewMode={projectViewMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Deployments History */}
          {activeTab === "deployments" && (
            <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl overflow-hidden shadow-xl shadow-sky-950/10 dark:shadow-none motion-safe:animate-fade-in-up">
              <div className="px-6 py-5 border-b border-slate-200/80 dark:border-[#282d37] bg-white/40 dark:bg-[#12151a]/60 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-[#f1f3f5]">
                    Deployment History
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                    Real-time status of your deployment pipeline runs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reloadProjects}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              <div className="divide-y divide-slate-200/80 dark:divide-[#282d37]">
                {deployments.length === 0 ? (
                  <div className="text-center py-16 px-4 space-y-2">
                    <Activity className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      No deployments found
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Connect a repository and deploy a project to view
                      deployment history.
                    </p>
                  </div>
                ) : (
                  deployments.map((dep) => (
                    <div
                      key={dep.id}
                      onClick={() =>
                        handleOpenDeploymentLogs(dep.id, dep.projectName)
                      }
                      className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-white/50 dark:hover:bg-[#1e222b]/50 transition-colors cursor-pointer"
                    >
                      <div className="space-y-1.5 max-w-xl">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-[#f1f3f5]">
                            {dep.projectName}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-900/60">
                            Production
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold italic">
                          "{dep.commitMsg}"
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                          <span className="flex items-center gap-1">
                            <GitBranch className="w-3.5 h-3.5 text-slate-800 dark:text-slate-300" />{" "}
                            {dep.branch}
                          </span>
                          <span>SHA: {dep.commitHash}</span>
                          <span>Deployed {dep.deployedAt}</span>
                          {dep.durationMs && (
                            <span>
                              Duration: {Math.round(dep.durationMs / 1000)}s
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {dep.status === "BUILT" || dep.status === "ready" ? (
                          <span className="bg-emerald-100/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />{" "}
                            Built
                          </span>
                        ) : dep.status === "FAILED" ||
                          dep.status === "failed" ? (
                          <span className="bg-red-100/90 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />{" "}
                            Failed
                          </span>
                        ) : dep.status === "CANCELLED" ||
                          (dep.status as string) === "cancelled" ? (
                          <span className="bg-slate-100 dark:bg-[#1e222b] border border-slate-300 dark:border-[#282d37] text-slate-700 dark:text-slate-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                            Cancelled
                          </span>
                        ) : (
                          <span className="bg-blue-100/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />{" "}
                            {dep.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: Databases */}
          {activeTab === "databases" && (
            <div className="space-y-6 motion-safe:animate-fade-in-up">
              <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-sky-950/10 dark:shadow-none">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                    <Database className="w-4 h-4" /> Serverless Cloud PostgreSQL
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#f1f3f5]">
                    Provision New Database
                  </h2>
                  <p className="text-slate-700 dark:text-slate-400 text-xs leading-relaxed font-semibold">
                    Spin up transactional, serverless PostgreSQL clusters
                    instantly. Databases scale computing nodes automatically.
                  </p>
                </div>

                <form
                  onSubmit={handleProvisionDb}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <input
                    type="text"
                    required
                    placeholder="e.g. app-production-db"
                    value={newDbName}
                    onChange={(e) => setNewDbName(e.target.value)}
                    className="bg-white/75 focus:bg-white dark:bg-[#12151a] dark:focus:bg-[#12151a] border border-white/90 dark:border-[#282d37] focus:border-blue-500 dark:focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-[#f1f3f5] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all shadow-2xs focus:ring-2 focus:ring-blue-500/20 font-semibold flex-1"
                    disabled={isProvisioningDb}
                  />
                  <button
                    type="submit"
                    disabled={isProvisioningDb}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProvisioningDb ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />{" "}
                        Provisioning...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Launch PostgreSQL
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl overflow-hidden shadow-xl shadow-sky-950/10 dark:shadow-none">
                <div className="px-6 py-4 border-b border-slate-200/80 dark:border-[#282d37] bg-white/40 dark:bg-[#12151a]/60">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Active Workspace Databases
                  </h3>
                </div>

                <div className="divide-y divide-slate-200/80 dark:divide-[#282d37]">
                  {databases.length === 0 ? (
                    <div className="text-center py-12 px-4 space-y-1 text-slate-500 dark:text-slate-400">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        No databases provisioned yet
                      </p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Launch a managed PostgreSQL cluster above for
                        zero-config persistence.
                      </p>
                    </div>
                  ) : (
                    databases.map((db) => (
                      <div
                        key={db.id}
                        className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/40 dark:hover:bg-[#1e222b]/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-[#f1f3f5]">
                              {db.name}
                            </span>
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded font-bold">
                              {db.status}
                            </span>
                          </div>
                          <code className="text-xs text-blue-600 dark:text-blue-400 font-mono block select-all">
                            {db.url}
                          </code>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                          {db.size}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Environment Variables & Secrets */}
          {(activeTab === "env-vars" || activeTab === "secrets") && (
            <div className="space-y-6 motion-safe:animate-fade-in-up">
              <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-sky-950/10 dark:shadow-none">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    <Key className="w-4 h-4" /> Secure Environment Storage
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#f1f3f5]">
                    {activeTab === "secrets"
                      ? "Secrets & Encrypted Parameters"
                      : "Configure Environment Keys"}
                  </h2>
                  <p className="text-slate-700 dark:text-slate-400 text-xs leading-relaxed font-semibold">
                    Inject parameters and secrets dynamically into your build
                    runs securely. Keys are encrypted at-rest using AES-256.
                  </p>
                </div>

                <form
                  onSubmit={handleAddEnvVar}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3"
                >
                  <div className="md:col-span-3">
                    <select
                      value={newEnvProject}
                      onChange={(e) => setNewEnvProject(e.target.value)}
                      className="bg-white/75 focus:bg-white dark:bg-[#12151a] dark:focus:bg-[#12151a] border border-white/90 dark:border-[#282d37] focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-[#f1f3f5] font-semibold focus:outline-none w-full cursor-pointer shadow-2xs"
                    >
                      {projects.length === 0 ? (
                        <option value="">No projects available</option>
                      ) : (
                        projects.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <input
                      type="text"
                      required
                      placeholder="API_KEY_NAME"
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      className="bg-white/75 focus:bg-white dark:bg-[#12151a] dark:focus:bg-[#12151a] border border-white/90 dark:border-[#282d37] focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-[#f1f3f5] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none w-full font-mono uppercase shadow-2xs"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <input
                      type="password"
                      required
                      placeholder="secret_parameter_value"
                      value={newEnvValue}
                      onChange={(e) => setNewEnvValue(e.target.value)}
                      className="bg-white/75 focus:bg-white dark:bg-[#12151a] dark:focus:bg-[#12151a] border border-white/90 dark:border-[#282d37] focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-[#f1f3f5] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none w-full font-mono shadow-2xs"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md shadow-blue-600/30 w-full flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add Key
                    </button>
                  </div>
                </form>
              </div>

              <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl overflow-hidden shadow-xl shadow-sky-950/10 dark:shadow-none">
                <div className="px-6 py-4 border-b border-slate-200/80 dark:border-[#282d37] bg-white/40 dark:bg-[#12151a]/60">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Configured Credentials Matrix
                  </h3>
                </div>

                <div className="divide-y divide-slate-200/80 dark:divide-[#282d37]">
                  {envVars.length === 0 ? (
                    <div className="text-center py-12 px-4 space-y-1 text-slate-500 dark:text-slate-400">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        No environment keys defined yet
                      </p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Add secure key-value pairs above for your project
                        configurations.
                      </p>
                    </div>
                  ) : (
                    envVars.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/40 dark:hover:bg-[#1e222b]/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-extrabold text-blue-700 dark:text-blue-400 font-mono">
                              {ev.key}
                            </code>
                            <span className="text-[10px] bg-slate-100 dark:bg-[#12151a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#282d37] px-2 py-0.5 rounded font-bold">
                              {ev.project}
                            </span>
                          </div>
                          <code className="text-xs text-slate-600 dark:text-slate-400 font-mono block select-all">
                            ••••••••••••••••
                          </code>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteEnvVar(ev.id)}
                          className="p-2 text-slate-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl border border-white/90 dark:border-[#282d37] bg-white/60 dark:bg-[#1e222b] hover:bg-white dark:hover:bg-[#282d37] transition-all shadow-2xs flex items-center justify-center cursor-pointer"
                          aria-label="Delete key"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Domains */}
          {activeTab === "domains" && (
            <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-sky-950/10 dark:shadow-none motion-safe:animate-fade-in-up">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1">
                  <Globe className="w-4 h-4" /> Edge Routing & SSL
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#f1f3f5]">
                  Custom Domains & TLS Routing
                </h2>
                <p className="text-slate-700 dark:text-slate-400 text-xs leading-relaxed font-semibold">
                  Map production domains to your container services. Automatic
                  wildcard SSL certificates are generated and renewed via Let's
                  Encrypt.
                </p>
              </div>

              <div className="p-8 text-center bg-white/40 dark:bg-[#12151a]/40 rounded-2xl border border-dashed border-slate-300 dark:border-[#282d37] space-y-3">
                <Globe className="w-10 h-10 text-sky-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Wildcard Edge Proxy Active
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Every project automatically receives a default high-speed URL
                  under{" "}
                  <code className="text-blue-600 dark:text-blue-400 font-mono">
                    *.havn.internal
                  </code>
                  . Custom vanity domain mapping is configurable through DNS
                  CNAME verification.
                </p>
              </div>
            </div>
          )}

          {/* TAB: Monitoring */}
          {activeTab === "monitoring" && (
            <div className="space-y-6 motion-safe:animate-fade-in-up">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">
                  Cluster & Engine Observability
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                  Real-time runtime health, worker execution states, and
                  telemetry
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SystemStatusCard
                  isBackendHealthy={isBackendHealthy}
                  githubConnected={githubConnected}
                  activeDeploymentsCount={
                    deployments.filter((d) =>
                      ["QUEUED", "INITIALIZING", "BUILDING"].includes(d.status),
                    ).length
                  }
                />

                <div className="backdrop-blur-2xl bg-white/75 dark:bg-[#16191f]/85 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 shadow-lg shadow-sky-950/5 dark:shadow-black/30 space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#f1f3f5]">
                    Telemetry Summary
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#282d37]">
                      <span className="text-slate-500 dark:text-slate-400">
                        Total Deployment Records
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {deployments.length}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#282d37]">
                      <span className="text-slate-500 dark:text-slate-400">
                        Active Build Workers
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Isolated Local Docker Daemon
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#282d37]">
                      <span className="text-slate-500 dark:text-slate-400">
                        Live Health Polling
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        Active (2s intervals during builds)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Analytics */}
          {activeTab === "analytics" && (
            <div className="space-y-6 motion-safe:animate-fade-in-up">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">
                  Deployment Analytics
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                  Historical throughput, cadence, and pipeline metrics
                </p>
              </div>

              <DashboardMetrics
                activeProjectsCount={activeProjectsCount}
                totalDeploymentsCount={totalDeploymentsCount}
                successfulDeploymentsCount={builtDeployments.length}
                successRateText={successRateText}
                avgDeployTimeText={avgDeployTimeText}
              />

              <DeploymentActivityChart
                variant="detailed"
                deployments={deployments}
                onViewAll={() => setActiveTab("deployments")}
              />
            </div>
          )}

          {/* TAB: Integrations */}
          {activeTab === "integrations" && (
            <div className="space-y-6 motion-safe:animate-fade-in-up">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">
                  Integrations & Connected Accounts
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                  Manage external code repositories, OAuth providers, and
                  automated deployment webhooks
                </p>
              </div>

              {githubMessage && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm ${
                    githubMessage.type === "success"
                      ? "bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                      : "bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {githubMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    )}
                    <span>{githubMessage.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGithubMessage(null)}
                    className="text-xs font-bold px-1.5 py-0.5 hover:opacity-70 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* GitHub Connection Card */}
                <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 space-y-4 shadow-xl shadow-sky-950/10 dark:shadow-none">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#282d37] pb-3">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#f1f3f5] flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />{" "}
                      Git Source Control
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      OAuth 2.0
                    </span>
                  </div>

                  <div className="bg-white/70 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-[#1e222b] text-white flex items-center justify-center shadow-md border dark:border-[#282d37]">
                          <Github className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5]">
                              GitHub
                            </p>
                            {loadingGithubStatus ? (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                                Checking...
                              </span>
                            ) : githubConnected ? (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full font-bold">
                                Connected
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 dark:bg-[#1e222b] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#282d37] px-2 py-0.5 rounded-full font-bold">
                                Not Connected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {githubConnected && githubUsername
                              ? `@${githubUsername}`
                              : "Link your repositories for zero-downtime automated builds"}
                          </p>
                        </div>
                      </div>

                      <div>
                        {githubConnected ? (
                          <button
                            type="button"
                            onClick={() => setShowDisconnectConfirm(true)}
                            disabled={githubActionLoading}
                            className="px-3.5 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/50 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Unlink className="w-3.5 h-3.5" /> Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleConnectGithubOAuth}
                            disabled={githubActionLoading}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black dark:bg-[#1e222b] dark:hover:bg-[#282d37] rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {githubActionLoading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Link2 className="w-3.5 h-3.5" />
                            )}
                            Connect GitHub
                          </button>
                        )}
                      </div>
                    </div>

                    {showDisconnectConfirm && (
                      <div className="pt-3 border-t border-slate-200/80 dark:border-[#282d37] space-y-2.5 animate-fadeIn">
                        <div className="p-3 bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs space-y-2">
                          <p className="font-bold text-red-900 dark:text-red-300">
                            Disconnect GitHub Account?
                          </p>
                          <p className="text-red-700 dark:text-red-400 text-[11px] leading-relaxed">
                            This will unlink <strong>@{githubUsername}</strong>{" "}
                            from your HAVN workspace. You can reconnect anytime.
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleDisconnectGithub}
                              disabled={githubActionLoading}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {githubActionLoading && (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              )}
                              Confirm Disconnect
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDisconnectConfirm(false)}
                              disabled={githubActionLoading}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-[#1e222b] dark:hover:bg-[#282d37] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#282d37] rounded-lg font-semibold text-xs transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Repository access grants HAVN read permissions to commit
                    SHAs, branch heads, and Dockerfiles for isolated container
                    builds.
                  </p>
                </div>

                {/* Integration Details / Permissions */}
                <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 space-y-4 shadow-xl shadow-sky-950/10 dark:shadow-none">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#282d37] pb-3">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#f1f3f5] flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />{" "}
                      Webhooks & Security
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Status
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#282d37]">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">
                        Active Repository Source
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {githubUsername
                          ? `GitHub (@${githubUsername})`
                          : "None linked"}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#282d37]">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">
                        Webhook Build Triggering
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Automatic on Git Push
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#282d37]">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">
                        Credential Storage
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        Encrypted JWT Tokens
                      </span>
                    </div>
                  </div>

                  {githubConnected && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsConnectModalOpen(true)}
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Import Another Repository
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Logs (Dedicated Observability Logs View) */}
          {activeTab === "logs" && (
            <div className="space-y-6 motion-safe:animate-fade-in-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Deployment Logs & Build Stream
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                    Real-time terminal output, build sequence steps, and
                    container logs
                  </p>
                </div>

                {deployments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const target =
                        deployments.find(
                          (d) =>
                            d.id === (selectedLogDepId || deployments[0].id),
                        ) || deployments[0];
                      handleOpenDeploymentLogs(target.id, target.projectName);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black dark:bg-[#1e222b] dark:hover:bg-[#282d37] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 text-blue-400" />
                    Open Fullscreen Terminal
                  </button>
                )}
              </div>

              {deployments.length === 0 ? (
                <div className="text-center py-20 backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-dashed border-slate-300 dark:border-[#282d37] rounded-3xl p-8 space-y-3">
                  <Terminal className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No deployment logs available
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                    Connect a repository and trigger a deployment to inspect
                    live build logs and runtime streaming output.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (githubConnected) setIsConnectModalOpen(true);
                      else handleConnectGithubOAuth();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-500 cursor-pointer shadow-md mt-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> Deploy An Application
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left: Deployment Selector List (4 cols) */}
                  <div className="lg:col-span-4 backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-4 shadow-xl shadow-sky-950/10 dark:shadow-none space-y-2">
                    <div className="px-2 py-1.5 border-b border-slate-200/80 dark:border-[#282d37] flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                        Select Run ({deployments.length})
                      </span>
                      <button
                        type="button"
                        onClick={reloadProjects}
                        className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
                      {deployments.map((dep) => {
                        const isSelected =
                          (selectedLogDepId || deployments[0].id) === dep.id;
                        return (
                          <div
                            key={dep.id}
                            onClick={() => setSelectedLogDepId(dep.id)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer text-xs space-y-1 ${
                              isSelected
                                ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800/80 shadow-xs"
                                : "bg-white/50 dark:bg-[#12151a]/60 border-slate-200/70 dark:border-[#282d37] hover:bg-white/80 dark:hover:bg-[#1e222b]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-slate-900 dark:text-[#f1f3f5] truncate">
                                {dep.projectName}
                              </span>
                              {dep.status === "BUILT" ||
                              dep.status === "ready" ? (
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                                  Built
                                </span>
                              ) : dep.status === "FAILED" ||
                                dep.status === "failed" ? (
                                <span className="text-[10px] text-red-700 dark:text-red-400 font-bold bg-red-100 dark:bg-red-950/60 px-1.5 py-0.5 rounded">
                                  Failed
                                </span>
                              ) : (
                                <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />{" "}
                                  {dep.status}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate italic">
                              "{dep.commitMsg}"
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                              <span>{dep.branch}</span>
                              <span>•</span>
                              <span>{dep.commitHash.substring(0, 7)}</span>
                              <span>•</span>
                              <span>{dep.deployedAt}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Embedded Log Output Console (8 cols) */}
                  <div className="lg:col-span-8 backdrop-blur-2xl bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-0">
                    {/* Console Header */}
                    <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500/80" />
                          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="font-mono text-slate-400 font-bold ml-2">
                          {deployments.find(
                            (d) =>
                              d.id === (selectedLogDepId || deployments[0].id),
                          )?.projectName || "runner"}
                          @build.log
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {loadingLogLines
                          ? "Loading stream..."
                          : `${logLines.length} lines`}
                      </span>
                    </div>

                    {/* Console Body */}
                    <div className="p-4 font-mono text-xs text-slate-200 min-h-[360px] max-h-[500px] overflow-y-auto space-y-1 selection:bg-blue-600 selection:text-white">
                      {loadingLogLines ? (
                        <div className="py-20 text-center space-y-2 text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
                          <p>Retrieving deployment build logs...</p>
                        </div>
                      ) : logLines.length === 0 ? (
                        <div className="py-20 text-center text-slate-500 space-y-1">
                          <p>No log records recorded for this build run.</p>
                          <p className="text-[11px]">
                            Click "Open Fullscreen Terminal" to poll live
                            execution logs.
                          </p>
                        </div>
                      ) : (
                        logLines.map((log) => (
                          <div
                            key={log.id}
                            className="flex gap-3 leading-relaxed hover:bg-slate-900/60 px-1 rounded"
                          >
                            <span className="text-slate-600 select-none text-[10px] shrink-0 pt-0.5">
                              {log.timestamp
                                ? new Date(log.timestamp).toLocaleTimeString()
                                : ""}
                            </span>
                            <span
                              className={
                                log.stream === "STDERR"
                                  ? "text-red-400 font-semibold"
                                  : "text-slate-300"
                              }
                            >
                              {log.line}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: Settings */}
          {activeTab === "settings" && (
            <div className="space-y-6 motion-safe:animate-fade-in-up">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">
                  Security & System Settings
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                  Manage authentication credentials, security policies, and
                  workspace preferences
                </p>
              </div>

              {passwordMessage && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm ${
                    passwordMessage.type === "success"
                      ? "bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                      : "bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {passwordMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    )}
                    <span>{passwordMessage.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPasswordMessage(null)}
                    className="text-xs font-bold px-1.5 py-0.5 hover:opacity-70 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Authentication Identity Card */}
                <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 space-y-4 shadow-xl shadow-sky-950/10 dark:shadow-none">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#282d37] pb-3">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#f1f3f5] flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />{" "}
                      Authentication Provider
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Security
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Sign-in Method
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-[#1e222b] border border-white/90 dark:border-[#282d37] px-3 py-1 rounded-xl capitalize shadow-xs flex items-center gap-1.5">
                        {currentUser?.provider === "github" ? (
                          <>
                            <Github className="w-3.5 h-3.5" /> GitHub OAuth
                          </>
                        ) : currentUser?.provider === "google" ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />{" "}
                            Google OAuth
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-3.5 h-3.5 text-blue-600" />{" "}
                            Password Credentials
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {currentUser?.provider === "github"
                        ? "Your account password and primary security are managed by your GitHub account settings."
                        : currentUser?.provider === "google"
                          ? "Your authentication is secured via Google OAuth SSO."
                          : "Your account is authenticated via encrypted password credentials using argon2/bcrypt password hashing."}
                    </p>
                  </div>

                  {/* Workspace Preferences */}
                  <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Workspace Display
                    </h4>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-semibold">
                        Living Sky Ambient Canvas
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full text-[10px]">
                        Active (60 FPS)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Password Change Form (or Provider Notice) */}
                <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 space-y-4 shadow-xl shadow-sky-950/10 dark:shadow-none">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#282d37] pb-3">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#f1f3f5] flex items-center gap-2">
                      <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />{" "}
                      Change Password
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Credentials
                    </span>
                  </div>

                  {currentUser?.provider === "credentials" ||
                  !currentUser?.provider ? (
                    <form
                      onSubmit={handleChangePassword}
                      className="space-y-3.5"
                    >
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="w-full text-xs font-medium bg-white/80 dark:bg-[#12151a] border border-slate-200 dark:border-[#282d37] focus:border-blue-500 rounded-xl px-3 py-2 pr-8 text-slate-900 dark:text-[#f1f3f5] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          New Password (8+ chars)
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={8}
                            className="w-full text-xs font-medium bg-white/80 dark:bg-[#12151a] border border-slate-200 dark:border-[#282d37] focus:border-blue-500 rounded-xl px-3 py-2 pr-8 text-slate-900 dark:text-[#f1f3f5] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showNewPassword ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full text-xs font-medium bg-white/80 dark:bg-[#12151a] border border-slate-200 dark:border-[#282d37] focus:border-blue-500 rounded-xl px-3 py-2 text-slate-900 dark:text-[#f1f3f5] outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {passwordLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Lock className="w-3.5 h-3.5" />
                        )}
                        Update Password
                      </button>
                    </form>
                  ) : (
                    <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] space-y-2 text-xs text-slate-600 dark:text-slate-400">
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        OAuth External Account
                      </p>
                      <p>
                        Password updates are not applicable because you sign in
                        directly through your OAuth provider.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Account */}
          {activeTab === "account" && (
            <div className="space-y-6 motion-safe:animate-fade-in-up">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">
                  Personal Account & Identity
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                  Manage your developer profile, verified contact details, and
                  workspace identity
                </p>
              </div>

              {/* Main Profile Header Card */}
              <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 sm:p-8 shadow-xl shadow-sky-950/10 dark:shadow-none">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    {currentUser?.avatar && !avatarError ? (
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name || "User Avatar"}
                        onError={() => setAvatarError(true)}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-white/90 dark:border-[#282d37] shadow-md shadow-blue-600/30"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-xl border-2 border-white/90 dark:border-[#282d37] shadow-md shadow-blue-600/30">
                        {currentUser?.name
                          ? currentUser.name.substring(0, 2).toUpperCase()
                          : currentUser?.email
                            ? currentUser.email.substring(0, 2).toUpperCase()
                            : "HV"}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">
                          {currentUser?.name ||
                            (currentUser?.email
                              ? currentUser.email.split("@")[0]
                              : "Developer")}
                        </h3>
                        <span className="text-[11px] bg-blue-100/90 dark:bg-blue-950/50 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                          Hobby Tier
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />{" "}
                        {currentUser?.email || "dev@havn.internal"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-600" />
                    Sign Out
                  </button>
                </div>
              </div>

              {/* Identity & Workspace Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 space-y-4 shadow-xl shadow-sky-950/10 dark:shadow-none">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#282d37] pb-3">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#f1f3f5] flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />{" "}
                      Personal Identity
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Account
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-bold block mb-1">
                        Full Name
                      </span>
                      <p className="text-slate-900 dark:text-[#f1f3f5] font-bold bg-white/80 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] px-3.5 py-2 rounded-xl shadow-xs">
                        {currentUser?.name || "Not provided"}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-bold block mb-1">
                        Email Address
                      </span>
                      <div className="flex items-center justify-between bg-white/80 dark:bg-[#12151a] border border-white/90 dark:border-[#282d37] px-3.5 py-2 rounded-xl shadow-xs">
                        <span className="text-slate-900 dark:text-[#f1f3f5] font-bold truncate mr-2">
                          {currentUser?.email || "N/A"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />{" "}
                          Verified
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="backdrop-blur-2xl bg-white/60 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 space-y-4 shadow-xl shadow-sky-950/10 dark:shadow-none">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#282d37] pb-3">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#f1f3f5] flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />{" "}
                      Workspace Allocation
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Tenant
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#282d37]">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">
                        Active Workspace
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Personal Developer Workspace
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#282d37]">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">
                        Total Projects Deployed
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {projects.length}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#282d37]">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">
                        Serverless Databases
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {databases.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <BuildLogModal
        isOpen={isLogModalOpen}
        deploymentId={activeDeploymentId}
        projectName={activeProjectName}
        onClose={() => setIsLogModalOpen(false)}
        onDeploymentTerminal={handleDeploymentTerminal}
      />

      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white/95 dark:bg-[#16191f] backdrop-blur-2xl border border-white/90 dark:border-[#282d37] rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-2xl shadow-sky-950/20 dark:shadow-none space-y-6 motion-safe:animate-fade-in-up">
            <div className="flex justify-between items-center border-b border-slate-200/80 dark:border-[#282d37] pb-4">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-[#f1f3f5]">
                  Connect GitHub Repository
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                  Select a repository to import into HAVN
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsConnectModalOpen(false);
                  setSelectedRepo(null);
                  setSelectedBranch("");
                  setBranches([]);
                  setConnectModalError(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-white/80 dark:hover:bg-[#1e222b] transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {connectModalError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-400 font-semibold flex items-center justify-between">
                <span>{connectModalError}</span>
                <button
                  type="button"
                  onClick={() => setConnectModalError(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            )}

            {!selectedRepo ? (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter repositories..."
                    value={searchRepoQuery}
                    onChange={(e) => setSearchRepoQuery(e.target.value)}
                    className="w-full bg-white/75 dark:bg-[#12151a] border border-slate-200 dark:border-[#282d37] focus:border-blue-500 dark:focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-[#f1f3f5] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
                  />
                </div>

                {loadingRepos ? (
                  <div className="text-center py-12 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Loading GitHub repositories...
                    </p>
                  </div>
                ) : repoError ? (
                  <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl space-y-2 text-center">
                    <p className="text-xs text-red-700 dark:text-red-400 font-bold">
                      {repoError}
                    </p>
                    {requiresReconnect && (
                      <button
                        type="button"
                        onClick={handleConnectGithubOAuth}
                        className="px-4 py-1.5 bg-slate-900 dark:bg-[#1e222b] text-white rounded-xl text-xs font-bold border dark:border-[#282d37]"
                      >
                        Reconnect GitHub
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-[#282d37] rounded-2xl border border-slate-200/80 dark:border-[#282d37] bg-white/60 dark:bg-[#12151a]/80">
                    {githubRepos
                      .filter((r) =>
                        r.fullName
                          .toLowerCase()
                          .includes(searchRepoQuery.toLowerCase()),
                      )
                      .map((repo) => (
                        <div
                          key={repo.id}
                          className="p-3.5 flex items-center justify-between hover:bg-white/80 dark:hover:bg-[#1e222b]/80 transition-colors"
                        >
                          <div className="space-y-0.5 truncate max-w-sm">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-[#f1f3f5] block truncate">
                              {repo.fullName}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate block">
                              {repo.description || "No description provided"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedRepo(repo)}
                            className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
                          >
                            Select
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-[#12151a] border border-slate-200 dark:border-[#282d37] rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-[#f1f3f5]">
                      {selectedRepo.fullName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRepo(null);
                        setSelectedBranch("");
                        setBranches([]);
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                    >
                      Change Repo
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    {selectedRepo.description || "No description provided."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Select Target Branch
                  </label>
                  {loadingBranches ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 p-2.5 bg-white dark:bg-[#12151a] border border-slate-200 dark:border-[#282d37] rounded-xl">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />{" "}
                      Fetching branches...
                    </div>
                  ) : branchError ? (
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-400 font-bold">
                      {branchError}
                    </div>
                  ) : (
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full bg-white dark:bg-[#12151a] border border-slate-200 dark:border-[#282d37] focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-[#f1f3f5] outline-none cursor-pointer"
                    >
                      {branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name} {b.protected ? "🔒 (Protected)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRepo(null);
                      setSelectedBranch("");
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-[#282d37] hover:bg-slate-100 dark:hover:bg-[#1e222b] cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={
                      !selectedBranch || loadingBranches || isCreatingProject
                    }
                    onClick={handleCreateAndDeploy}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs py-2 px-5 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
                  >
                    {isCreatingProject ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                        Queuing...
                      </>
                    ) : (
                      "Import & Deploy"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `,
        }}
      />
    </div>
  );
}
