import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Cloud, 
  Terminal, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Server, 
  GitBranch,
  Cpu
} from 'lucide-react';
import { ROUTES } from '../../constants/routes';

export default function Hero() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Realistic forward-travelling cloud ocean animation via Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight);
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;
      if (reduceMotion) {
        render();
      }
    };
    window.addEventListener('resize', handleResize);

    // Cloud puff data generator for multi-layered forward travel
    const horizonY = height * 0.42;
    const cloudCount = 70;
    
    interface CloudPuff {
      xRatio: number; // -1 to 1 relative to center
      z: number;      // depth: 0 (far) to 1 (near)
      radius: number;
      opacity: number;
      seed: number;
    }

    const clouds: CloudPuff[] = Array.from({ length: cloudCount }, () => ({
      xRatio: (Math.random() - 0.5) * 2.5,
      z: Math.random(),
      radius: 80 + Math.random() * 120,
      opacity: 0.35 + Math.random() * 0.45,
      seed: Math.random() * 100,
    }));

    let speed = 0.0008; // Continuous forward camera velocity

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // --- 1. Realistic Sky Background ---
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY + 100);
      skyGrad.addColorStop(0, '#1e40af'); // Deep rich blue
      skyGrad.addColorStop(0.4, '#3b82f6'); // Azure blue
      skyGrad.addColorStop(0.85, '#93c5fd'); // Soft atmospheric blue-white
      skyGrad.addColorStop(1, '#e0f2fe'); // Light horizon mist
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // --- 2. Sunlight Glow at Horizon (Centered behind hero content) ---
      const sunX = width * 0.5;
      const sunY = horizonY - 15;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 380);
      sunGlow.addColorStop(0, 'rgba(255, 253, 235, 0.95)');
      sunGlow.addColorStop(0.2, 'rgba(254, 243, 199, 0.6)');
      sunGlow.addColorStop(0.55, 'rgba(191, 219, 254, 0.35)');
      sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, width, height);

      // --- 3. Render Continuous Cloud Ocean with Depth/Parallax ---
      // Sort clouds by depth (far to near)
      clouds.sort((a, b) => a.z - b.z);

      clouds.forEach((cloud) => {
        // Advance depth forward
        cloud.z += speed;
        if (cloud.z > 1) {
          cloud.z -= 1;
          cloud.xRatio = (Math.random() - 0.5) * 2.5;
        }

        // Perspective scaling
        const perspective = Math.pow(cloud.z, 2.2); // Exponential depth feel
        const screenY = horizonY + perspective * (height - horizonY);
        const screenX = width / 2 + cloud.xRatio * width * (0.3 + perspective * 0.8);
        const currentRadius = cloud.radius * (0.25 + perspective * 1.8);
        const currentOpacity = Math.min(cloud.opacity, cloud.z * 1.2);

        // Volumetric Cloud Puff Painting
        const cloudGlow = ctx.createRadialGradient(
          screenX - currentRadius * 0.2,
          screenY - currentRadius * 0.3,
          currentRadius * 0.1,
          screenX,
          screenY,
          currentRadius
        );

        // Warm light top, cool soft blue shadow bottom
        cloudGlow.addColorStop(0, `rgba(255, 255, 255, ${currentOpacity})`);
        cloudGlow.addColorStop(0.5, `rgba(241, 245, 249, ${currentOpacity * 0.85})`);
        cloudGlow.addColorStop(0.85, `rgba(203, 213, 225, ${currentOpacity * 0.45})`);
        cloudGlow.addColorStop(1, 'rgba(203, 213, 225, 0)');

        ctx.beginPath();
        ctx.fillStyle = cloudGlow;
        ctx.arc(screenX, screenY, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // --- 4. Haze Overlay at Horizon Line ---
      const hazeGrad = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 60);
      hazeGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      hazeGrad.addColorStop(0.5, 'rgba(255, 247, 237, 0.45)');
      hazeGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = hazeGrad;
      ctx.fillRect(0, horizonY - 40, width, 100);

      if (!reduceMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <section className="relative min-h-screen w-full overflow-hidden pt-28 pb-16 flex flex-col items-center justify-between selection:bg-sky-200">
      {/* Dynamic Aerial Sky & Cloud Ocean Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Hero Outer Content Container */}
      <div className="relative z-10 max-w-7xl w-full px-4 sm:px-6 lg:px-8 mx-auto flex flex-col items-center justify-between flex-grow">
        
        {/* Upper Main Section: Left Cards | Center Hero | Right Card */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-4 mb-12">
          
          {/* LEFT SIDE: 3 Floating Compact Glass Feature Cards */}
          <div className="lg:col-span-3 flex flex-col gap-4 items-center lg:items-start order-2 lg:order-1">
            
            {/* Feature 1 */}
            <div className="w-full max-w-xs backdrop-blur-md bg-white/30 border border-white/50 rounded-2xl p-4 shadow-lg shadow-sky-900/5 hover:bg-white/40 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-600/10 text-blue-700">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-950/70">CLI & SDK</h4>
                  <p className="text-sm font-medium text-slate-900">Instant Deployments</p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="w-full max-w-xs backdrop-blur-md bg-white/30 border border-white/50 rounded-2xl p-4 shadow-lg shadow-sky-900/5 hover:bg-white/40 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-600/10 text-sky-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-950/70">Enterprise</h4>
                  <p className="text-sm font-medium text-slate-900">Zero Trust Security</p>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="w-full max-w-xs backdrop-blur-md bg-white/30 border border-white/50 rounded-2xl p-4 shadow-lg shadow-sky-900/5 hover:bg-white/40 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-600/10 text-amber-700">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-950/70">Edge Mesh</h4>
                  <p className="text-sm font-medium text-slate-900">&lt;10ms Global Latency</p>
                </div>
              </div>
            </div>

          </div>

          {/* CENTER: Core Hero Text & CTAs */}
          <div className="lg:col-span-6 flex flex-col items-center text-center order-1 lg:order-2">
            
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md bg-white/40 border border-white/60 shadow-sm mb-6">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-xs font-semibold text-blue-950 tracking-wide">
                Next-Gen Cloud Infrastructure
              </span>
            </div>

            {/* Central Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08] mb-6">
              From Code <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-sky-600 to-indigo-800">
                to Cloud.
              </span>
            </h1>

            {/* Sub-description */}
            <p className="max-w-xl text-base sm:text-lg text-slate-700 font-normal leading-relaxed mb-8">
              Deploy, scale, and manage automated cloud environments instantly. 
              Designed for high-growth engineering teams built on speed and reliability.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
              <button 
                onClick={() => navigate(ROUTES.SIGNUP)}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                Start Deploying Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => {
                  const pricingSection = document.getElementById('pricing');
                  if (pricingSection) {
                    pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    navigate(ROUTES.HOME);
                  }
                }}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl backdrop-blur-md bg-white/40 hover:bg-white/60 text-slate-900 font-medium border border-white/60 shadow-sm transition-all cursor-pointer"
              >
                Book Infrastructure Demo
              </button>
            </div>

          </div>

          {/* RIGHT SIDE: 1 Floating Deployment Card */}
          <div className="lg:col-span-3 flex justify-center lg:justify-end order-3">
            <div className="w-full max-w-xs backdrop-blur-md bg-white/35 border border-white/60 rounded-2xl p-5 shadow-xl shadow-sky-900/10">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/50">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Active Pipeline</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Live
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <GitBranch className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">main branch</p>
                    <p className="text-[11px] text-slate-500">Commit: #8f32a0c</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-slate-600">Region</span>
                  <span className="font-medium text-slate-900">us-east (N. Virginia)</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Build Time</span>
                  <span className="font-medium text-slate-900">1.42s</span>
                </div>

                <div className="pt-2 flex items-center gap-2 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SSL & Edge Routing Active</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM: Floating Dashboard Product Preview */}
        <div className="w-full max-w-5xl mt-4 relative z-20">
          <div className="backdrop-blur-xl bg-white/50 border border-white/70 rounded-2xl p-2 sm:p-3 shadow-2xl shadow-blue-950/20">
            {/* Dashboard Header Mock */}
            <div className="bg-slate-900/90 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-2 text-xs text-slate-400 font-mono">cloud-cluster-prod // overview</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-blue-400" /> CPU: 14%
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-400" /> RAM: 2.1 GB
                  </span>
                </div>
              </div>

              {/* Dashboard Content Mock */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">Total Requests / min</p>
                  <p className="text-2xl font-bold text-white">142,890</p>
                  <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full w-[72%]" />
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">Global Health Index</p>
                  <p className="text-2xl font-bold text-emerald-400">99.99%</p>
                  <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[99%]" />
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">Active Edge Nodes</p>
                  <p className="text-2xl font-bold text-sky-300">324 Nodes</p>
                  <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-400 rounded-full w-[85%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}