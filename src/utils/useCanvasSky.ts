import React, { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface UseCanvasSkyOptions {
  cloudCount?: number;
  baseSpeed?: number;
}

interface CloudPuff {
  x: number;
  y: number;
  z: number;
  radius: number;
  opacity: number;
  driftSpeed: number;
}

/**
 * Reusable dynamic 2D canvas sky hook.
 * Seamlessly adapts between high-altitude blue day sky and natural graphite dusk atmosphere
 * based on the global HAVN theme system and prefers-reduced-motion preferences.
 */
export function useCanvasSky(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options?: UseCanvasSkyOptions
) {
  const { theme } = useTheme();
  const cloudCount = options?.cloudCount ?? 32;
  const baseSpeed = options?.baseSpeed ?? 1.0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const mediaQuery =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let reduceMotion = mediaQuery ? mediaQuery.matches : false;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      if (reduceMotion) {
        render();
      }
    };

    window.addEventListener('resize', handleResize);

    const clouds: CloudPuff[] = Array.from({ length: cloudCount }, () => ({
      x: Math.random() * width,
      y: height * 0.1 + Math.random() * (height * 0.8),
      z: Math.random(),
      radius: 120 + Math.random() * 190,
      opacity: 0.3 + Math.random() * 0.4,
      driftSpeed: (0.16 + Math.random() * 0.28) * baseSpeed,
    }));

    const isDark = theme === 'dark';

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Atmospheric Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isDark) {
        skyGrad.addColorStop(0, '#0d0f12');    // Deep neutral charcoal top
        skyGrad.addColorStop(0.35, '#14171d'); // Rich graphite mid
        skyGrad.addColorStop(0.75, '#1a1e26'); // Subtle charcoal horizon
        skyGrad.addColorStop(1, '#0d0f12');    // Ground baseline
      } else {
        skyGrad.addColorStop(0, '#0284c7');    // Deep vibrant sky blue
        skyGrad.addColorStop(0.30, '#38bdf8'); // Clear mid sky blue
        skyGrad.addColorStop(0.65, '#7dd3fc'); // Atmospheric blue
        skyGrad.addColorStop(0.88, '#bae6fd'); // Soft horizon blue
        skyGrad.addColorStop(1, '#e0f2fe');    // Crisp base
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Atmospheric Bloom / Sunlight
      const sunGlow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.15,
        15,
        width * 0.5,
        height * 0.15,
        width * 0.65
      );

      if (isDark) {
        sunGlow.addColorStop(0, 'rgba(230, 138, 56, 0.14)');  // Warm dusk amber
        sunGlow.addColorStop(0.4, 'rgba(204, 102, 31, 0.07)');
        sunGlow.addColorStop(0.8, 'rgba(35, 39, 48, 0.03)');
        sunGlow.addColorStop(1, 'rgba(13, 15, 18, 0)');
      } else {
        sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        sunGlow.addColorStop(0.4, 'rgba(224, 242, 254, 0.35)');
        sunGlow.addColorStop(0.8, 'rgba(125, 211, 252, 0.1)');
        sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, width, height);

      // Volumetric Layered Clouds
      clouds.sort((a, b) => a.z - b.z);

      clouds.forEach((cloud) => {
        if (!reduceMotion) {
          cloud.x += cloud.driftSpeed * (0.6 + cloud.z * 0.4);
          if (cloud.x - cloud.radius > width) {
            cloud.x = -cloud.radius;
            cloud.y = height * 0.1 + Math.random() * (height * 0.8);
          }
        }

        const scale = 0.5 + cloud.z * 0.8;
        const currentRadius = cloud.radius * scale;
        const currentOpacity = cloud.opacity;

        const cloudGlow = ctx.createRadialGradient(
          cloud.x - currentRadius * 0.2,
          cloud.y - currentRadius * 0.25,
          currentRadius * 0.05,
          cloud.x,
          cloud.y,
          currentRadius
        );

        if (isDark) {
          cloudGlow.addColorStop(0, `rgba(191, 196, 207, ${currentOpacity * 0.45})`);
          cloudGlow.addColorStop(0.5, `rgba(140, 148, 160, ${currentOpacity * 0.28})`);
          cloudGlow.addColorStop(0.85, `rgba(35, 39, 48, ${currentOpacity * 0.12})`);
          cloudGlow.addColorStop(1, 'rgba(13, 15, 18, 0)');
        } else {
          cloudGlow.addColorStop(0, `rgba(255, 255, 255, ${currentOpacity * 0.95})`);
          cloudGlow.addColorStop(0.5, `rgba(248, 250, 252, ${currentOpacity * 0.8})`);
          cloudGlow.addColorStop(0.85, `rgba(226, 232, 240, ${currentOpacity * 0.25})`);
          cloudGlow.addColorStop(1, 'rgba(203, 213, 225, 0)');
        }

        ctx.beginPath();
        ctx.fillStyle = cloudGlow;
        ctx.arc(cloud.x, cloud.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      if (!reduceMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [theme, cloudCount, baseSpeed, canvasRef]);
}
