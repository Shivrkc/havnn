import { BuildLog, Deployment, LogStream } from "@prisma/client";
import { MAX_CONTEXT_CHARS, MAX_CONTEXT_LINES } from "../constants/ai.constants";
import { sanitizeLogOutput } from "../utils/sanitizer";

export interface DeploymentAiContext {
  summary: string;
  selectedLogs: Array<{
    sequence: number;
    stream: LogStream;
    timestamp: Date;
    line: string;
  }>;
  formattedContext: string;
  totalAvailableLogs: number;
  selectedLogCount: number;
}

/**
 * Builds a smart, bounded, secret-scrubbed context window from deployment metadata and BuildLogs.
 * Prevents token overflow and high latency by prioritizing lifecycle events, error signals,
 * failure windows, and build configuration.
 */
export function buildDeploymentAiContext(
  deployment: Deployment & { project?: { name?: string } },
  allLogs: BuildLog[]
): DeploymentAiContext {
  const totalAvailableLogs = allLogs.length;

  // 1. Compile Deployment Metadata Header
  const durationSec = deployment.durationMs != null ? Math.round(deployment.durationMs / 1000) : null;
  const metadataLines = [
    `=== DEPLOYMENT METADATA ===`,
    `Project: ${deployment.project?.name || deployment.repositoryName}`,
    `Repository: ${deployment.repositoryName} (${deployment.repositoryUrl})`,
    `Branch: ${deployment.branch}`,
    `Commit: ${deployment.commitSha ? deployment.commitSha.substring(0, 7) : "N/A"} - "${deployment.commitMsg || "No message"}"`,
    `Status: ${deployment.status}`,
    `Started: ${deployment.startedAt ? deployment.startedAt.toISOString() : "N/A"}`,
    `Completed: ${deployment.completedAt ? deployment.completedAt.toISOString() : "N/A"}`,
    `Duration: ${durationSec != null ? `${durationSec}s` : "In progress / Unknown"}`,
    `Exit Code: ${deployment.exitCode != null ? deployment.exitCode : "N/A"}`,
    `Recorded Error: ${deployment.errorMessage || "None"}`,
    `Dockerfile Path: ${deployment.dockerfilePath}`,
    `Image Tag: ${deployment.imageTag || "None"}`,
    `Total Stored Log Lines: ${totalAvailableLogs}`,
    `===========================`,
  ];

  const summaryHeader = metadataLines.join("\n");

  // 2. Select prioritized log lines
  const selectedMap = new Map<number, BuildLog>();

  // A. Include all SYSTEM logs (pipeline milestones: claim, git clone, docker start, size check, terminal state)
  for (const log of allLogs) {
    if (log.stream === LogStream.SYSTEM) {
      selectedMap.set(log.sequence, log);
    }
  }

  // B. Include all STDERR logs and lines matching common error/failure keywords
  const errorRegex = /\b(error|failed|failure|fatal|exception|cannot find|npm ERR!|command not found|exit code [1-9]|denied|timeout)\b/i;
  for (const log of allLogs) {
    if (log.stream === LogStream.STDERR || errorRegex.test(log.line)) {
      selectedMap.set(log.sequence, log);
    }
  }

  // C. Include initial build steps (first 15 lines of output)
  const initialSlice = allLogs.slice(0, 15);
  for (const log of initialSlice) {
    selectedMap.set(log.sequence, log);
  }

  // D. If deployment failed or cancelled, capture the failure window (30 lines preceding the last log)
  if (deployment.status === "FAILED" || deployment.status === "CANCELLED" || deployment.exitCode !== 0) {
    const trailingSlice = allLogs.slice(-35);
    for (const log of trailingSlice) {
      selectedMap.set(log.sequence, log);
    }
  }

  // Convert map to array sorted strictly by monotonic sequence
  let sortedSelected = Array.from(selectedMap.values()).sort((a, b) => a.sequence - b.sequence);

  // If still below MAX_CONTEXT_LINES and we have more logs, evenly sample or take the recent tail
  if (sortedSelected.length < MAX_CONTEXT_LINES && allLogs.length > sortedSelected.length) {
    const remainingSlots = MAX_CONTEXT_LINES - sortedSelected.length;
    const tailSlice = allLogs.slice(-remainingSlots);
    for (const log of tailSlice) {
      selectedMap.set(log.sequence, log);
    }
    sortedSelected = Array.from(selectedMap.values()).sort((a, b) => a.sequence - b.sequence);
  }

  // E. Bound to MAX_CONTEXT_LINES
  if (sortedSelected.length > MAX_CONTEXT_LINES) {
    // Retain first 15 (startup) and last (MAX_CONTEXT_LINES - 15) to preserve terminal error
    const head = sortedSelected.slice(0, 15);
    const tail = sortedSelected.slice(-(MAX_CONTEXT_LINES - 15));
    sortedSelected = [...head, ...tail];
  }

  // 3. Format log lines as "[Seq #N] [STREAM] line"
  const formattedLogLines = sortedSelected.map(
    (l) => `[Seq #${l.sequence}] [${l.stream}] ${l.line}`
  );

  let logSection = formattedLogLines.join("\n");

  // 4. Bound to MAX_CONTEXT_CHARS (~30KB)
  if (logSection.length > MAX_CONTEXT_CHARS) {
    logSection = logSection.slice(-MAX_CONTEXT_CHARS);
    const firstNewline = logSection.indexOf("\n");
    if (firstNewline !== -1) {
      logSection = logSection.slice(firstNewline + 1);
    }
  }

  // 5. Defense-in-depth sanitization pass across entire compiled context
  const fullText = `${summaryHeader}\n\n=== RELEVANT BUILD LOGS (${sortedSelected.length} of ${totalAvailableLogs} lines) ===\n${logSection}`;
  const sanitizedContext = sanitizeLogOutput(fullText);

  return {
    summary: summaryHeader,
    selectedLogs: sortedSelected.map((l) => ({
      sequence: l.sequence,
      stream: l.stream,
      timestamp: l.timestamp,
      line: l.line,
    })),
    formattedContext: sanitizedContext,
    totalAvailableLogs,
    selectedLogCount: sortedSelected.length,
  };
}
