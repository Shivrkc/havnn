import React, { useRef, useEffect } from 'react';
import {
  HeartHandshake,
  Bot,
  ShieldCheck,
  Terminal,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { motion, MotionValue, MotionStyle, useTransform, useMotionValue, useScroll } from 'motion/react';
import { useMotionEnvironment } from './motionSystem';

interface Differentiator {
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  title: string;
  description: string;
  keyBenefit: string;
}

const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: HeartHandshake,
    tag: 'Accessible DevOps',
    title: 'Beginner-Friendly Experience',
    description: 'Demystifies cloud infrastructure. Translates complex container lifecycles into clear, guided steps with zero obscure exit codes.',
    keyBenefit: 'Step-by-step deployment guidance',
  },
  {
    icon: Bot,
    tag: 'AI Diagnostics',
    title: 'HAVN AI Assistant',
    description: 'Inspects build and runtime stdout/stderr streams in real time. Decodes cryptic exceptions into verified root causes and fixes.',
    keyBenefit: 'Plain-English error explanations',
  },
  {
    icon: ShieldCheck,
    tag: 'Pre-Flight Safety',
    title: 'Secret Schema Validation',
    description: 'Proactively validates required environment variables before containers start, eliminating silent runtime crashes.',
    keyBenefit: 'Zero missing-secret surprises',
  },
  {
    icon: Terminal,
    tag: 'Structured Output',
    title: 'Clear Deployment Logs',
    description: 'Streams structured logs with deterministic sequence numbers, lifecycle markers, and high-contrast status glyphs.',
    keyBenefit: 'Reproducible diagnostic traces',
  },
];

export interface WhyChooseUsMotionProps {
  style?: MotionStyle;
  headerY?: MotionValue<number>;
  headerOpacity?: MotionValue<number>;
  cardsY?: MotionValue<number>;
  cardsOpacity?: MotionValue<number>;
  scrollYProgress?: MotionValue<number>;
  localProgress?: MotionValue<number>;
}

export default function WhyChooseUs({
  style,
  headerY,
  headerOpacity,
  cardsY,
  cardsOpacity,
  scrollYProgress,
  localProgress,
}: WhyChooseUsMotionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { isCinematicActive } = useMotionEnvironment();

  // Local section scroll progress for native document flow:
  // Progress begins as the section enters the lower viewport (start 0.90)
  // and settles into the resting 4-column grid as it centers in the viewport (center 0.60)
  const { scrollYProgress: sectionScrollProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.90', 'center 0.60'],
  });

  // Fallback progress value to guarantee static rendering when outside cinematic stage
  const fallbackProgress = useMotionValue(1);

  // Normalize global scroll to local scene progress [0, 1] if legacy scrollYProgress is passed
  const derivedLocalProgress = useTransform(
    scrollYProgress || fallbackProgress,
    [0.56, 0.76],
    [0, 1],
    { clamp: true }
  );

  const targetProgress = isCinematicActive
    ? (localProgress || (scrollYProgress ? derivedLocalProgress : sectionScrollProgress))
    : fallbackProgress;

  const hasCinematicCards = isCinematicActive;

  // =========================================================================
  // REFINED PHYSICAL CARD DECK CHOREOGRAPHY (Normalized Scene Progress: 0.00 -> 1.00)
  //
  // 1. COMPACT DECK   (0.00 -> 0.28): Cards rise & form a compact, tight physical stack
  //    - Scale ~0.85, minimal vertical spread (-3px to +3px), subtle rotations (-3° to +3°)
  // 2. SUBTLE SHUFFLE (0.28 -> 0.42): "Dealing the deck" - subtle divergence in 4 quadrants
  //    - Close to center (~30px x, ~18px y), signaling the cards are being dealt
  // 3. CONTROLLED FAN (0.42 -> 0.62): Clear 4-directional fan with staggered elevation
  //    - Alternating up/down (±28-30px) ensures titles and body text remain readable
  // 4. CLEAN SPREAD   (0.62 -> 0.88): Smooth glide from fan into column slots (rot->0, scale->1)
  // 5. SETTLE & LOCK  (0.88 -> 1.00): Locked into standard 4-column responsive grid
  // =========================================================================

  // CARD 1: Column 0 (Far Left) | Shuffle -> Upper-Left (-x, -y) | Fan -> Upper-Left
  const card1X = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [410, 410, 410, 375, 210, 0, 0]);
  const card1Y = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [180, -3, -3, -18, -30, 0, 0]);
  const card1Rotate = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [-3.0, -3.0, -3.0, -4.5, -6.0, 0, 0]);
  const card1Scale = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [0.85, 0.86, 0.86, 0.88, 0.94, 1, 1]);
  const card1Opacity = useTransform(targetProgress, [0.00, 0.10, 0.88, 1.00], [0, 1, 1, 1]);

  // CARD 2: Column 1 (Center Left) | Shuffle -> Lower-Left (-x, +y) | Fan -> Lower-Left
  const card2X = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [137, 137, 137, 110, 70, 0, 0]);
  const card2Y = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [180, 3, 3, 18, 28, 0, 0]);
  const card2Rotate = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [1.5, 1.5, 1.5, -2.5, -3.0, 0, 0]);
  const card2Scale = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [0.85, 0.855, 0.855, 0.88, 0.94, 1, 1]);
  const card2Opacity = useTransform(targetProgress, [0.00, 0.10, 0.88, 1.00], [0, 1, 1, 1]);

  // CARD 3: Column 2 (Center Right) | Shuffle -> Upper-Right (+x, -y) | Fan -> Upper-Right
  const card3X = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [-137, -137, -137, -110, -70, 0, 0]);
  const card3Y = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [180, -2, -2, -18, -28, 0, 0]);
  const card3Rotate = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [-1.5, -1.5, -1.5, 2.5, 3.0, 0, 0]);
  const card3Scale = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [0.85, 0.85, 0.85, 0.88, 0.94, 1, 1]);
  const card3Opacity = useTransform(targetProgress, [0.00, 0.10, 0.88, 1.00], [0, 1, 1, 1]);

  // CARD 4: Column 3 (Far Right) | Shuffle -> Lower-Right (+x, +y) | Fan -> Lower-Right
  const card4X = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [-415, -415, -415, -375, -210, 0, 0]);
  const card4Y = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [180, 2, 2, 18, 30, 0, 0]);
  const card4Rotate = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [3.0, 3.0, 3.0, 4.5, 6.0, 0, 0]);
  const card4Scale = useTransform(targetProgress, [0.00, 0.16, 0.28, 0.42, 0.62, 0.88, 1.00], [0.85, 0.845, 0.845, 0.88, 0.94, 1, 1]);
  const card4Opacity = useTransform(targetProgress, [0.00, 0.10, 0.88, 1.00], [0, 1, 1, 1]);

  // High-performance settled glass subscription: only triggers attribute update when crossing 0.88 threshold
  // Zero style recalculations or DOM writes during all active motion frames (0.00 -> 0.879)
  useEffect(() => {
    if (!hasCinematicCards || !sectionRef.current) return;
    let settled = targetProgress.get() >= 0.88;
    sectionRef.current.dataset.whySettled = settled ? 'true' : 'false';

    const unsubscribe = targetProgress.on('change', (v) => {
      const isNowSettled = v >= 0.88;
      if (isNowSettled !== settled) {
        settled = isNowSettled;
        if (sectionRef.current) {
          sectionRef.current.dataset.whySettled = settled ? 'true' : 'false';
        }
      }
    });
    return () => unsubscribe();
  }, [hasCinematicCards, targetProgress]);

  const CARD_Z_CLASSES = ['z-40', 'z-30', 'z-20', 'z-10'];

  const cardTransforms = [
    { x: card1X, y: card1Y, rotate: card1Rotate, scale: card1Scale, opacity: card1Opacity },
    { x: card2X, y: card2Y, rotate: card2Rotate, scale: card2Scale, opacity: card2Opacity },
    { x: card3X, y: card3Y, rotate: card3Rotate, scale: card3Scale, opacity: card3Opacity },
    { x: card4X, y: card4Y, rotate: card4Rotate, scale: card4Scale, opacity: card4Opacity },
  ];

  return (
    <motion.section
      ref={sectionRef}
      id="why-choose-us-section"
      style={style}
      className="py-8 sm:py-12 relative overflow-hidden text-slate-900 dark:text-white selection:bg-blue-600/30"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8 sm:space-y-12">

        {/* Section Heading - Stable Scene Anchor */}
        <motion.div
          style={{ y: headerY, opacity: headerOpacity }}
          className="text-center max-w-2xl mx-auto space-y-4"
        >
          <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/60 dark:bg-[#16191f]/90 border border-slate-200/80 dark:border-[#282d37] rounded-full px-4 py-1 text-xs text-blue-900 dark:text-[#7BBBFF] font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-[#7BBBFF]" />
            <span>The HAVN Differentiator</span>
          </div>

          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            Why Choose HAVN
          </h2>

          <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
            Built for developers who value clarity over configuration complexity.
            Automated deployments paired with actionable diagnostics.
          </p>
        </motion.div>

        {/* 4-Column Grid with Physical Card Deck Choreography */}
        <motion.div
          style={!hasCinematicCards ? { y: cardsY, opacity: cardsOpacity } : undefined}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 relative"
        >
          {DIFFERENTIATORS.map((item, idx) => {
            const Icon = item.icon;
            const motionStyle = hasCinematicCards ? {
              x: cardTransforms[idx].x,
              y: cardTransforms[idx].y,
              rotate: cardTransforms[idx].rotate,
              scale: cardTransforms[idx].scale,
              opacity: cardTransforms[idx].opacity,
              willChange: 'transform',
            } : undefined;

            return (
              <motion.div
                key={item.title}
                data-why-card={idx + 1}
                style={motionStyle}
                className={`${CARD_Z_CLASSES[idx]} ${
                  hasCinematicCards ? 'motion-card-glass' : 'backdrop-blur-xl'
                } bg-white/85 hover:bg-white/95 dark:bg-[#16191f]/92 dark:hover:bg-[#1e222b]/95 border border-white/80 dark:border-[#282d37] hover:border-blue-400/40 dark:hover:border-blue-500/30 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between text-left group cursor-default relative`}
              >
                <div className="space-y-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#1e222b] border border-blue-100 dark:border-[#282d37] flex items-center justify-center text-blue-600 dark:text-[#7BBBFF] group-hover:scale-105 transition-transform duration-300">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div>
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {item.tag}
                    </span>
                    <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3.5 mt-4 border-t border-slate-200/50 dark:border-[#282d37] flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-[#7BBBFF]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px]">{item.keyBenefit}</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

      </div>
    </motion.section>
  );
}
