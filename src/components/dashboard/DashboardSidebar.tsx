import React, { useState, useRef, useEffect } from "react";
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

interface NavItemDef {
  tab: DashboardNavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroupDef {
  title: string;
  items: NavItemDef[];
}

const PRIMARY_ITEM: NavItemDef = {
  tab: "overview",
  label: "Overview",
  icon: Home,
};

const NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Deploy",
    items: [
      { tab: "deployments", label: "Deployments", icon: Layers },
      { tab: "projects", label: "Projects", icon: Folder },
      { tab: "databases", label: "Databases", icon: Database },
      { tab: "domains", label: "Domains", icon: Globe },
    ],
  },
  {
    title: "Configuration",
    items: [
      { tab: "env-vars", label: "Environment Variables", icon: Key },
      { tab: "secrets", label: "Secrets", icon: Lock },
      { tab: "integrations", label: "Integrations", icon: Cpu },
    ],
  },
  {
    title: "Observability",
    items: [
      { tab: "logs", label: "Logs", icon: Terminal },
      { tab: "monitoring", label: "Monitoring", icon: Activity },
      { tab: "analytics", label: "Analytics", icon: BarChart2 },
    ],
  },
  {
    title: "System",
    items: [
      { tab: "settings", label: "Settings", icon: Settings },
      { tab: "account", label: "Account", icon: User },
    ],
  },
];

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  onOpenLatestLogs,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocusedWithin, setIsFocusedWithin] = useState<boolean>(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const isExpandedDesktop = isHovered || isFocusedWithin;
  const isExpandedEffective = isOpenMobile || isExpandedDesktop;

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

  // Prevent background scrolling while mobile navigation drawer is open
  useEffect(() => {
    if (!isOpenMobile) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpenMobile]);

  // Global Escape key listener to dismiss mobile navigation drawer
  useEffect(() => {
    if (!isOpenMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseMobile?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpenMobile, onCloseMobile]);

  const handleNavClick = (tab: DashboardNavTab) => {
    setActiveTab(tab);
    // Blur any active element so mouse clicks never leave persistent focus locking expansion
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsFocusedWithin(false);
    if (onCloseMobile) onCloseMobile();
  };

  const renderNavItem = (item: NavItemDef) => {
    const isActive = activeTab === item.tab;
    const Icon = item.icon;

    return (
      <button
        key={item.tab}
        type="button"
        onClick={() => handleNavClick(item.tab)}
        title={item.label}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        className={`relative group flex items-center h-10 rounded-xl transition-all duration-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 ${
          isActive
            ? "focus-visible:ring-[#155DFC]/40 dark:focus-visible:ring-[#C49A5A]/50"
            : "focus-visible:ring-[#155DFC]/40"
        } ${
          isExpandedEffective
            ? "w-full px-3 justify-start gap-3"
            : "w-10 h-10 mx-auto justify-center"
        } ${
          isActive
            ? "bg-[#155DFC]/10 dark:bg-[#C49A5A]/[0.12] text-[#155DFC] dark:text-[#D6B46A] font-semibold border border-[#155DFC]/25 dark:border-[#C49A5A]/[0.35] dark:hover:bg-[#C49A5A]/[0.18] dark:hover:border-[#C49A5A]/[0.45] shadow-xs backdrop-blur-xs"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-white/[0.06] hover:border-white/50 border border-transparent"
        }`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
            isActive
              ? "text-[#155DFC] dark:text-[#D6B46A]"
              : "text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
          }`}
        />

        <span
          className={`text-xs whitespace-nowrap transition-all duration-200 overflow-hidden text-left ${
            isExpandedEffective
              ? "opacity-100 max-w-[160px]"
              : "opacity-0 max-w-0 pointer-events-none"
          } ${
            isActive
              ? "text-[#155DFC] dark:text-[#D6B46A] font-semibold"
              : "text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 font-medium"
          }`}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Floating Inset Navigation Rail Sidebar - Liquid Glass Treatment */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsFocusedWithin(false);
          setIsProfileMenuOpen(false);
        }}
        onFocusCapture={(e) => {
          if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) {
            setIsFocusedWithin(true);
          }
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsFocusedWithin(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setIsFocusedWithin(false);
            setIsHovered(false);
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
          }
        }}
        className={`fixed top-4 bottom-4 left-3 sm:top-6 sm:bottom-6 sm:left-4 lg:top-8 lg:bottom-8 z-50 flex flex-col justify-between backdrop-blur-2xl backdrop-saturate-125 bg-white/70 dark:bg-[#07080B]/75 border border-white/70 dark:border-white/[0.09] text-slate-800 dark:text-slate-100 rounded-3xl sm:rounded-[28px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),inset_0_0_0_1px_rgba(255,255,255,0.35),0_16px_40px_-6px_rgba(15,23,42,0.08),0_4px_12px_-2px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),inset_0_0_0_1px_rgba(255,255,255,0.03),0_16px_48px_0_rgba(0,0,0,0.7)] transition-[width,transform,opacity,visibility,box-shadow] duration-300 ease-in-out ${
          isOpenMobile
            ? "translate-x-0 w-64 max-w-[calc(100vw-2rem)] shadow-2xl opacity-100 visible"
            : "-translate-x-[calc(100%+2rem)] w-64 max-lg:opacity-0 max-lg:pointer-events-none max-lg:invisible lg:translate-x-0 lg:opacity-100 lg:visible"
        } ${
          isExpandedDesktop
            ? "lg:w-64 lg:shadow-2xl lg:shadow-slate-900/12 dark:lg:shadow-black/70"
            : "lg:w-[72px]"
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Subtle Liquid Top Edge Specular Highlight */}
        <span
          className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none opacity-90 dark:opacity-100 transition-opacity"
          aria-hidden="true"
        />
        <div className="h-full flex flex-col justify-between p-3.5 overflow-hidden">
          {/* Header & Logo */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pt-1">
              <div className="flex-1 overflow-hidden">
                <Logo
                  variant="default"
                  collapsed={!isExpandedEffective}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick("overview");
                  }}
                  className={`transition-all duration-300 ${
                    isExpandedEffective ? "px-1 justify-start" : "justify-center"
                  }`}
                />
              </div>

              {/* Mobile Close Button */}
              {onCloseMobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#155DFC]/40 shrink-0 ml-1"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Standalone Primary Overview Navigation */}
            <div className="pt-1">{renderNavItem(PRIMARY_ITEM)}</div>
          </div>

          {/* Navigation Groups (Scrollable) */}
          <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-3">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="space-y-1">
                {isExpandedEffective ? (
                  <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
                    {group.title}
                  </div>
                ) : (
                  <div
                    className="w-7 h-px mx-auto my-1.5 bg-transparent"
                    aria-hidden="true"
                  />
                )}
                <nav className="space-y-1">
                  {group.items.map((item) => renderNavItem(item))}
                </nav>
              </div>
            ))}
          </div>

          {/* User Profile Badge at Bottom with Popover Menu */}
          <div
            ref={profileMenuRef}
            className="pt-3 border-t border-slate-200/80 dark:border-white/[0.08] relative shrink-0"
          >
            {isProfileMenuOpen && (
              <div className="absolute left-0 right-0 bottom-full mb-2 bg-white/85 dark:bg-[#07080B]/95 border border-white/80 dark:border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),0_16px_40px_0_rgba(15,23,42,0.12)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_16px_48px_0_rgba(0,0,0,0.85)] rounded-2xl p-1.5 text-xs space-y-1 z-50 backdrop-blur-2xl motion-safe:animate-fade-in-up">
                <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {currentUser?.name || "Developer"}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser?.email || "Personal Developer Workspace"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    handleNavClick("account");
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-slate-100 font-medium flex items-center justify-between transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#155DFC]/40"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
                    Account Settings
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-medium flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-400"
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
              className={`w-full flex items-center rounded-xl bg-white/40 dark:bg-white/[0.03] border border-white/50 dark:border-white/[0.08] hover:bg-white/60 dark:hover:bg-white/[0.06] hover:border-white/70 dark:hover:border-white/[0.12] transition-all cursor-pointer group text-left shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#155DFC]/40 ${
                isExpandedEffective
                  ? "p-2 justify-between gap-2.5"
                  : "w-10 h-10 mx-auto justify-center p-0"
              }`}
              title="Workspace & Account Menu"
              aria-label="Workspace & Account Menu"
            >
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name || "User Avatar"}
                  className="w-7 h-7 rounded-lg object-cover shrink-0 ring-1 ring-slate-200 dark:ring-white/20"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-[#155DFC]/10 dark:bg-[#155DFC]/20 text-[#155DFC] dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 border border-[#155DFC]/20 dark:border-[#155DFC]/30 shadow-2xs">
                  {(currentUser?.name || currentUser?.email || "HV")
                    .substring(0, 2)
                    .toUpperCase()}
                </div>
              )}

              {isExpandedEffective && (
                <>
                  <div className="truncate text-left leading-tight flex-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-[#155DFC] dark:group-hover:text-blue-400 transition-colors">
                      {currentUser?.name || "Developer"}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      Personal Workspace
                    </p>
                  </div>

                  <div className="p-0.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-transform">
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isProfileMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
