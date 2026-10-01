import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Server,
  GitBranch,
  Bot,
  ExternalLink
} from 'lucide-react';
import { motion, MotionValue, MotionStyle } from 'motion/react';
import { ROUTES } from '../../constants/routes';
import HavnClouds from './HavnClouds';

export interface HeroMotionProps {
  style?: MotionStyle;
  bgY?: MotionValue<number>;
  textY?: MotionValue<number>;
  textOpacity?: MotionValue<number>;
  showcaseY?: MotionValue<number>;
  showcaseOpacity?: MotionValue<number>;
}

export default function Hero({
  style,
  bgY,
  textY,
  textOpacity,
  showcaseY,
  showcaseOpacity,
}: HeroMotionProps) {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement | null>(null);

  return (
    <motion.section
      ref={heroRef}
      style={style}
      className="relative w-full overflow-hidden pt-32 sm:pt-36 lg:pt-32 pb-16 flex flex-col items-center justify-center selection:bg-blue-600/30"
    >
      {/* Animated 3D Vanta Clouds Background with Parallax Depth */}
      <motion.div
        style={bgY ? { y: bgY } : undefined}
        className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
      >
        <HavnClouds className="w-full h-full" />
      </motion.div>

      {/* Hero Outer Content Container */}
      <div className="relative z-10 max-w-7xl w-full px-4 sm:px-6 lg:px-8 mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">

          {/* LEFT COLUMN: Eyebrow + Large H1 + Description + Dual CTAs */}
          <motion.div
            style={{
              y: textY,
              opacity: textOpacity,
            }}
            className="lg:col-span-6 flex flex-col items-start text-left relative"
          >
            {/* Localized atmospheric vignette behind left copy for contrast over bright clouds */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-8 sm:-left-12 top-[28%] -bottom-8 w-[120%] sm:w-[130%] max-w-xl rounded-full bg-[radial-gradient(ellipse_at_40%_50%,rgba(248,250,252,0.85)_0%,rgba(248,250,252,0.45)_50%,transparent_80%)] dark:bg-[radial-gradient(ellipse_at_40%_50%,rgba(13,15,18,0.82)_0%,rgba(13,15,18,0.48)_50%,transparent_80%)] blur-2xl -z-10"
            />

            {/* Step 1: Eyebrow / Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md bg-white/60 dark:bg-[#16191f]/80 border border-slate-200/80 dark:border-[#282d37] shadow-xs mb-5">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tracking-wide font-mono">
                Next-Gen Cloud Deployment
              </span>
            </div>

            {/* Step 2: Dominant Primary Headline (Clash Display Style) */}
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.06] mb-5 max-w-xl">
              From Code <br />
              <span className="text-blue-600 dark:text-[#7BBBFF]">
                to Cloud.
              </span>
            </h1>

            {/* Step 3: Readable Supporting Description with enhanced contrast & subtle shadow */}
            <p className="max-w-lg text-sm sm:text-base lg:text-lg text-slate-700 dark:text-[#f0f4f8] font-normal leading-relaxed mb-7 [text-shadow:0_1px_2px_rgba(255,255,255,0.4)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.85),0_0_16px_rgba(13,15,18,0.9)]">
              Deploy, scale, and manage automated container environments directly from your repositories.
              Engineered with pre-flight secret validation, transparent build logs, and intelligent AI diagnostics.
            </p>

            {/* Step 4: CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
              <button
                onClick={() => navigate(ROUTES.SIGNUP)}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 group cursor-pointer active:scale-95"
              >
                Start Deploying Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => {
                  const targetSection = document.getElementById('why-choose-us');
                  if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    navigate(ROUTES.HOME);
                  }
                }}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl backdrop-blur-md bg-white/60 hover:bg-white/80 dark:bg-[#16191f]/80 dark:hover:bg-[#1e222b] text-slate-800 dark:text-slate-200 font-semibold border border-slate-200/80 dark:border-[#282d37] shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Why Choose HAVN
              </button>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: High-Fidelity Havn Product & Deployment Stage */}
          <motion.div
            style={{
              y: showcaseY,
              opacity: showcaseOpacity,
            }}
            className="lg:col-span-6 w-full flex justify-center lg:justify-end"
          >
            <div className="w-full max-w-lg backdrop-blur-2xl bg-white/70 dark:bg-[#16191f]/90 border border-white/80 dark:border-[#282d37] rounded-2xl p-5 sm:p-6 shadow-2xl shadow-sky-900/10 dark:shadow-black/50 text-left transition-shadow duration-300">

              {/* Window Header */}
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200/70 dark:border-[#282d37]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                    havn.app // deployment
                  </span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#1e222b] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#282d37] text-[11px] font-mono">
                  <GitBranch className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  <span>main</span>
                </div>
              </div>

              {/* Pipeline Status Summary */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/70 dark:bg-[#12151a] border border-slate-200/60 dark:border-[#282d37] mb-4">
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white leading-none">
                      Production Pipeline
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                      Commit #8f32a0c · Region us-east
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">1.42s</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    Live
                  </span>
                </div>
              </div>

              {/* Terminal Log Stream Simulation */}
              <div className="bg-[#0d0f12] text-slate-300 font-mono text-[11px] p-3.5 rounded-xl border border-[#282d37] space-y-1.5 shadow-inner mb-4 overflow-x-auto">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-blue-400">→</span>
                  <span>[git] Pulling ref main (commit #8f32a0c)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span>
                  <span>[docker] Multi-stage build layer cached</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span>
                  <span>[env] 8 environment secrets verified</span>
                </div>
                <div className="flex items-center gap-2 text-sky-300">
                  <span className="text-blue-400">⚡</span>
                  <span>[edge] Routing provisioned with automatic SSL</span>
                </div>
              </div>

              {/* HAVN AI Callout Box */}
              <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/40 flex items-start gap-2.5 mb-4">
                <div className="p-1 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-blue-950 dark:text-blue-200">
                    HAVN AI Diagnostics
                  </p>
                  <p className="text-[11px] text-blue-900/80 dark:text-blue-300/80 mt-0.5 leading-snug">
                    Zero build exceptions detected. Pre-flight schema validated and edge proxy active.
                  </p>
                </div>
              </div>

              {/* Live Deployment Link Banner */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100/60 dark:bg-[#1e222b] border border-slate-200/60 dark:border-[#282d37] text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-mono text-[11px] truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">https://app-prod.havn.cloud</span>
                </div>
                <a
                  href="#features"
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2"
                >
                  <span>Preview</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

            </div>
          </motion.div>

        </div>
      </div>
    </motion.section>
  );
}