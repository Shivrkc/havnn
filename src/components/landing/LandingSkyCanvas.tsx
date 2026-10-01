import React, { useEffect, useRef } from 'react';
import { MotionValue } from 'motion/react';
import { useTheme } from '../../context/ThemeContext';

interface LandingSkyCanvasProps {
  className?: string;
  speed?: number;
  cloudCount?: number;
  scrollYProgress?: MotionValue<number>;
}

/**
 * Consolidated 2D Canvas Sky and Procedural Cloud Ocean.
 * Features scroll-linked atmospheric depth, differential cloud velocities,
 * and persistent sky continuity across all cinematic scenes.
 */
export default function LandingSkyCanvas({
  className = 'absolute inset-0 w-full h-full pointer-events-none z-0',
  speed = 0.00045,
  cloudCount = 34,
  scrollYProgress,
}: LandingSkyCanvasProps) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const mediaQuery =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let prefersReducedMotion = !import.meta.env.DEV && mediaQuery ? mediaQuery.matches : false;

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
      if (prefersReducedMotion) {
        render();
      }
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Procedural cloud particles with depth attributes
    interface CloudPuff {
      xRatio: number;
      z: number;
      radius: number;
      opacity: number;
      driftDir: number;
    }

    const clouds: CloudPuff[] = Array.from({ length: cloudCount }, () => ({
      xRatio: (Math.random() - 0.5) * 2.5,
      z: Math.random(),
      radius: 95 + Math.random() * 150,
      opacity: 0.3 + Math.random() * 0.38,
      driftDir: Math.random() > 0.5 ? 1 : -1,
    }));

    const isDark = theme === 'dark';

    // Pre-rendered offscreen cloud sprite to avoid creating 34 radial gradients on CPU every frame
    const spriteSize = 256;
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = spriteSize;
    spriteCanvas.height = spriteSize;
    const sCtx = spriteCanvas.getContext('2d');
    if (sCtx) {
      const half = spriteSize / 2;
      const sGrad = sCtx.createRadialGradient(
        half,
        half - half * 0.3,
        half * 0.1,
        half,
        half,
        half
      );
      if (isDark) {
        sGrad.addColorStop(0, 'rgba(191, 196, 207, 0.45)');
        sGrad.addColorStop(0.6, 'rgba(35, 39, 48, 0.28)');
        sGrad.addColorStop(1, 'rgba(13, 15, 18, 0)');
      } else {
        sGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        sGrad.addColorStop(0.6, 'rgba(241, 245, 249, 0.8)');
        sGrad.addColorStop(1, 'rgba(203, 213, 225, 0)');
      }
      sCtx.fillStyle = sGrad;
      sCtx.beginPath();
      sCtx.arc(half, half, half, 0, Math.PI * 2);
      sCtx.fill();
    }

    // Initial sort once by depth
    clouds.sort((a, b) => a.z - b.z);

    const render = () => {
      const scrollOffset = scrollYProgress ? scrollYProgress.get() : 0;

      // When the lower section (FAQ, CTA, Footer) completely obscures the background, skip drawing
      if (scrollOffset > 0.88) {
        if (!prefersReducedMotion && isVisible) {
          animationFrameId = requestAnimationFrame(render);
        }
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Continuous Aerial Sky Gradient with subtle scroll inflection
      const skyGrad = ctx.createLinearGradient(0, -scrollOffset * height * 0.1, 0, height);
      if (isDark) {
        skyGrad.addColorStop(0, '#0d0f12');
        skyGrad.addColorStop(0.35, '#12151b');
        skyGrad.addColorStop(0.7, '#161921');
        skyGrad.addColorStop(1, '#0d0f12');
      } else {
        skyGrad.addColorStop(0, '#f0f9ff');
        skyGrad.addColorStop(0.35, '#e0f2fe');
        skyGrad.addColorStop(0.7, '#bae6fd');
        skyGrad.addColorStop(1, '#f8fafc');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Fast GPU-accelerated cloud sprite rendering
      clouds.forEach((cloud) => {
        if (!prefersReducedMotion) {
          cloud.z += speed;
          if (cloud.z > 1) {
            cloud.z -= 1;
            cloud.xRatio = (Math.random() - 0.5) * 2.5;
          }
        }

        const perspective = Math.pow(cloud.z, 2);
        // Differential vertical motion: deeper clouds move slower, foreground clouds move faster
        const scrollParallaxY = scrollOffset * height * 0.32 * (0.35 + perspective * 0.65);
        // Subtle lateral counter-drift linked to scroll progress
        const scrollDriftX = cloud.driftDir * scrollOffset * width * 0.08 * perspective;

        let screenY = (perspective * height) - scrollParallaxY;
        // Wrap vertically so clouds cycle continuously through the journey
        while (screenY < -120) screenY += height + 240;
        while (screenY > height + 120) screenY -= height + 240;

        const screenX = width / 2 + cloud.xRatio * width * (0.4 + perspective * 0.7) + scrollDriftX;
        const currentRadius = cloud.radius * (0.4 + perspective * 0.9);
        const currentOpacity = cloud.opacity * (0.2 + perspective * 0.8);

        ctx.globalAlpha = Math.min(1, Math.max(0, currentOpacity));
        ctx.drawImage(
          spriteCanvas,
          screenX - currentRadius,
          screenY - currentRadius,
          currentRadius * 2,
          currentRadius * 2
        );
      });
      ctx.globalAlpha = 1.0;

      if (!prefersReducedMotion && isVisible) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    // Pause rendering loop when canvas is scrolled off-screen
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (isVisible && !prefersReducedMotion) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(render);
          }
        });
      },
      { threshold: 0.05 }
    );

    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }

    return () => {
      observer.disconnect();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [theme, speed, cloudCount, scrollYProgress]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
    />
  );
}
