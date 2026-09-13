import { useState, FormEvent, useEffect, useRef } from 'react';
import { Mail, Lock, Eye, EyeOff, Github, Chrome, Rocket, Bot, BarChart3, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { login, getOAuthUrl } from "../services/auth.service";

export default function Login() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // High-Altitude Blue Sky & Realistic Horizontal Drifting Cloud Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      if (reduceMotion) {
        render();
      }
    };
    window.addEventListener('resize', handleResize);

    // Realistic Cloud Formations
    const cloudCount = 38;
    interface CloudPuff {
      x: number;
      y: number;
      z: number;
      radius: number;
      opacity: number;
      driftSpeed: number;
    }

    const clouds: CloudPuff[] = Array.from({ length: cloudCount }, () => ({
      x: Math.random() * width,
      y: height * 0.12 + Math.random() * (height * 0.78),
      z: Math.random(),
      radius: 130 + Math.random() * 210,
      opacity: 0.35 + Math.random() * 0.4,
      driftSpeed: 0.18 + Math.random() * 0.32,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep Rich High-Altitude Sky Blue Atmospheric Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#0284c7');    // Deep Vibrant Sky Blue Top
      skyGrad.addColorStop(0.30, '#38bdf8'); // Clear Mid Sky Blue
      skyGrad.addColorStop(0.65, '#7dd3fc'); // Atmospheric Atmosphere Blue
      skyGrad.addColorStop(0.88, '#bae6fd'); // Soft Horizon Sky Blue
      skyGrad.addColorStop(1, '#e0f2fe');    // Natural Crisp Base
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Natural Sunlight Atmospheric Bloom
      const sunGlow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.15,
        10,
        width * 0.5,
        height * 0.15,
        width * 0.65
      );
      sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      sunGlow.addColorStop(0.4, 'rgba(224, 242, 254, 0.35)');
      sunGlow.addColorStop(0.8, 'rgba(125, 211, 252, 0.1)');
      sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, width, height);

      // Render Layered Volumetric White Clouds
      clouds.sort((a, b) => a.z - b.z);

      clouds.forEach((cloud) => {
        // Continuous Horizontal Drift
        cloud.x += cloud.driftSpeed * (0.6 + cloud.z * 0.4);
        if (cloud.x - cloud.radius > width) {
          cloud.x = -cloud.radius;
          cloud.y = height * 0.12 + Math.random() * (height * 0.78);
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

        cloudGlow.addColorStop(0, `rgba(255, 255, 255, ${currentOpacity * 0.95})`);
        cloudGlow.addColorStop(0.5, `rgba(248, 250, 252, ${currentOpacity * 0.8})`);
        cloudGlow.addColorStop(0.85, `rgba(226, 232, 240, ${currentOpacity * 0.25})`);
        cloudGlow.addColorStop(1, 'rgba(203, 213, 225, 0)');

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
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all security fields.");
      return;
    }

    if (!email.includes("@")) {
      setError("Please insert a valid email address.");
      return;
    }

    try {
      setIsLoading(true);

      await login({
        email,
        password,
        rememberMe,
      });

      navigate(ROUTES.DASHBOARD);
    } catch (error: any) {
      setError(
        error?.response?.data?.message ||
        "Invalid email or password."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = (provider: "google" | "github") => {
    window.location.href = getOAuthUrl(provider);
  };

  return (
    <main id="login-container" className="min-h-screen flex flex-col justify-between relative overflow-x-hidden font-sans selection:bg-sky-200">
      
      {/* Background Animated Sky Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Main Floating Translucent Glass Login Interface */}
      <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center backdrop-blur-2xl bg-white/60 hover:bg-white/65 border border-white/90 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-sky-950/20 relative transition-all duration-300 motion-safe:animate-fade-in-up">
          
          {/* Left Side Content - Form Panel */}
          <div className="space-y-6 w-full">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/90 border border-blue-200 text-blue-900 text-[11px] font-bold shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                SECURE AUTHENTICATION
              </div>
              <h2 className="text-2xl sm:text-3xl font-sans font-extrabold text-slate-900 tracking-tight">Welcome back</h2>
              <p className="text-xs text-slate-700 font-sans font-semibold">
                Sign in to continue deploying your projects.
              </p>
            </div>

            {error && (
              <div role="alert" className="p-3 bg-red-500/10 border border-red-300/80 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2 backdrop-blur-sm animate-shake">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="login-email"
                    name="email"
                    autoComplete="email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/75 focus:bg-white border border-white/90 focus:border-blue-500 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 shadow-2xs focus:ring-2 focus:ring-blue-500/20 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">Password</label>
                  <button
  type="button"
  onClick={() => navigate("/forgot-password")}
  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
>
  Forgot password?
</button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="login-password"
                    name="password"
                    autoComplete="current-password"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-white/75 focus:bg-white border border-white/90 focus:border-blue-500 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 shadow-2xs focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-800 font-semibold select-none cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                  <span className="group-hover:text-slate-900 transition-colors">Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-70 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all active:scale-[0.98] mt-2 cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing you in...
                  </span>
                ) : (
                  'Log In'
                )}
              </button>
            </form>

            <div className="relative my-6 text-center">
              <span className="absolute inset-x-0 top-1/2 h-px bg-slate-300/80 -translate-y-1/2"></span>
              <span className="relative bg-white/90 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest rounded-full">
                or continue with
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuthLogin("github")}
                className="flex items-center justify-center gap-2 py-2.5 border border-white/90 hover:border-blue-300 bg-white/75 hover:bg-white text-xs text-slate-800 font-bold rounded-xl transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Github className="w-4 h-4 text-slate-800" /> GitHub
              </button>
              <button
                type="button"
                onClick={() => handleOAuthLogin("google")}
                className="flex items-center justify-center gap-2 py-2.5 border border-white/90 hover:border-blue-300 bg-white/75 hover:bg-white text-xs text-slate-800 font-bold rounded-xl transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Chrome className="w-4 h-4 text-blue-600" /> Google
              </button>
            </div>

            <p className="text-center text-xs text-slate-700 font-sans pt-2 font-semibold">
              Don't have an account?{' '}
              <button onClick={() => navigate(ROUTES.SIGNUP)} className="text-blue-600 hover:text-blue-700 font-extrabold hover:underline cursor-pointer">Sign Up</button>
            </p>
          </div>

          {/* Right Side Content - Translucent Glass Marketing Info Panel */}
          <div className="hidden md:flex flex-col justify-center h-full backdrop-blur-xl bg-white/40 border border-white/80 rounded-2xl p-7 space-y-7 shadow-2xs">

            {/* Deploy with confidence */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100/90 border border-blue-200 flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Rocket className="w-5 h-5 text-blue-600" />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Deploy with confidence
                </h3>

                <p className="mt-1.5 text-xs text-slate-700 leading-relaxed font-semibold">
                  Deploy directly from your Git repository with a clean, guided
                  workflow. Build, monitor, and manage your applications from one
                  place.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200/80"></div>

            {/* AI Assistant */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100/90 border border-blue-200 flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  AI that helps, not confuses
                </h3>

                <p className="mt-1.5 text-xs text-slate-700 leading-relaxed font-semibold">
                  HAVN explains deployment errors in plain English, suggests fixes,
                  and helps you move faster whether you're just starting or already
                  experienced.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200/80"></div>

            {/* Build & Grow */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100/90 border border-blue-200 flex items-center justify-center flex-shrink-0 shadow-2xs">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Build and grow
                </h3>

                <p className="mt-1.5 text-xs text-slate-700 leading-relaxed font-semibold">
                  Track deployments, monitor project history, and keep every release
                  organized as your applications evolve.
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="relative z-20 py-4 text-center text-xs text-slate-800 font-bold">
        © {new Date().getFullYear()} HAVN Inc. All rights reserved.
      </footer>

      {/* Embedded Animation Styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }

        .animate-shake {
          animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up, .animate-shake {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .transition-all, .transition-colors {
            transition: none !important;
          }
        }
      `}</style>
    </main>
  );
}