import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  X, RefreshCw, CheckCircle2, AlertTriangle, 
  Terminal, ShieldAlert, GitBranch, Hash, Clock,
  Copy, Check, Download, Search, ArrowDown
} from 'lucide-react';
import { DeploymentStatus, DeploymentLog, BackendDeployment } from '../../types';
import { 
  getDeploymentLogs, 
  getDeploymentById, 
  getDeploymentRawLogs,
  cancelDeployment 
} from '../../services/deployment.service';

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
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [deployment, setDeployment] = useState<BackendDeployment | null>(null);
  const [status, setStatus] = useState<DeploymentStatus>('QUEUED');
  const [isTerminal, setIsTerminal] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  // Search, filter, copy, download, and scroll indicator
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStream, setFilterStream] = useState<'ALL' | 'SYSTEM' | 'STDOUT' | 'STDERR'>('ALL');
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);

  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const lastSequenceRef = useRef<number>(0);
  const isAutoScrollRef = useRef<boolean>(true);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl shadow-sky-950/30 flex flex-col max-h-[90vh] motion-safe:animate-fade-in-up">
        {/* Header */}
        <div className="p-5 sm:px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                Build & Deployment Console
              </h3>
              {/* Status Badge */}
              <span
                className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                  status === 'BUILT'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : status === 'FAILED'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : status === 'CANCELLED'
                    ? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}
              >
                {!isTerminal && <RefreshCw className="w-3 h-3 animate-spin" />}
                {status === 'BUILT' && <CheckCircle2 className="w-3 h-3" />}
                {status === 'FAILED' && <AlertTriangle className="w-3 h-3" />}
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span className="font-semibold text-slate-300">{projectName || deployment?.repositoryName || 'Deployment'}</span>
              {deployment?.branch && (
                <span className="flex items-center gap-1 font-mono text-[11px] text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded">
                  <GitBranch className="w-3 h-3" /> {deployment.branch}
                </span>
              )}
              {deployment?.commitSha && (
                <span className="flex items-center gap-0.5 font-mono text-[11px] text-slate-400">
                  <Hash className="w-3 h-3" /> {deployment.commitSha.substring(0, 7)}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isTerminal && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="text-xs text-red-400 hover:text-red-300 font-bold bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 rounded-xl px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                Cancel Run
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Console"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata Banner */}
        {deployment && (
          <div className="px-6 py-2 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-4">
              {deployment.commitMsg && (
                <span className="truncate max-w-sm text-slate-300 italic">
                  "{deployment.commitMsg}"
                </span>
              )}
              {deployment.durationMs != null && (
                <span className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3 h-3" /> {Math.round(deployment.durationMs / 1000)}s
                </span>
              )}
            </div>
            {deployment.imageTag && (
              <span className="text-slate-500 truncate max-w-xs" title={deployment.imageTag}>
                Tag: {deployment.imageTag}
              </span>
            )}
          </div>
        )}

        {/* Console Controls: Search, Stream Filters, Copy, Download */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Stream Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {(['ALL', 'SYSTEM', 'STDOUT', 'STDERR'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStream(s)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  filterStream === s
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {s === 'ALL' ? 'All Logs' : s === 'SYSTEM' ? 'System' : s === 'STDOUT' ? 'Stdout' : 'Stderr'}
              </button>
            ))}
          </div>

          {/* Search Box & Actions */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search console..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-8 pr-7 py-1 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              title="Copy visible logs to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownloadLogs}
              disabled={isDownloading || logs.length === 0}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              title="Download full raw log file"
            >
              {isDownloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Cancel Error Alert */}
        {cancelError && (
          <div className="mx-6 mt-3 p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300 font-semibold flex items-center justify-between">
            <span>{cancelError}</span>
            <button type="button" onClick={() => setCancelError(null)} className="text-red-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Poll Error Alert */}
        {pollError && (
          <div className="mx-6 mt-3 p-2.5 bg-amber-950/40 border border-amber-800 rounded-xl text-xs text-amber-300 font-medium">
            Connection notice: {pollError}. Retrying...
          </div>
        )}

        {/* Terminal Logs View */}
        <div className="relative flex-1 flex flex-col min-h-0">
          {/* Large Log Banner */}
          {isCapped && (
            <div className="bg-blue-950/70 border-b border-blue-800/80 px-4 py-1.5 text-[11px] font-mono text-blue-300 flex items-center justify-between">
              <span>
                Displaying latest {MAX_RENDER_LINES.toLocaleString()} of {filteredLogs.length.toLocaleString()} lines. Full history preserved.
              </span>
              <button
                type="button"
                onClick={handleDownloadLogs}
                className="underline hover:text-white font-semibold cursor-pointer"
              >
                Download full log (.log)
              </button>
            </div>
          )}

          <div
            ref={logContainerRef}
            onScroll={handleScroll}
            className="p-5 bg-slate-950 font-mono text-xs text-slate-300 overflow-y-auto flex-1 min-h-[320px] max-h-[520px] space-y-1 selection:bg-blue-600 selection:text-white"
          >
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                <p className="text-xs font-semibold">Waiting for initial build output...</p>
              </div>
            ) : displayedLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-16 text-slate-500 space-y-1">
                <p className="text-xs font-semibold">No logs match your filter criteria.</p>
                <button
                  type="button"
                  onClick={() => {
                    setFilterStream('ALL');
                    setSearchQuery('');
                  }}
                  className="text-xs text-blue-400 underline hover:text-blue-300 cursor-pointer"
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

                return (
                  <div
                    key={log.id}
                    className={`leading-relaxed whitespace-pre-wrap break-all ${
                      isSystem
                        ? 'text-blue-300 font-semibold'
                        : isSuccess
                        ? 'text-emerald-400 font-semibold'
                        : isError
                        ? 'text-rose-400 font-semibold'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-600 select-none mr-2">[{log.sequence}]</span>
                    {log.line}
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
              className="absolute bottom-4 right-6 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-black/40 text-xs font-bold flex items-center gap-1.5 transition-all animate-bounce cursor-pointer border border-blue-400/30"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Scroll to latest</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  !isTerminal ? 'bg-blue-400 animate-ping' : status === 'BUILT' ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              ></span>
              {!isTerminal ? 'Live stream active' : `Build finished with status: ${status}`}
            </span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-500 hidden sm:inline">
              {logs.length} total line{logs.length === 1 ? '' : 's'}
              {filteredLogs.length !== logs.length ? ` (${filteredLogs.length} matching)` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all cursor-pointer"
          >
            {isTerminal ? 'Close' : 'Minimize'}
          </button>
        </div>
      </div>
    </div>
  );
};
