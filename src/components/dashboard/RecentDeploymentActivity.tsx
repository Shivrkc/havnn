import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { Deployment } from "../../types";

interface RecentDeploymentActivityProps {
  deployments: Deployment[];
  onViewLogs: (deploymentId: string, projectName: string) => void;
  onViewAllDeployments: () => void;
}

export const RecentDeploymentActivity: React.FC<
  RecentDeploymentActivityProps
> = ({ deployments, onViewLogs, onViewAllDeployments }) => {
  const recentList = deployments.slice(0, 5);

  return (
    <div className="backdrop-blur-2xl bg-white/75 dark:bg-[#16191f]/85 border border-white/90 dark:border-[#282d37] rounded-3xl p-5 sm:p-6 shadow-lg shadow-sky-950/5 dark:shadow-black/30 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">
          Recent Deployment Activity
        </h3>
        <button
          type="button"
          onClick={onViewAllDeployments}
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer flex items-center gap-1"
        >
          <span>View all</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Activity Table */}
      {recentList.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 font-semibold bg-slate-50/50 dark:bg-[#12151a]/40 rounded-2xl border border-dashed border-slate-200 dark:border-[#282d37]">
          No deployment activity recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <tbody>
              {recentList.map((dep) => {
                const isReady =
                  dep.status === "BUILT" || dep.status === "ready";
                const isFailed =
                  dep.status === "FAILED" || dep.status === "failed";
                const isBuilding =
                  dep.status === "BUILDING" ||
                  dep.status === "QUEUED" ||
                  dep.status === "INITIALIZING" ||
                  dep.status === "building";

                return (
                  <tr
                    key={dep.id}
                    onClick={() => onViewLogs(dep.id, dep.projectName)}
                    className="border-b border-slate-100 dark:border-[#282d37]/50 hover:bg-blue-50/40 dark:hover:bg-[#1e222b]/50 transition-colors cursor-pointer group last:border-none"
                  >
                    {/* Status Icon */}
                    <td className="py-3 pr-3 w-8">
                      {isReady && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                      {isFailed && (
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                      )}
                      {isBuilding && (
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                      )}
                      {!isReady && !isFailed && !isBuilding && (
                        <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700" />
                      )}
                    </td>

                    {/* Project Name */}
                    <td className="py-3 pr-4 font-bold text-slate-900 dark:text-[#f1f3f5] truncate max-w-[140px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {dep.projectName}
                    </td>

                    {/* Event / Commit Message */}
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400 italic truncate max-w-[200px] sm:max-w-xs">
                      {isReady && "Deployment succeeded"}
                      {isFailed &&
                        (dep.errorMessage
                          ? dep.errorMessage.slice(0, 45)
                          : "Build failed")}
                      {isBuilding && "Build in progress"}
                      {!isReady &&
                        !isFailed &&
                        !isBuilding &&
                        (dep.commitMsg || "Deployment triggered")}
                    </td>

                    {/* Commit SHA Pill */}
                    <td className="py-3 pr-4">
                      {dep.commitHash && dep.commitHash !== "pending" ? (
                        <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-900/60">
                          {dep.commitHash}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">
                          --
                        </span>
                      )}
                    </td>

                    {/* Relative Time */}
                    <td className="py-3 pr-3 text-right font-medium text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                      {dep.deployedAt}
                    </td>

                    {/* Action Icon */}
                    <td className="py-3 text-right w-8">
                      <Terminal className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ml-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
