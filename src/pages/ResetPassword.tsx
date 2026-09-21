import React, { useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { ROUTES } from "../constants/routes";
import { resetPassword } from "../services/auth.service";
import { useCanvasSky } from "../utils/useCanvasSky";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Dynamic Theme-Aware 2D Canvas Atmosphere
  useCanvasSky(canvasRef);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword(token, password);

      setMessage(result.message || "Password reset successfully.");

      setTimeout(() => {
        navigate(ROUTES.LOGIN);
      }, 1500);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between relative overflow-x-hidden font-sans selection:bg-blue-600/30 selection:text-white pt-20">
      {/* Background Animated Sky Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Main Floating Translucent Glass Interface */}
      <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="max-w-md w-full backdrop-blur-2xl bg-white/60 hover:bg-white/65 dark:bg-[#16191f]/85 dark:hover:bg-[#16191f]/90 border border-white/90 dark:border-[#282d37] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-sky-950/20 dark:shadow-black/60 relative transition-all duration-300 animate-fade-in-up">
          
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-300 text-[11px] font-bold shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                SECURITY VERIFICATION
              </div>
              <h2 className="text-2xl sm:text-3xl font-sans font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight">Reset password</h2>
              <p className="text-xs text-slate-700 dark:text-slate-400 font-sans font-semibold leading-relaxed">
                Create a strong new password for your HAVN account.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 dark:bg-red-950/40 border border-red-300/80 dark:border-red-800/80 rounded-xl text-xs text-red-800 dark:text-red-300 font-semibold flex items-center gap-2 backdrop-blur-sm animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800/80 rounded-xl text-xs text-emerald-900 dark:text-emerald-300 font-semibold flex items-center gap-2 backdrop-blur-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{message} Redirecting to login...</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider block">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-white/75 dark:bg-[#12151a] focus:bg-white dark:focus:bg-[#16191f] border border-white/90 dark:border-[#282d37] focus:border-blue-500 dark:focus:border-blue-500 rounded-xl text-xs text-slate-900 dark:text-[#f1f3f5] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all duration-200 shadow-2xs focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider block">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-white/75 dark:bg-[#12151a] focus:bg-white dark:focus:bg-[#16191f] border border-white/90 dark:border-[#282d37] focus:border-blue-500 dark:focus:border-blue-500 rounded-xl text-xs text-slate-900 dark:text-[#f1f3f5] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all duration-200 shadow-2xs focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-70 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all active:scale-[0.98] mt-2 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Resetting password...
                  </span>
                ) : (
                  "Reset Password"
                )}
              </button>
            </form>

            <div className="pt-2 text-center border-t border-slate-200/80 dark:border-[#282d37]">
              <button
                type="button"
                onClick={() => navigate(ROUTES.LOGIN)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Login
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="relative z-20 py-4 text-center text-xs text-slate-800 dark:text-slate-400 font-bold">
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