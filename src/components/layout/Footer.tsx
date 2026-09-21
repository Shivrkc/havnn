import React, { useEffect, useRef } from 'react';
import { Github, Twitter, Disc as Discord } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import Logo from '../ui/Logo';
import { useTheme } from '../../context/ThemeContext';

export default function Footer() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Continuous Dynamic Sky + Cloud Ocean Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.offsetHeight || 500);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const cloudCount = 30;
    interface CloudPuff {
      xRatio: number;
      z: number;
      radius: number;
      opacity: number;
    }

    const clouds: CloudPuff[] = Array.from({ length: cloudCount }, () => ({
      xRatio: (Math.random() - 0.5) * 2.5,
      z: Math.random(),
      radius: 120 + Math.random() * 160,
      opacity: 0.35 + Math.random() * 0.35,
    }));

    const speed = 0.0003;
    const isDark = theme === 'dark';

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Sky gradient continuation matching bottom of FAQ
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isDark) {
        skyGrad.addColorStop(0, '#0d0f12');
        skyGrad.addColorStop(0.5, '#14171d');
        skyGrad.addColorStop(1, '#0d0f12');
      } else {
        skyGrad.addColorStop(0, '#f0f9ff'); // Smooth sky transition
        skyGrad.addColorStop(0.6, '#bae6fd');
        skyGrad.addColorStop(1, '#e0f2fe');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Cloud ocean depth rendering
      clouds.sort((a, b) => a.z - b.z);

      clouds.forEach((cloud) => {
        cloud.z += speed;
        if (cloud.z > 1) {
          cloud.z -= 1;
          cloud.xRatio = (Math.random() - 0.5) * 2.5;
        }

        const perspective = Math.pow(cloud.z, 2);
        const screenY = perspective * height;
        const screenX = width / 2 + cloud.xRatio * width * (0.4 + perspective * 0.7);
        const currentRadius = cloud.radius * (0.4 + perspective * 1.5);
        const currentOpacity = Math.min(cloud.opacity, cloud.z * 1.1);

        const cloudGlow = ctx.createRadialGradient(
          screenX - currentRadius * 0.2,
          screenY - currentRadius * 0.3,
          currentRadius * 0.1,
          screenX,
          screenY,
          currentRadius
        );

        if (isDark) {
          cloudGlow.addColorStop(0, `rgba(191, 196, 207, ${currentOpacity * 0.45})`);
          cloudGlow.addColorStop(0.6, `rgba(35, 39, 48, ${currentOpacity * 0.3})`);
          cloudGlow.addColorStop(1, 'rgba(13, 15, 18, 0)');
        } else {
          cloudGlow.addColorStop(0, `rgba(255, 255, 255, ${currentOpacity})`);
          cloudGlow.addColorStop(0.6, `rgba(241, 245, 249, ${currentOpacity * 0.8})`);
          cloudGlow.addColorStop(1, 'rgba(203, 213, 225, 0)');
        }

        ctx.beginPath();
        ctx.fillStyle = cloudGlow;
        ctx.arc(screenX, screenY, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  return (
    <footer className="relative pt-12 pb-16 overflow-hidden text-slate-700 dark:text-slate-300">
      
      {/* Background Canvas extending cloud environment */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-10">
        
        {/* Main Footer Glass Card */}
        <div className="backdrop-blur-xl bg-white/40 hover:bg-white/50 dark:bg-[#16191f]/80 dark:hover:bg-[#1e222b]/90 border border-white/70 dark:border-[#282d37] rounded-3xl p-8 sm:p-12 shadow-xl shadow-sky-900/5 dark:shadow-black/30 transition-colors duration-300 motion-safe:animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-10 border-b border-slate-200/60 dark:border-slate-800 text-left">
            
            {/* Brand Info */}
            <div className="md:col-span-2 space-y-4">
              <div 
                onClick={() => navigate(ROUTES.HOME)}
                className="flex items-center gap-2.5 cursor-pointer group inline-block"
              >
                <Logo />
              </div>
              <p className="text-slate-600 dark:text-slate-300 max-w-sm text-xs leading-relaxed font-medium">
                HAVN is the developer-centric platform to build, deploy, and scale modern web applications with zero ops friction.
              </p>
              
              {/* Social Media Links */}
              <div className="flex items-center gap-3 pt-2">
                <a
                  href="https://github.com/Shivrkc/cloudforge"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="HAVN GitHub Repository"
                  className="w-9 h-9 rounded-xl bg-white/60 hover:bg-white/90 dark:bg-[#1e222b] dark:hover:bg-[#282d37] border border-white/80 dark:border-[#282d37] flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-2xs hover:shadow-xs transition-all duration-200"
                >
                  <Github className="w-4 h-4" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="HAVN Twitter Profile"
                  className="w-9 h-9 rounded-xl bg-white/60 hover:bg-white/90 dark:bg-[#1e222b] dark:hover:bg-[#282d37] border border-white/80 dark:border-[#282d37] flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-2xs hover:shadow-xs transition-all duration-200"
                >
                  <Twitter className="w-4 h-4" />
                </a>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="HAVN Discord Server"
                  className="w-9 h-9 rounded-xl bg-white/60 hover:bg-white/90 dark:bg-[#1e222b] dark:hover:bg-[#282d37] border border-white/80 dark:border-[#282d37] flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-2xs hover:shadow-xs transition-all duration-200"
                >
                  <Discord className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Nav Links Column 1: Product */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Product</h4>
              <ul className="space-y-2.5 font-medium">
                <li>
                  <a href="#features" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a>
                </li>
                <li>
                  <a href="#why-choose-us" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Why Choose Us</a>
                </li>
                <li>
                  <a href="#faq" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">FAQ</a>
                </li>
                <li>
                  <button 
                    onClick={() => navigate(ROUTES.DASHBOARD)} 
                    className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left cursor-pointer"
                  >
                    Dashboard
                  </button>
                </li>
              </ul>
            </div>

            {/* Nav Links Column 2: Resources */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Resources</h4>
              <ul className="space-y-2.5 font-medium">
                <li>
                  <a href="https://github.com/Shivrkc/cloudforge" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="https://github.com/Shivrkc/cloudforge" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    API Reference
                  </a>
                </li>
                <li>
                  <a href="https://github.com/Shivrkc/cloudforge" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    Status
                  </a>
                </li>
              </ul>
            </div>

            {/* Nav Links Column 3: Company */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Company</h4>
              <ul className="space-y-2.5 font-medium">
                <li>
                  <a href="https://github.com/Shivrkc/cloudforge" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="https://github.com/Shivrkc/cloudforge" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="https://github.com/Shivrkc/cloudforge" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="https://github.com/Shivrkc/cloudforge" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-medium text-slate-600 dark:text-slate-400">
            <p>© {new Date().getFullYear()} HAVN Inc. All rights reserved.</p>
            <p className="text-slate-500 dark:text-slate-400">Designed for developers. Built for speed.</p>
          </div>
        </div>

      </div>

      {/* Embedded Animation & Accessibility Styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .transition-colors, .transition-all {
            transition: none !important;
          }
        }
      `}</style>
    </footer>
  );
}