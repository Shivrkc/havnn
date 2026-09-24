import { useState, FormEvent, useRef } from 'react';
import { Mail, Lock, Eye, EyeOff, Github, Chrome } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { login, getOAuthUrl } from "../services/auth.service";
import { useCanvasSky } from '../utils/useCanvasSky';
import HavnMascot, { MascotFieldFocus } from '../components/auth/HavnMascot';

export default function Login() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<MascotFieldFocus>('idle');

  // Dynamic Theme-Aware 2D Canvas Atmosphere
  useCanvasSky(canvasRef);



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
    <main 
      id="login-container" 
      className="min-h-screen flex flex-col justify-between relative overflow-x-hidden font-sans selection:bg-sky-200 pt-[var(--navbar-offset-mobile)] sm:pt-[var(--navbar-offset-desktop)]"
    >
      
      {/* Background Animated Sky Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Main Floating Translucent Glass Login Interface */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-6 px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="max-w-[740px] w-full my-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-7 items-stretch backdrop-blur-2xl bg-white/70 hover:bg-white/75 dark:bg-[#16191f]/85 dark:hover:bg-[#16191f]/90 border border-white/90 dark:border-[#282d37] rounded-3xl p-5 sm:p-6 md:p-7 shadow-2xl shadow-sky-950/15 dark:shadow-black/60 relative transition-all duration-300 motion-safe:animate-fade-in-up">
          
          {/* Left Side Content - Focused Authentication Form Panel */}
          <div className="flex flex-col justify-center w-full my-auto">
            {error && (
              <div role="alert" className="p-2.5 bg-red-500/10 dark:bg-red-950/40 border border-red-300/80 dark:border-red-800/80 rounded-xl text-xs text-red-800 dark:text-red-300 font-semibold flex items-center gap-2 backdrop-blur-sm animate-shake mb-3.5">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5" autoComplete="off">
              <div className="space-y-1">
                <label htmlFor="login-email" className="text-[11px] font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    id="login-email"
                    name="email"
                    autoComplete="off"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField('idle')}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2 bg-white/75 dark:bg-[#12151a] focus:bg-white dark:focus:bg-[#16191f] border border-white/90 dark:border-[#282d37] focus:border-blue-500 dark:focus:border-blue-500 rounded-xl text-xs text-slate-900 dark:text-[#f1f3f5] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all duration-200 shadow-2xs focus:ring-2 focus:ring-blue-500/20 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-[11px] font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider block">Password</label>
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    id="login-password"
                    name="password"
                    autoComplete="new-password"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField('idle')}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2 bg-white/75 dark:bg-[#12151a] focus:bg-white dark:focus:bg-[#16191f] border border-white/90 dark:border-[#282d37] focus:border-blue-500 dark:focus:border-blue-500 rounded-xl text-xs text-slate-900 dark:text-[#f1f3f5] placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all duration-200 shadow-2xs focus:ring-2 focus:ring-blue-500/20 font-mono"
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

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-300 font-semibold select-none cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12151a] text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                  <span className="group-hover:text-slate-900 dark:group-hover:text-[#f1f3f5] transition-colors">Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 disabled:opacity-70 text-white dark:text-slate-900 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] mt-1 cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white dark:text-slate-900" viewBox="0 0 24 24" fill="none">
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

            <div className="relative my-4 text-center">
              <span className="absolute inset-x-0 top-1/2 h-px bg-slate-300/80 dark:bg-[#282d37] -translate-y-1/2"></span>
              <span className="relative bg-white/90 dark:bg-[#16191f] px-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest rounded-full">
                or continue with
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleOAuthLogin("github")}
                className="flex items-center justify-center gap-2 py-2 border border-slate-200/90 dark:border-[#282d37] hover:border-slate-400 dark:hover:border-slate-500 bg-white/75 hover:bg-white dark:bg-[#1e222b] dark:hover:bg-[#252a35] text-xs text-slate-800 dark:text-[#f1f3f5] font-bold rounded-xl transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Github className="w-4 h-4 text-slate-800 dark:text-[#f1f3f5]" /> GitHub
              </button>
              <button
                type="button"
                onClick={() => handleOAuthLogin("google")}
                className="flex items-center justify-center gap-2 py-2 border border-slate-200/90 dark:border-[#282d37] hover:border-slate-400 dark:hover:border-slate-500 bg-white/75 hover:bg-white dark:bg-[#1e222b] dark:hover:bg-[#252a35] text-xs text-slate-800 dark:text-[#f1f3f5] font-bold rounded-xl transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Chrome className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Google
              </button>
            </div>

            <p className="text-center text-xs text-slate-700 dark:text-slate-400 font-sans pt-2.5 font-semibold">
              Don't have an account?{' '}
              <button onClick={() => navigate(ROUTES.SIGNUP)} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-extrabold hover:underline cursor-pointer">Sign Up</button>
            </p>
          </div>

          {/* Right Side Content - Compact Welcome Panel with Yeti & Bold Typographic Statement */}
          <div className="hidden md:flex flex-col justify-between items-center text-center h-full backdrop-blur-xl bg-gradient-to-b from-sky-400/10 via-blue-500/5 to-sky-400/15 dark:from-sky-500/10 dark:via-[#12151a]/50 dark:to-blue-600/10 border border-white/80 dark:border-[#282d37] rounded-2xl p-5 lg:p-6 shadow-2xs relative overflow-hidden select-none">
            {/* Ambient Soft Sky Glow Behind Yeti */}
            <div className="absolute inset-0 bg-radial from-sky-400/15 via-transparent to-transparent pointer-events-none" />

            {/* Yeti Mascot Section - Centerpiece */}
            <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full py-1">
              <HavnMascot focusedField={focusedField} isSubmitting={isLoading} hasError={!!error} />
            </div>

            {/* Minimalist Typographic Statement (Pinterest-Style) */}
            <div className="relative z-10 pt-2 pb-1 w-full text-left px-2">
              <h3 className="font-display text-2xl lg:text-[26px] font-black tracking-tight text-slate-900 dark:text-[#f1f3f5] leading-[1.05] uppercase">
                BUILD.<br />
                RUN. DEPLOY.
              </h3>
            </div>
          </div>

        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="relative z-20 py-4 text-center text-xs text-slate-800 dark:text-slate-400 font-bold">
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