import React, { useRef, useState, useEffect } from 'react';
import {
  GitBranch,
  Bot,
  Terminal,
  KeyRound,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { GithubLogo, DockerLogo } from '../ui/BrandIcons';
import { motion, MotionValue, MotionStyle, useScroll, useTransform, useMotionValue } from 'motion/react';
import { useMotionEnvironment } from './motionSystem';

export interface FeaturesMotionProps {
  style?: MotionStyle;
  headerY?: MotionValue<number>;
  headerOpacity?: MotionValue<number>;
  cardRow1Y?: MotionValue<number>;
  cardRow2Y?: MotionValue<number>;
  cardsOpacity?: MotionValue<number>;
  localProgress?: MotionValue<number>;
}

export default function Features({
  style,
  headerY,
  headerOpacity,
  cardRow1Y,
  cardRow2Y,
  cardsOpacity,
  localProgress,
}: FeaturesMotionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { isCinematicActive } = useMotionEnvironment();

  // Responsive scale factor for card-deck travel distance
  // Desktop (>=1024px): 1.0 | Tablet (768px-1023px): 0.58 | Mobile (<768px): 0 (normal flow)
  const [motionScale, setMotionScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth >= 1024) {
        setMotionScale(1.0);
      } else if (window.innerWidth >= 768) {
        setMotionScale(0.58);
      } else {
        setMotionScale(0);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Local section scroll progress for native document flow:
  // Starts when section top enters lower viewport (start 0.88)
  // Settles into 2x2 grid as section centers in viewport (center 0.50)
  const { scrollYProgress: sectionScrollProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.88', 'center 0.50'],
  });

  const fallbackProgress = useMotionValue(1);

  const targetProgress = isCinematicActive
    ? (localProgress || sectionScrollProgress)
    : fallbackProgress;

  const hasDeckMotion = isCinematicActive && motionScale > 0;

  // =========================================================================
  // REFINED 4-CARD PHYSICAL DECK CHOREOGRAPHY (Normalized Scene Progress: 0.00 -> 1.00)
  //
  // 1. COMPACT DECK   (0.00 -> 0.22): Cards form a compact, tight physical stack near center
  //    - Dominant front card (z:40), partial overlap, subtle rotations (-2.5° to +2.0°)
  // 2. SHORT SHUFFLE  (0.22 -> 0.36): Subtle physical shuffle ("dealing the deck")
  //    - Small twitch offsets, tiny rotation changes, slight depth movement
  // 3. CONTROLLED FAN (0.36 -> 0.58): Clear 4-directional fan toward 2x2 quadrants
  // 4. CLEAN SPREAD   (0.58 -> 0.84): Smooth glide into 2x2 grid slots (rot->0, scale->1)
  // 5. SETTLE & LOCK  (0.84 -> 1.00): Locked into original 2x2 bento grid
  // =========================================================================

  // CARD 1: Row 1, Col 1 (Top-Left 7-col) | Dominant Front Card (z: 40)
  const c1X = 253 * motionScale;
  const c1Y = 182.5 * motionScale;
  const card1X = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [c1X, c1X, c1X, c1X * 0.94, c1X * 0.59, 0, 0]);
  const card1Y = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [c1Y, c1Y, c1Y, c1Y * 0.92, c1Y * 0.58, 0, 0]);
  const card1Rot = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [-2.5, -2.5, -2.5, -3.5, -2.0, 0, 0]);
  const card1Scale = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [0.88, 0.88, 0.88, 0.89, 0.93, 1, 1]);
  const card1Opacity = useTransform(targetProgress, [0.00, 0.08, 0.84, 1.00], [0, 1, 1, 1]);

  // CARD 2: Row 1, Col 2 (Top-Right 5-col) | Upper-Mid Card (z: 30)
  const c2X = -358.5 * motionScale;
  const c2Y = 188.5 * motionScale;
  const card2X = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [c2X, c2X, c2X, c2X * 0.95, c2X * 0.57, 0, 0]);
  const card2Y = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [c2Y, c2Y, c2Y, c2Y * 0.92, c2Y * 0.56, 0, 0]);
  const card2Rot = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [1.8, 1.8, 1.8, 2.8, 1.5, 0, 0]);
  const card2Scale = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [0.87, 0.87, 0.87, 0.88, 0.93, 1, 1]);
  const card2Opacity = useTransform(targetProgress, [0.00, 0.08, 0.84, 1.00], [0, 1, 1, 1]);

  // CARD 3: Row 2, Col 1 (Bottom-Left 5-col) | Lower-Mid Card (z: 20)
  const c3X = 358.5 * motionScale;
  const c3Y = -186.5 * motionScale;
  const card3X = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [c3X, c3X, c3X, c3X * 0.95, c3X * 0.57, 0, 0]);
  const card3Y = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [c3Y, c3Y, c3Y, c3Y * 0.92, c3Y * 0.56, 0, 0]);
  const card3Rot = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [-1.5, -1.5, -1.5, -2.2, -1.0, 0, 0]);
  const card3Scale = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [0.86, 0.86, 0.86, 0.87, 0.93, 1, 1]);
  const card3Opacity = useTransform(targetProgress, [0.00, 0.08, 0.84, 1.00], [0, 1, 1, 1]);

  // CARD 4: Row 2, Col 2 (Bottom-Right 7-col) | Base Card (z: 10)
  const c4X = -253 * motionScale;
  const c4Y = -182.5 * motionScale;
  const card4X = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [c4X, c4X, c4X, c4X * 0.94, c4X * 0.59, 0, 0]);
  const card4Y = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [c4Y, c4Y, c4Y, c4Y * 0.92, c4Y * 0.58, 0, 0]);
  const card4Rot = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [2.0, 2.0, 2.0, 3.0, 1.5, 0, 0]);
  const card4Scale = useTransform(targetProgress, [0.00, 0.12, 0.22, 0.36, 0.58, 0.84, 1.00], [0.85, 0.85, 0.85, 0.86, 0.93, 1, 1]);
  const card4Opacity = useTransform(targetProgress, [0.00, 0.08, 0.84, 1.00], [0, 1, 1, 1]);

  // High-performance settled glass subscription: only triggers attribute update when crossing 0.84 threshold
  // Zero style recalculations or DOM writes during all active motion frames (0.00 -> 0.839)
  useEffect(() => {
    if (!hasDeckMotion || !sectionRef.current) return;
    let settled = targetProgress.get() >= 0.84;
    sectionRef.current.dataset.deckSettled = settled ? 'true' : 'false';

    const unsubscribe = targetProgress.on('change', (v) => {
      const isNowSettled = v >= 0.84;
      if (isNowSettled !== settled) {
        settled = isNowSettled;
        if (sectionRef.current) {
          sectionRef.current.dataset.deckSettled = settled ? 'true' : 'false';
        }
      }
    });
    return () => unsubscribe();
  }, [hasDeckMotion, targetProgress]);

  const card1Style: MotionStyle | undefined = hasDeckMotion ? {
    x: card1X,
    y: card1Y,
    rotate: card1Rot,
    scale: card1Scale,
    opacity: card1Opacity,
    willChange: 'transform',
  } : (cardRow1Y ? { y: cardRow1Y } : undefined);

  const card2Style: MotionStyle | undefined = hasDeckMotion ? {
    x: card2X,
    y: card2Y,
    rotate: card2Rot,
    scale: card2Scale,
    opacity: card2Opacity,
    willChange: 'transform',
  } : (cardRow1Y ? { y: cardRow1Y } : undefined);

  const card3Style: MotionStyle | undefined = hasDeckMotion ? {
    x: card3X,
    y: card3Y,
    rotate: card3Rot,
    scale: card3Scale,
    opacity: card3Opacity,
    willChange: 'transform',
  } : (cardRow2Y ? { y: cardRow2Y } : undefined);

  const card4Style: MotionStyle | undefined = hasDeckMotion ? {
    x: card4X,
    y: card4Y,
    rotate: card4Rot,
    scale: card4Scale,
    opacity: card4Opacity,
    willChange: 'transform',
  } : (cardRow2Y ? { y: cardRow2Y } : undefined);


  return (
    <motion.section
      ref={sectionRef}
      id="features-section"
      style={style}
      className="py-6 sm:py-10 lg:py-8 relative overflow-hidden text-slate-900 dark:text-white selection:bg-blue-600/30"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6 sm:space-y-8">

        {/* Section Heading & Description */}
        <motion.div
          style={{ y: headerY, opacity: headerOpacity }}
          className="text-center max-w-2xl mx-auto space-y-4"
        >
          <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/60 dark:bg-[#16191f]/90 border border-slate-200/80 dark:border-[#282d37] rounded-full px-4 py-1 text-xs text-blue-900 dark:text-[#7BBBFF] font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-[#7BBBFF]" />
            <span>Platform Capabilities</span>
          </div>

          <h2 className="font-display text-3xl sm:text-5xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            Everything You Need to Deploy Better
          </h2>

          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg leading-relaxed">
            Designed for modern development workflows. High-performance infrastructure without the ops complexity.
          </p>
        </motion.div>

        {/* Asymmetric 2x2 Bento Grid with Circular Orbit Choreography */}
        <motion.div
          style={{ opacity: cardsOpacity }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 relative"
        >

          {/* ROW 1 - CARD 1: Wide Feature (7 Cols) - GitHub & Automated CI/CD */}
          <motion.div
            data-feature-card="1"
            style={card1Style}
            className={`lg:col-span-7 z-40 ${
              hasDeckMotion ? 'motion-card-glass' : 'backdrop-blur-xl'
            } bg-white/60 hover:bg-white/80 dark:bg-[#16191f]/85 dark:hover:bg-[#1e222b]/95 border border-white/80 dark:border-[#282d37] hover:border-blue-400/40 dark:hover:border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-lg shadow-sky-900/5 dark:shadow-black/30 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group text-left cursor-default relative`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 dark:bg-[#1e222b] border border-slate-200/80 dark:border-[#282d37] flex items-center justify-center text-slate-800 dark:text-white group-hover:scale-105 transition-transform duration-300">
                  <GithubLogo className="w-5 h-5 fill-current" />
                </div>
                <span className="text-[11px] font-mono font-bold text-blue-800 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/60 px-3 py-1 rounded-full">
                  Automated CI/CD
                </span>
              </div>

              <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3">
                GitHub Integration & Zero-Config Pipelines
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5 max-w-xl">
                Connect your repositories with one click. Havn listens for webhook events, automatically detects your framework, triggers containerized builds, and rolls out edge-routed deployments.
              </p>
            </div>

            {/* Embedded Visual: GitHub Pipeline Mockup */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-100/80 dark:bg-[#0d0f12] border border-slate-200/80 dark:border-[#282d37] font-mono text-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-[#282d37] text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                  branch: main
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Deploy Enabled
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 text-[11px]">
                <span className="truncate">Commit #8f32a0c · feat: setup cloud infrastructure</span>
                <span className="text-slate-400 shrink-0 ml-2">Just now</span>
              </div>
            </div>
          </motion.div>

          {/* ROW 1 - CARD 2: Narrow Feature (5 Cols) - Docker Container Builder */}
          <motion.div
            data-feature-card="2"
            style={card2Style}
            className={`lg:col-span-5 z-30 ${
              hasDeckMotion ? 'motion-card-glass' : 'backdrop-blur-xl'
            } bg-white/60 hover:bg-white/80 dark:bg-[#16191f]/85 dark:hover:bg-[#1e222b]/95 border border-white/80 dark:border-[#282d37] hover:border-blue-400/40 dark:hover:border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-lg shadow-sky-900/5 dark:shadow-black/30 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group text-left cursor-default relative`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-sky-50 dark:bg-[#1e222b] border border-sky-100 dark:border-[#282d37] flex items-center justify-center text-[#2496ED] group-hover:scale-105 transition-transform duration-300">
                  <DockerLogo className="w-5.5 h-5.5 fill-current" />
                </div>
                <span className="text-[11px] font-mono font-bold text-sky-800 dark:text-sky-300 bg-sky-50/80 dark:bg-sky-950/60 border border-sky-200/70 dark:border-sky-800/60 px-3 py-1 rounded-full">
                  Micro-VMs
                </span>
              </div>

              <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3">
                Docker Container Builder
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
                Isolated container builds with multi-stage layer caching for fast cold starts and reproducible runtime environments.
              </p>
            </div>

            {/* Embedded Visual: Docker Stage Metrics */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-100/80 dark:bg-[#0d0f12] border border-slate-200/80 dark:border-[#282d37] font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 dark:text-slate-400">Layer Cache</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">92% Hit Rate</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-[#1e222b] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[92%]" />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                Optimized OCI runtime with zero daemon overhead
              </p>
            </div>
          </motion.div>

          {/* ROW 2 - CARD 3: Narrow Feature (5 Cols) - Environment Variable Validation */}
          <motion.div
            data-feature-card="3"
            style={card3Style}
            className={`lg:col-span-5 z-20 ${
              hasDeckMotion ? 'motion-card-glass' : 'backdrop-blur-xl'
            } bg-white/60 hover:bg-white/80 dark:bg-[#16191f]/85 dark:hover:bg-[#1e222b]/95 border border-white/80 dark:border-[#282d37] hover:border-blue-400/40 dark:hover:border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-lg shadow-sky-900/5 dark:shadow-black/30 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group text-left cursor-default relative`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-50 dark:bg-[#1e222b] border border-amber-100 dark:border-[#282d37] flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform duration-300">
                  <KeyRound className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/60 px-3 py-1 rounded-full">
                  Pre-Flight Safety
                </span>
              </div>

              <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3">
                Environment Variable Validation
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
                Prevent 500 runtime crashes before deployment. Pre-flight schema inspection verifies that all required secrets and configuration keys are securely set.
              </p>
            </div>

            {/* Embedded Visual: Secret Schema Check */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-100/80 dark:bg-[#0d0f12] border border-slate-200/80 dark:border-[#282d37] font-mono text-[11px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300">DATABASE_URL</span>
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Valid
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300">JWT_SECRET</span>
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Valid
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300">PORT</span>
                <span className="text-slate-400 font-mono">3000 (Default)</span>
              </div>
            </div>
          </motion.div>

          {/* ROW 2 - CARD 4: Wide Feature (7 Cols) - Deployment Logs & HAVN AI */}
          <motion.div
            data-feature-card="4"
            style={card4Style}
            className={`lg:col-span-7 z-10 ${
              hasDeckMotion ? 'motion-card-glass' : 'backdrop-blur-xl'
            } bg-white/60 hover:bg-white/80 dark:bg-[#16191f]/85 dark:hover:bg-[#1e222b]/95 border border-white/80 dark:border-[#282d37] hover:border-blue-400/40 dark:hover:border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-lg shadow-sky-900/5 dark:shadow-black/30 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group text-left cursor-default relative`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-50 dark:bg-[#1e222b] border border-indigo-100 dark:border-[#282d37] flex items-center justify-center text-indigo-600 dark:text-[#B8A9FF] group-hover:scale-105 transition-transform duration-300">
                  <Terminal className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-bold text-indigo-800 dark:text-[#B8A9FF] bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 px-3 py-1 rounded-full">
                  AI Diagnostics
                </span>
              </div>

              <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3">
                Deployment Logs & HAVN AI Assistant
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5 max-w-xl">
                Stream real-time build and execution logs with sequence numbers and status glyphs. When errors occur, HAVN AI decodes raw stderr stack traces into plain English explanations and actionable fixes.
              </p>
            </div>

            {/* Embedded Visual: Split Terminal & AI Remedy */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-100/80 dark:bg-[#0d0f12] border border-slate-200/80 dark:border-[#282d37] font-mono text-[11px] space-y-2">
              <div className="flex items-center gap-2 text-slate-400 pb-1 border-b border-slate-200/60 dark:border-[#282d37]">
                <Bot className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">Live AI Assistant Stream</span>
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                012 // [stdout] Container entrypoint initialized
              </div>
              <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                013 // [status] Health checks responding on :3000 (HTTP 200 OK)
              </div>
            </div>
          </motion.div>

        </motion.div>

      </div>
    </motion.section>
  );
}