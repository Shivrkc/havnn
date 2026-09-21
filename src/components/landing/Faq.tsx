import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { FAQ_ITEMS } from '../../data/mockData';
import { useTheme } from '../../context/ThemeContext';

export default function Faq() {
  const { theme } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Continuous Dynamic Sky + Cloud Ocean Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.offsetHeight || 800);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const cloudCount = 35;
    interface CloudPuff {
      xRatio: number;
      z: number;
      radius: number;
      opacity: number;
    }

    const clouds: CloudPuff[] = Array.from({ length: cloudCount }, () => ({
      xRatio: (Math.random() - 0.5) * 2.5,
      z: Math.random(),
      radius: 110 + Math.random() * 160,
      opacity: 0.35 + Math.random() * 0.35,
    }));

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = mediaQuery.matches;

    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      if (!prefersReducedMotion && !animationFrameId) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMotionChange);
    }

    const speed = 0.0005;
    const isDark = theme === 'dark';

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Sky gradient continuation matching sky atmosphere
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isDark) {
        skyGrad.addColorStop(0, '#0d0f12');
        skyGrad.addColorStop(0.5, '#14171d');
        skyGrad.addColorStop(1, '#0d0f12');
      } else {
        skyGrad.addColorStop(0, '#e0f2fe'); // Top transition matching bottom of Pricing
        skyGrad.addColorStop(0.5, '#bae6fd');
        skyGrad.addColorStop(1, '#f0f9ff');
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

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMotionChange);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  return (
    <section id="faq" className="py-28 relative overflow-hidden text-slate-900 dark:text-white selection:bg-sky-200">
      
      {/* Background Canvas extending cloud environment */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16 relative z-10">
        
        {/* Header Block */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/50 dark:bg-slate-900/60 border border-white/80 dark:border-white/15 rounded-full px-4 py-1.5 text-xs text-blue-900 dark:text-blue-300 font-bold shadow-xs">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>FAQ DATABASE</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            Frequently Answered Concerns
          </h2>
          
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed font-normal">
            Everything you need to know about setting up integrations, automatic builds, bandwidth limitations, and high-performance serverless computations.
          </p>
        </div>

        {/* Expandable Accordion Glass List */}
        <div className="space-y-4 max-w-3xl mx-auto">
          {FAQ_ITEMS.map((faq: any, index: number) => {
            const isOpen = openIndex === index;
            const contentId = `faq-answer-${index}`;
            const headerId = `faq-header-${index}`;
            
            return (
              <div
                key={index}
                className={`rounded-2xl transition-all duration-300 border backdrop-blur-xl motion-safe:animate-fade-in-up ${
                  isOpen 
                    ? 'bg-white/60 dark:bg-[#16191f]/90 border-blue-500/50 shadow-xl shadow-blue-600/10' 
                    : 'bg-white/40 hover:bg-white/60 dark:bg-[#16191f]/80 dark:hover:bg-[#1e222b]/90 border border-white/60 hover:border-white/90 dark:border-[#282d37] dark:hover:border-[#374151] shadow-lg shadow-sky-900/5 dark:shadow-black/30'
                }`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <h3>
                  <button
                    type="button"
                    id={headerId}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    onClick={() => toggleAccordion(index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer group transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-2xl"
                  >
                    <span className={`font-bold text-base sm:text-lg leading-snug transition-colors ${
                      isOpen ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300'
                    }`}>
                      {faq.question}
                    </span>
                    <span className={`ml-4 p-2 rounded-xl border flex-shrink-0 transition-all duration-300 ${
                      isOpen 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                        : 'bg-white/60 dark:bg-[#1e222b] border-white/80 dark:border-[#282d37] text-slate-500 dark:text-slate-400 group-hover:border-blue-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                    }`}>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                </h3>

                {/* CSS Smooth Transition Expansion Container */}
                <div
                  id={contentId}
                  role="region"
                  aria-labelledby={headerId}
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen
                      ? 'grid-rows-[1fr] opacity-100 visible'
                      : 'grid-rows-[0fr] opacity-0 invisible'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 pt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal text-left border-t border-slate-200/50 dark:border-[#282d37]">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Developer Help Glass Banner */}
        <div className="text-center pt-2">
          <div className="inline-block backdrop-blur-xl bg-white/40 dark:bg-[#16191f]/80 border border-white/70 dark:border-[#282d37] rounded-2xl px-6 py-4 shadow-lg shadow-sky-900/5 dark:shadow-black/20">
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
              Have a technical query not listed in our database?{' '}
              <a
                href="https://github.com/Shivrkc/cloudforge"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold underline underline-offset-4 decoration-blue-500/30 hover:decoration-blue-600 transition-colors"
              >
                Reach out to our Core Developers
              </a>
            </p>
          </div>
        </div>

      </div>

      {/* Embedded Animations & Reduced Motion Compliance */}
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

        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .transition-all, .transition-colors, .transition-transform {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}