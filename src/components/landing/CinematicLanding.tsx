import React, { useRef } from 'react';
import { useScroll, useTransform, MotionConfig } from 'motion/react';
import { useMotionEnvironment } from './motionSystem';
import LandingSkyCanvas from './LandingSkyCanvas';
import Hero from './Hero';
import TechStrip from './TechStrip';
import Features from './Features';
import WhyChooseUs from './WhyChooseUs';
import ProductTrust from './ProductTrust';
import Faq from './Faq';
import FinalCta from './FinalCta';
import Footer from '../layout/Footer';

/**
 * Natural Document Flow Landing Page.
 *
 * Re-architected for fluid native browser scrolling:
 * - Eliminates the 800vh pinned sticky track and scroll hijacking.
 * - Each section flows naturally in document order with 1:1 scroll responsiveness.
 * - WhyChooseUs features the proven 5-phase card deck choreography (DECK -> SHUFFLE -> FAN -> SPREAD -> GRID)
 *   driven locally by its own section scroll progress.
 * - Background LandingSkyCanvas and Vanta clouds are preserved and optimized.
 */
export default function CinematicLanding() {
  const { isCinematicActive } = useMotionEnvironment();
  const heroRef = useRef<HTMLDivElement>(null);

  // Global document scroll progress for background sky atmosphere
  const { scrollYProgress: docScrollYProgress } = useScroll();

  // Subtle, lightweight local parallax for Hero (never blocks document scroll)
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroBgY = useTransform(heroScrollProgress, [0, 1], [0, 60]);
  const heroTextY = useTransform(heroScrollProgress, [0, 1], [0, -25]);
  const heroTextOpacity = useTransform(heroScrollProgress, [0, 0.8, 1], [1, 0.9, 0.4]);
  const heroShowcaseY = useTransform(heroScrollProgress, [0, 1], [0, -40]);
  const heroShowcaseOpacity = useTransform(heroScrollProgress, [0, 0.85, 1], [1, 0.9, 0.5]);

  return (
    <MotionConfig reducedMotion={import.meta.env.DEV ? 'never' : 'user'}>
      <div className="flex flex-col relative w-full selection:bg-blue-600/30">

        {/* Consolidated Ambient Sky Canvas in Background with Window Scroll Atmosphere */}
        <LandingSkyCanvas
          scrollYProgress={docScrollYProgress}
          className="fixed inset-0 w-full h-full pointer-events-none z-0"
        />

        {/* ========================================================================= */}
        {/* NATIVE DOCUMENT FLOW LANDING SEQUENCE                                    */}
        {/* ========================================================================= */}
        <div className="flex flex-col relative z-10 w-full">

          {/* Section 1: Hero */}
          <div id="hero-anchor" />
          <div ref={heroRef} className="w-full relative">
            <Hero
              bgY={isCinematicActive ? heroBgY : undefined}
              textY={isCinematicActive ? heroTextY : undefined}
              textOpacity={isCinematicActive ? heroTextOpacity : undefined}
              showcaseY={isCinematicActive ? heroShowcaseY : undefined}
              showcaseOpacity={isCinematicActive ? heroShowcaseOpacity : undefined}
            />
          </div>

          {/* Section 2: TechStrip (DevOps Stack Marquee) */}
          <TechStrip />

          {/* Section 3: Features Bento Grid */}
          <div id="features" />
          <Features />

          {/* Section 4: WhyChooseUs (Physical Card Deck Choreography) */}
          <div id="why-choose-us" />
          <WhyChooseUs />

          {/* Section 5: ProductTrust (Value Pillars) */}
          <div id="product-trust" />
          <ProductTrust />
        </div>

        {/* ========================================================================= */}
        {/* POST-LANDING NATURAL DOCUMENT FLOW (FAQ, CTA, Footer)                    */}
        {/* ========================================================================= */}
        <div className="relative z-20 flex flex-col bg-[var(--color-background)] transition-colors duration-300">
          <Faq />
          <FinalCta />
          <Footer />
        </div>

      </div>
    </MotionConfig>
  );
}
