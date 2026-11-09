import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Terminal, Sparkles, RefreshCw, CheckCircle2,
  AlertTriangle, ShieldAlert, GitBranch, Hash, Clock,
  Search, Copy, Check, Download, ArrowDown, Square,
  RotateCw, ExternalLink, Globe, XCircle, Play
} from 'lucide-react';
import { ROUTES } from '../constants/routes';
import { DeploymentStatus, DeploymentLog, BackendDeployment } from '../types';
import {
  getDeploymentById,
  getDeploymentLogs,
  getDeploymentRawLogs,
  cancelDeployment,
  getDeploymentRuntimeLogs,
  stopDeployment,
  restartDeployment,
} from '../services/deployment.service';
import { HavnAiAssistant } from '../components/dashboard/HavnAiAssistant';
import { HavnClouds } from '../components/landing/HavnClouds';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const MAX_RENDER_LINES = 2500;

export default function DeploymentConsolePage() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const navigate = useNavigate();

  const [deployment, setDeployment] = useState<BackendDeployment | null>(null);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [status, setStatus] = useState<DeploymentStatus>('QUEUED');
  const [isTerminal, setIsTerminal] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  // Active view: 'console' (Terminal logs) or 'ai' (HAVN AI diagnostics)
  const [activeTab, setActiveTab] = useState<'console' | 'ai'>('console');

  // Console sub-tab: 'build' (compile logs) vs 'runtime' (container stdout/stderr)
  const [consoleLogType, setConsoleLogType] = useState<'build' | 'runtime'>('build');
  const [runtimeLogs, setRuntimeLogs] = useState<string[]>([]);
  const [isLoadingRuntimeLogs, setIsLoadingRuntimeLogs] = useState<boolean>(false);
  const [runtimeLogsError, setRuntimeLogsError] = useState<string | null>(null);
  const [runtimeCopied, setRuntimeCopied] = useState<boolean>(false);

  // Runtime container actions
  const [isStopping, setIsStopping] = useState<boolean>(false);
  const [isRestarting, setIsRestarting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState<boolean>(false);

  // Console filtering & search for build logs
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStream, setFilterStream] = useState<'ALL' | 'SYSTEM' | 'STDOUT' | 'STDERR'>('ALL');
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);

  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const runtimeLogContainerRef = useRef<HTMLDivElement | null>(null);
  const lastSequenceRef = useRef<number>(0);
  const isAutoScrollRef = useRef<boolean>(true);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const runtimePollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const pollingGenerationRef = useRef<number>(0);
  const isFetchingRuntimeLogsRef = useRef<boolean>(false);

  // Back navigation handler
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(ROUTES.DASHBOARD);
    }
  };

  // Keyboard shortcut: Escape blurs input or returns to dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement | null;
        const isTextInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
        if (isTextInput && target === document.activeElement) {
          target.blur();
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll handler
  const scrollToBottom = useCallback((force = false) => {
    if ((force || isAutoScrollRef.current) && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  }, []);

  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const atBottom = scrollHeight - (scrollTop + clientHeight) < 40;
    isAutoScrollRef.current = atBottom;
    setIsAtBottom(atBottom);
  };

  const handleJumpToBottom = () => {
    isAutoScrollRef.current = true;
    scrollToBottom(true);
  };

  // Fetch runtime logs
  const fetchRuntimeLogs = useCallback(async () => {
    if (!deploymentId || isFetchingRuntimeLogsRef.current) return;
    isFetchingRuntimeLogsRef.current = true;
    setIsLoadingRuntimeLogs(true);
    try {
      const res = await getDeploymentRuntimeLogs(deploymentId, 200);
      setRuntimeLogs(res.logs || []);
      setRuntimeLogsError(null);
    } catch (err: any) {
      setRuntimeLogsError(err.response?.data?.message || err.message || 'Failed to fetch runtime logs');
    } finally {
      setIsLoadingRuntimeLogs(false);
      isFetchingRuntimeLogsRef.current = false;
    }
  }, [deploymentId]);

  // Polling deployment metadata and incremental build logs
  useEffect(() => {
    if (!deploymentId || isTerminal) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    let isSubscribed = true;
    const currentGeneration = pollingGenerationRef.current;

    // Load initial deployment metadata
    getDeploymentById(deploymentId)
      .then((dep) => {
        if (!isSubscribed || currentGeneration !== pollingGenerationRef.current) return;
        setDeployment(dep);
        setStatus(dep.status);
        if (['STOPPED', 'CRASHED', 'FAILED', 'CANCELLED'].includes(dep.status)) {
          setIsTerminal(true);
        }
        // If deployment is already RUNNING, load runtime logs as well
        if (dep.status === 'RUNNING') {
          fetchRuntimeLogs();
        }
      })
      .catch((err) => {
        console.error('Failed to load deployment metadata:', err);
      });

    const poll = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const res = await getDeploymentLogs(deploymentId, lastSequenceRef.current);

        if (!isSubscribed || currentGeneration !== pollingGenerationRef.current) return;

        if (res.logs && res.logs.length > 0) {
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newLogs = res.logs.filter((l) => !existingIds.has(l.id));
            if (newLogs.length === 0) return prev;
            return [...prev, ...newLogs].sort((a, b) => a.sequence - b.sequence);
          });
          const highestSeq = Math.max(...res.logs.map((l) => l.sequence));
          if (highestSeq > lastSequenceRef.current) {
            lastSequenceRef.current = highestSeq;
          }
        }

        if (res.currentStatus) {
          setStatus(res.currentStatus);

          // If reached terminal or running state, refresh full deployment metadata to get containerId / localUrl
          if (['RUNNING', 'STOPPED', 'CRASHED', 'FAILED', 'CANCELLED'].includes(res.currentStatus)) {
            getDeploymentById(deploymentId).then((updated) => {
              if (isSubscribed && currentGeneration === pollingGenerationRef.current) {
                setDeployment(updated);
              }
            }).catch(() => {});
          }

          if (['FAILED', 'CANCELLED', 'STOPPED', 'CRASHED'].includes(res.currentStatus) || res.isTerminal) {
            setIsTerminal(true);
          }
        }

        setPollError(null);
      } catch (err: any) {
        if (!isSubscribed || currentGeneration !== pollingGenerationRef.current) return;
        setPollError(err.message || 'Log polling error');
      } finally {
        isPollingRef.current = false;
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, 1500);

    return () => {
      isSubscribed = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [deploymentId, isTerminal, fetchRuntimeLogs]);

  // Periodic polling for runtime logs when in 'runtime' subtab and container is active
  useEffect(() => {
    if (consoleLogType !== 'runtime' || !deploymentId) {
      if (runtimePollTimerRef.current) {
        clearInterval(runtimePollTimerRef.current);
        runtimePollTimerRef.current = null;
      }
      return;
    }

    fetchRuntimeLogs();

    // Auto-poll runtime logs every 3 seconds if container is running or starting
    if (status === 'RUNNING' || status === 'STARTING') {
      runtimePollTimerRef.current = setInterval(() => {
        fetchRuntimeLogs();
      }, 3000);
    }

    return () => {
      if (runtimePollTimerRef.current) {
        clearInterval(runtimePollTimerRef.current);
        runtimePollTimerRef.current = null;
      }
    };
  }, [consoleLogType, deploymentId, status, fetchRuntimeLogs]);

  // Trigger auto-scroll on new logs
  useEffect(() => {
    if (isAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [logs, scrollToBottom]);

  // Cancel in-progress deployment
  const handleCancel = async () => {
    if (!deploymentId || isCancelling || isTerminal) return;
    setIsCancelling(true);
    setCancelError(null);
    pollingGenerationRef.current += 1;
    try {
      await cancelDeployment(deploymentId);
      setStatus('CANCELLED');
      setIsTerminal(true);
      const updated = await getDeploymentById(deploymentId);
      setDeployment(updated);
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel deployment run');
    } finally {
      setIsCancelling(false);
    }
  };

  // Stop running container
  const handleStop = async () => {
    if (!deploymentId || isStopping) return;
    setIsStopping(true);
    setActionError(null);
    pollingGenerationRef.current += 1;
    try {
      const res = await stopDeployment(deploymentId);
      setStatus(res.deployment.status);
      setDeployment(res.deployment);
      setIsTerminal(true);
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to stop container');
    } finally {
      setIsStopping(false);
    }
  };

  // Restart stopped or crashed deployment
  const handleRestart = async () => {
    if (!deploymentId || isRestarting) return;
    setIsRestarting(true);
    setActionError(null);
    pollingGenerationRef.current += 1;
    try {
      await restartDeployment(deploymentId);
      lastSequenceRef.current = 0;
      setLogs([]);
      setStatus('QUEUED');
      setIsTerminal(false);
      // Reload deployment metadata
      const updated = await getDeploymentById(deploymentId);
      setDeployment(updated);
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to restart deployment');
    } finally {
      setIsRestarting(false);
    }
  };

  // Copy localhost URL
  const handleCopyUrl = async () => {
    if (!deployment?.localUrl) return;
    try {
      await navigator.clipboard.writeText(deployment.localUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  // Filter logs by stream & search
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterStream !== 'ALL' && log.stream !== filterStream) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return log.line.toLowerCase().includes(query) || String(log.sequence).includes(query);
      }
      return true;
    });
  }, [logs, filterStream, searchQuery]);

  const isCapped = filteredLogs.length > MAX_RENDER_LINES;
  const displayedLogs = useMemo(() => {
    if (!isCapped) return filteredLogs;
    return filteredLogs.slice(-MAX_RENDER_LINES);
  }, [filteredLogs, isCapped]);

  // Copy build logs
  const handleCopyLogs = async () => {
    if (filteredLogs.length === 0) return;
    const text = filteredLogs
      .map((l) => `[${l.sequence}] [${l.stream}] ${l.line}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  // Copy runtime logs
  const handleCopyRuntimeLogs = async () => {
    if (runtimeLogs.length === 0) return;
    try {
      await navigator.clipboard.writeText(runtimeLogs.join('\n'));
      setRuntimeCopied(true);
      setTimeout(() => setRuntimeCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy runtime logs:', err);
    }
  };

  // Download raw build logs
  const handleDownloadLogs = async () => {
    if (!deploymentId) return;
    setIsDownloading(true);
    try {
      const rawText = await getDeploymentRawLogs(deploymentId);
      const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `deployment-${deploymentId.slice(0, 8)}.log`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download raw logs:', err);
      const fallbackText = logs
        .map((l) => `[${new Date(l.timestamp).toISOString()}] [${l.stream}] [${l.sequence}] ${l.line}`)
        .join('\n');
      const blob = new Blob([fallbackText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `deployment-${deploymentId.slice(0, 8)}.log`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  // Download runtime logs
  const handleDownloadRuntimeLogs = () => {
    if (runtimeLogs.length === 0 || !deploymentId) return;
    const blob = new Blob([runtimeLogs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `runtime-${deploymentId.slice(0, 8)}.log`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  // Render Status Badge for all 10 deployment lifecycle states
  const renderStatusBadge = () => {
    switch (status) {
      case 'RUNNING':
        return (
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Running
          </span>
        );
      case 'STARTING':
        return (
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800 flex items-center gap-1.5 shadow-2xs">
            <RefreshCw className="w-2.5 h-2.5 animate-spin text-sky-600 dark:text-sky-400" />
            Starting Container...
          </span>
        );
      case 'BUILT':
        return (
          <span
            className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800 flex items-center gap-1.5 shadow-2xs"
            title="Image compiled. Container startup in progress."
          >
            <CheckCircle2 className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
            Built (Image Compiled)
          </span>
        );
      case 'BUILDING':
        return (
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 flex items-center gap-1.5 shadow-2xs">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            Building
          </span>
        );
      case 'INITIALIZING':
      case 'QUEUED':
        return (
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1.5 shadow-2xs">
            <Clock className="w-2.5 h-2.5" />
            {status}
          </span>
        );
      case 'STOPPED':
        return (
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800/80 dark:text-zinc-300 dark:border-zinc-700 flex items-center gap-1.5 shadow-2xs">
            <Square className="w-2 h-2 fill-current text-zinc-500" />
            Stopped
          </span>
        );
      case 'CRASHED':
        return (
          <span
            className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-400 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 flex items-center gap-1.5 shadow-2xs"
            title="Application container exited unexpectedly"
          >
            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
            Crashed
          </span>
        );
      case 'FAILED':
        return (
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 flex items-center gap-1.5 shadow-2xs">
            <XCircle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
            Failed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700">
            {status}
          </span>
        );
    }
  };

  const isLiveRunning = status === 'RUNNING';
  const hasLocalUrl = Boolean(deployment?.localUrl);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-gradient-to-b from-[#f2f7fd] via-[#ebf3fc] to-[#f4f8fe] dark:from-[#0a0c0e] dark:via-[#0d0f12] dark:to-[#12151a] text-slate-800 dark:text-slate-100 select-text relative font-sans transition-colors duration-200">
      {/* Subtle Atmospheric Havn Clouds in the Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-30 dark:opacity-20">
        <HavnClouds speed={0.2} />
      </div>

      {/* Soft Sky Ambient Radial Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-200px] left-[-150px] w-[550px] h-[550px] bg-sky-300/20 dark:bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-200px] right-[-150px] w-[550px] h-[550px] bg-blue-300/15 dark:bg-sky-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Compact Top Navigation / Header */}
      <header className="relative z-10 px-4 sm:px-6 py-2.5 bg-white/80 dark:bg-[#16191f]/80 backdrop-blur-xl border-b border-sky-200/60 dark:border-[#282d37] shadow-xs dark:shadow-black/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Back to Dashboard & Project Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="px-2.5 py-1.5 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-slate-900 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-xl border border-slate-200/80 dark:border-[#282d37] shadow-2xs text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-wide">
              Console
            </h1>
          </div>

          {/* Status Badge */}
          {renderStatusBadge()}
        </div>

        {/* Center / Metadata: Repository, Branch, Commit, Ports */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {deployment?.repositoryName || 'Deployment'}
          </span>
          {deployment?.branch && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-blue-700 bg-blue-50/90 dark:text-blue-300 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/80 dark:border-blue-800/60">
              <GitBranch className="w-3 h-3 text-blue-600 dark:text-blue-400" /> {deployment.branch}
            </span>
          )}
          {deployment?.commitSha && (
            <span className="flex items-center gap-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              <Hash className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {deployment.commitSha.substring(0, 7)}
            </span>
          )}
          {deployment?.durationMs != null && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {Math.round(deployment.durationMs / 1000)}s
            </span>
          )}
        </div>

        {/* Right Actions: Stop, Restart, Cancel, View Switcher & Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Stop Container Button (when RUNNING or STARTING) */}
          {(status === 'RUNNING' || status === 'STARTING') && (
            <button
              type="button"
              onClick={handleStop}
              disabled={isStopping}
              className="text-xs text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:text-rose-300 dark:hover:text-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:border-rose-800/60 rounded-xl px-2.5 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs font-semibold"
              title="Stop running application container"
            >
              {isStopping ? <RefreshCw className="w-3 h-3 animate-spin text-rose-600" /> : <Square className="w-3 h-3 fill-current text-rose-600" />}
              <span>Stop Container</span>
            </button>
          )}

          {/* Restart Deployment Button (when STOPPED or CRASHED) */}
          {(status === 'STOPPED' || status === 'CRASHED') && (
            <button
              type="button"
              onClick={handleRestart}
              disabled={isRestarting}
              className="text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-600/20 font-semibold"
              title="Restart container"
            >
              {isRestarting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
              <span>Restart Container</span>
            </button>
          )}

          {/* Cancel Run (when build in-progress) */}
          {!isTerminal && ['QUEUED', 'INITIALIZING', 'BUILDING', 'BUILT'].includes(status) && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:text-rose-400 dark:hover:text-rose-300 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:border-rose-800/60 rounded-xl px-2.5 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              {isCancelling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Cancel Run</span>
            </button>
          )}

          {/* Primary View Switcher: Terminal Console vs Ask HAVN AI */}
          {activeTab === 'console' ? (
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/25 cursor-pointer"
              title="Open HAVN AI Diagnostics"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
              <span>Ask HAVN AI</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('console')}
              className="px-3.5 py-1.5 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-slate-900 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-200 dark:hover:text-white rounded-xl border border-slate-200/80 dark:border-[#282d37] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Return to Terminal Console"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Terminal Console</span>
            </button>
          )}

          {/* Dedicated Theme Toggle */}
          <ThemeToggle className="ml-1" />
        </div>
      </header>

      {/* Action / Error Banner */}
      {(actionError || cancelError || pollError) && (
        <div className="relative z-10 px-4 sm:px-6 py-2 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{actionError || cancelError || pollError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setCancelError(null);
              setPollError(null);
            }}
            className="text-rose-600 dark:text-rose-400 hover:underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Deployment URL Banner (when RUNNING and localUrl exists) */}
      {isLiveRunning && hasLocalUrl && (
        <div className="relative z-10 px-4 sm:px-6 py-2 bg-emerald-500/10 dark:bg-emerald-950/40 backdrop-blur-md border-b border-emerald-500/25 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE APPLICATION</span>
            </div>
            <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <a
              href={deployment!.localUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1"
            >
              <span>{deployment!.localUrl}</span>
              <ExternalLink className="w-3 h-3 text-emerald-600" />
            </a>
            {deployment?.hostPort && deployment?.internalPort && (
              <span className="text-[11px] font-mono text-emerald-700/80 dark:text-emerald-400/70 bg-emerald-100/70 dark:bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/50">
                Port {deployment.hostPort} &rarr; {deployment.internalPort}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="px-2.5 py-1 bg-white/90 hover:bg-emerald-50 text-emerald-800 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-emerald-300 rounded-lg border border-emerald-300/80 dark:border-emerald-800/60 shadow-2xs text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Copy localhost URL"
            >
              {urlCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{urlCopied ? 'Copied URL!' : 'Copy URL'}</span>
            </button>
            <a
              href={deployment!.localUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-2xs text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Open App</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Subtab Switcher: Build Logs vs Runtime Logs & Console Toolbar */}
      {activeTab === 'console' && (
        <div className="relative z-10 px-4 sm:px-6 py-2 bg-white/70 dark:bg-[#16191f]/70 backdrop-blur-md border-b border-sky-200/50 dark:border-[#282d37] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-2xs">
          {/* Left: Log Type Switcher (Build vs Runtime) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#1e222b] p-0.5 rounded-lg border border-slate-200/80 dark:border-[#282d37]">
              <button
                type="button"
                onClick={() => setConsoleLogType('build')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  consoleLogType === 'build'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#252a35]'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Build Logs</span>
                {logs.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${consoleLogType === 'build' ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                    {logs.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setConsoleLogType('runtime')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  consoleLogType === 'runtime'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#252a35]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Runtime Logs</span>
                {status === 'RUNNING' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            </div>

            {/* Build Log Streams Filter (Shown only when in Build view) */}
            {consoleLogType === 'build' && (
              <div className="hidden lg:flex items-center gap-1 bg-slate-100/90 dark:bg-[#1e222b] p-0.5 rounded-lg border border-slate-200/80 dark:border-[#282d37] ml-2">
                {(['ALL', 'SYSTEM', 'STDOUT', 'STDERR'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilterStream(s)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      filterStream === s
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#252a35]'
                    }`}
                  >
                    {s === 'ALL' ? 'All Streams' : s === 'SYSTEM' ? 'System' : s === 'STDOUT' ? 'Stdout' : 'Stderr'}
                  </button>
                ))}
              </div>
            )}

            {/* Runtime Log Indicators & Refresh (Shown only when in Runtime view) */}
            {consoleLogType === 'runtime' && (
              <div className="flex items-center gap-2 ml-2">
                <button
                  type="button"
                  onClick={fetchRuntimeLogs}
                  disabled={isLoadingRuntimeLogs}
                  className="px-2.5 py-1 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-slate-900 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#282d37] shadow-2xs text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Refresh runtime logs now"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingRuntimeLogs ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                  <span>Refresh</span>
                </button>
                {status === 'RUNNING' && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 hidden sm:inline-flex">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Auto-polling (3s)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right Toolbar: Search, Copy, Download */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            {consoleLogType === 'build' ? (
              <>
                <div className="relative flex-1 sm:w-52">
                  <Search className="w-3 h-3 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="w-full bg-white/95 dark:bg-[#12151a]/95 border border-slate-200 dark:border-[#282d37] focus:border-blue-500 rounded-lg pl-7 pr-3 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-blue-500 font-mono transition-all shadow-2xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCopyLogs}
                  disabled={filteredLogs.length === 0}
                  className="px-2.5 py-1 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-slate-900 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#282d37] shadow-2xs text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                  title="Copy filtered logs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
                  <span className="hidden md:inline">{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadLogs}
                  disabled={isDownloading || logs.length === 0}
                  className="px-2.5 py-1 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-slate-900 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#282d37] shadow-2xs text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                  title="Download raw logs file"
                >
                  {isDownloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" /> : <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
                  <span className="hidden md:inline">Download</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCopyRuntimeLogs}
                  disabled={runtimeLogs.length === 0}
                  className="px-2.5 py-1 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-slate-900 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#282d37] shadow-2xs text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                  title="Copy runtime logs"
                >
                  {runtimeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
                  <span className="hidden md:inline">{runtimeCopied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadRuntimeLogs}
                  disabled={runtimeLogs.length === 0}
                  className="px-2.5 py-1 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-slate-900 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#282d37] shadow-2xs text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                  title="Download runtime logs (.log)"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="hidden md:inline">Download</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Terminal Console View */}
        <div className={`flex-1 min-h-0 flex flex-col relative ${activeTab === 'console' ? '' : 'hidden'}`}>
          {/* BUILD LOGS VIEW */}
          {consoleLogType === 'build' && (
            <div className="flex-1 min-h-0 flex flex-col relative">
              {isCapped && (
                <div className="bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200/80 dark:border-sky-800/60 px-4 py-1 text-[11px] font-mono text-sky-800 dark:text-sky-300 flex items-center justify-between shrink-0">
                  <span>
                    Displaying latest {MAX_RENDER_LINES.toLocaleString()} of {filteredLogs.length.toLocaleString()} lines. Full history preserved.
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadLogs}
                    className="underline hover:text-blue-700 dark:hover:text-blue-400 font-semibold cursor-pointer"
                  >
                    Download full log (.log)
                  </button>
                </div>
              )}

              <div
                ref={logContainerRef}
                onScroll={handleScroll}
                className="p-4 sm:p-6 bg-white/70 dark:bg-[#0a0c0e]/85 backdrop-blur-md font-mono text-xs text-slate-800 dark:text-slate-200 overflow-y-auto flex-1 min-h-0 space-y-1 selection:bg-blue-600 selection:text-white"
              >
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-semibold">Waiting for initial build output...</p>
                  </div>
                ) : displayedLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500 space-y-1">
                    <p className="text-xs font-semibold">No logs match your filter criteria.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterStream('ALL');
                        setSearchQuery('');
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  displayedLogs.map((log) => {
                    const isSystem = log.stream === 'SYSTEM';
                    const isStderr = log.stream === 'STDERR';
                    const isSuccess = log.line.includes('SUCCESS') || log.line.includes('built and verified') || log.line.includes('completed successfully') || log.line.includes('Container reachable');
                    const isError = isStderr || log.line.includes('ERROR') || log.line.includes('Failed') || log.line.includes('exited with failure');
                    const isWarning = log.line.includes('WARN') || log.line.includes('warning');

                    const glyph = isSuccess ? '✓' : isError ? '✕' : isWarning ? '⚠' : isSystem ? 'ℹ' : '→';
                    const glyphColor = isSuccess ? 'text-emerald-600 dark:text-emerald-400' : isError ? 'text-rose-600 dark:text-rose-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : isSystem ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500';

                    return (
                      <div
                        key={log.id}
                        className={`leading-relaxed whitespace-pre-wrap break-all flex items-start gap-2 ${
                          isSystem
                            ? 'text-blue-800 dark:text-blue-400 font-medium'
                            : isSuccess
                            ? 'text-emerald-800 dark:text-emerald-400 font-medium'
                            : isError
                            ? 'text-rose-700 bg-rose-50/70 dark:text-rose-300 dark:bg-rose-950/40 border-l-2 border-rose-500 pl-1.5 py-0.5 rounded-r font-medium'
                            : isWarning
                            ? 'text-amber-800 dark:text-amber-400 font-medium'
                            : 'text-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-slate-400 dark:text-slate-500 select-none shrink-0 text-[11px] font-mono">[{log.sequence}]</span>
                        <span className={`select-none shrink-0 font-bold ${glyphColor}`}>{glyph}</span>
                        <span className="flex-1">{log.line}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Floating Jump to Latest Button */}
              {!isAtBottom && logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleJumpToBottom}
                  className="absolute bottom-4 right-6 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-600/30 text-xs font-bold flex items-center gap-1.5 transition-all animate-bounce cursor-pointer border border-blue-400/40 z-20"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Scroll to latest</span>
                </button>
              )}
            </div>
          )}

          {/* RUNTIME LOGS VIEW */}
          {consoleLogType === 'runtime' && (
            <div className="flex-1 min-h-0 flex flex-col relative">
              <div
                ref={runtimeLogContainerRef}
                className="p-4 sm:p-6 bg-white/70 dark:bg-[#0a0c0e]/85 backdrop-blur-md font-mono text-xs text-slate-800 dark:text-slate-200 overflow-y-auto flex-1 min-h-0 space-y-1 selection:bg-blue-600 selection:text-white"
              >
                {isLoadingRuntimeLogs && runtimeLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-semibold">Fetching runtime logs from Docker daemon...</p>
                  </div>
                ) : runtimeLogsError ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-rose-500 dark:text-rose-400 space-y-2">
                    <AlertTriangle className="w-6 h-6" />
                    <p className="text-xs font-semibold">{runtimeLogsError}</p>
                    <button
                      type="button"
                      onClick={fetchRuntimeLogs}
                      className="text-xs underline text-blue-600 dark:text-blue-400 cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : runtimeLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500 space-y-2">
                    {status === 'RUNNING' ? (
                      <>
                        <Globe className="w-6 h-6 text-emerald-500" />
                        <p className="text-xs font-semibold">Container is running, but no stdout/stderr logs have been emitted yet.</p>
                        <p className="text-[11px] text-slate-400">Click Refresh above or make HTTP requests to the localhost URL.</p>
                      </>
                    ) : status === 'STARTING' ? (
                      <>
                        <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                        <p className="text-xs font-semibold">Container is starting up. Runtime logs will appear once it produces output.</p>
                      </>
                    ) : status === 'STOPPED' ? (
                      <>
                        <Square className="w-6 h-6 text-zinc-400" />
                        <p className="text-xs font-semibold">Container is stopped. Start or restart the container to view runtime logs.</p>
                      </>
                    ) : status === 'CRASHED' ? (
                      <>
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                        <p className="text-xs font-semibold">Container crashed. No exit logs were recorded.</p>
                      </>
                    ) : (
                      <>
                        <Terminal className="w-6 h-6 text-slate-400" />
                        <p className="text-xs font-semibold">Application container has not started yet.</p>
                        <p className="text-[11px] text-slate-400">Runtime logs will be available when deployment transitions to RUNNING.</p>
                      </>
                    )}
                  </div>
                ) : (
                  runtimeLogs.map((line, idx) => {
                    const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('exception') || line.toLowerCase().includes('fatal');
                    const isWarn = line.toLowerCase().includes('warn');
                    return (
                      <div
                        key={idx}
                        className={`leading-relaxed whitespace-pre-wrap break-all flex items-start gap-2 ${
                          isError
                            ? 'text-rose-700 dark:text-rose-300 font-medium bg-rose-50/50 dark:bg-rose-950/30 px-1 rounded'
                            : isWarn
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-slate-400 dark:text-slate-500 select-none shrink-0 text-[11px] font-mono w-8 text-right">
                          {idx + 1}
                        </span>
                        <span className="flex-1">{line}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* AI Diagnostics View */}
        <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'ai' ? '' : 'hidden'}`}>
          <HavnAiAssistant
            deploymentId={deploymentId || ''}
            deploymentStatus={status}
            projectName={deployment?.repositoryName}
            onSelectSequence={(seq) => {
              setActiveTab('console');
              setConsoleLogType('build');
              setSearchQuery(String(seq));
            }}
            isFullscreen={true}
            isActive={activeTab === 'ai'}
          />
        </div>
      </main>
    </div>
  );
}
