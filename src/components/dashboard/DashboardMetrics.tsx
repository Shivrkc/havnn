import React from "react";
import {
  Box,
  Rocket,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface DashboardMetricsProps {
  activeProjectsCount: number;
  totalDeploymentsCount: number;
  successfulDeploymentsCount: number;
  successRateText: string;
  avgDeployTimeText: string;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  activeProjectsCount,
  totalDeploymentsCount,
  successfulDeploymentsCount,
  successRateText,
  avgDeployTimeText,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Active Projects */}
      <div className="backdrop-blur-2xl bg-white/70 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-5 shadow-lg shadow-sky-950/5 dark:shadow-black/30 hover:shadow-xl transition-all duration-200 flex items-center justify-between group">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-xs">
            <div className="p-1.5 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
              <Box className="w-3.5 h-3.5" />
            </div>
            <span>Active Projects</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-[#f1f3f5] tracking-tight">
            {activeProjectsCount}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>
              {activeProjectsCount === 0
                ? "No active projects"
                : activeProjectsCount === 1
                  ? "1 project deployed"
                  : `${activeProjectsCount} projects active`}
            </span>
          </div>
        </div>

        {/* Decorative mini bar sparkline */}
        <div className="flex items-end gap-1 h-12 pr-1 opacity-70 group-hover:opacity-100 transition-opacity">
          <div className="w-1.5 h-4 rounded-full bg-blue-200 dark:bg-blue-900/60" />
          <div className="w-1.5 h-6 rounded-full bg-blue-300 dark:bg-blue-800/70" />
          <div className="w-1.5 h-8 rounded-full bg-blue-400 dark:bg-blue-700/80" />
          <div className="w-1.5 h-5 rounded-full bg-blue-300 dark:bg-blue-800/70" />
          <div className="w-1.5 h-10 rounded-full bg-blue-500 dark:bg-blue-600" />
          <div className="w-1.5 h-12 rounded-full bg-blue-600 dark:bg-blue-500" />
        </div>
      </div>

      {/* Metric 2: Total Deployments */}
      <div className="backdrop-blur-2xl bg-white/70 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-5 shadow-lg shadow-sky-950/5 dark:shadow-black/30 hover:shadow-xl transition-all duration-200 flex items-center justify-between group">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-xs">
            <div className="p-1.5 rounded-xl bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
              <Rocket className="w-3.5 h-3.5" />
            </div>
            <span>Total Deployments</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-[#f1f3f5] tracking-tight">
            {totalDeploymentsCount}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>
              {totalDeploymentsCount === 0
                ? "0 runs this period"
                : `${successfulDeploymentsCount} successful runs`}
            </span>
          </div>
        </div>

        {/* Decorative mini bar sparkline */}
        <div className="flex items-end gap-1 h-12 pr-1 opacity-70 group-hover:opacity-100 transition-opacity">
          <div className="w-1.5 h-5 rounded-full bg-indigo-200 dark:bg-indigo-900/60" />
          <div className="w-1.5 h-7 rounded-full bg-indigo-300 dark:bg-indigo-800/70" />
          <div className="w-1.5 h-4 rounded-full bg-indigo-200 dark:bg-indigo-900/60" />
          <div className="w-1.5 h-9 rounded-full bg-indigo-400 dark:bg-indigo-700/80" />
          <div className="w-1.5 h-11 rounded-full bg-indigo-500 dark:bg-indigo-600" />
          <div className="w-1.5 h-8 rounded-full bg-indigo-600 dark:bg-indigo-500" />
        </div>
      </div>

      {/* Metric 3: Success Rate */}
      <div className="backdrop-blur-2xl bg-white/70 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-5 shadow-lg shadow-sky-950/5 dark:shadow-black/30 hover:shadow-xl transition-all duration-200 flex items-center justify-between group">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-xs">
            <div className="p-1.5 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span>Success Rate</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-[#f1f3f5] tracking-tight">
            {successRateText}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>
              {successRateText === "--"
                ? "No builds recorded"
                : "Terminal builds ratio"}
            </span>
          </div>
        </div>

        {/* Decorative mini wave sparkline */}
        <div className="w-16 h-10 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
          <svg
            viewBox="0 0 64 32"
            className="w-full h-full fill-none stroke-emerald-500 dark:stroke-emerald-400 stroke-2"
          >
            <path
              d="M 2 24 C 12 16, 20 28, 30 18 C 40 8, 50 14, 62 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Metric 4: Avg Deploy Time */}
      <div className="backdrop-blur-2xl bg-white/70 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl p-5 shadow-lg shadow-sky-950/5 dark:shadow-black/30 hover:shadow-xl transition-all duration-200 flex items-center justify-between group">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-xs">
            <div className="p-1.5 rounded-xl bg-sky-100/80 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/40">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span>Avg. Deploy Time</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-[#f1f3f5] tracking-tight">
            {avgDeployTimeText}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400">
            <TrendingDown className="w-3 h-3" />
            <span>
              {avgDeployTimeText === "--"
                ? "Awaiting first run"
                : "Measured build duration"}
            </span>
          </div>
        </div>

        {/* Decorative mini wave sparkline */}
        <div className="w-16 h-10 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
          <svg
            viewBox="0 0 64 32"
            className="w-full h-full fill-none stroke-blue-500 dark:stroke-blue-400 stroke-2"
          >
            <path
              d="M 2 20 C 14 26, 24 10, 36 14 C 46 18, 54 8, 62 10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
