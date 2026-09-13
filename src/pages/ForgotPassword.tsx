import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { ROUTES } from "../constants/routes";
import { forgotPassword } from "../services/auth.service";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // High-Altitude Blue Sky & Realistic Horizontal Drifting Cloud Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

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
      skyGrad.addColorStop(0, "#0284c7");    // Deep Vibrant Sky Blue Top
      skyGrad.addColorStop(0.30, "#38bdf8"); // Clear Mid Sky Blue
      skyGrad.addColorStop(0.65, "#7dd3fc"); // Atmospheric Atmosphere Blue
      skyGrad.addColorStop(0.88, "#bae6fd"); // Soft Horizon Sky Blue
      skyGrad.addColorStop(1, "#e0f2fe");    // Natural Crisp Base
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
      sunGlow.addColorStop(0, "rgba(255, 255, 255, 0.7)");
      sunGlow.addColorStop(0.4, "rgba(224, 242, 254, 0.35)");
      sunGlow.addColorStop(0.8, "rgba(125, 211, 252, 0.1)");
      sunGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
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
        cloudGlow.addColorStop(1, "rgba(203, 213, 225, 0)");

        ctx.beginPath();
        ctx.fillStyle = cloudGlow;
        ctx.arc(cloud.x, cloud.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);

      const result = await forgotPassword(email);

      setMessage(
        result.message ||
          "If an account with that email exists, a password reset link has been sent."
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Unable to process your request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between relative overflow-x-hidden font-sans selection:bg-sky-200 pt-20">
      {/* Background Animated Sky Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Main Floating Translucent Glass Interface */}
      <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="max-w-md w-full backdrop-blur-2xl bg-white/60 hover:bg-white/65 border border-white/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-sky-950/20 relative transition-all duration-300 animate-fade-in-up">
          
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/90 border border-blue-200 text-blue-900 text-[11px] font-bold shadow-2xs">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                ACCOUNT RECOVERY
              </div>
              <h2 className="text-2xl sm:text-3xl font-sans font-extrabold text-slate-900 tracking-tight">Forgot password?</h2>
              <p className="text-xs text-slate-700 font-sans font-semibold leading-relaxed">
                Enter your email address and we'll send you instructions to reset your password.
              </p>
            </div>

            {error && (
              <div role="alert" className="p-3 bg-red-500/10 border border-red-300/80 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2 backdrop-blur-sm animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div role="status" aria-live="polite" className="p-3 bg-emerald-500/10 border border-emerald-300/80 rounded-xl text-xs text-emerald-900 font-semibold flex items-center gap-2 backdrop-blur-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white/75 focus:bg-white border border-white/90 focus:border-blue-500 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 shadow-2xs focus:ring-2 focus:ring-blue-500/20 font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-70 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all active:scale-[0.98] mt-2 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending reset link...
                  </span>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            <div className="pt-2 text-center border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => navigate(ROUTES.LOGIN)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Login
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="relative z-20 py-4 text-center text-xs text-slate-800 font-bold">
        © {new Date().getFullYear()} HAVN Inc. All rights reserved.
      </footer>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
      `}</style>
    </main>
  );
}