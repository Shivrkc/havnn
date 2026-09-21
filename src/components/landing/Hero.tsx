import React from 'react';
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
import HavnClouds from './HavnClouds';

export default function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen w-full overflow-hidden pt-28 pb-16 flex flex-col items-center justify-between selection:bg-sky-200">
      {/* Animated 3D Vanta Clouds Background */}
      <HavnClouds className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden" />

      {/* Hero Outer Content Container */}
      <div className="relative z-10 max-w-7xl w-full px-4 sm:px-6 lg:px-8 mx-auto flex flex-col items-center justify-between flex-grow">
        
        {/* Upper Main Section: Left Cards | Center Hero | Right Card */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-center mt-4 mb-12">
          
          {/* LEFT SIDE: 3 Floating Compact Glass Feature Cards */}
          <div className="w-full flex flex-col gap-4 items-center md:contents lg:flex lg:flex-col lg:col-span-3 lg:gap-4 lg:items-start order-2 lg:order-1">
            
            {/* Feature 1 */}
            <div className="w-full max-w-xs mx-auto lg:mx-0 backdrop-blur-md bg-white/30 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 rounded-2xl p-4 shadow-lg shadow-sky-900/5 dark:shadow-black/20 hover:bg-white/40 dark:hover:bg-slate-900/60 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-950/70 dark:text-blue-300">CLI & SDK</h4>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Instant Deployments</p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="w-full max-w-xs mx-auto lg:mx-0 backdrop-blur-md bg-white/30 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 rounded-2xl p-4 shadow-lg shadow-sky-900/5 dark:shadow-black/20 hover:bg-white/40 dark:hover:bg-slate-900/60 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-600/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-950/70 dark:text-blue-300">Enterprise</h4>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Zero Trust Security</p>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="w-full max-w-xs mx-auto lg:mx-0 backdrop-blur-md bg-white/30 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 rounded-2xl p-4 shadow-lg shadow-sky-900/5 dark:shadow-black/20 hover:bg-white/40 dark:hover:bg-slate-900/60 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-600/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-950/70 dark:text-blue-300">Edge Mesh</h4>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">&lt;10ms Global Latency</p>
                </div>
              </div>
            </div>

          </div>

          {/* CENTER: Core Hero Text & CTAs */}
          <div className="w-full md:col-span-2 lg:col-span-6 flex flex-col items-center text-center order-first lg:order-2">
            
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md bg-white/40 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 shadow-sm mb-6">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
              <span className="text-xs font-semibold text-blue-950 dark:text-blue-200 tracking-wide">
                Next-Gen Cloud Infrastructure
              </span>
            </div>

            {/* Central Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.08] mb-6">
              From Code <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-sky-600 to-indigo-800 dark:from-blue-400 dark:via-sky-300 dark:to-indigo-300">
                to Cloud.
              </span>
            </h1>

            {/* Sub-description */}
            <p className="max-w-xl text-base sm:text-lg text-slate-700 dark:text-slate-100 font-normal leading-relaxed mb-8 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
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
                  const targetSection = document.getElementById('why-choose-us');
                  if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    navigate(ROUTES.HOME);
                  }
                }}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl backdrop-blur-md bg-white/40 hover:bg-white/60 dark:bg-slate-800/60 dark:hover:bg-slate-700/60 text-slate-900 dark:text-white font-medium border border-white/60 dark:border-slate-700 shadow-sm transition-all cursor-pointer"
              >
                Why Choose HAVN
              </button>
            </div>

          </div>

          {/* RIGHT SIDE: 1 Floating Deployment Card */}
          <div className="w-full flex justify-center md:contents lg:flex lg:col-span-3 lg:justify-end order-3">
            <div className="w-full max-w-xs mx-auto lg:mx-0 backdrop-blur-md bg-white/35 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 rounded-2xl p-5 shadow-xl shadow-sky-900/10 dark:shadow-black/30">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/50 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Active Pipeline</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  Live
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <GitBranch className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">main branch</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Commit: #8f32a0c</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-slate-600 dark:text-slate-400">Region</span>
                  <span className="font-medium text-slate-900 dark:text-white">us-east (N. Virginia)</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Build Time</span>
                  <span className="font-medium text-slate-900 dark:text-white">1.42s</span>
                </div>

                <div className="pt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SSL & Edge Routing Active</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM: Floating Dashboard Product Preview */}
        <div className="w-full max-w-5xl mt-4 relative z-20">
          <div className="backdrop-blur-xl bg-white/50 dark:bg-slate-900/50 border border-white/70 dark:border-white/10 rounded-2xl p-2 sm:p-3 shadow-2xl shadow-blue-950/20 dark:shadow-black/50">
            {/* Dashboard Header Mock */}
            <div className="bg-slate-900/90 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-2 text-xs text-slate-400 font-mono">demo-environment // preview</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-blue-400" /> CPU: Normal
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-400" /> RAM: Normal
                  </span>
                </div>
              </div>

              {/* Dashboard Content Mock */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">Requests / min</p>
                  <p className="text-xl sm:text-2xl font-bold text-white tracking-wide">Sample Stream</p>
                  <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full w-[65%]" />
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">Global Health</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-wide">Operational</p>
                  <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[95%]" />
                  </div>
                </div>

                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">Demo Environment</p>
                  <p className="text-xl sm:text-2xl font-bold text-sky-300 tracking-wide">Active Sandbox</p>
                  <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-400 rounded-full w-[80%]" />
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