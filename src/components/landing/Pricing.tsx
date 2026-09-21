import React, { useEffect, useRef, useState } from 'react';
import { Check, Info, Sparkles } from 'lucide-react';
import { PRICING_PLANS } from '../../data/mockData';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useTheme } from '../../context/ThemeContext';

// Translucent Glass Pricing Card with Interactive Mouse Tilt
function GlassPricingCard({
  plan,
  billingCycle,
  onSelect,
  index
}: {
  plan: any;
  billingCycle: 'monthly' | 'annually';
  onSelect: (id: string) => void;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  const isPopular = plan.popular;

  // Custom Price Overrides matching ₹0, ₹599, and ₹999
  const getPrice = () => {
    let basePrice = 0;
    if (plan.id === 'hobby') basePrice = 0;
    else if (plan.id === 'pro') basePrice = 599;
    else if (plan.id === 'enterprise') basePrice = 999;
    else basePrice = plan.price;

    if (billingCycle === 'annually' && basePrice > 0) {
      return Math.floor(basePrice * 0.8);
    }
    return basePrice;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -2.5;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 2.5;

    setTransform(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`);
  };

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)');
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        transition: isHovered
          ? 'transform 0.15s ease-out, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
          : 'transform 0.4s ease-out, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        animationDelay: `${index * 90}ms`
      }}
      className={`relative backdrop-blur-xl rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 cursor-pointer motion-safe:animate-fade-in-up ${
        isPopular
          ? 'bg-white/60 dark:bg-[#16191f]/90 border-2 border-blue-500 shadow-xl shadow-blue-600/15 md:-translate-y-2 overflow-visible'
          : 'bg-white/40 hover:bg-white/60 dark:bg-[#16191f]/80 dark:hover:bg-[#1e222b]/90 border border-white/60 hover:border-white/90 dark:border-[#282d37] dark:hover:border-[#374151] shadow-lg shadow-sky-900/5 dark:shadow-black/30 hover:shadow-xl hover:shadow-blue-600/10 overflow-hidden'
      }`}
    >
      {/* Light Reflection Glow Container */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-white/40 dark:bg-white/5 blur-xl rounded-full group-hover:translate-x-10 group-hover:translate-y-10 transition-transform duration-700 ease-out" />
      </div>

      {/* Refined & Unclipped Popular Badge */}
      {isPopular && (
        <div className="absolute top-4 right-4 sm:right-5 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 border border-blue-400/50 text-white text-[10px] tracking-wider font-mono uppercase px-3 py-1 rounded-full font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 z-20">
          <Sparkles className="w-3 h-3 fill-white/30 text-white" /> Most Popular Choice
        </div>
      )}

      <div className="space-y-6 text-left relative z-10">
        <div className="space-y-2 pt-1">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed min-h-[40px] font-normal pr-4">
            {plan.description}
          </p>
        </div>

        {/* Pricing Display */}
        <div className="flex items-baseline gap-1.5 py-4 border-b border-slate-200/60 dark:border-slate-800">
          <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            ₹{getPrice()}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">/ month</span>
        </div>

        {/* Feature Checklist */}
        <ul className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
          {plan.features.map((feature: string, idx: number) => (
            <li key={idx} className="flex items-start gap-3">
              <div
                className={`p-0.5 rounded-full mt-0.5 flex-shrink-0 ${
                  isPopular
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="leading-tight text-slate-700 dark:text-slate-300">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-8 space-y-3 relative z-10">
        <button
          type="button"
          onClick={() => onSelect(plan.id)}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            isPopular
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 active:scale-95'
              : 'bg-white/60 dark:bg-slate-800/80 border border-white/80 dark:border-slate-700 hover:bg-white/90 dark:hover:bg-slate-700 text-slate-900 dark:text-white shadow-2xs active:scale-95'
          }`}
        >
          {plan.cta}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
          {plan.id === 'hobby' ? 'No credit card required' : 'Cancel anytime, instantly'}
        </p>
      </div>
    </div>
  );
}

export default function Pricing() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handlePlanSelection = (planId: string) => {
    if (planId === 'enterprise') {
      alert('Your Enterprise Sales request is logged in this preview! Opening registration form.');
    }
    navigate(ROUTES.SIGNUP);
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

    const cloudCount = 40;
    interface CloudPuff {
      xRatio: number;
      z: number;
      radius: number;
      opacity: number;
    }

    const clouds: CloudPuff[] = Array.from({ length: cloudCount }, () => ({
      xRatio: (Math.random() - 0.5) * 2.5,
      z: Math.random(),
      radius: 100 + Math.random() * 150,
      opacity: 0.3 + Math.random() * 0.4,
    }));

    const speed = 0.0005;
    const isDark = theme === 'dark';

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Sky gradient continuation
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isDark) {
        skyGrad.addColorStop(0, '#0d0f12');
        skyGrad.addColorStop(0.5, '#14171d');
        skyGrad.addColorStop(1, '#0d0f12');
      } else {
        skyGrad.addColorStop(0, '#f0f9ff'); // Top transition matching bottom of Features
        skyGrad.addColorStop(0.5, '#bae6fd');
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
    <section id="pricing" className="py-28 relative overflow-hidden text-slate-900 dark:text-white selection:bg-sky-200">
      
      {/* Background Canvas extending cloud environment */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 relative z-10">
        
        {/* Header content block */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/50 dark:bg-slate-900/60 border border-white/80 dark:border-white/15 rounded-full px-4 py-1.5 text-xs text-blue-900 dark:text-blue-300 font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>FLEXIBLE SCALE INFRASTRUCTURE</span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            Predictable resource bounds.
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto font-normal">
            From isolated testing hobby microenvironments to production global routing layers, lock down transparent cloud spending with zero surprise adjustments.
          </p>
          
          {/* Monthly / Annual Billing Selector */}
          <div className="pt-3 flex justify-center">
            <div className="inline-flex items-center p-1.5 bg-white/40 dark:bg-slate-900/60 border border-white/70 dark:border-white/15 rounded-full backdrop-blur-xl shadow-xs">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`text-xs px-5 py-2 font-bold rounded-full transition-all duration-200 cursor-pointer ${
                  billingCycle === 'monthly' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Monthly billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annually')}
                className={`text-xs px-5 py-2 font-bold rounded-full transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  billingCycle === 'annually' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Annually</span>
                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Option Glass Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          {PRICING_PLANS?.map((plan: any, idx: number) => (
            <GlassPricingCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              onSelect={handlePlanSelection}
              index={idx}
            />
          ))}
        </div>

        {/* Enterprise Glass Banner */}
        <div className="backdrop-blur-xl bg-white/40 dark:bg-slate-900/50 border border-white/70 dark:border-white/15 max-w-4xl mx-auto rounded-2xl p-5 flex items-start gap-4 shadow-lg shadow-sky-900/5 dark:shadow-black/20">
          <div className="p-2 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed text-left font-medium">
            Need a custom deployment layout or looking to migrate a high-volume application? We offer customized micro-vms, dedicated VPC clusters, and custom data processing parameters.{' '}
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                navigate(ROUTES.SIGNUP);
              }}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold underline underline-offset-4 decoration-blue-500/30 hover:decoration-blue-600 transition-colors"
            >
              Contact Enterprise Sales
            </a>
          </p>
        </div>

      </div>

      {/* Embedded Animations */}
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
        }
      `}</style>
    </section>
  );
}