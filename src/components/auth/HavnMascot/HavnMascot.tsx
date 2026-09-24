import React, { useEffect, useRef, useState } from 'react';
import { HavnMascotProps } from './mascotTypes';
import './mascot.css';

export default function HavnMascot({
  focusedField = 'idle',
  isSubmitting = false,
  hasError = false,
  reduceMotion = false,
  className = '',
}: HavnMascotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isPassword = focusedField === 'password' || focusedField === 'confirmPassword';
  const isFormFocused = focusedField === 'email' || focusedField === 'name';

  const shouldReduceMotion = Boolean(
    reduceMotion ||
    (typeof window !== 'undefined' && (window as any).__FORCE_REDUCED_MOTION__ === true) ||
    (typeof document !== 'undefined' && document.documentElement.classList.contains('reduce-motion'))
  );

  // Play entrance animation once on mount unless reduced motion is explicitly requested
  const [isEntering, setIsEntering] = useState(!shouldReduceMotion);

  useEffect(() => {
    if (shouldReduceMotion) {
      setIsEntering(false);
      return;
    }

    setIsEntering(true);
    const timer = setTimeout(() => {
      setIsEntering(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [shouldReduceMotion]);

  // Immediate override: if user focuses password, immediately switch to no-peeking pose
  useEffect(() => {
    if (isPassword && isEntering) {
      setIsEntering(false);
    }
  }, [isPassword, isEntering]);

  // Four-tiered independent coordinate layers for organic motion hierarchy
  const [pupilsCoords, setPupilsCoords] = useState({ x: 0, y: 0 });
  const [headCoords, setHeadCoords] = useState({ x: 0, y: 0 });
  const [bodyCoords, setBodyCoords] = useState({ x: 0, y: 0 });
  const [armCoords, setArmCoords] = useState({ x: 0, y: 0 });

  const targetRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Determine target based on focused form field, entrance state, or mouse position
    const updateTarget = (clientX: number, clientY: number) => {
      if (isEntering) {
        // Defer cursor tracking while welcome entrance plays
        targetRef.current = { x: 0, y: 0 };
        return;
      }

      if (isPassword) {
        // Look straight down gently when covering eyes
        targetRef.current = { x: 0, y: 0.1 };
        return;
      }

      if (isFormFocused) {
        // Look attentively to the left towards authentication form fields
        targetRef.current = { x: -0.85, y: 0.2 };
        return;
      }

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mascotCenterX = rect.left + rect.width / 2;
      const mascotCenterY = rect.top + rect.height * 0.4;

      // Calculate directional vector from mascot to cursor
      const dx = (clientX - mascotCenterX) / (window.innerWidth * 0.45);
      const dy = (clientY - mascotCenterY) / (window.innerHeight * 0.45);

      const clampedX = Math.max(-1, Math.min(1, dx));
      const clampedY = Math.max(-1, Math.min(1, dy));

      targetRef.current = { x: clampedX, y: clampedY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateTarget(e.clientX, e.clientY);
    };

    const handleMouseLeave = () => {
      if (!isFormFocused && !isPassword && !isEntering) {
        targetRef.current = { x: 0, y: 0 };
      }
    };

    // If already in a focused state, initialize the target immediately
    if (isPassword) {
      targetRef.current = { x: 0, y: 0.1 };
    } else if (isFormFocused) {
      targetRef.current = { x: -0.85, y: 0.2 };
    } else if (isEntering) {
      targetRef.current = { x: 0, y: 0 };
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);

    // Differentiated spring interpolation (Eyes = fastest, Head = medium, Body = slowest, Arms = deliberate)
    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

    let curPupils = { x: targetRef.current.x, y: targetRef.current.y };
    let curHead = { x: targetRef.current.x, y: targetRef.current.y };
    let curBody = { x: targetRef.current.x, y: targetRef.current.y };
    let curArm = { x: targetRef.current.x, y: targetRef.current.y };

    const animate = () => {
      const target = targetRef.current;

      // Eyes: fastest follow (0.16)
      curPupils.x = lerp(curPupils.x, target.x, 0.16);
      curPupils.y = lerp(curPupils.y, target.y, 0.16);
      setPupilsCoords({ ...curPupils });

      // Head: medium follow (0.08)
      curHead.x = lerp(curHead.x, target.x, 0.08);
      curHead.y = lerp(curHead.y, target.y, 0.08);
      setHeadCoords({ ...curHead });

      // Body: slow, grounded follow (0.04)
      curBody.x = lerp(curBody.x, target.x, 0.04);
      curBody.y = lerp(curBody.y, target.y, 0.04);
      setBodyCoords({ ...curBody });

      // Arms: deliberate follow (0.06)
      curArm.x = lerp(curArm.x, target.x, 0.06);
      curArm.y = lerp(curArm.y, target.y, 0.06);
      setArmCoords({ ...curArm });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPassword, isFormFocused, isEntering]);

  // Transform Calculations
  // 1. Pupils (Fast response, ~12px X, ~9px Y)
  const pupilsX = isPassword ? 0 : isEntering ? 0 : pupilsCoords.x * 12;
  const pupilsY = isPassword ? 3 : isEntering ? 0 : pupilsCoords.y * 9;

  // 2. Head (Medium response, ~11px X, ~8px Y, ~5deg tilt, lifts up / lowers down)
  const headX = isPassword ? 0 : isEntering ? 0 : headCoords.x * 11;
  const headY = isPassword ? 5 : isEntering ? 0 : headCoords.y * 8;
  const headRotate = isPassword ? 0 : isEntering ? 0 : headCoords.x * 5 + (hasError ? 6 : 0);

  // 3. Body (Grounded response, ~5px X, ~3px Y, ~2.5deg tilt)
  const bodyX = isPassword ? 0 : isEntering ? 0 : bodyCoords.x * 5;
  const bodyY = isPassword ? 2 : isEntering ? 0 : bodyCoords.y * 3;
  const bodyRotate = isPassword ? 0 : isEntering ? 0 : bodyCoords.x * 2.5;

  // 4. Arms & Hands (Directional gestures, password eye-cover, celebration)
  // Left Arm
  let leftArmTransform = '';
  if (isPassword) {
    // No Peeking: Paws cover the eyes perfectly at eye level
    leftArmTransform = 'translate(80px, -138px) rotate(32deg)';
  } else if (isSubmitting) {
    leftArmTransform = 'translate(-8px, -42px) rotate(-35deg)';
  } else if (!isEntering) {
    // Deliberate gesture towards cursor direction
    const gestureX = armCoords.x < 0 ? armCoords.x * 7 : armCoords.x * 3;
    const gestureY = armCoords.y * 5;
    const gestureRot = armCoords.x < 0 ? armCoords.x * 9 : armCoords.x * 3;
    leftArmTransform = `translate(${gestureX}px, ${gestureY}px) rotate(${gestureRot}deg)`;
  }

  // Right Arm
  let rightArmTransform = '';
  if (isPassword) {
    // No Peeking: Paws cover the eyes perfectly at eye level
    rightArmTransform = 'translate(-80px, -138px) rotate(-32deg)';
  } else if (isSubmitting) {
    rightArmTransform = 'translate(8px, -42px) rotate(35deg)';
  } else if (!isEntering) {
    // Deliberate gesture towards cursor direction
    const gestureX = armCoords.x > 0 ? armCoords.x * 7 : armCoords.x * 3;
    const gestureY = armCoords.y * 5;
    const gestureRot = armCoords.x > 0 ? armCoords.x * 9 : armCoords.x * 3;
    rightArmTransform = `translate(${gestureX}px, ${gestureY}px) rotate(${gestureRot}deg)`;
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-[220px] sm:max-w-[240px] lg:max-w-[250px] mx-auto select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Soft Ambient Cloud Aura Backdrop */}
      <div className="absolute inset-0 -top-6 rounded-full bg-radial from-blue-400/15 via-sky-300/5 to-transparent dark:from-blue-500/10 dark:via-sky-400/5 dark:to-transparent blur-2xl pointer-events-none" />

      <svg
        viewBox="0 0 360 380"
        className={`w-full h-auto drop-shadow-xl ${isSubmitting ? 'yeti-celebrate' : ''}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Fur linear & radial gradients for 3D depth */}
          <linearGradient id="yetiFurGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="65%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>

          <radialGradient id="yetiBodyShading" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </radialGradient>

          <linearGradient id="yetiBellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#e8eef6" stopOpacity="0.7" />
          </linearGradient>

          {/* Soft Baby Powder Blue Face Mask */}
          <radialGradient id="yetiFaceGrad" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="70%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#60a5fa" />
          </radialGradient>

          {/* Ears inner gradient */}
          <radialGradient id="yetiInnerEar" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#93c5fd" />
          </radialGradient>

          {/* Paw pads soft blue */}
          <linearGradient id="yetiPawPad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>

          {/* Eye gloss gradient */}
          <linearGradient id="yetiEyeGloss" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="60%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          {/* Soft Drop Shadows */}
          <filter id="yetiShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.12" />
          </filter>

          {/* Eye clips for natural blinking */}
          <clipPath id="leftEyeClip">
            <ellipse cx="145" cy="155" rx="14" ry="17" />
          </clipPath>
          <clipPath id="rightEyeClip">
            <ellipse cx="215" cy="155" rx="14" ry="17" />
          </clipPath>
        </defs>

        {/* --- LAYER 1: Cloud Platform / Bottom Ground Puffs --- */}
        <g opacity="0.85">
          <ellipse
            cx="180"
            cy="365"
            rx="90"
            ry="10"
            fill="#94a3b8"
            className={isEntering ? 'yeti-entrance-shadow' : ''}
            style={{ transformOrigin: '180px 365px', transformBox: 'view-box' }}
            opacity="0.18"
          />
          <path
            d="M95 365 C95 352, 115 348, 125 354 C132 346, 155 344, 168 352 C178 344, 210 342, 222 352 C235 346, 258 350, 265 365 Z"
            fill="#ffffff"
            opacity="0.8"
            className="dark:fill-[#1e222b]"
          />
        </g>

        {/* --- YETI CHARACTER (Full Body Group for Jump, Stretch, Squash, Landing) --- */}
        <g
          className={isEntering ? 'yeti-entrance-jump' : ''}
          style={{ transformOrigin: '180px 355px', transformBox: 'view-box' }}
        >
          {/* --- LAYER 2: Body Group (Lower body, belly, grounded shift & breathing) --- */}
          <g
            className={`yeti-layer ${isEntering ? 'yeti-entrance-body' : 'yeti-breathe'}`}
            style={
              isEntering
                ? { transformOrigin: '180px 340px', transformBox: 'view-box' }
                : {
                    transform: `translate(${bodyX}px, ${bodyY}px) rotate(${bodyRotate}deg)`,
                    transformOrigin: '180px 340px',
                    transformBox: 'view-box',
                  }
            }
          >
            {/* Feet Paws Peeking */}
            <ellipse cx="135" cy="350" rx="24" ry="13" fill="url(#yetiFurGrad)" />
            <ellipse cx="132" cy="351" rx="6" ry="4" fill="url(#yetiPawPad)" />
            <ellipse cx="144" cy="351" rx="5" ry="3.5" fill="url(#yetiPawPad)" />

            <ellipse cx="225" cy="350" rx="24" ry="13" fill="url(#yetiFurGrad)" />
            <ellipse cx="228" cy="351" rx="6" ry="4" fill="url(#yetiPawPad)" />
            <ellipse cx="216" cy="351" rx="5" ry="3.5" fill="url(#yetiPawPad)" />

            {/* Main Body Pear-Silhouette with organic fur tufts */}
            <path
              d="M 120 220
                 C 90 240, 75 290, 95 330
                 C 105 348, 130 355, 180 355
                 C 230 355, 255 348, 265 330
                 C 285 290, 270 240, 240 220
                 C 215 205, 145 205, 120 220 Z"
              fill="url(#yetiBodyShading)"
              filter="url(#yetiShadow)"
            />

            {/* Side Fluffy Fur Tufts */}
            <path d="M 85 290 C 72 296, 78 308, 92 312 Z" fill="#e2e8f0" />
            <path d="M 82 270 C 68 276, 75 288, 88 290 Z" fill="#cbd5e1" />
            <path d="M 275 290 C 288 296, 282 308, 268 312 Z" fill="#e2e8f0" />
            <path d="M 278 270 C 292 276, 285 288, 272 290 Z" fill="#cbd5e1" />

            {/* Soft Lighter Belly Oval */}
            <g className="yeti-chest-breathe">
              <ellipse cx="180" cy="285" rx="62" ry="52" fill="url(#yetiBellyGrad)" />
              {/* Subtle chest fur highlights */}
              <path
                d="M 172 255 C 180 262, 188 262, 196 255"
                stroke="#cbd5e1"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.6"
              />
              <path
                d="M 175 268 C 180 273, 186 273, 191 268"
                stroke="#cbd5e1"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.6"
              />
            </g>
          </g>

          {/* --- LAYER 3: Head Group (Ears, Head Fur, Blue Face, Snout, Expressive Eyes) --- */}
          <g
            className={`yeti-layer ${isEntering ? 'yeti-entrance-head' : ''}`}
            style={
              isEntering
                ? { transformOrigin: '180px 165px', transformBox: 'view-box' }
                : {
                    transform: `translate(${headX}px, ${headY}px) rotate(${headRotate}deg)`,
                    transformOrigin: '180px 165px',
                    transformBox: 'view-box',
                  }
            }
          >
            {/* Rounded Ears with Inner Blue Depth */}
            <g className={isEntering ? 'yeti-entrance-ears' : 'yeti-ears'}>
              {/* Left Ear */}
              <circle cx="102" cy="108" r="22" fill="url(#yetiFurGrad)" />
              <circle cx="104" cy="108" r="13" fill="url(#yetiInnerEar)" />

              {/* Right Ear */}
              <circle cx="258" cy="108" r="22" fill="url(#yetiFurGrad)" />
              <circle cx="256" cy="108" r="13" fill="url(#yetiInnerEar)" />
            </g>

            {/* Fluffy Head Fur Crest & Cheek Tufts */}
            <path
              d="M 110 135
                 C 85 155, 80 195, 105 220
                 C 125 240, 150 242, 180 242
                 C 210 242, 235 240, 255 220
                 C 280 195, 275 155, 250 135
                 C 255 105, 230 75, 195 82
                 C 185 70, 175 70, 165 82
                 C 130 75, 105 105, 110 135 Z"
              fill="url(#yetiFurGrad)"
              filter="url(#yetiShadow)"
            />

            {/* Top Hair Tufts Crest */}
            <path d="M 168 80 C 160 62, 172 60, 176 74 Z" fill="#ffffff" />
            <path d="M 176 76 C 180 56, 192 58, 188 74 Z" fill="#f8fafc" />
            <path d="M 186 78 C 196 66, 204 72, 196 82 Z" fill="#f1f5f9" />

            {/* Cheek Tufts Details */}
            <path d="M 94 185 C 80 190, 84 202, 98 205 Z" fill="#e2e8f0" />
            <path d="M 266 185 C 280 190, 276 202, 262 205 Z" fill="#e2e8f0" />

            {/* Soft Baby Powder Blue Face Mask */}
            <path
              d="M 132 125
                 C 112 140, 110 190, 130 205
                 C 145 216, 170 218, 180 218
                 C 190 218, 215 216, 230 205
                 C 250 190, 248 140, 228 125
                 C 212 114, 148 114, 132 125 Z"
              fill="url(#yetiFaceGrad)"
            />

            {/* Cheerful Soft Pinkish Cheek Blush */}
            <ellipse cx="132" cy="180" rx="10" ry="6" fill="#f43f5e" opacity="0.22" />
            <ellipse cx="228" cy="180" rx="10" ry="6" fill="#f43f5e" opacity="0.22" />

            {/* Sclera (Eye Whites) with subtle 3D shadow */}
            <ellipse cx="145" cy="155" rx="15" ry="18" fill="#ffffff" />
            <ellipse cx="145" cy="153" rx="14" ry="16" fill="#f8fafc" />

            <ellipse cx="215" cy="155" rx="15" ry="18" fill="#ffffff" />
            <ellipse cx="215" cy="153" rx="14" ry="16" fill="#f8fafc" />

            {/* --- PUPILS & IRISES (Fast tracking + Specular Highlights) --- */}
            {/* Left Eye */}
            <g
              clipPath="url(#leftEyeClip)"
              className="yeti-pupils-layer"
              style={{
                transform: `translate(${pupilsX}px, ${pupilsY}px)`,
                transformBox: 'view-box',
              }}
            >
              {/* Iris */}
              <circle cx="145" cy="155" r="10" fill="url(#yetiEyeGloss)" />
              {/* Primary Catchlight (Gloss Sparkle) */}
              <circle cx="142" cy="151" r="3.6" fill="#ffffff" />
              {/* Secondary Accent Catchlight */}
              <circle cx="148" cy="157" r="1.6" fill="#ffffff" opacity="0.85" />
            </g>

            {/* Right Eye */}
            <g
              clipPath="url(#rightEyeClip)"
              className="yeti-pupils-layer"
              style={{
                transform: `translate(${pupilsX}px, ${pupilsY}px)`,
                transformBox: 'view-box',
              }}
            >
              {/* Iris */}
              <circle cx="215" cy="155" r="10" fill="url(#yetiEyeGloss)" />
              {/* Primary Catchlight */}
              <circle cx="212" cy="151" r="3.6" fill="#ffffff" />
              {/* Secondary Accent Catchlight */}
              <circle cx="218" cy="157" r="1.6" fill="#ffffff" opacity="0.85" />
            </g>

            {/* Eyelids Blink Overlay */}
            <g className="yeti-blink">
              <ellipse cx="145" cy="155" rx="16" ry="19" fill="url(#yetiFaceGrad)" opacity="0" />
              <ellipse cx="215" cy="155" rx="16" ry="19" fill="url(#yetiFaceGrad)" opacity="0" />
            </g>

            {/* Cute Snout & Triangular Soft Dark Nose */}
            <path
              d="M 172 172 C 172 167, 188 167, 188 172 C 188 177, 182 181, 180 181 C 178 181, 172 177, 172 172 Z"
              fill="#1e293b"
            />
            {/* Nose specular highlight */}
            <circle cx="178" cy="171" r="1.5" fill="#94a3b8" />

            {/* Warm Friendly Curved Smile */}
            <path
              d="M 168 188 C 174 196, 186 196, 192 188"
              stroke="#1e293b"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            {/* Cute mouth corner dimples */}
            <circle cx="167" cy="188" r="1.2" fill="#1e293b" />
            <circle cx="193" cy="188" r="1.2" fill="#1e293b" />
          </g>

          {/* --- LAYER 4: Independent Left & Right Arms & Paws --- */}

          {/* Left Arm & Paw */}
          <g
            className={`yeti-arm-layer ${isEntering ? 'yeti-entrance-balance-arm' : ''}`}
            style={
              isEntering
                ? { transformOrigin: '95px 230px', transformBox: 'view-box' }
                : {
                    transform: leftArmTransform,
                    transformOrigin: '95px 230px',
                    transformBox: 'view-box',
                  }
            }
          >
            {/* Arm Sleeve/Fur */}
            <path
              d="M 98 225
                 C 70 240, 68 280, 88 300
                 C 100 310, 114 300, 118 285
                 C 122 265, 115 235, 98 225 Z"
              fill="url(#yetiFurGrad)"
              filter="url(#yetiShadow)"
            />
            {/* Left Paw Hand & Blue Pads */}
            <ellipse cx="100" cy="298" rx="16" ry="14" fill="#93c5fd" />
            <circle cx="94" cy="292" r="4" fill="#60a5fa" />
            <circle cx="102" cy="290" r="4.2" fill="#60a5fa" />
            <circle cx="110" cy="294" r="3.8" fill="#60a5fa" />
            <ellipse cx="101" cy="301" rx="6" ry="4.5" fill="#3b82f6" opacity="0.6" />
          </g>

          {/* Right Arm & Paw */}
          <g
            className={`yeti-arm-layer ${isEntering ? 'yeti-entrance-wave-arm' : ''}`}
            style={
              isEntering
                ? { transformOrigin: '265px 230px', transformBox: 'view-box' }
                : {
                    transform: rightArmTransform,
                    transformOrigin: '265px 230px',
                    transformBox: 'view-box',
                  }
            }
          >
            {/* Arm Sleeve/Fur */}
            <path
              d="M 262 225
                 C 290 240, 292 280, 272 300
                 C 260 310, 246 300, 242 285
                 C 238 265, 245 235, 262 225 Z"
              fill="url(#yetiFurGrad)"
              filter="url(#yetiShadow)"
            />
            {/* Right Paw Hand & Blue Pads */}
            <ellipse cx="260" cy="298" rx="16" ry="14" fill="#93c5fd" />
            <circle cx="266" cy="292" r="4" fill="#60a5fa" />
            <circle cx="258" cy="290" r="4.2" fill="#60a5fa" />
            <circle cx="250" cy="294" r="3.8" fill="#60a5fa" />
            <ellipse cx="259" cy="301" rx="6" ry="4.5" fill="#3b82f6" opacity="0.6" />
          </g>

          {/* Celebration / Success Sparkles when Submitting */}
          {isSubmitting && (
            <g className="motion-safe:animate-pulse">
              <path d="M 85 90 L 90 98 L 98 90 L 90 82 Z" fill="#60a5fa" />
              <path d="M 275 80 L 280 88 L 288 80 L 280 72 Z" fill="#38bdf8" />
              <path d="M 180 40 L 183 46 L 190 48 L 184 53 L 185 60 L 180 55 L 175 60 L 176 53 L 170 48 L 177 46 Z" fill="#fbbf24" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
