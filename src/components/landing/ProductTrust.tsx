import React, { useRef, useState, useEffect } from 'react';
import { GraduationCap, Rocket, SearchCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { motion, MotionValue, MotionStyle, useScroll, useTransform, useMotionValue } from 'motion/react';
import { useMotionEnvironment } from './motionSystem';

interface ValuePillar {
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  title: string;
  description: string;
  focusArea: string;
}

const PILLARS: ValuePillar[] = [
  {
    icon: GraduationCap,
    tag: 'Educational & Accessible',
    title: 'For Learners & Students',
    description: 'Deploy fullstack projects without getting trapped in complex IAM policies or obscure YAML manifests. Understand container stages and configuration through direct, hands-on feedback.',
    focusArea: 'Demystified container lifecycles',
  },
  {
    icon: Rocket,
    tag: 'Zero-Friction Shipping',
    title: 'For Independent Builders',
    description: 'Focus on shipping your product instead of maintaining infrastructure pipelines. Push code to your repository, let Havn handle containerization, and receive a secure live URL instantly.',
    focusArea: 'Automated Git-to-Cloud workflows',
  },
  {
    icon: SearchCheck,
    tag: 'Diagnostic Transparency',
    title: 'For Developers Seeking Clarity',
    description: 'Eliminate the frustration of silent runtime crashes and 300-line stack traces. Proactive environment checks and plain-English AI log breakdowns keep you informed at every stage.',
    focusArea: 'Plain-English error diagnosis',
  },
];

export interface ProductTrustMotionProps {
  style?: MotionStyle;
  headerY?: MotionValue<number>;
  headerOpacity?: MotionValue<number>;
  cardsY?: MotionValue<number>;
  cardsOpacity?: MotionValue<number>;
  localProgress?: MotionValue<number>;
}

export default function ProductTrust({
  style,
  headerY,
  headerOpacity,
  cardsY,
  cardsOpacity,
  localProgress,
}: ProductTrustMotionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { isCinematicActive } = useMotionEnvironment();

  // Responsive horizontal split distance
  const [splitDistance, setSplitDistance] = useState(260);

  useEffect(() => {
    const updateSplit = () => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth >= 1280) {
        setSplitDistance(260);
      } else if (window.innerWidth >= 1024) {
        setSplitDistance(220);
      } else if (window.innerWidth >= 768) {
        setSplitDistance(150);
      } else {
        setSplitDistance(0); // Disabled on mobile: clean vertical stacked layout
      }
    };
    updateSplit();
    window.addEventListener('resize', updateSplit);
    return () => window.removeEventListener('resize', updateSplit);
  }, []);

  // Local section scroll progress for native document flow
  const { scrollYProgress: sectionScrollProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.85', 'center 0.50'],
  });

  const fallbackProgress = useMotionValue(1);

  const targetProgress = isCinematicActive
    ? (localProgress || sectionScrollProgress)
    : fallbackProgress;

  const hasSplitMotion = isCinematicActive && splitDistance > 0;

  // =========================================================================
  // CENTER CARD EMERGES, SIDE CARDS SPLIT OUTWARD
  //
  // 0.00 -> 0.20: Grouped State (Middle is dominant in front, sides tucked behind)
  // 0.20 -> 0.75: Main Split (Left moves left, Right moves right, Middle settles)
  // 0.75 -> 1.00: Settling (Locked into stable 3-column horizontal arrangement)
  // =========================================================================

  // LEFT CARD (Pillar 0)
  const leftCardX = useTransform(targetProgress, [0.00, 0.20, 0.75, 1.00], [splitDistance, splitDistance, 0, 0]);
  const leftCardY = useTransform(targetProgress, [0.00, 0.20, 0.75, 1.00], [12, 12, 0, 0]);
  const leftCardScale = useTransform(targetProgress, [0.00, 0.20, 0.75, 1.00], [0.96, 0.96, 1.0, 1.0]);
  const leftCardRotate = useTransform(targetProgress, [0.00, 0.20, 0.65, 0.85, 1.00], [-3.0, -3.0, -1.0, 0, 0]);

  // MIDDLE CARD (Pillar 1) - Visual Anchor
  const midCardY = useTransform(targetProgress, [0.00, 0.20, 0.75, 1.00], [-24, -24, 0, 0]);
  const midCardScale = useTransform(targetProgress, [0.00, 0.20, 0.75, 1.00], [1.02, 1.02, 1.0, 1.0]);

  // RIGHT CARD (Pillar 2)
  const rightCardX = useTransform(targetProgress, [0.00, 0.20, 0.75, 1.00], [-splitDistance, -splitDistance, 0, 0]);
  const rightCardY = useTransform(targetProgress, [0.00, 0.20, 0.75, 1.00], [12, 12, 0, 0]);
  const rightCardScale = useTransform(targetProgress, [0.00, 0.20, 0.75, 1.00], [0.96, 0.96, 1.0, 1.0]);
  const rightCardRotate = useTransform(targetProgress, [0.00, 0.20, 0.65, 0.85, 1.00], [3.0, 3.0, 1.0, 0, 0]);

  // High-performance settled glass subscription: only triggers attribute update when crossing 0.80 threshold
  // Zero style recalculations or DOM writes during all active motion frames (0.00 -> 0.799)
  useEffect(() => {
    if (!hasSplitMotion || !sectionRef.current) return;
    let settled = targetProgress.get() >= 0.80;
    sectionRef.current.dataset.trustSettled = settled ? 'true' : 'false';

    const unsubscribe = targetProgress.on('change', (v) => {
      const isNowSettled = v >= 0.80;
      if (isNowSettled !== settled) {
        settled = isNowSettled;
        if (sectionRef.current) {
          sectionRef.current.dataset.trustSettled = settled ? 'true' : 'false';
        }
      }
    });
    return () => unsubscribe();
  }, [hasSplitMotion, targetProgress]);

  const TRUST_Z_CLASSES = ['z-10', 'z-30', 'z-10'];

  const leftStyle: MotionStyle | undefined = hasSplitMotion ? {
    x: leftCardX,
    y: leftCardY,
    scale: leftCardScale,
    rotate: leftCardRotate,
    willChange: 'transform',
  } : (cardsY ? { y: cardsY } : undefined);

  const midStyle: MotionStyle | undefined = hasSplitMotion ? {
    x: 0,
    y: midCardY,
    scale: midCardScale,
    rotate: 0,
    willChange: 'transform',
  } : (cardsY ? { y: cardsY } : undefined);

  const rightStyle: MotionStyle | undefined = hasSplitMotion ? {
    x: rightCardX,
    y: rightCardY,
    scale: rightCardScale,
    rotate: rightCardRotate,
    willChange: 'transform',
  } : (cardsY ? { y: cardsY } : undefined);

  return (
    <motion.section
      ref={sectionRef}
      id="product-trust"
      style={style}
      className="py-8 sm:py-12 relative z-10 text-slate-900 dark:text-white selection:bg-blue-600/30 overflow-hidden"
    >
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10 relative z-10">

        {/* Section Heading & Subtitle */}
        <motion.div
          style={{ y: headerY, opacity: headerOpacity }}
          className="text-center max-w-2xl mx-auto space-y-4"
        >
          <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/60 dark:bg-[#16191f]/90 border border-slate-200/80 dark:border-[#282d37] rounded-full px-4 py-1 text-xs text-blue-900 dark:text-[#7BBBFF] font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-[#7BBBFF]" />
            <span>Developer-First Philosophy</span>
          </div>

          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            Built for Developers Who Want to Understand Their Deployments
          </h2>

          <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
            Havn bridges the gap between opaque black-box hosting and overwhelming enterprise cloud consoles.
          </p>
        </motion.div>

        {/* 3 Value Cards - Outward Split Reveal */}
        <motion.div
          style={{ opacity: cardsOpacity }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 relative"
        >
          {PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon;
            const motionStyle = idx === 0 ? leftStyle : idx === 1 ? midStyle : rightStyle;
            const cardDataRole = idx === 0 ? "left" : idx === 1 ? "middle" : "right";

            return (
              <motion.div
                key={pillar.title}
                data-trust-card={cardDataRole}
                style={motionStyle}
                className={`${TRUST_Z_CLASSES[idx]} ${
                  hasSplitMotion ? 'motion-card-glass' : 'backdrop-blur-xl'
                } bg-white/60 hover:bg-white/80 dark:bg-[#16191f]/85 dark:hover:bg-[#1e222b]/95 border border-white/80 dark:border-[#282d37] hover:border-blue-400/40 dark:hover:border-blue-500/30 rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between text-left group cursor-default relative`}
              >
                <div className="space-y-3.5 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-50 dark:bg-[#1e222b] border border-blue-100 dark:border-[#282d37] flex items-center justify-center text-blue-600 dark:text-[#7BBBFF] group-hover:scale-105 transition-transform duration-300">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {pillar.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                      {pillar.title}
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                    {pillar.description}
                  </p>
                </div>

                <div className="pt-4 mt-6 border-t border-slate-200/50 dark:border-[#282d37] flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{pillar.focusArea}</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

      </div>
    </motion.section>
  );
}
