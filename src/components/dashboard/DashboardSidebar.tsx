import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  Layers,
  Folder,
  Database,
  Globe,
  Key,
  Lock,
  Cpu,
  Terminal,
  Activity,
  BarChart2,
  Settings,
  User,
  LogOut,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import { ROUTES } from "../../constants/routes";
import Logo from "../ui/Logo";

export type DashboardNavTab =
  | "overview"
  | "deployments"
  | "projects"
  | "databases"
  | "domains"
  | "env-vars"
  | "secrets"
  | "integrations"
  | "logs"
  | "monitoring"
  | "analytics"
  | "settings"
  | "account";

interface DashboardSidebarProps {
  activeTab: DashboardNavTab;
  setActiveTab: (tab: DashboardNavTab) => void;
  currentUser: {
    id?: string;
    name?: string;
    email?: string;
    avatar?: string | null;
    provider?: string;
  } | null;
  onLogout: () => void;
  onOpenLatestLogs?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  onOpenLatestLogs,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  const handleNavClick = (tab: DashboardNavTab) => {
    setActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (tab: DashboardNavTab) => {
    const isActive = activeTab === tab;
    return `w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
      isActive
        ? "bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold shadow-2xs"
        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-[#1e222b]/60"
    }`;
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Persistent Glassmorphic Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 p-3 lg:p-4 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col justify-between backdrop-blur-2xl bg-white/75 dark:bg-[#16191f]/85 border border-white/90 dark:border-[#282d37] rounded-3xl p-4 shadow-xl shadow-sky-950/5 dark:shadow-black/40 overflow-y-auto no-scrollbar">
          {/* Header & Logo */}
          <div className="space-y-6">
            <div className="flex items-center justify-between pt-1 px-1">
              <div
                className="cursor-pointer"
                onClick={() => handleNavClick("overview")}
              >
                <Logo />
              </div>
              {onCloseMobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e222b] cursor-pointer"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Standalone Primary Overview */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => handleNavClick("overview")}
                className={navItemClass("overview")}
              >
                <span className="flex items-center gap-2.5">
                  <Home className="w-3.5 h-3.5 shrink-0" />
                  Overview
                </span>
              </button>
            </div>

            {/* Navigation Groups */}
            <div className="space-y-4 text-xs">
              {/* Group 1: DEPLOY */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Deploy
                </span>
                <nav className="space-y-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleNavClick("deployments")}
                    className={navItemClass("deployments")}
                  >
                    <span className="flex items-center gap-2.5">
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      Deployments
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick("projects")}
                    className={navItemClass("projects")}
                  >
                    <span className="flex items-center gap-2.5">
                      <Folder className="w-3.5 h-3.5 shrink-0" />
                      Projects
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick("databases")}
                    className={navItemClass("databases")}
                  >
                    <span className="flex items-center gap-2.5">
                      <Database className="w-3.5 h-3.5 shrink-0" />
                      Databases
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick("domains")}
                    className={navItemClass("domains")}
                  >
                    <span className="flex items-center gap-2.5">
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      Domains
                    </span>
                  </button>
                </nav>
              </div>

              {/* Group 2: Configuration */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Configuration
                </span>
                <nav className="space-y-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleNavClick("env-vars")}
                    className={navItemClass("env-vars")}
                  >
                    <span className="flex items-center gap-2.5">
                      <Key className="w-3.5 h-3.5 shrink-0" />
                      Environment Variables
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick("secrets")}
                    className={navItemClass("secrets")}
                  >
                    <span className="flex items-center gap-2.5">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      Secrets
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick("integrations")}
                    className={navItemClass("integrations")}
                  >
                    <span className="flex items-center gap-2.5">
                      <Cpu className="w-3.5 h-3.5 shrink-0" />
                      Integrations
                    </span>
                  </button>
                </nav>
              </div>

              {/* Group 3: Observability */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Observability
                </span>
                <nav className="space-y-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleNavClick("logs")}
                    className={navItemClass("logs")}
                  >
                    <span className="flex items-center gap-2.5">
                      <Terminal className="w-3.5 h-3.5 shrink-0" />
                      Logs
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick("monitoring")}
                    className={navItemClass("monitoring")}
                  >
                    <span className="flex items-center gap-2.5">
                      <Activity className="w-3.5 h-3.5 shrink-0" />
                      Monitoring
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick("analytics")}
                    className={navItemClass("analytics")}
                  >
                    <span className="flex items-center gap-2.5">
                      <BarChart2 className="w-3.5 h-3.5 shrink-0" />
                      Analytics
                    </span>
                  </button>
                </nav>
              </div>

              {/* Group 4: System */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  System
                </span>
                <nav className="space-y-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleNavClick("settings")}
                    className={navItemClass("settings")}
                  >
                    <span className="flex items-center gap-2.5">
                      <Settings className="w-3.5 h-3.5 shrink-0" />
                      Settings
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick("account")}
                    className={navItemClass("account")}
                  >
                    <span className="flex items-center gap-2.5">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      Account
                    </span>
                  </button>
                </nav>
              </div>
            </div>
          </div>

          {/* User Profile Badge at Bottom with Chevron & Popover Menu */}
          <div
            ref={profileMenuRef}
            className="pt-3 border-t border-slate-200/80 dark:border-[#282d37] relative"
          >
            {isProfileMenuOpen && (
              <div className="absolute left-0 right-0 bottom-full mb-2 bg-white/95 dark:bg-[#16191f]/95 backdrop-blur-2xl border border-white/90 dark:border-[#282d37] rounded-2xl shadow-xl shadow-sky-950/15 dark:shadow-black/60 p-2 text-xs space-y-1 z-50 motion-safe:animate-fade-in-up">
                <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-[#282d37]/80">
                  <p className="font-extrabold text-slate-900 dark:text-[#f1f3f5] truncate">
                    {currentUser?.name || "Developer"}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {currentUser?.email || "Personal Developer Workspace"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    handleNavClick("account");
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-[#1e222b] hover:text-blue-600 dark:hover:text-blue-400 font-semibold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    Account Settings
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
              className="w-full flex items-center justify-between p-2 rounded-2xl bg-white/50 dark:bg-[#1e222b]/50 border border-white/80 dark:border-[#282d37]/80 hover:bg-white/80 dark:hover:bg-[#1e222b] transition-all cursor-pointer group text-left"
              title="Workspace & Account Menu"
            >
              <div className="flex items-center gap-2.5 truncate flex-1">
                {currentUser?.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name || "User Avatar"}
                    className="w-8 h-8 rounded-xl object-cover shrink-0 ring-1 ring-blue-500/30"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {(currentUser?.name || currentUser?.email || "HV")
                      .substring(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <div className="truncate text-left leading-tight">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-[#f1f3f5] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {currentUser?.name || "Developer"}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Personal Workspace
                  </p>
                </div>
              </div>

              <div className="p-1 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-transform">
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isProfileMenuOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""}`}
                />
              </div>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
