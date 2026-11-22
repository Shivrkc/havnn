import React from "react";
import { Plus, Database, Globe } from "lucide-react";
import { GithubLogo } from "../ui/BrandIcons";
import { AmoledLiquidGlass } from "../ui/AmoledLiquidGlass";

interface QuickActionsCardProps {
  onNewProject: () => void;
  onConnectRepository: () => void;
  onAddDatabase: () => void;
  onManageDomains: () => void;
}

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  onNewProject,
  onConnectRepository,
  onAddDatabase,
  onManageDomains,
}) => {
  return (
    <AmoledLiquidGlass variant="card" className="p-4 sm:p-5 space-y-3">
      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
        Quick Actions
      </h3>

      <div className="grid grid-cols-2 gap-2 text-left">
        {/* Action 1: New Project */}
        <button
          type="button"
          onClick={onNewProject}
          className="p-3 rounded-xl bg-white/35 dark:bg-[#181d28]/70 border border-white/45 dark:border-white/[0.06] hover:bg-white/55 dark:hover:bg-[#1e2535] hover:border-[#1453E6]/40 dark:hover:border-[#1453E6]/50 transition-colors shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_2px_6px_-2px_rgba(12,50,110,0.04)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#1453E6]/40 text-left cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-lg bg-[#1453E6]/10 text-[#1453E6] dark:text-blue-400 border border-[#1453E6]/15 flex items-center justify-center mb-1.5">
            <Plus className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
            New Project
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Deploy application
          </p>
        </button>

        {/* Action 2: Connect Repository */}
        <button
          type="button"
          onClick={onConnectRepository}
          className="p-3 rounded-xl bg-white/35 dark:bg-[#181d28]/70 border border-white/45 dark:border-white/[0.06] hover:bg-white/55 dark:hover:bg-[#1f2533] hover:border-white/80 dark:hover:border-white/[0.14] transition-colors shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_2px_6px_-2px_rgba(12,50,110,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 text-left cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-200/80 dark:bg-[#252b3b] text-slate-800 dark:text-slate-200 border border-slate-300/40 dark:border-white/[0.08] flex items-center justify-center mb-1.5">
            <GithubLogo className="w-3.5 h-3.5 fill-current" />
          </div>
          <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
            Connect Repo
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Link GitHub repo
          </p>
        </button>

        {/* Action 3: Add Database */}
        <button
          type="button"
          onClick={onAddDatabase}
          className="p-3 rounded-xl bg-white/35 dark:bg-[#181d28]/70 border border-white/45 dark:border-white/[0.06] hover:bg-white/55 dark:hover:bg-[#22213a] hover:border-indigo-300/60 dark:hover:border-indigo-700/50 transition-colors shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_2px_6px_-2px_rgba(12,50,110,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 text-left cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15 flex items-center justify-center mb-1.5">
            <Database className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
            Add Database
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            PostgreSQL instance
          </p>
        </button>

        {/* Action 4: Manage Domains */}
        <button
          type="button"
          onClick={onManageDomains}
          className="p-3 rounded-xl bg-white/35 dark:bg-[#181d28]/70 border border-white/45 dark:border-white/[0.06] hover:bg-white/55 dark:hover:bg-[#1b2738] hover:border-sky-300/60 dark:hover:border-sky-700/50 transition-colors shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_2px_6px_-2px_rgba(12,50,110,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 text-left cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/15 flex items-center justify-center mb-1.5">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
            Manage Domains
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Configure domains
          </p>
        </button>
      </div>
    </AmoledLiquidGlass>
  );
};
