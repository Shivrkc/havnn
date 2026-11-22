import React from "react";
import { Link } from "react-router-dom";

interface LogoProps {
  showVersion?: boolean;
  className?: string;
  variant?: "default" | "white";
  collapsed?: boolean;
  to?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export default function Logo({
  showVersion = false,
  className = "",
  variant = "default",
  collapsed = false,
  to = "/",
  onClick,
}: LogoProps) {
  const isWhite = variant === "white";

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} group select-none ${className}`}
      aria-label="HAVN Home"
    >
      {/* Cloud Logo */}
      <div
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105 ${
          isWhite
            ? "bg-white/20 border border-white/30 text-white shadow-xs backdrop-blur-md"
            : "bg-[#155DFC]/10 dark:bg-[#155DFC]/20 border border-[#155DFC]/20 dark:border-[#155DFC]/30 shadow-xs backdrop-blur-md"
        }`}
      >
        <svg
          className={`h-6 w-6 ${isWhite ? "text-white" : "text-[#155DFC] dark:text-[#155DFC]"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M18.5 10.5C18.22 7.42 15.63 5 12.5 5C9.74 5 7.4 6.88 6.7 9.45C4.08 9.6 2 11.78 2 14.45C2 17.21 4.24 19.45 7 19.45H18C20.76 19.45 23 17.21 23 14.45C23 12.04 21.3 10.03 18.5 10.5Z" />
        </svg>
      </div>

      {/* Brand Wordmark */}
      <div
        className={`flex flex-col leading-none overflow-hidden transition-all duration-300 ${
          collapsed
            ? "max-w-0 opacity-0 pointer-events-none"
            : "max-w-[140px] opacity-100"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-[28px] font-medium tracking-tight whitespace-nowrap leading-none ${
              isWhite ? "text-white" : "text-slate-900 dark:text-white"
            }`}
          >
            havn
          </span>

          {showVersion && (
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                isWhite
                  ? "border-white/30 bg-white/20 text-white"
                  : "border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80"
              }`}
            >
              v1.0
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}