import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import CLOUDS, { VantaEffect } from 'vanta/dist/vanta.clouds.min';
import { useTheme } from '../../context/ThemeContext';

export interface VantaPalette {
  skyColor: number;
  cloudColor: number;
  cloudShadowColor: number;
  sunColor: number;
  sunGlareColor: number;
  sunlightColor: number;
}

export const LIGHT_VANTA_PALETTE: VantaPalette = {
  skyColor: 0x68b8d7,
  cloudColor: 0xadc1de,
  cloudShadowColor: 0x183550,
  sunColor: 0xff9919,
  sunGlareColor: 0xff6633,
  sunlightColor: 0xff9933,
};

export const DARK_VANTA_PALETTE: VantaPalette = {
  skyColor: 0x111317,
  cloudColor: 0xbfc4cf,
  cloudShadowColor: 0x232730,
  sunColor: 0xe68a38,
  sunGlareColor: 0xcc661f,
  sunlightColor: 0xf5a04e,
};

export interface HavnCloudsProps {
  className?: string;
  children?: React.ReactNode;
  speed?: number;
  mouseControls?: boolean;
  touchControls?: boolean;
  gyroControls?: boolean;
  scale?: number;
  scaleMobile?: number;
}

export const HavnClouds: React.FC<HavnCloudsProps> = ({
  className = 'absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden',
  children,
  speed = 0.45,
  mouseControls = true,
  touchControls = true,
  gyroControls = false,
  scale = 3.0,
  scaleMobile = 8.0,
}) => {
  const { theme } = useTheme();
  const vantaRef = useRef<HTMLDivElement | null>(null);
  const vantaEffectRef = useRef<VantaEffect | null>(null);

  const activePalette = theme === 'dark' ? DARK_VANTA_PALETTE : LIGHT_VANTA_PALETTE;

  // 1. Initialize Vanta CLOUDS on mount
  useEffect(() => {
    const element = vantaRef.current;
    if (!element) return;

    // Check prefers-reduced-motion
    const mediaQuery =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    const isReducedMotion = mediaQuery ? mediaQuery.matches : false;
    const initialSpeed = isReducedMotion ? 0 : speed;

    // Clean up any stale canvas elements to ensure exactly 1 canvas instance
    if (vantaEffectRef.current) {
      try {
        vantaEffectRef.current.destroy();
      } catch {
        // Ignore cleanup errors on stale references
      }
      vantaEffectRef.current = null;
    }

    const existingCanvases = element.querySelectorAll('.vanta-canvas');
    existingCanvases.forEach((canvas) => canvas.remove());

    // Initialize Vanta CLOUDS with Three.js
    let effect: VantaEffect | null = null;
    try {
      effect = CLOUDS({
        el: element,
        THREE,
        mouseControls,
        touchControls,
        gyroControls,
        speed: initialSpeed,
        skyColor: activePalette.skyColor,
        cloudColor: activePalette.cloudColor,
        cloudShadowColor: activePalette.cloudShadowColor,
        sunColor: activePalette.sunColor,
        sunGlareColor: activePalette.sunGlareColor,
        sunlightColor: activePalette.sunlightColor,
        scale,
        scaleMobile,
        backgroundColor: activePalette.skyColor,
      });
      vantaEffectRef.current = effect;

      // Ensure the generated canvas does not capture pointer events
      const canvasEl = element.querySelector('.vanta-canvas') as HTMLCanvasElement | null;
      if (canvasEl) {
        canvasEl.style.pointerEvents = 'none';
      }
    } catch (err) {
      console.error('[HavnClouds] Failed to initialize Vanta.js CLOUDS:', err);
    }

    // Dynamic listener for prefers-reduced-motion changes
    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (vantaEffectRef.current) {
        vantaEffectRef.current.setOptions({
          speed: e.matches ? 0 : speed,
        });
      }
    };

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleMotionChange);
      } else if (typeof (mediaQuery as any).addListener === 'function') {
        (mediaQuery as any).addListener(handleMotionChange);
      }
    }

    // IntersectionObserver to pause speed when off-screen and resume when visible
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!vantaEffectRef.current) return;
            const currentReducedMotion = mediaQuery ? mediaQuery.matches : false;
            if (currentReducedMotion) return;

            if (entry.isIntersecting) {
              vantaEffectRef.current.setOptions({ speed });
            } else {
              // Pause cloud movement when scrolled off-screen
              vantaEffectRef.current.setOptions({ speed: 0 });
            }
          });
        },
        { threshold: 0.05 }
      );
      observer.observe(element);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', handleMotionChange);
        } else if (typeof (mediaQuery as any).removeListener === 'function') {
          (mediaQuery as any).removeListener(handleMotionChange);
        }
      }
      if (vantaEffectRef.current) {
        try {
          vantaEffectRef.current.destroy();
        } catch (err) {
          console.warn('[HavnClouds] Error during destroy:', err);
        }
        vantaEffectRef.current = null;
      }
      // Safety sweep: ensure canvas element is removed from DOM
      if (element) {
        const remainingCanvases = element.querySelectorAll('.vanta-canvas');
        remainingCanvases.forEach((c) => c.remove());
      }
    };
  }, [
    speed,
    mouseControls,
    touchControls,
    gyroControls,
    scale,
    scaleMobile,
  ]);

  // 2. Synchronize theme palette dynamically via setOptions and uniform mutation
  useEffect(() => {
    if (!vantaEffectRef.current) return;

    try {
      // Method A: Call Vanta's built-in setOptions
      vantaEffectRef.current.setOptions({
        ...activePalette,
        backgroundColor: activePalette.skyColor,
      });

      // Method B: Direct uniform mutation fallback to ensure cached WebGL uniforms update immediately
      const effectAny = vantaEffectRef.current as any;
      if (effectAny.uniforms) {
        for (const [k, v] of Object.entries(activePalette)) {
          if (effectAny.uniforms[k]) {
            const color = new THREE.Color(v);
            effectAny.uniforms[k].value = new THREE.Vector3(color.r, color.g, color.b);
          }
        }
        if (effectAny.uniforms.backgroundColor) {
          const bg = new THREE.Color(activePalette.skyColor);
          effectAny.uniforms.backgroundColor.value = new THREE.Vector3(bg.r, bg.g, bg.b);
        }
      }
    } catch (err) {
      console.warn('[HavnClouds] Error updating Vanta theme options:', err);
    }
  }, [theme, activePalette]);

  if (children) {
    return (
      <div className={`relative ${className}`}>
        <div
          ref={vantaRef}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
        />
        <div className="relative z-10 w-full h-full">{children}</div>
      </div>
    );
  }

  return (
    <div
      ref={vantaRef}
      aria-hidden="true"
      className={className}
    />
  );
};

export default HavnClouds;
