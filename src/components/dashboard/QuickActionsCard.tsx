import React from "react";
import { Plus, Database, Globe } from "lucide-react";
import { GithubLogo } from "../ui/BrandIcons";

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
    <div className="backdrop-blur-2xl bg-white/75 dark:bg-[#16191f]/85 border border-white/90 dark:border-[#282d37] rounded-3xl p-5 shadow-lg shadow-sky-950/5 dark:shadow-black/30 space-y-3">
      <h3 className="text-xs font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">
        Quick Actions
      </h3>

      <div className="grid grid-cols-2 gap-2 text-left">
        {/* Action 1: New Project */}
        <button
          type="button"
          onClick={onNewProject}
          className="p-3 rounded-2xl bg-white/60 dark:bg-[#1e222b]/60 border border-slate-200/60 dark:border-[#282d37] hover:bg-blue-50/60 dark:hover:bg-[#252a35] hover:border-blue-300 dark:hover:border-blue-700 transition-all text-left group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <Plus className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5] truncate">
            New Project
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
            Deploy application
          </p>
        </button>

        {/* Action 2: Connect Repository */}
        <button
          type="button"
          onClick={onConnectRepository}
          className="p-3 rounded-2xl bg-white/60 dark:bg-[#1e222b]/60 border border-slate-200/60 dark:border-[#282d37] hover:bg-slate-100/60 dark:hover:bg-[#252a35] hover:border-slate-300 dark:hover:border-slate-600 transition-all text-left group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-xl bg-slate-900 dark:bg-[#1e222b] text-white flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <GithubLogo className="w-3.5 h-3.5 fill-current" />
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5] truncate">
            Connect Repo
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
            Link GitHub repo
          </p>
        </button>

        {/* Action 3: Add Database */}
        <button
          type="button"
          onClick={onAddDatabase}
          className="p-3 rounded-2xl bg-white/60 dark:bg-[#1e222b]/60 border border-slate-200/60 dark:border-[#282d37] hover:bg-blue-50/60 dark:hover:bg-[#252a35] hover:border-blue-300 dark:hover:border-blue-700 transition-all text-left group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-xl bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <Database className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5] truncate">
            Add Database
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
            PostgreSQL instance
          </p>
        </button>

        {/* Action 4: Manage Domains */}
        <button
          type="button"
          onClick={onManageDomains}
          className="p-3 rounded-2xl bg-white/60 dark:bg-[#1e222b]/60 border border-slate-200/60 dark:border-[#282d37] hover:bg-sky-50/60 dark:hover:bg-[#252a35] hover:border-sky-300 dark:hover:border-sky-700 transition-all text-left group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-xl bg-sky-100/80 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5] truncate">
            Manage Domains
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
            Configure domains
          </p>
        </button>
      </div>
    </div>
  );
};
