import { Link } from "react-router-dom";

interface LogoProps {
  showVersion?: boolean;
  className?: string;
}

export default function Logo({
  showVersion = false,
  className = "",
}: LogoProps) {
  return (
    <Link
      to="/"
      className={`flex items-center gap-3 group ${className}`}
      aria-label="HAVN Home"
    >
      {/* Cloud Logo */}
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 dark:bg-white/20 border border-blue-600/20 dark:border-white/30 shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.15)] backdrop-blur-md transition-all duration-300 group-hover:scale-105">
        <svg
          className="h-6 w-6 text-blue-600 dark:text-white"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M18.5 10.5C18.22 7.42 15.63 5 12.5 5C9.74 5 7.4 6.88 6.7 9.45C4.08 9.6 2 11.78 2 14.45C2 17.21 4.24 19.45 7 19.45H18C20.76 19.45 23 17.21 23 14.45C23 12.04 21.3 10.03 18.5 10.5Z" />
        </svg>
      </div>

      {/* Brand */}
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-2">
          <span className="text-[28px] font-medium tracking-tight text-slate-900 dark:text-white">
            havn
          </span>

          {showVersion && (
            <span className="rounded-md border border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-white/80">
              v1.0
            </span>
          )}
        </div>

        <span className="mt-1 text-xs tracking-wide text-white/50">
          
        </span>
      </div>
    </Link>
  );
}