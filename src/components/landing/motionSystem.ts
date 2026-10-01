import { useState, useEffect } from 'react';
import { Transition, MotionValue, useTransform, useReducedMotion } from 'motion/react';

/**
 * Premium quintic-style deceleration curve.
 * Calibrated for calm, technical, high-end motion with zero bouncy overshoot.
 */
export const EASE_PREMIUM: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Standard transition configurations across the landing page motion system.
 */
export const TRANSITION_FAST: Transition = {
  duration: 0.45,
  ease: EASE_PREMIUM,
};

export const TRANSITION_NORMAL: Transition = {
  duration: 0.65,
  ease: EASE_PREMIUM,
};

export const TRANSITION_SLOW: Transition = {
  duration: 0.85,
  ease: EASE_PREMIUM,
};

/**
 * Viewport trigger configuration for subtle supporting reveals in natural flow.
 */
export const VIEWPORT_ONCE = {
  once: true,
  amount: 0.15,
};

export const VIEWPORT_SECTION = {
  once: true,
  amount: 0.1,
};

/**
 * Master Scene Timeline Intervals across the unified cinematic landing sequence.
 * Range: [0.00, 1.00] corresponding to master scroll container progress.
 */
export const SCENE_INTERVALS = {
  // Scene 1: Hero (Code to Cloud)
  HERO: {
    enter: 0.00,
    hold: 0.15,
    exit: 0.30,
  },
  // Scene 2: TechStrip (Supported DevOps Stacks Marquee)
  TECH_STRIP: {
    enter: 0.13,
    focus: 0.24,
    exit: 0.48,
  },
  // Scene 3: Features (Platform Capabilities Bento Grid)
  FEATURES: {
    enter: 0.34,
    focus: 0.46,
    exit: 0.78,
  },
  // Scene 4: WhyChooseUs & ProductTrust (Developer-First Philosophy)
  TRUST: {
    enter: 0.62,
    focus: 0.76,
    exit: 0.96,
  },
} as const;

/**
 * Hook to detect responsive desktop breakpoint and motion preferences.
 */
export function useMotionEnvironment() {
  const prefersReduced = useReducedMotion() ?? false;
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // In development, desktop animations run by default without requiring ?motion=on.
  // In production, user accessibility preference (prefers-reduced-motion) is strictly respected.
  const isCinematicActive = isDesktop && (import.meta.env.DEV || !prefersReduced);

  return {
    isDesktop,
    prefersReduced,
    isCinematicActive,
  };
}

/**
 * Responsive scroll motion scale hook for natural flow sections.
 */
export function useMotionScale(): number {
  const shouldReduceMotion = useReducedMotion();
  const [scale, setScale] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    if (window.innerWidth < 640) return 0.4;
    if (window.innerWidth < 1024) return 0.65;
    return 1.0;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setScale(0.4);
      } else if (window.innerWidth < 1024) {
        setScale(0.65);
      } else {
        setScale(1.0);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return shouldReduceMotion ? 0 : scale;
}

/**
 * Helper hook for responsive vertical scroll transforms.
 * Dynamically scales travel distances according to screen size and reduced motion.
 */
export function useResponsiveY(
  progress: MotionValue<number>,
  input: number[],
  output: number[],
  scale: number
): MotionValue<number> {
  const scaledOutput = output.map((val) => val * scale);
  return useTransform(progress, input, scaledOutput);
}
