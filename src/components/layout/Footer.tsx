import React from 'react';
import { Twitter, Disc as Discord } from 'lucide-react';
import { GithubLogo } from '../ui/BrandIcons';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import Logo from '../ui/Logo';
import { useMotionEnvironment } from '../landing/motionSystem';

export default function Footer() {
  const navigate = useNavigate();
  const { isCinematicActive } = useMotionEnvironment();

  return (
    <footer className="relative pt-12 pb-16 overflow-hidden text-slate-700 dark:text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-10">

        {/* Main Footer Glass Card */}
        <div className="relative backdrop-blur-xl bg-white/40 hover:bg-white/50 dark:bg-[#16191f]/80 dark:hover:bg-[#1e222b]/90 border border-white/70 dark:border-[#282d37] rounded-3xl p-8 sm:p-12 shadow-xl shadow-sky-900/5 dark:shadow-black/30 transition-colors duration-300">
          {/* Subtle Continuous Blue Light Snake Tracing the Outer Border */}
          {isCinematicActive && (
            <svg
              aria-hidden="true"
              data-motion-allowed={import.meta.env.DEV ? "true" : undefined}
              className="footer-border-snake pointer-events-none absolute inset-0 w-full h-full overflow-visible rounded-3xl z-20"
            >
              <defs>
                <filter id="footer-snake-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
                </filter>
              </defs>

              {/* Layer 1: Soft Ambient Aura & Fading Tail (12% length) */}
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                rx="24"
                ry="24"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="5.5"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray="12 88"
                opacity="0.45"
                filter="url(#footer-snake-glow)"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-100"
                  dur="6s"
                  repeatCount="indefinite"
                />
              </rect>

              {/* Layer 2: Core Luminous Blue Body (10% length) */}
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                rx="24"
                ry="24"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray="10 90"
                opacity="0.9"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-100"
                  dur="6s"
                  repeatCount="indefinite"
                />
              </rect>

              {/* Layer 3: Brighter Leading Head Highlight (2.5% length) */}
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                rx="24"
                ry="24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray="2.5 97.5"
                opacity="0.95"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-100"
                  dur="6s"
                  repeatCount="indefinite"
                />
              </rect>
            </svg>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-10 border-b border-slate-200/60 dark:border-slate-800 text-left">

            {/* Brand Info */}
            <div className="md:col-span-2 space-y-4">
              <div
                onClick={() => navigate(ROUTES.HOME)}
                className="flex items-center gap-2.5 cursor-pointer group inline-block"
              >
                <Logo />
              </div>
              <p className="text-slate-600 dark:text-slate-300 max-w-sm text-xs leading-relaxed font-medium">
                HAVN is the developer-centric cloud deployment platform designed for autonomous deployments, transparent logs, and intelligent diagnostics.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <a
                  href="https://github.com/Shivrkc/cloudforge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors"
                  aria-label="HAVN on GitHub"
                >
                  <GithubLogo className="w-4 h-4 fill-current" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors"
                  aria-label="HAVN on Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors"
                  aria-label="HAVN Discord Community"
                >
                  <Discord className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <p className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-4 font-mono">
                Product
              </p>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <a href="#features" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    Zero-Config CI/CD
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    Docker Containerization
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    Secret Validation
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    HAVN AI Diagnostics
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources Links */}
            <div>
              <p className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-4 font-mono">
                Resources
              </p>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <a
                    href="https://github.com/Shivrkc/cloudforge"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/Shivrkc/cloudforge"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    Deployment Guides
                  </a>
                </li>
                <li>
                  <a href="#why-choose-us" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    Why Choose HAVN
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    FAQ & Support
                  </a>
                </li>
              </ul>
            </div>

            {/* Platform Trust & Safety */}
            <div>
              <p className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-4 font-mono">
                Platform
              </p>
              <ul className="space-y-2.5 text-xs">
                <li className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Systems Operational</span>
                </li>
                <li>
                  <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    v1.0.0-production
                  </span>
                </li>
              </ul>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <p>© {new Date().getFullYear()} HAVN Cloud Infrastructure. Open source deployment platform.</p>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/Shivrkc/cloudforge/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                License (MIT)
              </a>
              <a
                href="https://github.com/Shivrkc/cloudforge"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Repository
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* Subtle Electric Blue Border Snake Accessibility Styles */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .footer-border-snake:not([data-motion-allowed="true"]) {
            display: none !important;
          }
        }
      `}</style>
    </footer>
  );
}