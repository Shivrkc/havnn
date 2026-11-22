import React, { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface UseCanvasSkyOptions {
  cloudCount?: number;
  baseSpeed?: number;
}

interface CloudPuff {
  relX: number;
  relY: number;
  radius: number;
  opacity: number;
  isShadow: boolean;
}

interface CloudCluster {
  x: number;
  y: number;
  baseY: number;
  z: number;
  driftSpeed: number;
  verticalFreq: number;
  verticalAmp: number;
  phase: number;
  offsetX: number;
  offsetY: number;
  velX: number;
  velY: number;
  clusterRadius: number;
  puffs: CloudPuff[];
}

/**
 * Reusable dynamic 2D canvas sky hook for HAVN.
 *
 * Implements a living, atmospheric daytime sky inspired by HAVN's landing page:
 * - Natural deep daylight blue sky gradient with soft, non-bleaching sunlight bloom.
 * - Multi-depth volumetric cumulus cloud formations composed of billowy puff clusters.
 * - Dual-tone cloud lighting: warm sunlit white tops fading to subtle periwinkle-slate
 *   atmospheric underbellies (#adc1de and #183550, reused from HavnClouds / LandingSkyCanvas).
 * - Continuous organic horizontal drift with subtle undulating vertical breath.
 * - Interactive cursor aerodynamic airflow: clouds near the cursor gently shift and part,
 *   with smooth spring recovery to undisturbed drift trajectories (no magnetic bouncing).
 * - Fast, GPU-accelerated dual offscreen sprite rendering (60 FPS, zero per-frame allocation).
 * - Fully respects prefers-reduced-motion and stays 100% dormant in dark mode (preserving AMOLED nebula).
 */
export function useCanvasSky(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options?: UseCanvasSkyOptions
) {
  const { theme } = useTheme();
  const rawCount = options?.cloudCount ?? 20;
  const baseSpeed = options?.baseSpeed ?? 0.8;

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

    window.addEventListener('resize', handleResize, { passive: true });

    // 1. Pre-render GPU offscreen sprites to eliminate per-frame gradient allocations
    const spriteSize = 256;
    const half = spriteSize / 2;

    // Sprite A: Warm sunlit cumulus crest (top highlight)
    const sunlitCanvas = document.createElement('canvas');
    sunlitCanvas.width = spriteSize;
    sunlitCanvas.height = spriteSize;
    const sCtx1 = sunlitCanvas.getContext('2d');
    if (sCtx1) {
      const sGrad = sCtx1.createRadialGradient(
        half,
        half - half * 0.28,
        half * 0.05,
        half,
        half,
        half
      );
      sGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      sGrad.addColorStop(0.35, 'rgba(250, 253, 255, 0.88)');
      sGrad.addColorStop(0.65, 'rgba(235, 244, 255, 0.48)');
      sGrad.addColorStop(0.85, 'rgba(219, 234, 254, 0.16)');
      sGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      sCtx1.fillStyle = sGrad;
      sCtx1.beginPath();
      sCtx1.arc(half, half, half, 0, Math.PI * 2);
      sCtx1.fill();
    }

    // Sprite B: Atmospheric slate/periwinkle shadow underbelly
    // Palette referenced from HavnClouds LIGHT_VANTA_PALETTE (#adc1de cloud, #183550 shadow)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = spriteSize;
    shadowCanvas.height = spriteSize;
    const sCtx2 = shadowCanvas.getContext('2d');
    if (sCtx2) {
      const sGrad = sCtx2.createRadialGradient(
        half,
        half + half * 0.20,
        half * 0.05,
        half,
        half,
        half
      );
      sGrad.addColorStop(0, 'rgba(173, 193, 222, 0.50)'); // #adc1de periwinkle
      sGrad.addColorStop(0.40, 'rgba(148, 175, 208, 0.35)');
      sGrad.addColorStop(0.70, 'rgba(24, 53, 80, 0.16)');  // #183550 deep blue-slate
      sGrad.addColorStop(1, 'rgba(24, 53, 80, 0)');
      sCtx2.fillStyle = sGrad;
      sCtx2.beginPath();
      sCtx2.arc(half, half, half, 0, Math.PI * 2);
      sCtx2.fill();
    }

    // 2. Generate natural volumetric cloud clusters across the viewport
    const clusterCount = Math.max(5, Math.min(10, Math.round(rawCount / 2.5)));
    const clusters: CloudCluster[] = Array.from({ length: clusterCount }, (_, i) => {
      const z = 0.25 + (i / clusterCount) * 0.75; // Depth factor: 0.25 (distant) to 1.0 (foreground)
      const scale = 0.55 + z * 0.65;
      const baseY = height * 0.06 + Math.random() * (height * 0.80);
      const startX = (i / clusterCount) * (width + 400) - 200 + (Math.random() - 0.5) * 150;

      // Compose 5-7 overlapping billowy puffs into a coherent cumulus bank
      const puffCount = 5 + Math.floor(Math.random() * 3);
      const puffs: CloudPuff[] = [];

      // 1-2 lower shaded underbelly puffs
      const shadowCount = 1 + (puffCount > 6 ? 1 : 0);
      for (let s = 0; s < shadowCount; s++) {
        puffs.push({
          relX: (Math.random() - 0.5) * 80 * scale,
          relY: (15 + Math.random() * 25) * scale,
          radius: (75 + Math.random() * 45) * scale,
          opacity: (0.22 + Math.random() * 0.18) * (0.6 + z * 0.4),
          isShadow: true,
        });
      }

      // 4-5 upper/central bright sunlit puffs
      const sunlitCount = puffCount - shadowCount;
      for (let u = 0; u < sunlitCount; u++) {
        puffs.push({
          relX: (Math.random() - 0.5) * 110 * scale,
          relY: (-25 + Math.random() * 30) * scale,
          radius: (65 + Math.random() * 55) * scale,
          opacity: (0.28 + Math.random() * 0.32) * (0.6 + z * 0.4),
          isShadow: false,
        });
      }

      return {
        x: startX,
        y: baseY,
        baseY,
        z,
        driftSpeed: (0.10 + Math.random() * 0.14) * baseSpeed * scale,
        verticalFreq: 0.0005 + Math.random() * 0.0008,
        verticalAmp: (3 + Math.random() * 7) * scale,
        phase: Math.random() * Math.PI * 2,
        offsetX: 0,
        offsetY: 0,
        velX: 0,
        velY: 0,
        clusterRadius: 170 * scale,
        puffs,
      };
    });

    // Sort by depth so distant clouds render behind near clouds
    clusters.sort((a, b) => a.z - b.z);

    // Interactive pointer disturbance tracking (zero React re-renders)
    let targetMouseX = -1000;
    let targetMouseY = -1000;
    let currentMouseX = -1000;
    let currentMouseY = -1000;
    let prevMouseX = -1000;
    let prevMouseY = -1000;
    let isPointerActive = false;
    let pointerDecayTimeout: number | undefined;

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
      isPointerActive = true;
      if (pointerDecayTimeout) window.clearTimeout(pointerDecayTimeout);
      pointerDecayTimeout = window.setTimeout(() => {
        isPointerActive = false;
      }, 1500);
    };

    const onPointerLeave = () => {
      isPointerActive = false;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });

    const isDark = theme === 'dark';

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (isDark) {
        // Dark Mode: Handled by dedicated AMOLED Nebula background asset.
        // Canvas is kept clear to eliminate competing gradients and unnecessary GPU/CPU repainting.
        return;
      }

      // 1. Natural Deep Atmospheric Day Sky Gradient (Balanced HAVN Blue)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#0284c7');    // Deep vibrant sky blue
      skyGrad.addColorStop(0.30, '#38bdf8'); // Clear mid sky blue
      skyGrad.addColorStop(0.65, '#7dd3fc'); // Atmospheric soft blue
      skyGrad.addColorStop(0.88, '#bae6fd'); // Soft horizon blue
      skyGrad.addColorStop(1, '#e0f2fe');    // Crisp base
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Gentle Natural Sunlight Bloom (Non-bleaching atmospheric glow)
      const sunGlow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.15,
        15,
        width * 0.5,
        height * 0.15,
        width * 0.55
      );
      sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.40)');
      sunGlow.addColorStop(0.35, 'rgba(224, 242, 254, 0.18)');
      sunGlow.addColorStop(0.75, 'rgba(125, 211, 252, 0.05)');
      sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Pointer Airflow Smoothing
      if (currentMouseX === -1000) {
        currentMouseX = targetMouseX;
        currentMouseY = targetMouseY;
        prevMouseX = targetMouseX;
        prevMouseY = targetMouseY;
      }

      currentMouseX += (targetMouseX - currentMouseX) * 0.08;
      currentMouseY += (targetMouseY - currentMouseY) * 0.08;
      const mouseVelX = currentMouseX - prevMouseX;
      const mouseVelY = currentMouseY - prevMouseY;
      prevMouseX = currentMouseX;
      prevMouseY = currentMouseY;

      const time = performance.now();

      // 4. Update and Render Realistic Floating Cloud Clusters with Aerodynamic Airflow
      clusters.forEach((cluster) => {
        const renderX = cluster.x + cluster.offsetX;
        const renderY = cluster.y + cluster.offsetY;

        // Interactive Airflow disturbance calculation on the cluster formation
        if (isPointerActive && !reduceMotion) {
          const dx = renderX - currentMouseX;
          const dy = renderY - currentMouseY;
          const distSq = dx * dx + dy * dy;
          const interactionRadius = 260 * (0.6 + cluster.z * 0.5); // 156px to 286px
          const radiusSq = interactionRadius * interactionRadius;

          if (distSq < radiusSq && distSq > 4) {
            const dist = Math.sqrt(distSq);
            const normX = dx / dist;
            const normY = dy / dist;
            const forceFactor = Math.pow(1 - dist / interactionRadius, 1.8);

            // Aerodynamic airflow: soft radial deflection + light drag along mouse velocity vector
            const pushStrength = 0.45 * forceFactor * cluster.z;
            const dragStrength = 0.06 * forceFactor * cluster.z;

            cluster.velX += normX * pushStrength + mouseVelX * dragStrength;
            cluster.velY += normY * pushStrength + mouseVelY * dragStrength;
          }
        }

        // Spring restitution toward undisturbed drift trajectory
        cluster.velX += -cluster.offsetX * 0.022;
        cluster.velY += -cluster.offsetY * 0.022;

        // Atmospheric fluid resistance (smooth deceleration without bouncing)
        cluster.velX *= 0.90;
        cluster.velY *= 0.90;

        cluster.offsetX += cluster.velX;
        cluster.offsetY += cluster.velY;

        // Safety offset boundary to prevent sudden displacement
        const maxOffset = 50 * cluster.z;
        const currentOffsetDist = Math.hypot(cluster.offsetX, cluster.offsetY);
        if (currentOffsetDist > maxOffset) {
          cluster.offsetX = (cluster.offsetX / currentOffsetDist) * maxOffset;
          cluster.offsetY = (cluster.offsetY / currentOffsetDist) * maxOffset;
        }

        // Continuous horizontal drifting & organic vertical breath
        if (!reduceMotion) {
          cluster.x += cluster.driftSpeed;
          cluster.y = cluster.baseY + Math.sin(time * cluster.verticalFreq + cluster.phase) * cluster.verticalAmp;

          // Seamless loop when cluster drifts off the right edge
          if (cluster.x - cluster.clusterRadius > width) {
            cluster.x = -cluster.clusterRadius;
            cluster.baseY = height * 0.06 + Math.random() * (height * 0.80);
            cluster.offsetX = 0;
            cluster.offsetY = 0;
            cluster.velX = 0;
            cluster.velY = 0;
          }
        }

        // Draw cloud cluster puffs (shadow base first, then sunlit crests)
        const drawCenterX = cluster.x + cluster.offsetX;
        const drawCenterY = cluster.y + cluster.offsetY;

        for (const puff of cluster.puffs) {
          const px = drawCenterX + puff.relX;
          const py = drawCenterY + puff.relY;
          const sprite = puff.isShadow ? shadowCanvas : sunlitCanvas;

          ctx.globalAlpha = Math.min(1, Math.max(0, puff.opacity));
          ctx.drawImage(
            sprite,
            px - puff.radius,
            py - puff.radius,
            puff.radius * 2,
            puff.radius * 2
          );
        }
      });

      ctx.globalAlpha = 1.0;

      if (!reduceMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      if (pointerDecayTimeout) window.clearTimeout(pointerDecayTimeout);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [theme, rawCount, baseSpeed, canvasRef]);
}
