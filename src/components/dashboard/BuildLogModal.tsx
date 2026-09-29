import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, RefreshCw, CheckCircle2, AlertTriangle, 
  Terminal, ShieldAlert, GitBranch, Hash, Clock,
  Copy, Check, Download, Search, ArrowDown, Sparkles,
  Maximize2
} from 'lucide-react';
import { DeploymentStatus, DeploymentLog, BackendDeployment } from '../../types';
import { 
  getDeploymentLogs, 
  getDeploymentById, 
  getDeploymentRawLogs,
  cancelDeployment 
} from '../../services/deployment.service';
import { HavnAiAssistant } from './HavnAiAssistant';
import { ThemeToggle } from '../ui/ThemeToggle';

const MAX_RENDER_LINES = 2500;

interface BuildLogModalProps {
  isOpen: boolean;
  deploymentId: string | null;
  projectName?: string;
  onClose: () => void;
  onDeploymentTerminal?: (deployment: BackendDeployment) => void;
}

export const BuildLogModal: React.FC<BuildLogModalProps> = ({
  isOpen,
  deploymentId,
  projectName,
  onClose,
  onDeploymentTerminal,
}) => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [deployment, setDeployment] = useState<BackendDeployment | null>(null);
  const [status, setStatus] = useState<DeploymentStatus>('QUEUED');
  const [isTerminal, setIsTerminal] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  // Search, filter, copy, download, scroll indicator, and active tab
  const [activeModalTab, setActiveModalTab] = useState<'console' | 'ai'>('console');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStream, setFilterStream] = useState<'ALL' | 'SYSTEM' | 'STDOUT' | 'STDERR'>('ALL');
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);

  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const lastSequenceRef = useRef<number>(0);
  const isAutoScrollRef = useRef<boolean>(true);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Lock background page scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Escape key handling: Closes modal if not typing in input
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement | null;
        const isTextInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
        if (isTextInput && target === document.activeElement) {
          target.blur();
          return;
        }

        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-scroll logic: scroll to bottom if user hasn't manually scrolled up
  const scrollToBottom = useCallback((force = false) => {
    if ((force || isAutoScrollRef.current) && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  }, []);

  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    // User is within 40px of bottom
    const atBottom = scrollHeight - (scrollTop + clientHeight) < 40;
    isAutoScrollRef.current = atBottom;
    setIsAtBottom(atBottom);
  };

  const handleJumpToBottom = () => {
    isAutoScrollRef.current = true;
    scrollToBottom(true);
  };

  // Poll logs and metadata
  useEffect(() => {
    if (!isOpen || !deploymentId) {
      setLogs([]);
      setDeployment(null);
      setStatus('QUEUED');
      setIsTerminal(false);
      setIsCancelling(false);
      setCancelError(null);
      setPollError(null);
      setActiveModalTab('console');
      setSearchQuery('');
      setFilterStream('ALL');
      setCopied(false);
      setIsDownloading(false);
      setIsAtBottom(true);
      lastSequenceRef.current = 0;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    // Fetch initial deployment details
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
        console.error("Failed to load initial deployment metadata:", err);
      });

    const poll = async () => {
      try {
        const result = await getDeploymentLogs(deploymentId, lastSequenceRef.current);
        if (!isSubscribed) return;

        setPollError(null);
        setStatus(result.currentStatus);

        if (result.logs && result.logs.length > 0) {
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newLogs = result.logs.filter((l) => !existingIds.has(l.id));
            return [...prev, ...newLogs];
          });
          const highestSeq = result.logs[result.logs.length - 1].sequence;
          if (highestSeq > lastSequenceRef.current) {
            lastSequenceRef.current = highestSeq;
          }
        }

        if (result.isTerminal) {
          setIsTerminal(true);
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          // Fetch final deployment details for exit code, duration, imageTag
          const finalDep = await getDeploymentById(deploymentId);
          if (isSubscribed) {
            setDeployment(finalDep);
            if (onDeploymentTerminal) {
              onDeploymentTerminal(finalDep);
            }
          }
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        setPollError(err.response?.data?.message || err.message || "Failed to fetch build logs");
      }
    };

    // Initial immediate poll
    poll();

    // Set 1-second interval
    pollTimerRef.current = setInterval(poll, 1000);

    return () => {
      isSubscribed = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, deploymentId, onDeploymentTerminal]);

  // Scroll to bottom when logs update
  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const handleCancel = async () => {
    if (!deploymentId || isCancelling || isTerminal) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await cancelDeployment(deploymentId);
      if (res.deployment) {
        setDeployment(res.deployment);
        setStatus(res.deployment.status);
      }
      setIsTerminal(true);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    } catch (err: any) {
      setCancelError(err.response?.data?.message || err.message || "Failed to cancel deployment.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Filter and search logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterStream !== 'ALL' && log.stream !== filterStream) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        return log.line.toLowerCase().includes(query) || String(log.sequence).includes(query);
      }
      return true;
    });
  }, [logs, filterStream, searchQuery]);

  // Safe large-log slicing for DOM rendering performance
  const isCapped = filteredLogs.length > MAX_RENDER_LINES;
  const displayedLogs = useMemo(() => {
    if (!isCapped) return filteredLogs;
    return filteredLogs.slice(-MAX_RENDER_LINES);
  }, [filteredLogs, isCapped]);

  // Copy logs to clipboard
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
      console.error("Failed to copy logs:", err);
    }
  };

  // Download raw log export
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
      console.error("Failed to download raw logs:", err);
      // Fallback: generate download directly from loaded logs
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white/95 dark:bg-[#12151a]/95 backdrop-blur-xl border border-sky-200/80 dark:border-[#282d37] rounded-3xl w-full max-w-4xl h-[88vh] max-h-[850px] min-h-[520px] overflow-hidden shadow-2xl flex flex-col motion-safe:animate-fade-in-up text-slate-800 dark:text-slate-100">
        {/* Compact Header */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-sky-200/60 dark:border-[#282d37] flex items-center justify-between bg-white/80 dark:bg-[#16191f]/80 backdrop-blur-md shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                Build & Deployment Console
              </h3>
              {/* Status Badge */}
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  status === 'BUILT'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    : status === 'FAILED'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                    : status === 'CANCELLED'
                    ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700'
                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                }`}
              >
                {!isTerminal && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                {status === 'BUILT' && <CheckCircle2 className="w-2.5 h-2.5" />}
                {status === 'FAILED' && <AlertTriangle className="w-2.5 h-2.5" />}
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{projectName || deployment?.repositoryName || 'Deployment'}</span>
              {deployment?.branch && (
                <span className="flex items-center gap-1 font-mono text-[11px] text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
                  <GitBranch className="w-3 h-3 text-blue-600 dark:text-blue-400" /> {deployment.branch}
                </span>
              )}
              {deployment?.commitSha && (
                <span className="flex items-center gap-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  <Hash className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {deployment.commitSha.substring(0, 7)}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isTerminal && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:text-rose-400 dark:hover:text-rose-300 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:border-rose-800/60 rounded-xl px-2.5 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Cancel Run</span>
              </button>
            )}

            {/* Dedicated Page Fullscreen Button */}
            <button
              type="button"
              onClick={() => {
                if (!deploymentId) return;
                onClose();
                navigate(`/dashboard/deployments/${deploymentId}`);
              }}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#1e222b] transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#282d37]"
              title="Open dedicated full-page deployment console"
              aria-label="Open dedicated full-page deployment console"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Theme Toggle Button */}
            <ThemeToggle className="scale-90" />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#1e222b] transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#282d37]"
              title="Close"
              aria-label="Close deployment console"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-sky-50/50 dark:bg-[#16191f]/50 border-b border-sky-200/50 dark:border-[#282d37] shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveModalTab('console')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeModalTab === 'console'
                  ? 'bg-white text-blue-700 border border-sky-200 shadow-2xs dark:bg-[#1e222b] dark:text-blue-400 dark:border-[#282d37]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#1e222b]/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Terminal Console
            </button>
          </div>

          {activeModalTab === 'console' ? (
            <button
              type="button"
              onClick={() => setActiveModalTab('ai')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs shadow-md shadow-blue-500/20"
              title="Open HAVN AI Diagnostics"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask HAVN AI</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveModalTab('console')}
              className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-200 dark:hover:text-white rounded-xl border border-sky-200/80 dark:border-[#282d37] font-semibold flex items-center gap-1.5 transition-all cursor-pointer text-xs shadow-2xs"
              title="Return to Terminal Console"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Back to Logs</span>
            </button>
          )}
        </div>

        {/* AI Assistant View - Preserved across tab switches */}
        <div className={`flex-1 min-h-0 flex flex-col ${activeModalTab === 'ai' ? '' : 'hidden'}`}>
          <HavnAiAssistant
            deploymentId={deploymentId}
            deploymentStatus={status}
            projectName={projectName || deployment?.repositoryName}
            onSelectSequence={(seq) => {
              setActiveModalTab('console');
              setSearchQuery(String(seq));
            }}
            isFullscreen={false}
            isActive={activeModalTab === 'ai'}
          />
        </div>

        {/* Terminal Console View - Preserved across tab switches */}
        <div className={`flex-1 min-h-0 flex flex-col ${activeModalTab === 'console' ? '' : 'hidden'}`}>
          {/* Metadata Banner */}
          {deployment && (
            <div className="px-6 py-2 bg-sky-50/40 dark:bg-slate-900/60 border-b border-sky-200/40 dark:border-[#282d37] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-4">
                {deployment.commitMsg && (
                  <span className="truncate max-w-sm text-slate-700 dark:text-slate-300 italic">
                    "{deployment.commitMsg}"
                  </span>
                )}
                {deployment.durationMs != null && (
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <Clock className="w-3 h-3" /> {Math.round(deployment.durationMs / 1000)}s
                  </span>
                )}
              </div>
              {deployment.imageTag && (
                <span className="text-slate-500 dark:text-slate-400 truncate max-w-xs" title={deployment.imageTag}>
                  Tag: {deployment.imageTag}
                </span>
              )}
            </div>
          )}

          {/* Console Controls: Search, Stream Filters, Copy, Download */}
          <div className="px-6 py-2 bg-white/70 dark:bg-[#16191f]/70 backdrop-blur-md border-b border-sky-200/50 dark:border-[#282d37] flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Stream Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#1e222b] p-1 rounded-xl border border-slate-200 dark:border-[#282d37]">
              {(['ALL', 'SYSTEM', 'STDOUT', 'STDERR'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStream(s)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    filterStream === s
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#252a35]'
                  }`}
                >
                  {s === 'ALL' ? 'All Logs' : s === 'SYSTEM' ? 'System' : s === 'STDOUT' ? 'Stdout' : 'Stderr'}
                </button>
              ))}
            </div>

            {/* Search Box & Actions */}
            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search console..."
                  className="w-full bg-white/95 dark:bg-[#12151a]/95 border border-slate-200 dark:border-[#282d37] focus:border-blue-500 rounded-xl pl-8 pr-7 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Copy Button */}
              <button
                type="button"
                onClick={handleCopyLogs}
                disabled={filteredLogs.length === 0}
                className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-xl border border-slate-200 dark:border-[#282d37] font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shadow-2xs"
                title="Copy visible logs to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {/* Download Button */}
              <button
                type="button"
                onClick={handleDownloadLogs}
                disabled={isDownloading || logs.length === 0}
                className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-xl border border-slate-200 dark:border-[#282d37] font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shadow-2xs"
                title="Download full raw log file"
              >
                {isDownloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" /> : <Download className="w-3.5 h-3.5" />}
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* Cancel Error Alert */}
          {cancelError && (
            <div className="mx-6 mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center justify-between">
              <span>{cancelError}</span>
              <button type="button" onClick={() => setCancelError(null)} className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Poll Error Alert */}
          {pollError && (
            <div className="mx-6 mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
              Connection notice: {pollError}. Retrying...
            </div>
          )}

          {/* Terminal Logs View */}
          <div className="relative flex-1 flex flex-col min-h-0">
            {/* Large Log Banner */}
            {isCapped && (
              <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800/60 px-4 py-1.5 text-[11px] font-mono text-blue-700 dark:text-blue-300 flex items-center justify-between">
                <span>
                  Displaying latest {MAX_RENDER_LINES.toLocaleString()} of {filteredLogs.length.toLocaleString()} lines. Full history preserved.
                </span>
                <button
                  type="button"
                  onClick={handleDownloadLogs}
                  className="underline hover:text-blue-900 dark:hover:text-blue-200 font-semibold cursor-pointer"
                >
                  Download full log (.log)
                </button>
              </div>
            )}

            <div
              ref={logContainerRef}
              onScroll={handleScroll}
              className="p-5 bg-white/70 dark:bg-[#0a0c0e]/85 backdrop-blur-md font-mono text-xs text-slate-800 dark:text-slate-200 overflow-y-auto flex-1 min-h-0 space-y-1 selection:bg-blue-600 selection:text-white"
            >
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                  <p className="text-xs font-semibold">Waiting for initial build output...</p>
                </div>
              ) : displayedLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="text-xs font-semibold">No logs match your filter criteria.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStream('ALL');
                      setSearchQuery('');
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
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
                      className={`leading-relaxed whitespace-pre-wrap break-all flex items-start gap-2 py-0.5 px-1 rounded-sm ${
                        isError
                          ? 'text-rose-700 bg-rose-50/70 dark:text-rose-300 dark:bg-rose-950/40 border-l-2 border-rose-500 pl-1.5'
                          : isSuccess
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : isWarning
                          ? 'text-amber-700 dark:text-amber-400'
                          : isSystem
                          ? 'text-blue-700 dark:text-blue-400'
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

            {/* Floating "Scroll to latest" button */}
            {!isAtBottom && logs.length > 0 && (
              <button
                type="button"
                onClick={handleJumpToBottom}
                className="absolute bottom-4 right-6 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-500/25 text-xs font-bold flex items-center gap-1.5 transition-all animate-bounce cursor-pointer border border-blue-400/40"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Scroll to latest</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
