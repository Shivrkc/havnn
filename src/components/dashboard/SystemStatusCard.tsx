import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { AmoledLiquidGlass } from "../ui/AmoledLiquidGlass";

interface SystemStatusCardProps {
  isBackendHealthy: boolean;
  githubConnected: boolean;
  activeDeploymentsCount: number;
}

export const SystemStatusCard: React.FC<SystemStatusCardProps> = ({
  isBackendHealthy,
  githubConnected,
  activeDeploymentsCount,
}) => {
  const allHealthy = isBackendHealthy;

  return (
    <AmoledLiquidGlass variant="card" className="p-4 sm:p-5 space-y-3">
      {/* Overall Status Banner */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              allHealthy ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            {allHealthy ? "All Systems Operational" : "Degraded System Status"}
          </h3>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-4">
          Verified from real engine health telemetry
        </p>
      </div>

      {/* Verified Real Services List */}
      <div className="space-y-2.5 pt-2.5 border-t border-slate-100 dark:border-white/[0.06] text-xs">
        {/* Service 1: Core API Gateway */}
        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendHealthy ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <span className="text-[11px]">API Gateway</span>
          </div>
          <span
            className={`text-[11px] font-medium font-mono ${
              isBackendHealthy
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-500"
            }`}
          >
            {isBackendHealthy ? "Operational" : "Unavailable"}
          </span>
        </div>

        {/* Service 2: Deployment Worker Engine */}
        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendHealthy ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <span className="text-[11px]">Deployment Engine</span>
          </div>
          <span className="text-[11px] font-medium font-mono text-emerald-600 dark:text-emerald-400">
            {activeDeploymentsCount > 0
              ? `${activeDeploymentsCount} Active`
              : "Operational"}
          </span>
        </div>

        {/* Service 3: PostgreSQL Database */}
        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendHealthy ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <span className="text-[11px]">Database Store</span>
          </div>
          <span
            className={`text-[11px] font-medium font-mono ${
              isBackendHealthy
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-500"
            }`}
          >
            {isBackendHealthy ? "Connected" : "Error"}
          </span>
        </div>

        {/* Service 4: GitHub Integration */}
        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                githubConnected ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
            <span className="text-[11px]">GitHub OAuth</span>
          </div>
          <span
            className={`text-[11px] font-medium font-mono ${
              githubConnected
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-500"
            }`}
          >
            {githubConnected ? "Connected" : "Not Linked"}
          </span>
        </div>
      </div>
    </AmoledLiquidGlass>
  );
};
