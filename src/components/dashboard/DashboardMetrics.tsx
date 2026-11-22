import React from "react";
import {
  Box,
  Rocket,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { AmoledLiquidGlass } from "../ui/AmoledLiquidGlass";

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
      {/* Metric 1: Active Projects (PROTOTYPE: Amoled Smoked Liquid Glass) */}
      <AmoledLiquidGlass
        variant="card"
        interactive={true}
        className="p-4 sm:p-5 flex flex-col justify-between group"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-400">
            Active Projects
          </span>
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15">
            <Box className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100 tracking-tight">
            {activeProjectsCount}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>
              {activeProjectsCount === 0
                ? "No active projects"
                : activeProjectsCount === 1
                  ? "1 container environment"
                  : `${activeProjectsCount} container environments`}
            </span>
          </div>
        </div>
      </AmoledLiquidGlass>

      {/* Metric 2: Total Deployments */}
      <AmoledLiquidGlass
        variant="card"
        interactive={true}
        className="p-4 sm:p-5 flex flex-col justify-between group"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-400">
            Total Deployments
          </span>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15">
            <Rocket className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100 tracking-tight">
            {totalDeploymentsCount}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <TrendingUp className="w-3 h-3 text-indigo-500" />
            <span>
              {totalDeploymentsCount === 0
                ? "0 runs this period"
                : `${successfulDeploymentsCount} successful runs`}
            </span>
          </div>
        </div>
      </AmoledLiquidGlass>

      {/* Metric 3: Success Rate */}
      <AmoledLiquidGlass
        variant="card"
        interactive={true}
        className="p-4 sm:p-5 flex flex-col justify-between group"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-400">
            Success Rate
          </span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100 tracking-tight">
            {successRateText}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                successRateText !== "--" && parseInt(successRateText, 10) >= 80
                  ? "bg-emerald-500"
                  : "bg-slate-400"
              }`}
            />
            <span>
              {successRateText === "--"
                ? "No builds recorded"
                : "Terminal builds ratio"}
            </span>
          </div>
        </div>
      </AmoledLiquidGlass>

      {/* Metric 4: Avg Deploy Time */}
      <AmoledLiquidGlass
        variant="card"
        interactive={true}
        className="p-4 sm:p-5 flex flex-col justify-between group"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-400">
            Avg. Deploy Time
          </span>
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/15">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100 tracking-tight">
            {avgDeployTimeText}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium font-mono">
            <span>
              {avgDeployTimeText === "--"
                ? "Awaiting first run"
                : "Measured build duration"}
            </span>
          </div>
        </div>
      </AmoledLiquidGlass>
    </div>
  );
};
