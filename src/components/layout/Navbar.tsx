// Navbar.tsx
import { useState, useEffect } from 'react';
import { Menu, X, Github } from 'lucide-react';
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import Logo from "../ui/Logo";
import ThemeToggle from "../ui/ThemeToggle";

interface NavbarProps {
  scrollToSection?: (id: string) => void;
}

export default function Navbar({ scrollToSection }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const isLanding = location.pathname === ROUTES.HOME;
  const isLogin = location.pathname === ROUTES.LOGIN;
  const isSignup = location.pathname === ROUTES.SIGNUP;
  const isDashboard = location.pathname === ROUTES.DASHBOARD;
  const isProfile = location.pathname === ROUTES.PROFILE;
  const isAuthApp = isDashboard || isProfile;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (sectionId: string) => {
    setIsMobileMenuOpen(false);
    if (!isLanding) {
      navigate(ROUTES.HOME);
      setTimeout(() => {
        scrollToSection?.(sectionId);
      }, 100);
    } else {
      scrollToSection?.(sectionId);
    }
  };

  return (
    <header
      id="main-navbar"
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-3 sm:pt-4 pointer-events-none transition-all duration-300"
    >
      <div
        className={`pointer-events-auto w-full max-w-6xl rounded-2xl transition-all duration-300 ease-out border ${
          isScrolled
            ? 'bg-white/80 dark:bg-[#16191f]/85 backdrop-blur-2xl border-white/80 dark:border-[#282d37] shadow-[0_12px_36px_0_rgba(0,0,0,0.08)] dark:shadow-[0_12px_36px_0_rgba(0,0,0,0.4)] py-2'
            : 'bg-white/40 dark:bg-[#16191f]/60 backdrop-blur-xl border-white/60 dark:border-[#282d37] hover:bg-white/55 dark:hover:bg-[#16191f]/80 hover:border-white/80 dark:hover:border-[#374151] py-2.5 shadow-[0_8px_30px_0_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_0_rgba(0,0,0,0.3)]'
        } px-5 sm:px-6 flex items-center justify-between`}
      >
        {/* LEFT: Brand / Logo */}
        <div className="flex items-center">
          <div 
            onClick={() => navigate(isAuthApp ? ROUTES.DASHBOARD : ROUTES.HOME)}
            className="flex items-center gap-2.5 cursor-pointer group transition-transform duration-200 hover:scale-[1.01]"
          >
            <Logo />
          </div>
        </div>

        {/* CENTER: Navigation Links (Landing only) */}
        {isLanding && (
          <nav className="hidden md:flex items-center gap-1 sm:gap-2 text-[13px] font-medium text-slate-700 dark:text-white/90">
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("features");
              }}
              className="px-3 py-1.5 rounded-lg hover:text-blue-600 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-200"
            >
              Features
            </a>
            <a
              href="#why-choose-us"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("why-choose-us");
              }}
              className="px-3 py-1.5 rounded-lg hover:text-blue-600 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-200"
            >
              Why Choose Us
            </a>
            <a
              href="#faq"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("faq");
              }}
              className="px-3 py-1.5 rounded-lg hover:text-blue-600 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-200"
            >
              FAQ
            </a>
          </nav>
        )}

        {/* RIGHT: Actions & CTAs */}
        <div className="hidden md:flex items-center gap-2">
          {/* Light / Dark Theme Toggle Button */}
          <ThemeToggle />

          {/* GitHub: secondary / utility action (subtle / ghost with icon) */}
          <a
            href="https://github.com/Shivrkc/cloudforge"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-transparent hover:border-slate-200/60 dark:hover:border-white/10 hover:bg-white/60 dark:hover:bg-white/10 rounded-xl transition-all duration-200 ease-out active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>

          {!isAuthApp && (
            <>
              {/* Login: secondary action (subtle / ghost) */}
              <button 
                onClick={() => navigate(ROUTES.LOGIN)}
                className={`inline-flex items-center justify-center h-8 px-3.5 text-xs font-medium rounded-xl border transition-all duration-200 ease-out active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1 ${
                  isLogin 
                    ? "text-blue-600 dark:text-white bg-white/60 dark:bg-white/10 border-slate-200/60 dark:border-white/10 font-semibold" 
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-transparent hover:border-slate-200/60 dark:hover:border-white/10 hover:bg-white/60 dark:hover:bg-white/10"
                }`}
              >
                Login
              </button>

              {/* Sign Up: primary action (dark/filled pill with high contrast) */}
              <button 
                onClick={() => navigate(ROUTES.SIGNUP)}
                className="inline-flex items-center justify-center h-8 px-3.5 text-xs font-semibold rounded-xl border border-slate-900 dark:border-[#f1f3f5] bg-slate-900 text-white dark:bg-[#f1f3f5] dark:text-[#0d0f12] hover:bg-slate-800 dark:hover:bg-white hover:border-slate-800 dark:hover:border-white shadow-xs hover:shadow-sm transition-all duration-200 ease-out active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1"
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        {/* Mobile Toggle Buttons (Theme Toggle + Menu Toggle) */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-slate-800 dark:text-white/90 hover:text-blue-600 dark:hover:text-white p-2 rounded-xl bg-white/40 dark:bg-white/10 border border-white/60 dark:border-white/20 backdrop-blur-md transition-all active:scale-95"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden pointer-events-auto absolute top-full left-4 right-4 mt-2 max-w-6xl mx-auto rounded-2xl bg-white/90 dark:bg-[#16191f]/95 backdrop-blur-2xl border border-white/80 dark:border-[#282d37] p-4 space-y-3 shadow-2xl transition-all text-slate-800 dark:text-[#f1f3f5]">
          {isLanding && (
            <div className="flex flex-col space-y-1 border-b border-slate-200/60 dark:border-[#282d37] pb-3">
              <a 
                href="#features" 
                onClick={(e) => { e.preventDefault(); handleNavClick('features'); }}
                className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white py-2 px-3 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
              >
                Features
              </a>
              <a 
                href="#why-choose-us" 
                onClick={(e) => { e.preventDefault(); handleNavClick('why-choose-us'); }}
                className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white py-2 px-3 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
              >
                Why Choose Us
              </a>
              <a 
                href="#faq" 
                onClick={(e) => { e.preventDefault(); handleNavClick('faq'); }}
                className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white py-2 px-3 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
              >
                FAQ
              </a>
            </div>
          )}

          <div className="flex flex-col space-y-2 pt-1">
            <a
              href="https://github.com/Shivrkc/cloudforge"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full h-9 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-[#282d37] bg-white/40 dark:bg-[#1e222b] hover:bg-white/70 dark:hover:bg-[#252a35] rounded-xl transition-all duration-200 ease-out active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>

            {!isAuthApp && (
              <>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate(ROUTES.LOGIN);
                  }}
                  className={`inline-flex items-center justify-center w-full h-9 text-xs font-medium transition-all duration-200 ease-out rounded-xl border active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                    isLogin 
                      ? "text-blue-600 dark:text-white bg-white/60 dark:bg-white/10 border-slate-200/80 dark:border-white/10 font-semibold"
                      : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-200/80 dark:border-[#282d37] bg-white/40 dark:bg-[#1e222b] hover:bg-white/70 dark:hover:bg-[#252a35]"
                  }`}
                >
                  Login
                </button>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate(ROUTES.SIGNUP);
                  }}
                  className="inline-flex items-center justify-center w-full h-9 text-xs font-semibold transition-all duration-200 ease-out rounded-xl bg-slate-900 text-white dark:bg-[#f1f3f5] dark:text-[#0d0f12] hover:bg-slate-800 dark:hover:bg-white border border-slate-900 dark:border-[#f1f3f5] shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}