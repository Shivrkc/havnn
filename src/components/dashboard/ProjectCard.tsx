import React, { useState, useRef, useEffect } from "react";
import {
  GitBranch,
  RefreshCw,
  AlertTriangle,
  Trash,
  ExternalLink,
  Play,
  Terminal,
  MoreVertical,
  FileCode,
  CheckCircle2,
  Square,
  RotateCw,
  Globe,
  Copy,
  Check,
  XCircle,
  Clock,
} from "lucide-react";
import { GithubLogo } from "../ui/BrandIcons";
import { Project } from "../../types";

interface ProjectCardProps {
  project: Project;
  onDeploy: (project: Project) => void;
  onViewLogs: (deploymentId: string, projectName: string) => void;
  onDelete: (projectId: string, projectName: string) => void;
  onStopDeployment?: (deploymentId: string, projectName: string) => Promise<void> | void;
  onRestartDeployment?: (deploymentId: string, projectName: string) => Promise<void> | void;
  isDeploying?: boolean;
  isDeleting?: boolean;
  viewMode?: "grid" | "list";
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onDeploy,
  onViewLogs,
  onDelete,
  onStopDeployment,
  onRestartDeployment,
  isDeploying = false,
  isDeleting = false,
  viewMode = "grid",
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const effectiveStatus = project.latestDeployment?.status || project.status;
  const isLiveRunning = effectiveStatus === "RUNNING";
  const isStarting = effectiveStatus === "STARTING";
  const isImageCompiled = effectiveStatus === "BUILT";
  const isBuilding =
    effectiveStatus === "BUILDING" ||
    effectiveStatus === "INITIALIZING" ||
    effectiveStatus === "QUEUED" ||
    project.status === "building" ||
    project.status === "queued";
  const isStopped = effectiveStatus === "STOPPED";
  const isCrashed = effectiveStatus === "CRASHED";
  const isFailed = effectiveStatus === "FAILED" || project.status === "failed";
  const isCancelled = effectiveStatus === "CANCELLED" || project.status === "cancelled";

  const localUrl = project.latestDeployment?.localUrl || project.localUrl;
  const hostPort = project.latestDeployment?.hostPort || project.hostPort;
  const internalPort = project.latestDeployment?.internalPort || project.internalPort;

  const handleCopyUrl = async (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project.latestDeployment || !onStopDeployment || isStopping) return;
    setIsStopping(true);
    try {
      await onStopDeployment(project.latestDeployment.id, project.name);
    } finally {
      setIsStopping(false);
    }
  };

  const handleRestart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project.latestDeployment || !onRestartDeployment || isRestarting) return;
    setIsRestarting(true);
    try {
      await onRestartDeployment(project.latestDeployment.id, project.name);
    } finally {
      setIsRestarting(false);
    }
  };

  const renderStatusBadge = () => {
    if (isLiveRunning) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Running
        </span>
      );
    }
    if (isStarting) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 text-[10px] font-bold">
          <RefreshCw className="w-3 h-3 animate-spin text-sky-600 dark:text-sky-400" />
          Starting...
        </span>
      );
    }
    if (isImageCompiled) {
      return (
        <span
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold"
          title="Docker image compiled. Container not started yet."
        >
          <CheckCircle2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          Image Compiled
        </span>
      );
    }
    if (isBuilding) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold">
          <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
          {effectiveStatus === "QUEUED" || project.status === "queued" ? "Queued" : "Building"}
        </span>
      );
    }
    if (isStopped) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border border-zinc-500/20 text-[10px] font-bold">
          <Square className="w-2.5 h-2.5 fill-current text-zinc-500" />
          Stopped
        </span>
      );
    }
    if (isCrashed) {
      return (
        <span
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold"
          title="Application container exited unexpectedly"
        >
          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          Crashed
        </span>
      );
    }
    if (isFailed) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">
          <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          Failed
        </span>
      );
    }
    if (isCancelled) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
          Cancelled
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
        Idle
      </span>
    );
  };

  // -------------------------------------------------------------
  // LIST VIEW
  // -------------------------------------------------------------
  if (viewMode === "list") {
    return (
      <div className="backdrop-blur-2xl bg-white/75 hover:bg-white/90 dark:bg-[#16191f]/85 dark:hover:bg-[#1e222b] border border-white/90 dark:border-[#282d37] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center shrink-0">
            <FileCode className="w-4 h-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#f1f3f5] truncate">
                {project.name}
              </h3>
              {renderStatusBadge()}
              {isLiveRunning && localUrl && (
                <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                  <Globe className="w-3 h-3 text-emerald-600" />
                  <a
                    href={localUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    title={`Open ${localUrl}`}
                  >
                    {localUrl}
                  </a>
                  <button
                    type="button"
                    onClick={(e) => handleCopyUrl(e, localUrl)}
                    className="ml-1 text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200"
                    title="Copy URL"
                  >
                    {urlCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <GithubLogo className="w-3 h-3 fill-current shrink-0" />
                {project.repo || "No repository"}
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <GitBranch className="w-3 h-3" />
                {project.branch || "main"}
              </span>
              <span>Updated {project.updatedAt}</span>
              <span>
                {project.deploymentsCount}{" "}
                {project.deploymentsCount === 1 ? "Deploy" : "Deploys"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
          {project.latestDeployment && (
            <button
              type="button"
              onClick={() =>
                onViewLogs(project.latestDeployment!.id, project.name)
              }
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-mono text-xs font-bold hover:underline cursor-pointer flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-lg border border-blue-200/60 dark:border-blue-900/40"
            >
              <span>
                {project.latestDeployment.commitSha
                  ? `SHA: ${project.latestDeployment.commitSha.substring(0, 7)}`
                  : "Console"}
              </span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          )}

          {/* Quick Stop Control */}
          {(isLiveRunning || isStarting) && onStopDeployment && project.latestDeployment && (
            <button
              type="button"
              onClick={handleStop}
              disabled={isStopping}
              className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Stop container"
            >
              {isStopping ? <RefreshCw className="w-3 h-3 animate-spin text-rose-600" /> : <Square className="w-3 h-3 fill-current text-rose-600" />}
              <span>Stop</span>
            </button>
          )}

          {/* Quick Restart Control */}
          {(isStopped || isCrashed) && onRestartDeployment && project.latestDeployment && (
            <button
              type="button"
              onClick={handleRestart}
              disabled={isRestarting}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Restart container"
            >
              {isRestarting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
              <span>Restart</span>
            </button>
          )}

          {/* Building State -> View Logs */}
          {isBuilding && project.latestDeployment && (
            <button
              type="button"
              onClick={() => onViewLogs(project.latestDeployment!.id, project.name)}
              className="py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400" />
              <span>View Logs</span>
            </button>
          )}

          {/* Primary Action Button (Deploy / Redeploy / Retry) */}
          {!isBuilding && !(isStopped && onRestartDeployment) && !(isCrashed && onRestartDeployment) && (
            <button
              type="button"
              onClick={() => onDeploy(project)}
              disabled={isDeploying}
              className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isDeploying ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>
                {isLiveRunning ? "Redeploy" : isFailed ? "Retry" : "Deploy"}
              </span>
            </button>
          )}

          {/* Options Dropdown Menu */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1e222b] transition-colors cursor-pointer"
              title="More options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 z-40 w-40 bg-white dark:bg-[#16191f] border border-slate-200 dark:border-[#282d37] rounded-2xl shadow-xl p-1 text-xs space-y-0.5">
                {project.latestDeployment && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onViewLogs(project.latestDeployment!.id, project.name);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-[#1e222b] hover:text-blue-600 font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    View Console
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onDeploy(project);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-[#1e222b] hover:text-blue-600 font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  New Deployment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(project.id, project.name);
                  }}
                  disabled={isDeleting}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Trash className="w-3.5 h-3.5" />
                  Delete Project
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // GRID VIEW
  // -------------------------------------------------------------
  return (
    <div className="backdrop-blur-2xl bg-white/75 hover:bg-white/90 dark:bg-[#16191f]/85 dark:hover:bg-[#1e222b] border border-white/90 dark:border-[#282d37] rounded-3xl p-5 space-y-4 shadow-lg shadow-sky-950/5 dark:shadow-black/30 hover:shadow-xl transition-all duration-200 group flex flex-col justify-between relative">
      <div className="space-y-3.5">
        {/* Top Header: Icon + Name + Status */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center shrink-0">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="truncate min-w-0">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#f1f3f5] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {project.name}
              </h3>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                <GithubLogo className="w-3 h-3 fill-current shrink-0" />
                <span className="truncate">
                  {project.repo || "No repository"}
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            {renderStatusBadge()}
          </div>
        </div>

        {/* Live Application URL Card (Shown when RUNNING and localUrl exists) */}
        {isLiveRunning && localUrl && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/20 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <a
                href={localUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline truncate"
                title={`Open live app at ${localUrl}`}
              >
                {localUrl}
              </a>
              {hostPort && internalPort && (
                <span className="text-[10px] font-mono text-emerald-600/80 dark:text-emerald-400/70 hidden sm:inline">
                  (:{hostPort} &rarr; :{internalPort})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => handleCopyUrl(e, localUrl)}
                className="p-1 rounded text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                title="Copy URL"
              >
                {urlCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <a
                href={localUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Starting Progress Indicator */}
        {isStarting && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-sky-500/10 dark:bg-sky-950/30 border border-sky-500/20 text-xs text-sky-700 dark:text-sky-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
            <span className="text-[11px] font-medium">Starting container & probing readiness...</span>
          </div>
        )}

        {/* Branch & Updated Info */}
        <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-slate-100 dark:border-[#282d37]/60">
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-mono text-[10px] bg-slate-100/80 dark:bg-[#1e222b] px-2 py-0.5 rounded-md min-w-0 shrink">
            <GitBranch className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[180px]">
              {project.branch || "main"}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
            {project.updatedAt}
          </span>
        </div>

        {/* Latest Run & Commit SHA */}
        <div className="flex items-center justify-between gap-2 text-xs bg-slate-50/80 dark:bg-[#12151a]/60 px-3 py-2 rounded-2xl border border-slate-100 dark:border-[#282d37]/40">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            Latest Run
          </span>
          {project.latestDeployment ? (
            <button
              type="button"
              onClick={() =>
                onViewLogs(project.latestDeployment!.id, project.name)
              }
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-mono text-[11px] font-bold hover:underline cursor-pointer flex items-center gap-1 shrink-0"
            >
              <span>
                {project.latestDeployment.commitSha
                  ? `SHA: ${project.latestDeployment.commitSha.substring(0, 7)}`
                  : "Console"}
              </span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 shrink-0">
              No deployments
            </span>
          )}
        </div>
      </div>

      {/* Card Footer: Deployments Count & Actions */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-[#282d37]">
        {/* Left: Deployment Count */}
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {project.deploymentsCount}
          </span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight truncate">
            {project.deploymentsCount === 1 ? "Deployment" : "Deployments"}
          </span>
        </div>

        {/* Right: Actions Container */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Stop Button (for RUNNING or STARTING) */}
          {(isLiveRunning || isStarting) && onStopDeployment && project.latestDeployment && (
            <button
              type="button"
              onClick={handleStop}
              disabled={isStopping}
              className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Stop application container"
            >
              {isStopping ? <RefreshCw className="w-3 h-3 animate-spin text-rose-600" /> : <Square className="w-3 h-3 fill-current text-rose-600" />}
              <span>Stop</span>
            </button>
          )}

          {/* Quick Restart Button (for STOPPED or CRASHED) */}
          {(isStopped || isCrashed) && onRestartDeployment && project.latestDeployment && (
            <button
              type="button"
              onClick={handleRestart}
              disabled={isRestarting}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Restart container"
            >
              {isRestarting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
              <span>Restart</span>
            </button>
          )}

          {/* Building State -> View Logs */}
          {isBuilding && project.latestDeployment && (
            <button
              type="button"
              onClick={() => {
                if (project.latestDeployment) {
                  onViewLogs(project.latestDeployment.id, project.name);
                }
              }}
              className="py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400" />
              <span>View Logs</span>
            </button>
          )}

          {/* Deploy / Redeploy / Retry Button */}
          {!isBuilding && !(isStopped && onRestartDeployment) && !(isCrashed && onRestartDeployment) && (
            <button
              type="button"
              onClick={() => onDeploy(project)}
              disabled={isDeploying}
              className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 hover:shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isDeploying ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>
                {isLiveRunning ? "Redeploy" : isFailed ? "Retry" : "Deploy"}
              </span>
            </button>
          )}

          {/* Quick Menu Toggle */}
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1e222b] transition-colors cursor-pointer"
              title="More options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 bottom-full mb-1 z-40 w-40 bg-white dark:bg-[#16191f] border border-slate-200 dark:border-[#282d37] rounded-2xl shadow-xl p-1 text-xs space-y-0.5">
                  {project.latestDeployment && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onViewLogs(project.latestDeployment!.id, project.name);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-[#1e222b] hover:text-blue-600 font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      View Console
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDeploy(project);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-[#1e222b] hover:text-blue-600 font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    New Deployment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(project.id, project.name);
                    }}
                    disabled={isDeleting}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Trash className="w-3.5 h-3.5" />
                    Delete Project
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
