import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Menu,
  User,
  X,
  Folder,
  Rocket,
  Database as DatabaseIcon,
  Layers,
  ChevronRight,
  Terminal,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCheck,
} from "lucide-react";
import { GithubLogo } from "../ui/BrandIcons";
import ThemeToggle from "../ui/ThemeToggle";
import { ROUTES } from "../../constants/routes";
import { DashboardNavTab } from "./DashboardSidebar";
import { Project, Deployment } from "../../types";

interface DashboardHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  githubConnected: boolean;
  githubUsername: string | null;
  onConnectGithub: () => void;
  currentUser: {
    name?: string;
    avatar?: string | null;
  } | null;
  onOpenMobileSidebar: () => void;
  onTabChange?: (tab: DashboardNavTab) => void;
  projects?: Project[];
  deployments?: Deployment[];
  databases?: Array<{
    id: string;
    name: string;
    status: string;
    url?: string;
    size?: string;
  }>;
  onViewLogs?: (deploymentId: string, projectName: string) => void;
  isBackendHealthy?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  searchQuery,
  onSearchChange,
  githubConnected,
  githubUsername,
  onConnectGithub,
  currentUser,
  onOpenMobileSidebar,
  onTabChange,
  projects = [],
  deployments = [],
  databases = [],
  onViewLogs,
  isBackendHealthy = true,
}) => {
  const navigate = useNavigate();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Notification Center state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationContainerRef = useRef<HTMLDivElement | null>(null);

  // Persisted read notification IDs
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("havn_read_notification_ids");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus global search, Esc to close search & notifications
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsSearchFocused(true);
      }
      if (e.key === "Escape") {
        if (isSearchFocused) {
          setIsSearchFocused(false);
          inputRef.current?.blur();
        }
        if (isNotificationsOpen) {
          setIsNotificationsOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchFocused, isNotificationsOpen]);

  // Click outside listener for search results and notifications dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(target)
      ) {
        setIsSearchFocused(false);
      }
      if (
        notificationContainerRef.current &&
        !notificationContainerRef.current.contains(target)
      ) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute real global search matches across projects, deployments, databases, and sections
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;

    // 1. Projects
    const matchedProjects = projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.repo && p.repo.toLowerCase().includes(q)) ||
          (p.branch && p.branch.toLowerCase().includes(q)),
      )
      .slice(0, 4);

    // 2. Deployments
    const matchedDeployments = deployments
      .filter(
        (d) =>
          (d.projectName && d.projectName.toLowerCase().includes(q)) ||
          (d.commitHash && d.commitHash.toLowerCase().includes(q)) ||
          (d.commitMsg && d.commitMsg.toLowerCase().includes(q)) ||
          (d.branch && d.branch.toLowerCase().includes(q)),
      )
      .slice(0, 4);

    // 3. Databases
    const matchedDatabases = databases
      .filter((db) => db.name.toLowerCase().includes(q))
      .slice(0, 3);

    // 4. Navigation sections
    const navSections: Array<{
      tab: DashboardNavTab;
      title: string;
      category: string;
      description: string;
    }> = [
      {
        tab: "overview",
        title: "Overview & Metrics",
        category: "General",
        description: "Main system summary, telemetry, and active workloads",
      },
      {
        tab: "projects",
        title: "Projects Workspace",
        category: "Deploy",
        description: "Manage containerized applications and environments",
      },
      {
        tab: "deployments",
        title: "Deployment History",
        category: "Deploy",
        description: "Pipeline execution logs and run statuses",
      },
      {
        tab: "databases",
        title: "Databases",
        category: "Deploy",
        description: "Managed PostgreSQL, Redis, and MySQL instances",
      },
      {
        tab: "domains",
        title: "Custom Domains & TLS",
        category: "Deploy",
        description:
          "Production domains and automated Let's Encrypt SSL certificates",
      },
      {
        tab: "env-vars",
        title: "Environment Variables",
        category: "Configuration",
        description: "Key-value config pairs and runtime environment secrets",
      },
      {
        tab: "secrets",
        title: "Encrypted Secrets",
        category: "Configuration",
        description:
          "Encrypted tokens, private keys, and application credentials",
      },
      {
        tab: "integrations",
        title: "Integrations & GitHub",
        category: "Configuration",
        description: "Connected code repositories and automated webhooks",
      },
      {
        tab: "logs",
        title: "Build Logs & Terminal",
        category: "Observability",
        description: "Real-time stdout, stderr, and container runtime traces",
      },
      {
        tab: "monitoring",
        title: "System Monitoring",
        category: "Observability",
        description: "API gateway uptime, memory gauges, and cluster health",
      },
      {
        tab: "analytics",
        title: "Analytics & Traffic",
        category: "Observability",
        description: "Requests per minute, latency percentiles, and bandwidth",
      },
      {
        tab: "settings",
        title: "Security & System Settings",
        category: "System",
        description: "Authentication credentials and security policies",
      },
      {
        tab: "account",
        title: "Personal Account & Identity",
        category: "System",
        description:
          "Developer identity, verified email, and workspace allocation",
      },
    ];

    const matchedSections = navSections
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.tab.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      )
      .slice(0, 3);

    const totalMatches =
      matchedProjects.length +
      matchedDeployments.length +
      matchedDatabases.length +
      matchedSections.length;

    return {
      projects: matchedProjects,
      deployments: matchedDeployments,
      databases: matchedDatabases,
      sections: matchedSections,
      totalMatches,
    };
  }, [searchQuery, projects, deployments, databases]);

  const handleSelectSection = (tab: DashboardNavTab) => {
    if (onTabChange) {
      onTabChange(tab);
    }
    onSearchChange("");
    setIsSearchFocused(false);
  };

  const handleSelectProject = (project: Project) => {
    if (onTabChange) {
      onTabChange("projects");
    }
    onSearchChange("");
    setIsSearchFocused(false);
  };

  const handleSelectDeployment = (deployment: Deployment) => {
    if (onViewLogs && deployment.id) {
      onViewLogs(deployment.id, deployment.projectName);
    } else if (onTabChange) {
      onTabChange("deployments");
    }
    onSearchChange("");
    setIsSearchFocused(false);
  };

  const handleSelectDatabase = () => {
    if (onTabChange) {
      onTabChange("databases");
    }
    onSearchChange("");
    setIsSearchFocused(false);
  };

  // Helper to parse timestamps robustly across ISO dates, numbers, and relative labels like "5d ago"
  const parseTimestamp = (
    createdVal?: string,
    deployedVal?: string,
  ): number => {
    if (createdVal) {
      const parsed = new Date(createdVal).getTime();
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (deployedVal) {
      const parsed = new Date(deployedVal).getTime();
      if (!isNaN(parsed) && parsed > 0) return parsed;
      const match = deployedVal.match(/(\d+)\s*(s|m|h|d|w)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        const multipliers: Record<string, number> = {
          s: 1000,
          m: 60 * 1000,
          h: 3600 * 1000,
          d: 24 * 3600 * 1000,
          w: 7 * 24 * 3600 * 1000,
        };
        return Date.now() - num * (multipliers[unit] || 1000);
      }
    }
    return Date.now();
  };

  // Compute real event-driven notifications derived strictly from real state
  const notifications = useMemo(() => {
    const items: Array<{
      id: string;
      type: "success" | "error" | "warning" | "info";
      title: string;
      description: string;
      timestamp: number;
      timeLabel?: string;
      category: "deployment" | "github" | "database" | "system";
      targetTab: DashboardNavTab;
      deploymentId?: string;
      projectName?: string;
    }> = [];

    // 1. Real Deployments Events
    deployments.slice(0, 10).forEach((dep) => {
      const ts = parseTimestamp(dep.createdAt, dep.deployedAt);
      const shortSha = dep.commitHash
        ? ` (${dep.commitHash.substring(0, 7)})`
        : "";

      if (dep.status === "BUILT") {
        items.push({
          id: `dep-${dep.id}-built`,
          type: "success",
          title: "Deployment Succeeded",
          description: `${dep.projectName} built and deployed successfully${shortSha}`,
          timestamp: ts,
          timeLabel: dep.deployedAt,
          category: "deployment",
          targetTab: "deployments",
          deploymentId: dep.id,
          projectName: dep.projectName,
        });
      } else if (dep.status === "FAILED") {
        items.push({
          id: `dep-${dep.id}-failed`,
          type: "error",
          title: "Deployment Failed",
          description: `${dep.projectName} build encountered errors${shortSha}`,
          timestamp: ts,
          timeLabel: dep.deployedAt,
          category: "deployment",
          targetTab: "deployments",
          deploymentId: dep.id,
          projectName: dep.projectName,
        });
      } else if (dep.status === "CANCELLED") {
        items.push({
          id: `dep-${dep.id}-cancelled`,
          type: "warning",
          title: "Deployment Cancelled",
          description: `${dep.projectName} build was manually cancelled`,
          timestamp: ts,
          timeLabel: dep.deployedAt,
          category: "deployment",
          targetTab: "deployments",
          deploymentId: dep.id,
          projectName: dep.projectName,
        });
      } else if (["QUEUED", "INITIALIZING", "BUILDING"].includes(dep.status)) {
        items.push({
          id: `dep-${dep.id}-building`,
          type: "info",
          title: "Deployment in Progress",
          description: `${dep.projectName} container build is executing...`,
          timestamp: ts,
          timeLabel: dep.deployedAt,
          category: "deployment",
          targetTab: "deployments",
          deploymentId: dep.id,
          projectName: dep.projectName,
        });
      }
    });

    // 2. Real GitHub Account Integration State
    if (githubConnected) {
      items.push({
        id: `gh-connected-${githubUsername || "user"}`,
        type: "success",
        title: "GitHub Connected",
        description: `@${githubUsername || "connected"} repository sync active`,
        timestamp: Date.now() - 3600000,
        category: "github",
        targetTab: "integrations",
      });
    } else {
      items.push({
        id: "gh-disconnected-alert",
        type: "info",
        title: "GitHub Integration",
        description:
          "Connect GitHub to enable automated commits and deployments",
        timestamp: Date.now() - 7200000,
        category: "github",
        targetTab: "integrations",
      });
    }

    // 3. Real Serverless Databases
    databases.slice(0, 3).forEach((db) => {
      items.push({
        id: `db-${db.id}-${db.status}`,
        type: db.status === "active" ? "success" : "info",
        title:
          db.status === "active"
            ? "Database Operational"
            : "Database Provisioning",
        description: `${db.name} is ${db.status === "active" ? "healthy and accepting connections" : "spinning up"}`,
        timestamp: Date.now() - 1800000,
        category: "database",
        targetTab: "databases",
      });
    });

    // 4. Real System Health Status
    if (isBackendHealthy === false) {
      items.push({
        id: "sys-warning-health",
        type: "error",
        title: "API Gateway Degraded",
        description: "Backend gateway reported degraded status",
        timestamp: Date.now(),
        category: "system",
        targetTab: "monitoring",
      });
    } else {
      items.push({
        id: "sys-all-operational",
        type: "info",
        title: "All Systems Operational",
        description: "API gateways and container runners healthy",
        timestamp: Date.now() - 86400000,
        category: "system",
        targetTab: "monitoring",
      });
    }

    // Sort descending by timestamp
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [
    deployments,
    githubConnected,
    githubUsername,
    databases,
    isBackendHealthy,
  ]);

  // Derived unread notifications count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(
          "havn_read_notification_ids",
          JSON.stringify(next),
        );
      } catch {}
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds((prev) => {
      const combined = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem(
          "havn_read_notification_ids",
          JSON.stringify(combined),
        );
      } catch {}
      return combined;
    });
  };

  const handleNotificationClick = (item: (typeof notifications)[0]) => {
    markAsRead(item.id);
    setIsNotificationsOpen(false);

    if (item.category === "deployment" && item.deploymentId && onViewLogs) {
      onViewLogs(item.deploymentId, item.projectName || "Project");
    } else if (item.targetTab && onTabChange) {
      onTabChange(item.targetTab);
    }
  };

  const getRelativeTime = (timestamp: number, fallback?: string) => {
    if (!timestamp || isNaN(timestamp) || timestamp <= 0)
      return fallback || "Recently";
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;
    const d = new Date(timestamp);
    return isNaN(d.getTime())
      ? fallback || "Recently"
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <header className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 backdrop-blur-2xl bg-white/70 dark:bg-[#16191f]/80 border border-white/90 dark:border-[#282d37] rounded-3xl shadow-lg shadow-sky-950/5 dark:shadow-black/30 transition-all relative z-30">
      {/* Left: Mobile Menu Trigger + Global Search */}
      <div
        ref={searchContainerRef}
        className="flex items-center gap-3 flex-1 max-w-xl relative"
      >
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-[#1e222b] rounded-xl border border-slate-200/60 dark:border-[#282d37] transition-colors cursor-pointer shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects, deployments, databases..."
            className="w-full pl-10 pr-20 py-2 bg-white/60 dark:bg-[#12151a]/60 border border-slate-200/80 dark:border-[#282d37] rounded-2xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  inputRef.current?.focus();
                }}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Clear global search"
                aria-label="Clear global search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-[#1e222b] border border-slate-200 dark:border-[#282d37] rounded-md text-[10px] font-mono text-slate-500 dark:text-slate-400 pointer-events-none">
              <span>Ctrl</span>
              <span>K</span>
            </div>
          </div>

          {/* Global Search Results Palette */}
          {isSearchFocused && searchResults && (
            <div className="absolute left-0 right-0 top-full mt-2 z-50 backdrop-blur-2xl bg-white/95 dark:bg-[#16191f]/95 border border-white/90 dark:border-[#282d37] rounded-2xl shadow-2xl shadow-sky-950/20 dark:shadow-black/50 overflow-hidden max-h-[460px] overflow-y-auto animate-fade-in divide-y divide-slate-100 dark:divide-[#282d37]/60">
              {searchResults.totalMatches === 0 ? (
                <div className="p-8 text-center space-y-1.5">
                  <Search className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    No results found for &ldquo;{searchQuery}&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Try searching by project name, commit SHA, database name, or
                    dashboard sections.
                  </p>
                </div>
              ) : (
                <>
                  {/* Category: Projects */}
                  {searchResults.projects.length > 0 && (
                    <div className="p-2 space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                        <span>Projects</span>
                        <span className="text-[9px] bg-slate-100 dark:bg-[#1e222b] px-1.5 py-0.5 rounded">
                          {searchResults.projects.length}
                        </span>
                      </div>
                      {searchResults.projects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => handleSelectProject(project)}
                          className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-blue-50/80 dark:hover:bg-[#1e222b] transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center shrink-0">
                              <Folder className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                {project.name}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {project.repo || "No repo"} &bull;{" "}
                                {project.branch}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-600 flex items-center gap-1 shrink-0">
                            View <ChevronRight className="w-3 h-3" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Category: Deployments */}
                  {searchResults.deployments.length > 0 && (
                    <div className="p-2 space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                        <span>Deployments & Runs</span>
                        <span className="text-[9px] bg-slate-100 dark:bg-[#1e222b] px-1.5 py-0.5 rounded">
                          {searchResults.deployments.length}
                        </span>
                      </div>
                      {searchResults.deployments.map((dep) => (
                        <button
                          key={dep.id}
                          type="button"
                          onClick={() => handleSelectDeployment(dep)}
                          className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-blue-50/80 dark:hover:bg-[#1e222b] transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center shrink-0">
                              <Rocket className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5] truncate">
                                  {dep.projectName}
                                </p>
                                <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded">
                                  {dep.commitHash
                                    ? `SHA: ${dep.commitHash.substring(0, 7)}`
                                    : "run"}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {dep.commitMsg || dep.branch}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-600 flex items-center gap-1 shrink-0">
                            <Terminal className="w-3 h-3" /> Logs{" "}
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Category: Databases */}
                  {searchResults.databases.length > 0 && (
                    <div className="p-2 space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                        <span>Databases</span>
                        <span className="text-[9px] bg-slate-100 dark:bg-[#1e222b] px-1.5 py-0.5 rounded">
                          {searchResults.databases.length}
                        </span>
                      </div>
                      {searchResults.databases.map((db) => (
                        <button
                          key={db.id}
                          type="button"
                          onClick={handleSelectDatabase}
                          className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-blue-50/80 dark:hover:bg-[#1e222b] transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-center shrink-0">
                              <DatabaseIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5] truncate">
                                {db.name}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Status: {db.status}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-600 flex items-center gap-1 shrink-0">
                            Manage <ChevronRight className="w-3 h-3" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Category: Navigation Sections */}
                  {searchResults.sections.length > 0 && (
                    <div className="p-2 space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                        <span>Dashboard Sections</span>
                        <span className="text-[9px] bg-slate-100 dark:bg-[#1e222b] px-1.5 py-0.5 rounded">
                          {searchResults.sections.length}
                        </span>
                      </div>
                      {searchResults.sections.map((section) => (
                        <button
                          key={section.tab}
                          type="button"
                          onClick={() => handleSelectSection(section.tab)}
                          className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-blue-50/80 dark:hover:bg-[#1e222b] transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-sky-100/80 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/40 flex items-center justify-center shrink-0">
                              <Layers className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5] truncate">
                                {section.title}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {section.description}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-600 flex items-center gap-1 shrink-0">
                            Go to tab <ChevronRight className="w-3 h-3" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Popover Footer Info */}
              <div className="px-3.5 py-2 bg-slate-50/80 dark:bg-[#12151a]/80 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>
                  Scope: Real projects, deployments, databases &amp; sections
                </span>
                <span className="font-mono">ESC to close</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* GitHub Integration Pill */}
        {githubConnected ? (
          <div
            onClick={() =>
              onTabChange
                ? onTabChange("integrations")
                : navigate(ROUTES.PROFILE)
            }
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-[#1e222b] text-white dark:text-slate-200 border border-slate-800 dark:border-[#282d37] text-xs font-bold cursor-pointer hover:bg-slate-800 transition-all shadow-2xs"
            title="Connected to GitHub (Click to manage)"
          >
            <GithubLogo className="w-3.5 h-3.5 fill-current" />
            <span className="truncate max-w-[120px]">
              @{githubUsername || "connected"}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConnectGithub}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#1e222b]/80 hover:bg-white dark:hover:bg-[#1e222b] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-[#282d37] text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <GithubLogo className="w-3.5 h-3.5 fill-current" />
            <span>GitHub</span>
          </button>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Fully Functional Notifications Center */}
        <div ref={notificationContainerRef} className="relative">
          <button
            type="button"
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className={`relative p-2 rounded-xl transition-all cursor-pointer border ${
              isNotificationsOpen
                ? "bg-blue-50 text-blue-600 dark:bg-[#1e222b] dark:text-blue-400 border-blue-200 dark:border-[#282d37]"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-[#1e222b] border-transparent hover:border-slate-200/60 dark:hover:border-[#282d37]"
            }`}
            title="System notifications"
            aria-label={`Notifications (${unreadCount} unread)`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-[#16191f] shadow-xs">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Palette */}
          {isNotificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 backdrop-blur-2xl bg-white/95 dark:bg-[#16191f]/95 border border-white/90 dark:border-[#282d37] rounded-2xl shadow-2xl shadow-sky-950/20 dark:shadow-black/50 overflow-hidden animate-fade-in divide-y divide-slate-100 dark:divide-[#282d37]/60">
              {/* Header */}
              <div className="px-4 py-3 flex items-center justify-between bg-slate-50/50 dark:bg-[#12151a]/50">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-[#f1f3f5]">
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Mark all notifications as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label="Close notifications"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-[#282d37]/40">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center space-y-1.5">
                    <Bell className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      No notifications
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      You are all caught up with deployments and system events.
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => {
                    const isUnread = !readIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNotificationClick(item)}
                        className={`w-full text-left p-3 flex items-start gap-3 transition-colors cursor-pointer group ${
                          isUnread
                            ? "bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/40"
                            : "hover:bg-slate-50/80 dark:hover:bg-[#1e222b]"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {item.type === "success" && (
                            <div className="w-7 h-7 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {item.type === "error" && (
                            <div className="w-7 h-7 rounded-xl bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 flex items-center justify-center">
                              <AlertCircle className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {item.type === "warning" && (
                            <div className="w-7 h-7 rounded-xl bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {item.type === "info" && (
                            <div className="w-7 h-7 rounded-xl bg-sky-100/80 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/40 flex items-center justify-center">
                              <Info className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <p
                              className={`text-xs font-bold truncate ${
                                isUnread
                                  ? "text-slate-900 dark:text-white"
                                  : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {item.title}
                            </p>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                              {getRelativeTime(item.timestamp, item.timeLabel)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                            {item.description}
                          </p>
                        </div>

                        {isUnread && (
                          <div className="mt-1.5 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-blue-500 block" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Popover Footer Info */}
              <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-[#12151a]/80 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span>Real-time system events</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    if (onTabChange) onTabChange("monitoring");
                  }}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  System Health <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar */}
        <button
          type="button"
          onClick={() =>
            onTabChange ? onTabChange("account") : navigate(ROUTES.PROFILE)
          }
          className="flex items-center justify-center p-0.5 rounded-full ring-2 ring-blue-500/20 hover:ring-blue-500 transition-all cursor-pointer"
          title="Account Profile"
        >
          {currentUser?.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name || "User"}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
