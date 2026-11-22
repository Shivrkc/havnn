import React, { useState, useRef, useEffect, useMemo } from "react";
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
import { getEligibleRestartDeployment, getProjectLiveRuntime } from "../../utils/deployment.utils";
import { AmoledLiquidGlass } from "../ui/AmoledLiquidGlass";

interface ProjectCardProps {
  project: Project;
  onDeploy: (project: Project) => void;
  onViewLogs: (deploymentId: string, projectName: string) => void;
  onDelete: (projectId: string, projectName: string) => void;
  onStopDeployment?: (deploymentId: string, projectName: string) => Promise<void> | void;
  onRestartDeployment?: (deploymentId: string, projectName: string) => Promise<void> | void;
  onSelect?: (project: Project) => void;
  isSelected?: boolean;
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
  onSelect,
  isSelected = false,
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
  const isStopped = effectiveStatus === "STOPPED" || project.status === "stopped";
  const isCrashed = effectiveStatus === "CRASHED" || project.status === "crashed";
  const isFailed = effectiveStatus === "FAILED" || project.status === "failed";
  const isCancelled = effectiveStatus === "CANCELLED" || project.status === "cancelled";
  const isStarting = effectiveStatus === "STARTING";
  const isImageCompiled = effectiveStatus === "BUILT";
  const isBuilding =
    effectiveStatus === "BUILDING" ||
    effectiveStatus === "INITIALIZING" ||
    effectiveStatus === "QUEUED" ||
    project.status === "building" ||
    project.status === "queued";

  // Determine whether this project has an active, healthy running container.
  // Never present a STOPPED or CRASHED container as live.
  const liveRuntime = useMemo(() => {
    return getProjectLiveRuntime(project);
  }, [
    project.status,
    project.localUrl,
    project.hostPort,
    project.internalPort,
    project.liveDeploymentId,
    project.latestDeployment,
    project.liveDeployment,
  ]);

  const hasLiveRuntime = liveRuntime.hasLiveRuntime;
  const localUrl = liveRuntime.localUrl;
  const hostPort = liveRuntime.hostPort;
  const internalPort = liveRuntime.internalPort;
  const isLiveRunning = hasLiveRuntime;

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

  // Restart must target an actual eligible STOPPED or CRASHED deployment.
  // Never target FAILED, BUILDING, RUNNING or ineligible deployments.
  const eligibleRestartDeployment = useMemo(() => {
    return getEligibleRestartDeployment(project);
  }, [project.latestDeployment, project.liveDeployment]);

  const canRestart = Boolean(eligibleRestartDeployment && onRestartDeployment);

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const runningTarget =
      (project.liveDeployment?.status === "RUNNING" ? project.liveDeployment.id : null) ||
      (project.latestDeployment?.status === "RUNNING" ? project.latestDeployment.id : null) ||
      liveRuntime.activeLiveDeploymentId ||
      project.liveDeploymentId;
    if (!runningTarget || !onStopDeployment || isStopping) return;
    setIsStopping(true);
    try {
      await onStopDeployment(runningTarget, project.name);
    } finally {
      setIsStopping(false);
    }
  };

  const handleRestart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!eligibleRestartDeployment || !onRestartDeployment || isRestarting) return;
    setIsRestarting(true);
    try {
      await onRestartDeployment(eligibleRestartDeployment.id, project.name);
    } finally {
      setIsRestarting(false);
    }
  };

  const renderStatusBadge = () => {
    if (isStarting) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 text-[11px] font-medium">
          <RefreshCw className="w-3 h-3 animate-spin text-sky-600 dark:text-sky-400 shrink-0" />
          <span>Starting...</span>
        </span>
      );
    }
    if (isImageCompiled) {
      return (
        <span
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-medium"
          title="Docker image compiled. Container not started yet."
        >
          <CheckCircle2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Image Compiled</span>
        </span>
      );
    }
    if (isBuilding) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[11px] font-medium">
          <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{effectiveStatus === "QUEUED" || project.status === "queued" ? "Queued" : "Building"}</span>
        </span>
      );
    }
    if (isStopped) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20 text-[11px] font-medium">
          <Square className="w-2.5 h-2.5 fill-current text-zinc-500 shrink-0" />
          <span>Stopped</span>
        </span>
      );
    }
    if (isCrashed) {
      return (
        <span
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-medium"
          title="Application container exited unexpectedly"
        >
          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Crashed</span>
        </span>
      );
    }
    if (isFailed) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[11px] font-medium">
          <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>Failed</span>
        </span>
      );
    }
    if (isCancelled) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium">
          <span>Cancelled</span>
        </span>
      );
    }
    if (hasLiveRuntime || effectiveStatus === "RUNNING" || project.status === "ready") {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse shrink-0" />
          <span>Running</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
        <span>Idle</span>
      </span>
    );
  };

  // -------------------------------------------------------------
  // LIST VIEW
  // -------------------------------------------------------------
  if (viewMode === "list") {
    return (
      <AmoledLiquidGlass
        variant="toolbar"
        interactive={true}
        selected={isSelected}
        onClick={() => onSelect?.(project)}
        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15 flex items-center justify-center shrink-0">
            <FileCode className="w-4 h-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {project.name}
              </h3>
              {hasLiveRuntime && isFailed && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse shrink-0" />
                  <span>Live: Running</span>
                </span>
              )}
              {renderStatusBadge()}
              {hasLiveRuntime && localUrl && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 bg-emerald-500/[0.08] dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-300"
                >
                  <Globe className="w-3 h-3 text-emerald-600 shrink-0" />
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
                    className="ml-0.5 text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 focus-visible:outline-none"
                    title="Copy URL"
                  >
                    {urlCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <GithubLogo className="w-3 h-3 fill-current shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">{project.repo || "No repository"}</span>
              </span>
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <GitBranch className="w-3 h-3 text-slate-400" />
                <span>{project.branch || "main"}</span>
              </span>
              <span className="text-[11px] tabular-nums">Updated {project.updatedAt}</span>
              <span className="text-[11px] tabular-nums">
                {project.deploymentsCount}{" "}
                {project.deploymentsCount === 1 ? "Deploy" : "Deploys"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {project.latestDeployment && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewLogs(project.latestDeployment!.id, project.name);
              }}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-mono text-xs font-semibold hover:underline cursor-pointer flex items-center gap-1 bg-blue-500/10 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
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
          {(hasLiveRuntime || isStarting) && onStopDeployment && (
            <button
              type="button"
              onClick={handleStop}
              disabled={isStopping}
              className="py-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/15 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-500/20 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              title="Stop container"
            >
              {isStopping ? <RefreshCw className="w-3 h-3 animate-spin text-rose-600" /> : <Square className="w-3 h-3 fill-current text-rose-600" />}
              <span>Stop</span>
            </button>
          )}

          {/* Quick Restart Control */}
          {canRestart && eligibleRestartDeployment && (
            <button
              type="button"
              onClick={handleRestart}
              disabled={isRestarting}
              className="py-1 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              title={`Restart ${eligibleRestartDeployment.status.toLowerCase()} container`}
            >
              {isRestarting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
              <span>Restart</span>
            </button>
          )}

          {/* Building State -> View Logs */}
          {isBuilding && project.latestDeployment && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewLogs(project.latestDeployment!.id, project.name);
              }}
              className="py-1 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              <RefreshCw className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400" />
              <span>View Logs</span>
            </button>
          )}

          {/* Primary Action Button (Deploy / Redeploy / Retry) */}
          {!isBuilding && (!canRestart || isFailed) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeploy(project);
              }}
              disabled={isDeploying}
              className="py-1 px-3 bg-[#1453E6] hover:bg-[#1249cc] text-white rounded-lg text-xs font-medium transition-colors shadow-md shadow-[#1453E6]/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1453E6]/40"
            >
              {isDeploying ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>
                {isFailed ? "Retry" : hasLiveRuntime ? "Redeploy" : "Deploy"}
              </span>
            </button>
          )}

          {/* Options Dropdown Menu */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-white/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              title="More options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 z-40 w-40 bg-white/85 dark:bg-[#07080B]/95 border border-white/80 dark:border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),0_16px_40px_0_rgba(15,23,42,0.12)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_16px_48px_0_rgba(0,0,0,0.85)] rounded-xl backdrop-blur-2xl p-1 text-xs space-y-0.5">
                {project.latestDeployment && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onViewLogs(project.latestDeployment!.id, project.name);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-white/[0.06] hover:text-blue-600 font-medium flex items-center gap-2 cursor-pointer"
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
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-white/[0.06] hover:text-blue-600 font-medium flex items-center gap-2 cursor-pointer"
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
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Trash className="w-3.5 h-3.5" />
                  Delete Project
                </button>
              </div>
            )}
          </div>
        </div>
      </AmoledLiquidGlass>
    );
  }

  // -------------------------------------------------------------
  // GRID VIEW
  // -------------------------------------------------------------
  return (
    <AmoledLiquidGlass
      variant="card"
      interactive={true}
      selected={isSelected}
      onClick={() => onSelect?.(project)}
      className="p-4 sm:p-5 space-y-4 group flex flex-col justify-between"
    >
      <div className="space-y-3">
        {/* Top Header: Icon + Name + Status */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/30 flex items-center justify-center shrink-0">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="truncate min-w-0">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                {project.name}
              </h3>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate font-mono">
                <GithubLogo className="w-3 h-3 fill-current shrink-0" />
                <span className="truncate">
                  {project.repo || "No repository"}
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0 flex items-center gap-1.5">
            {hasLiveRuntime && isFailed && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live: Running
              </span>
            )}
            {renderStatusBadge()}
          </div>
        </div>

        {/* Live Application URL Card (Shown when RUNNING and localUrl exists) */}
        {hasLiveRuntime && localUrl && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-500/[0.07] dark:bg-emerald-950/25 border border-emerald-500/20 text-xs"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <a
                href={localUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:underline truncate focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-sm"
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
                className="p-1 rounded-md text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/40"
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
                className="p-1 rounded-md text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Starting Progress Indicator */}
        {isStarting && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 dark:bg-sky-950/30 border border-sky-500/20 text-xs text-sky-700 dark:text-sky-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
            <span className="text-[11px] font-medium">Starting container & probing readiness...</span>
          </div>
        )}

        {/* Branch & Updated Info */}
        <div className="flex items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-mono text-[10px] bg-white/50 dark:bg-white/[0.04] border border-white/60 dark:border-white/[0.06] shadow-2xs px-2 py-0.5 rounded-md min-w-0 shrink">
            <GitBranch className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[180px]">
              {project.branch || "main"}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-mono tabular-nums">
            {project.updatedAt}
          </span>
        </div>

        {/* Latest Run & Commit SHA */}
        <div className="flex items-center justify-between gap-2 text-xs bg-white/45 dark:bg-white/[0.02] px-3 py-2 rounded-xl border border-white/50 dark:border-white/[0.06] shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
            Latest Run
          </span>
          {project.latestDeployment ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewLogs(project.latestDeployment!.id, project.name);
              }}
              className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-mono text-[11px] font-medium hover:underline cursor-pointer flex items-center gap-1 shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500/40 rounded-sm"
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
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
        {/* Left: Deployment Count */}
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight tabular-nums">
            {project.deploymentsCount}
          </span>
          <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 leading-tight truncate">
            {project.deploymentsCount === 1 ? "Deployment" : "Deployments"}
          </span>
        </div>

        {/* Right: Actions Container */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Stop Button (for RUNNING or STARTING) */}
          {(hasLiveRuntime || isStarting) && onStopDeployment && (
            <button
              type="button"
              onClick={handleStop}
              disabled={isStopping}
              className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500/40"
              title="Stop application container"
            >
              {isStopping ? <RefreshCw className="w-3 h-3 animate-spin text-rose-600" /> : <Square className="w-3 h-3 fill-current text-rose-600" />}
              <span>Stop</span>
            </button>
          )}

          {/* Quick Restart Button (for eligible STOPPED or CRASHED deployment) */}
          {canRestart && eligibleRestartDeployment && (
            <button
              type="button"
              onClick={handleRestart}
              disabled={isRestarting}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              title={`Restart ${eligibleRestartDeployment.status.toLowerCase()} container`}
            >
              {isRestarting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
              <span>Restart</span>
            </button>
          )}

          {/* Building State -> View Logs */}
          {isBuilding && project.latestDeployment && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (project.latestDeployment) {
                  onViewLogs(project.latestDeployment.id, project.name);
                }
              }}
              className="py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              <RefreshCw className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400" />
              <span>View Logs</span>
            </button>
          )}

          {/* Deploy / Redeploy / Retry Button */}
          {!isBuilding && (!canRestart || isFailed) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeploy(project);
              }}
              disabled={isDeploying}
              className="py-1.5 px-3 bg-[#1453E6] hover:bg-[#1249cc] text-white rounded-lg text-xs font-medium transition-colors shadow-md shadow-[#1453E6]/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#1453E6]/40"
            >
              {isDeploying ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>
                {isFailed ? "Retry" : hasLiveRuntime ? "Redeploy" : "Deploy"}
              </span>
            </button>
          )}

          {/* Quick Menu Toggle */}
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((prev) => !prev);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-white/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500/40"
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
                <div className="absolute right-0 bottom-full mb-1 z-40 w-40 bg-white/85 dark:bg-[#07080B]/95 backdrop-blur-2xl border border-white/80 dark:border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),0_16px_40px_0_rgba(15,23,42,0.12)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_16px_48px_0_rgba(0,0,0,0.85)] rounded-xl p-1 text-xs space-y-0.5">
                  {project.latestDeployment && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onViewLogs(project.latestDeployment!.id, project.name);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-sky-600 dark:hover:text-sky-400 font-medium flex items-center gap-2 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500/40"
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
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-sky-600 dark:hover:text-sky-400 font-medium flex items-center gap-2 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500/40"
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
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium flex items-center gap-2 cursor-pointer disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500/40"
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
    </AmoledLiquidGlass>
  );
};
