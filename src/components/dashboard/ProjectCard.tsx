import React from 'react';
import { 
  Github, GitBranch, RefreshCw, CheckCircle2, 
  AlertTriangle, Trash, ExternalLink, Play, Clock
} from 'lucide-react';
import { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onDeploy: (project: Project) => void;
  onViewLogs: (deploymentId: string, projectName: string) => void;
  onDelete: (projectId: string, projectName: string) => void;
  isDeploying?: boolean;
  isDeleting?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onDeploy,
  onViewLogs,
  onDelete,
  isDeploying = false,
  isDeleting = false,
}) => {
  const isBuilding = project.status === 'building' || project.status === 'queued';
  const isReady = project.status === 'ready';
  const isFailed = project.status === 'failed';
  const isCancelled = project.status === 'cancelled';

  return (
    <div className="backdrop-blur-2xl bg-white/60 hover:bg-white/80 dark:bg-[#16191f]/85 dark:hover:bg-[#1e222b] border border-white/90 dark:border-[#282d37] rounded-2xl p-6 space-y-5 shadow-lg shadow-sky-950/5 dark:shadow-black/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 truncate">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-[#f1f3f5] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {project.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-semibold">
              <Github className="w-3.5 h-3.5 text-slate-800 dark:text-slate-300 shrink-0" />
              <span className="truncate">{project.repo || 'No repository connected'}</span>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {isReady && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Ready
              </span>
            )}
            {isBuilding && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 text-[10px] font-bold shrink-0">
                <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                {project.status === 'queued' ? 'Queued' : 'Building'}
              </span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100/90 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300 text-[10px] font-bold shrink-0">
                <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                Failed
              </span>
            )}
            {isCancelled && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold shrink-0">
                Cancelled
              </span>
            )}
            {project.status === 'idle' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-bold shrink-0">
                Idle
              </span>
            )}
          </div>
        </div>

        {/* Details Box */}
        <div className="bg-white/70 dark:bg-[#12151a]/90 border border-white/90 dark:border-[#282d37] p-3.5 rounded-xl space-y-2 shadow-2xs text-xs font-semibold">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="text-slate-500 dark:text-slate-400">Branch</span>
            <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-mono text-[11px] bg-slate-100 dark:bg-[#1e222b] px-2 py-0.5 rounded">
              <GitBranch className="w-3 h-3 text-slate-600 dark:text-slate-400" /> {project.branch || 'main'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Latest Run</span>
            {project.latestDeployment ? (
              <button
                type="button"
                onClick={() => onViewLogs(project.latestDeployment!.id, project.name)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                {project.latestDeployment.commitSha
                  ? `SHA: ${project.latestDeployment.commitSha.substring(0, 7)}`
                  : 'View Console'}
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 font-normal">No deployments yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Footer & Actions */}
      <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-[#282d37]">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
          <span>Updated {project.updatedAt}</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {project.deploymentsCount} {project.deploymentsCount === 1 ? 'Deploy' : 'Deploys'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isBuilding ? (
            <button
              type="button"
              onClick={() => {
                if (project.latestDeployment) {
                  onViewLogs(project.latestDeployment.id, project.name);
                }
              }}
              className="flex-1 py-2 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
              View Live Build
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onDeploy(project)}
              disabled={isDeploying}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isDeploying ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              {isReady ? 'Redeploy' : isFailed || isCancelled ? 'Retry Deploy' : 'Deploy Project'}
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(project.id, project.name)}
            disabled={isDeleting}
            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 border border-slate-200/60 dark:border-[#282d37] bg-white/60 dark:bg-[#16191f] transition-all cursor-pointer disabled:opacity-50"
            title="Delete Project"
          >
            {isDeleting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-500" />
            ) : (
              <Trash className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
