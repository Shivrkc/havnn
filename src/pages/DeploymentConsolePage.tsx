import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Terminal, Sparkles, RefreshCw, CheckCircle2,
  AlertTriangle, ShieldAlert, GitBranch, Hash, Clock,
  Search, Copy, Check, Download, ArrowDown
} from 'lucide-react';
import { ROUTES } from '../constants/routes';
import { DeploymentStatus, DeploymentLog, BackendDeployment } from '../types';
import {
  getDeploymentById,
  getDeploymentLogs,
  getDeploymentRawLogs,
  cancelDeployment
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

  // Console filtering & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStream, setFilterStream] = useState<'ALL' | 'SYSTEM' | 'STDOUT' | 'STDERR'>('ALL');
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);

  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const lastSequenceRef = useRef<number>(0);
  const isAutoScrollRef = useRef<boolean>(true);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Polling deployment metadata and incremental logs
  useEffect(() => {
    if (!deploymentId) return;

    let isSubscribed = true;

    // Load initial deployment metadata
    getDeploymentById(deploymentId)
      .then((dep) => {
        if (!isSubscribed) return;
        setDeployment(dep);
        setStatus(dep.status);
        if (['BUILT', 'FAILED', 'CANCELLED'].includes(dep.status)) {
          setIsTerminal(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load deployment metadata:', err);
      });

    const poll = async () => {
      try {
        const res = await getDeploymentLogs(deploymentId, {
          afterSequence: lastSequenceRef.current,
          limit: 100,
        });

        if (!isSubscribed) return;

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

        if (res.deploymentStatus) {
          setStatus(res.deploymentStatus);
          if (['BUILT', 'FAILED', 'CANCELLED'].includes(res.deploymentStatus)) {
            setIsTerminal(true);
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          }
        }

        setPollError(null);
      } catch (err: any) {
        if (!isSubscribed) return;
        setPollError(err.message || 'Log polling error');
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
  }, [deploymentId]);

  // Trigger auto-scroll on new logs
  useEffect(() => {
    if (isAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [logs, scrollToBottom]);

  // Cancel running deployment
  const handleCancel = async () => {
    if (!deploymentId || isCancelling || isTerminal) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await cancelDeployment(deploymentId);
      setStatus('CANCELLED');
      setIsTerminal(true);
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel deployment run');
    } finally {
      setIsCancelling(false);
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

  // Copy logs
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

  // Download logs
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
              Build & Deployment Console
            </h1>
          </div>

          {/* Status Badge */}
          <span
            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
              status === 'BUILT'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                : status === 'FAILED'
                ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                : status === 'CANCELLED'
                ? 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700'
                : 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
            }`}
          >
            {!isTerminal && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
            {status === 'BUILT' && <CheckCircle2 className="w-2.5 h-2.5" />}
            {status === 'FAILED' && <AlertTriangle className="w-2.5 h-2.5" />}
            {status}
          </span>
        </div>

        {/* Center / Metadata: Repository, Branch, Commit */}
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

        {/* Right Actions: Cancel Run, View Mode Switcher & Theme Toggle */}
        <div className="flex items-center gap-2">
          {!isTerminal && (
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

      {/* Compact Console Controls (Rendered when in Console mode) */}
      {activeTab === 'console' && (
        <div className="relative z-10 px-4 sm:px-6 py-2 bg-white/70 dark:bg-[#16191f]/70 backdrop-blur-md border-b border-sky-200/50 dark:border-[#282d37] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-2xs">
          {/* Left: Terminal Console Indicator & Stream Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:inline">
              Terminal:
            </span>
            <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#1e222b] p-0.5 rounded-lg border border-slate-200/80 dark:border-[#282d37]">
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
                  {s === 'ALL' ? 'All Logs' : s === 'SYSTEM' ? 'System' : s === 'STDOUT' ? 'Stdout' : 'Stderr'}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Search, Copy, Download */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3 h-3 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs or [Seq #]..."
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
          </div>
        </div>
      )}

      {/* Main Flexible Content Area: Maximized Vertical Viewport */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Terminal Logs View (Preserved across tab switches) */}
        <div className={`flex-1 min-h-0 flex flex-col relative ${activeTab === 'console' ? '' : 'hidden'}`}>
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
                const isSuccess = log.line.includes('SUCCESS') || log.line.includes('built and verified') || log.line.includes('completed successfully');
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

        {/* AI Diagnostics View (Preserved across tab switches) */}
        <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'ai' ? '' : 'hidden'}`}>
          <HavnAiAssistant
            deploymentId={deploymentId || ''}
            deploymentStatus={status}
            projectName={deployment?.repositoryName}
            onSelectSequence={(seq) => {
              setActiveTab('console');
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
