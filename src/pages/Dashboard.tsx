import { useState, useEffect, FormEvent, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Github, GitBranch, CheckCircle2, 
  AlertTriangle, RefreshCw, RefreshCcw, Database, Key, Trash,
  ExternalLink, Activity, Layers, Server, 
  Clock, TrendingUp, Lock, AlertCircle, Play, User
} from 'lucide-react';
import { Project, Deployment, BackendDeployment, DeploymentStatus } from '../types';
import { ROUTES } from '../constants/routes';
import { getProjects, createProject, deleteProject, BackendProject } from '../services/project.service';
import { createDeployment, getProjectDeployments, getDeploymentById } from '../services/deployment.service';
import { getCurrentUser, logout } from '../services/auth.service';
import { 
  getGithubStatus, 
  getGithubConnectUrl,
  getGithubRepositories, 
  getGithubBranches, 
  GithubRepository, 
  GithubBranch 
} from '../services/github.service';
import { BuildLogModal } from '../components/dashboard/BuildLogModal';
import { ProjectCard } from '../components/dashboard/ProjectCard';

const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const mapBackendProjectToProject = (bp: BackendProject): Project => {
  const repoName = bp.repositoryName ?? '';
  let status: 'ready' | 'building' | 'failed' | 'queued' | 'cancelled' | 'idle' = 'idle';

  if (bp.status === 'ready') status = 'ready';
  else if (bp.status === 'building') status = 'building';
  else if (bp.status === 'queued') status = 'queued';
  else if (bp.status === 'failed') status = 'failed';
  else if (bp.status === 'cancelled') status = 'cancelled';

  return {
    id: bp.id,
    name: bp.name,
    repo: repoName,
    owner: repoName.includes('/') ? repoName.split('/')[0] : 'dev-master',
    branch: bp.branch || 'main',
    status,
    url: bp.repositoryUrl ?? '',
    updatedAt: formatRelativeTime(bp.updatedAt),
    deploymentsCount: bp.deploymentsCount ?? 0,
    latestDeployment: bp.latestDeployment || null,
  };
};

export const sortDeploymentsNewestFirst = (a: Deployment, b: Deployment): number => {
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

export const mapBackendDeploymentToFrontend = (bd: BackendDeployment): Deployment => {
  return {
    id: bd.id,
    projectId: bd.projectId,
    projectName: bd.repositoryName || 'project',
    status: bd.status,
    branch: bd.branch,
    commitMsg: bd.commitMsg || 'Deployment triggered',
    commitHash: bd.commitSha ? bd.commitSha.substring(0, 7) : 'pending',
    commitAuthor: bd.commitAuthor || undefined,
    deployedAt: formatRelativeTime(bd.createdAt),
    createdAt: bd.createdAt,
    url: bd.repositoryUrl || '',
    environment: 'production',
    durationMs: bd.durationMs,
    errorMessage: bd.errorMessage,
  };
};

export default function Dashboard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reloadRequestIdRef = useRef<number>(0);
  const handledTerminalDeploymentsRef = useRef<Set<string>>(new Set());
  const [searchParams] = useSearchParams();
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
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [githubConnected, setGithubConnected] = useState<boolean>(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [loadingGithubStatus, setLoadingGithubStatus] = useState<boolean>(true);
  const [githubStatusError, setGithubStatusError] = useState<string | null>(null);

  const [githubRepos, setGithubRepos] = useState<GithubRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [requiresReconnect, setRequiresReconnect] = useState<boolean>(false);

  const [selectedRepo, setSelectedRepo] = useState<GithubRepository | null>(null);
  const [branches, setBranches] = useState<GithubBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [loadingBranches, setLoadingBranches] = useState<boolean>(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'databases' | 'env-vars'>('overview');
  
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [searchRepoQuery, setSearchRepoQuery] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [connectModalError, setConnectModalError] = useState<string | null>(null);

  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string>('');
  const [deployingProjectId, setDeployingProjectId] = useState<string | null>(null);

  const [databases, setDatabases] = useState<Array<{ id: string; name: string; status: 'active' | 'provisioning'; url: string; size: string }>>([]);
  const [isProvisioningDb, setIsProvisioningDb] = useState(false);
  const [newDbName, setNewDbName] = useState('');

  const [envVars, setEnvVars] = useState<Array<{ id: string; key: string; value: string; project: string }>>([]);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [newEnvProject, setNewEnvProject] = useState('');

  const [searchProjectQuery, setSearchProjectQuery] = useState('');

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
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setGithubStatusError(errorObj.response?.data?.message || errorObj.message || 'Failed to fetch GitHub status');
      setGithubConnected(false);
    } finally {
      setLoadingGithubStatus(false);
    }
  }, []);

  useEffect(() => {
    const success = searchParams.get('github_success');
    const error = searchParams.get('github_error');

    if (error) {
      if (error === 'account_already_linked') {
        setGithubStatusError('This GitHub account is already connected to another HAVN account.');
      } else {
        setGithubStatusError('Failed to connect GitHub account.');
      }
      fetchGithubStatus();
      navigate('/dashboard', { replace: true });
    } else if (success) {
      setGithubStatusError(null);
      fetchGithubStatus();
      navigate('/dashboard', { replace: true });
    } else {
      fetchGithubStatus();
    }
  }, [searchParams, navigate, fetchGithubStatus]);

  useEffect(() => {
    getCurrentUser().then((data) => {
      if (data?.success && data?.user) {
        setCurrentUser(data.user);
        if (data.user.githubConnected && data.user.githubAccount) {
          setGithubConnected(true);
          setGithubUsername(data.user.githubAccount.username);
        }
      }
    }).catch(console.error);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
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

      const projectsWithDeployments = data.filter((p) => (p.deploymentsCount ?? 0) > 0);
      const deploymentBatches = await Promise.all(
        projectsWithDeployments.map(async (p) => {
          try {
            const depListRes = await getProjectDeployments(p.id, 1, 10);
            return depListRes.deployments.map(mapBackendDeploymentToFrontend);
          } catch {
            return [];
          }
        })
      );

      if (currentRequestId !== reloadRequestIdRef.current) {
        return mapped;
      }

      const allDeps = deploymentBatches.flat();
      allDeps.sort(sortDeploymentsNewestFirst);
      setDeployments(allDeps);

      return mapped;
    } catch (err: any) {
      if (currentRequestId !== reloadRequestIdRef.current) {
        return [];
      }
      const msg = err.response?.data?.message || err.message || 'Failed to fetch projects from server';
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
      if (p.latestDeployment && ['QUEUED', 'INITIALIZING', 'BUILDING'].includes(p.latestDeployment.status)) {
        setActiveDeploymentId(p.latestDeployment.id);
        setActiveProjectName(p.name);
        setIsLogModalOpen(true);
        break;
      }
    }
  }, [projects, activeDeploymentId]);

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!window.confirm(`Are you sure you want to delete project "${projectName}"? This will delete all associated deployments and local images.`)) {
      return;
    }
    setDeletingProjectId(projectId);
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setDeployments((prev) => prev.filter((d) => d.projectId !== projectId));
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorObj.response?.data?.message || errorObj.message || 'Failed to delete project');
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
          const isReconnect = err.response?.status === 401 || err.response?.data?.requiresReconnect === true;
          setRequiresReconnect(isReconnect);
          const msg = err.response?.data?.message || err.message || 'Failed to load GitHub repositories';
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
            const defBranch = branchList.find(b => b.name === selectedRepo.defaultBranch);
            setSelectedBranch(defBranch ? defBranch.name : branchList[0].name);
          } else {
            setSelectedBranch('main');
          }
        })
        .catch((err) => {
          const msg = err.response?.data?.message || err.message || 'Failed to load repository branches';
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
        branch: project.branch || 'main',
        dockerfilePath: 'Dockerfile',
      });

      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id
            ? {
                ...p,
                status: 'queued',
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
            : p
        )
      );

      setActiveDeploymentId(newDeployment.id);
      setActiveProjectName(project.name);
      setIsLogModalOpen(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to trigger deployment.";
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
      const targetBranch = selectedBranch || selectedRepo.defaultBranch || 'main';

      const createdBackendProject = await createProject({
        name: selectedRepo.name,
        repositoryName: selectedRepo.fullName,
        repositoryUrl: selectedRepo.url,
        branch: targetBranch,
        status: 'queued',
      });

      const initialDep = await createDeployment(createdBackendProject.id, {
        branch: targetBranch,
        dockerfilePath: 'Dockerfile',
      });

      setIsConnectModalOpen(false);
      setSelectedRepo(null);
      setSelectedBranch('');
      setBranches([]);

      await reloadProjects();

      setActiveDeploymentId(initialDep.id);
      setActiveProjectName(createdBackendProject.name);
      setIsLogModalOpen(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create project and queue deployment';
      setConnectModalError(msg);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeploymentTerminal = useCallback(async (finalDep?: BackendDeployment) => {
    if (!finalDep) {
      await reloadProjects();
      return;
    }

    if (handledTerminalDeploymentsRef.current.has(finalDep.id)) {
      return;
    }
    handledTerminalDeploymentsRef.current.add(finalDep.id);

    try {
      const depListRes = await getProjectDeployments(finalDep.projectId, 1, 10);
      const newProjDeps = depListRes.deployments.map(mapBackendDeploymentToFrontend);

      setDeployments((prev) => {
        const otherDeps = prev.filter((d) => d.projectId !== finalDep.projectId);
        const merged = [...otherDeps, ...newProjDeps];
        merged.sort(sortDeploymentsNewestFirst);
        return merged;
      });

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== finalDep.projectId) return p;
          let newStatus: 'ready' | 'building' | 'failed' | 'queued' | 'cancelled' | 'idle' = p.status;
          if (finalDep.status === 'BUILT') newStatus = 'ready';
          else if (finalDep.status === 'FAILED') newStatus = 'failed';
          else if (finalDep.status === 'CANCELLED') newStatus = 'cancelled';
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
        })
      );
    } catch {
      await reloadProjects();
    }
  }, [reloadProjects]);

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
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setGithubStatusError(errorObj.response?.data?.message || errorObj.message || 'Failed to initiate GitHub connection');
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const clouds = Array.from({ length: 18 }, () => ({
      x: Math.random() * width,
      y: height * 0.1 + Math.random() * (height * 0.8),
      radius: 90 + Math.random() * 160,
      driftSpeed: 0.12 + Math.random() * 0.35,
      opacity: 0.18 + Math.random() * 0.35,
      z: Math.random()
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
      skyGradient.addColorStop(0, '#f0f9ff');
      skyGradient.addColorStop(0.35, '#e0f2fe');
      skyGradient.addColorStop(0.75, '#bae6fd');
      skyGradient.addColorStop(1, '#7dd3fc');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height);

      const sunGlow = ctx.createRadialGradient(
        width * 0.8,
        height * 0.2,
        20,
        width * 0.8,
        height * 0.2,
        width * 0.65
      );
      sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      sunGlow.addColorStop(0.4, 'rgba(224, 242, 254, 0.3)');
      sunGlow.addColorStop(0.85, 'rgba(125, 211, 252, 0.1)');
      sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, width, height);

      clouds.forEach((cloud) => {
        cloud.x += cloud.driftSpeed * (0.6 + cloud.z * 0.4);
        if (cloud.x - cloud.radius > width) {
          cloud.x = -cloud.radius;
        }
        
        ctx.beginPath();
        const grad = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius);
        grad.addColorStop(0, `rgba(255,255,255,${cloud.opacity})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleProvisionDb = (e: FormEvent) => {
    e.preventDefault();
    if (!newDbName.trim()) return;

    setIsProvisioningDb(true);
    const dbNameClean = newDbName.toLowerCase().replace(/[^a-z0-9-_]/g, '');

    setTimeout(() => {
      setDatabases(prev => [
        ...prev,
        {
          id: `db-${Date.now()}`,
          name: dbNameClean,
          status: 'active',
          url: `postgresql://forge_admin:cf_sec_${Math.random().toString(36).substring(7)}@db.cloudforge.internal:5432/${dbNameClean}`,
          size: '128 MB (Tier: Hobby)'
        }
      ]);
      setNewDbName('');
      setIsProvisioningDb(false);
    }, 1200);
  };

  const handleAddEnvVar = (e: FormEvent) => {
    e.preventDefault();
    if (!newEnvKey.trim() || !newEnvValue.trim() || !newEnvProject) return;

    const newVar = {
      id: `ev-${Date.now()}`,
      key: newEnvKey.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
      value: newEnvValue,
      project: newEnvProject
    };

    setEnvVars(prev => [...prev, newVar]);
    setNewEnvKey('');
    setNewEnvValue('');
  };

  const handleDeleteEnvVar = (id: string) => {
    setEnvVars(prev => prev.filter(ev => ev.id !== id));
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchProjectQuery.toLowerCase()) ||
    (p.repo && p.repo.toLowerCase().includes(searchProjectQuery.toLowerCase()))
  );

  const activeProjectsCount = projects.length;
  const totalDeploymentsCount = projects.reduce((acc, p) => acc + (p.deploymentsCount || 0), 0);

  const builtDeployments = deployments.filter(d => d.status === 'BUILT' || d.status === 'ready');
  const failedDeployments = deployments.filter(d => d.status === 'FAILED' || d.status === 'failed');
  const terminalDeploymentsCount = builtDeployments.length + failedDeployments.length;

  const successRateText =
    terminalDeploymentsCount > 0
      ? `${Math.round((builtDeployments.length / terminalDeploymentsCount) * 100)}%`
      : '--';

  const deploymentsWithDuration = builtDeployments.filter(
    (d) => typeof d.durationMs === 'number' && d.durationMs > 0
  );
  const avgDurationMs =
    deploymentsWithDuration.length > 0
      ? deploymentsWithDuration.reduce((acc, d) => acc + (d.durationMs || 0), 0) /
        deploymentsWithDuration.length
      : 0;

  const avgDeployTimeText =
    avgDurationMs > 0 ? `${Math.round(avgDurationMs / 1000)}s` : '--';

  return (
    <div id="dashboard-workspace" className="min-h-screen flex flex-col relative overflow-x-hidden font-sans selection:bg-sky-200">
      
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
      />

      <div className="pt-28 sm:pt-32 pb-16 flex-1 flex flex-col relative z-20 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {githubStatusError && !isConnectModalOpen && (
          <div className="backdrop-blur-xl bg-amber-50/90 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-center justify-between text-xs font-semibold shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{githubStatusError}</span>
            </div>
            <button
              type="button"
              onClick={() => setGithubStatusError(null)}
              className="text-amber-600 hover:text-amber-800 font-bold ml-2 cursor-pointer text-sm"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <section className="backdrop-blur-2xl bg-white/60 hover:bg-white/65 border border-white/90 rounded-3xl p-6 shadow-xl shadow-sky-950/10 transition-all duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div 
              onClick={() => navigate(ROUTES.PROFILE)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(ROUTES.PROFILE);
                }
              }}
              title="View Account Settings & Profile"
              className="flex items-center space-x-4 p-2 -m-2 rounded-2xl transition-all duration-200 group cursor-pointer hover:bg-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {currentUser?.avatar && !avatarError ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name || 'User Avatar'}
                  onError={() => setAvatarError(true)}
                  className="w-12 h-12 rounded-2xl object-cover shadow-md shadow-blue-600/30 border border-white/80 group-hover:ring-2 group-hover:ring-blue-500/40 transition-all duration-200"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-lg shadow-md shadow-blue-600/30 group-hover:ring-2 group-hover:ring-blue-500/40 transition-all duration-200">
                  {((currentUser?.name || currentUser?.email || 'CF').substring(0, 2)).toUpperCase()}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'dev-master')}
                  </h1>
                  <span className="text-[11px] bg-blue-100/90 text-blue-900 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold shadow-2xs capitalize">
                    {currentUser?.provider ? `${currentUser.provider} account` : 'Hobby Plan'}
                  </span>
                  {githubConnected && githubUsername && (
                    <span className="flex items-center gap-1 text-[11px] bg-slate-900 text-white px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                      <Github className="w-3 h-3" /> @{githubUsername}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 font-semibold">
                  {currentUser?.email ? `${currentUser.email} • Cloud Deployment Engine` : 'Personal Developer Workspace • Cloud Deployment Engine'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(ROUTES.PROFILE)}
                className="bg-white/70 hover:bg-white text-slate-800 hover:text-slate-950 font-bold text-xs py-3 px-4 rounded-xl border border-white/90 transition-all shadow-sm hover:shadow flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
                title="View Profile & Account Settings"
              >
                <User className="w-4 h-4 text-slate-600" />
                <span>Account</span>
              </button>
              {loadingGithubStatus ? (
                <div className="text-xs text-slate-500 font-bold flex items-center gap-1.5 px-3 py-2 bg-white/50 rounded-xl border border-white/80">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" /> Checking GitHub status...
                </div>
              ) : !githubConnected ? (
                <button
                  type="button"
                  onClick={handleConnectGithubOAuth}
                  className="bg-slate-900 hover:bg-black text-white font-bold text-xs py-3 px-5 rounded-xl transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                >
                  <Github className="w-4 h-4" />
                  Connect GitHub
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-3 px-5 rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Connect Repository
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/80 flex items-center space-x-2 sm:space-x-4 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('deployments')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'deployments'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Deployments
            </button>
            <button
              onClick={() => setActiveTab('databases')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'databases'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Databases
            </button>
            <button
              onClick={() => setActiveTab('env-vars')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'env-vars'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              Environment Variables
            </button>
          </div>
        </section>

        {activeTab === 'overview' && (
          <div className="space-y-6 motion-safe:animate-fade-in-up">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="backdrop-blur-xl bg-white/60 border border-white/90 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-blue-600" /> Active Projects
                </span>
                <p className="text-2xl font-extrabold text-slate-900">{activeProjectsCount}</p>
              </div>

              <div className="backdrop-blur-xl bg-white/60 border border-white/90 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-blue-600" /> Total Deploys
                </span>
                <p className="text-2xl font-extrabold text-slate-900">{totalDeploymentsCount > 0 ? totalDeploymentsCount : "--"}</p>
              </div>

              <div className="backdrop-blur-xl bg-white/60 border border-white/90 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Success Rate
                </span>
                <p className="text-2xl font-extrabold text-slate-900">{successRateText}</p>
              </div>

              <div className="backdrop-blur-xl bg-white/60 border border-white/90 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" /> Avg Deploy Time
                </span>
                <p className="text-2xl font-extrabold text-slate-900">{avgDeployTimeText}</p>
              </div>
            </div>

            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search active projects or git branches..."
                value={searchProjectQuery}
                onChange={(e) => setSearchProjectQuery(e.target.value)}
                className="w-full backdrop-blur-xl bg-white/75 focus:bg-white border border-white/90 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 font-semibold placeholder:text-slate-400 outline-none transition-all shadow-2xs focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {loadingProjects ? (
              <div className="text-center py-16 backdrop-blur-xl bg-white/50 border border-slate-200/80 rounded-3xl p-8 space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-800">Loading projects from server...</p>
              </div>
            ) : projectError ? (
              <div className="text-center py-16 backdrop-blur-xl bg-white/50 border border-red-200/80 rounded-3xl p-8 space-y-3">
                <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Unable to load projects</p>
                <p className="text-xs text-red-600 font-medium">{projectError}</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-20 backdrop-blur-xl bg-white/50 border border-dashed border-slate-300 rounded-3xl p-8 space-y-3">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">No projects found.</p>
                <p className="text-xs text-slate-600">Connect a GitHub repository to trigger your first cloud deployment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDeploy={handleTriggerDeploy}
                    onViewLogs={handleOpenDeploymentLogs}
                    onDelete={handleDeleteProject}
                    isDeploying={deployingProjectId === project.id}
                    isDeleting={deletingProjectId === project.id}
                  />
                ))}
              </div>
            )}

            <div className="backdrop-blur-2xl bg-white/60 border border-white/90 rounded-2xl overflow-hidden shadow-lg shadow-sky-950/5 space-y-3 p-6">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Recent Deployment Activity</h3>
                  <p className="text-xs text-slate-600 font-semibold">Latest commits deployed across your workspace repositories</p>
                </div>
              </div>

              <div className="divide-y divide-slate-200/70">
                {deployments.length === 0 ? (
                  <div className="text-center py-8 text-xs font-semibold text-slate-500">
                    No recent deployment activity.
                  </div>
                ) : (
                  deployments.slice(0, 5).map((dep) => (
                    <div
                      key={dep.id}
                      onClick={() => handleOpenDeploymentLogs(dep.id, dep.projectName)}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/60 rounded-xl px-3 transition-colors cursor-pointer"
                      title="Click to view build console and logs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{dep.projectName}</span>
                          <span className="text-[10px] font-mono bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded font-bold">
                            {dep.branch}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {dep.commitHash}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 italic truncate max-w-md">"{dep.commitMsg}"</p>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-semibold shrink-0">
                        <span className="text-slate-500 text-[11px]">{dep.deployedAt}</span>
                        {dep.status === 'BUILT' || dep.status === 'ready' ? (
                          <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                            <CheckCircle2 className="w-3 h-3" /> Live
                          </span>
                        ) : dep.status === 'FAILED' || dep.status === 'failed' ? (
                          <span className="flex items-center gap-1 text-red-700 font-bold bg-red-100/80 border border-red-200 px-2 py-0.5 rounded-full text-[10px]">
                            <AlertTriangle className="w-3 h-3" /> Failed
                          </span>
                        ) : dep.status === 'CANCELLED' || dep.status === 'cancelled' ? (
                          <span className="flex items-center gap-1 text-slate-700 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[10px]">
                            Cancelled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-blue-700 font-bold bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full text-[10px]">
                            <RefreshCw className="w-3 h-3 animate-spin" /> {dep.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {activeTab === 'deployments' && (
          <div className="backdrop-blur-2xl bg-white/60 border border-white/90 rounded-3xl overflow-hidden shadow-xl shadow-sky-950/10 motion-safe:animate-fade-in-up">
            <div className="px-6 py-5 border-b border-slate-200/80 bg-white/40 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Deployment History</h2>
                <p className="text-xs text-slate-600 font-semibold">Real-time status of your deployment pipeline runs</p>
              </div>
              <button
                type="button"
                onClick={reloadProjects}
                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="divide-y divide-slate-200/80">
              {deployments.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-2">
                  <Activity className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">No deployments found</p>
                  <p className="text-xs text-slate-500 font-medium">Connect a repository and deploy a project to view deployment history.</p>
                </div>
              ) : (
                deployments.map((dep) => (
                  <div 
                    key={dep.id} 
                    onClick={() => handleOpenDeploymentLogs(dep.id, dep.projectName)}
                    className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-white/50 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-extrabold text-slate-900">{dep.projectName}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-blue-100 text-blue-900 border-blue-200">
                          Production
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 font-semibold italic">
                        "{dep.commitMsg}"
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-semibold">
                        <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5 text-slate-800" /> {dep.branch}</span>
                        <span>SHA: {dep.commitHash}</span>
                        <span>Deployed {dep.deployedAt}</span>
                        {dep.durationMs && <span>Duration: {Math.round(dep.durationMs / 1000)}s</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {dep.status === 'BUILT' || dep.status === 'ready' ? (
                        <span className="bg-emerald-100/90 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Built
                        </span>
                      ) : dep.status === 'FAILED' || dep.status === 'failed' ? (
                        <span className="bg-red-100/90 border border-red-200 text-red-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Failed
                        </span>
                      ) : dep.status === 'CANCELLED' || dep.status === 'cancelled' ? (
                        <span className="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                          Cancelled
                        </span>
                      ) : (
                        <span className="bg-blue-100/90 border border-blue-200 text-blue-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" /> {dep.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'databases' && (
          <div className="space-y-6 motion-safe:animate-fade-in-up">
            <div className="backdrop-blur-2xl bg-white/60 border border-white/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-sky-950/10">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                  <Database className="w-4 h-4" /> Serverless Cloud PostgreSQL
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">Provision New Database</h2>
                <p className="text-slate-700 text-xs leading-relaxed font-semibold">
                  Spin up transactional, serverless PostgreSQL clusters instantly. Databases scale computing nodes automatically.
                </p>
              </div>

              <form onSubmit={handleProvisionDb} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  placeholder="e.g. app-production-db"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  className="bg-white/75 focus:bg-white border border-white/90 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs focus:ring-2 focus:ring-blue-500/20 font-semibold flex-1"
                  disabled={isProvisioningDb}
                />
                <button
                  type="submit"
                  disabled={isProvisioningDb}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProvisioningDb ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Provisioning...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Launch PostgreSQL
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="backdrop-blur-2xl bg-white/60 border border-white/90 rounded-3xl overflow-hidden shadow-xl shadow-sky-950/10">
              <div className="px-6 py-4 border-b border-slate-200/80 bg-white/40">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active Workspace Databases</h3>
              </div>
              
              <div className="divide-y divide-slate-200/80">
                {databases.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-1 text-slate-500">
                    <p className="text-xs font-bold text-slate-700">No databases provisioned yet</p>
                    <p className="text-[11px] font-medium text-slate-500">Launch a managed PostgreSQL cluster above for zero-config persistence.</p>
                  </div>
                ) : (
                  databases.map((db) => (
                    <div key={db.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/40 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{db.name}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                            {db.status}
                          </span>
                        </div>
                        <code className="text-xs text-blue-600 font-mono block select-all">{db.url}</code>
                      </div>
                      <span className="text-xs text-slate-500 font-semibold">{db.size}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'env-vars' && (
          <div className="space-y-6 motion-safe:animate-fade-in-up">
            <div className="backdrop-blur-2xl bg-white/60 border border-white/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-sky-950/10">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <Key className="w-4 h-4" /> Secure Environment Storage
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">Configure Environment Keys</h2>
                <p className="text-slate-700 text-xs leading-relaxed font-semibold">
                  Inject parameters and secrets dynamically into your build runs securely. Keys are encrypted at-rest using AES-256.
                </p>
              </div>

              <form onSubmit={handleAddEnvVar} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-3">
                  <select
                    value={newEnvProject}
                    onChange={(e) => setNewEnvProject(e.target.value)}
                    className="bg-white/75 focus:bg-white border border-white/90 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none w-full cursor-pointer shadow-2xs"
                  >
                    {projects.length === 0 ? (
                      <option value="">No projects available</option>
                    ) : (
                      projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
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
                    className="bg-white/75 focus:bg-white border border-white/90 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none w-full font-mono uppercase shadow-2xs"
                  />
                </div>

                <div className="md:col-span-3">
                  <input
                    type="text"
                    required
                    placeholder="secret_parameter_value"
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                    className="bg-white/75 focus:bg-white border border-white/90 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none w-full font-mono shadow-2xs"
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

            <div className="backdrop-blur-2xl bg-white/60 border border-white/90 rounded-3xl overflow-hidden shadow-xl shadow-sky-950/10">
              <div className="px-6 py-4 border-b border-slate-200/80 bg-white/40">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Configured Credentials Matrix</h3>
              </div>

              <div className="divide-y divide-slate-200/80">
                {envVars.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-1 text-slate-500">
                    <p className="text-xs font-bold text-slate-700">No environment keys defined yet</p>
                    <p className="text-[11px] font-medium text-slate-500">Add secure key-value pairs above for your project configurations.</p>
                  </div>
                ) : (
                  envVars.map((ev) => (
                    <div key={ev.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/40 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-extrabold text-blue-700 font-mono">{ev.key}</code>
                          <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-bold">
                            {ev.project}
                          </span>
                        </div>
                        <code className="text-xs text-slate-600 font-mono block select-all">{ev.value}</code>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteEnvVar(ev.id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-xl border border-white/90 bg-white/60 hover:bg-white transition-all shadow-2xs flex items-center justify-center cursor-pointer"
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

      </div>

      <BuildLogModal
        isOpen={isLogModalOpen}
        deploymentId={activeDeploymentId}
        projectName={activeProjectName}
        onClose={() => setIsLogModalOpen(false)}
        onDeploymentTerminal={handleDeploymentTerminal}
      />

      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div className="bg-white/90 backdrop-blur-2xl border border-white/90 rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-2xl shadow-sky-950/20 space-y-6 motion-safe:animate-fade-in-up">
            <div className="flex justify-between items-center border-b border-slate-200/80 pb-4">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-lg text-slate-900">
                  Connect GitHub Repository
                </h3>
                <p className="text-xs text-slate-600 font-semibold">Select a repository to import into CloudForge</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsConnectModalOpen(false);
                  setSelectedRepo(null);
                  setSelectedBranch('');
                  setBranches([]);
                  setConnectModalError(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/80 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {connectModalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center justify-between">
                <span>{connectModalError}</span>
                <button type="button" onClick={() => setConnectModalError(null)} className="text-red-500 hover:text-red-700">✕</button>
              </div>
            )}

            {!selectedRepo ? (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter repositories..."
                    value={searchRepoQuery}
                    onChange={(e) => setSearchRepoQuery(e.target.value)}
                    className="w-full bg-white/75 border border-slate-200 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 outline-none"
                  />
                </div>

                {loadingRepos ? (
                  <div className="text-center py-12 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">Loading GitHub repositories...</p>
                  </div>
                ) : repoError ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-2 text-center">
                    <p className="text-xs text-red-700 font-bold">{repoError}</p>
                    {requiresReconnect && (
                      <button
                        type="button"
                        onClick={handleConnectGithubOAuth}
                        className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
                      >
                        Reconnect GitHub
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white/60">
                    {githubRepos
                      .filter((r) => r.fullName.toLowerCase().includes(searchRepoQuery.toLowerCase()))
                      .map((repo) => (
                        <div
                          key={repo.id}
                          className="p-3.5 flex items-center justify-between hover:bg-white/80 transition-colors"
                        >
                          <div className="space-y-0.5 truncate max-w-sm">
                            <span className="text-xs font-extrabold text-slate-900 block truncate">{repo.fullName}</span>
                            <span className="text-[11px] text-slate-500 font-medium truncate block">
                              {repo.description || 'No description provided'}
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
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900">{selectedRepo.fullName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRepo(null);
                        setSelectedBranch('');
                        setBranches([]);
                      }}
                      className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      Change Repo
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {selectedRepo.description || 'No description provided.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Select Target Branch
                  </label>
                  {loadingBranches ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 p-2.5 bg-white border border-slate-200 rounded-xl">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" /> Fetching branches...
                    </div>
                  ) : branchError ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold">
                      {branchError}
                    </div>
                  ) : (
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none cursor-pointer"
                    >
                      {branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name} {b.protected ? '🔒 (Protected)' : ''}
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
                      setSelectedBranch('');
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!selectedBranch || loadingBranches || isCreatingProject}
                    onClick={handleCreateAndDeploy}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs py-2 px-5 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
                  >
                    {isCreatingProject ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Queuing...
                      </>
                    ) : (
                      'Import & Deploy'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
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
      ` }} />
    </div>
  );
}