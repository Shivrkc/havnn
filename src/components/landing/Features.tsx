import React, { useEffect, useRef, useState } from 'react';
import { 
  GitBranch, 
  Rocket, 
  Container, 
  Bot, 
  Terminal, 
  KeyRound,
  ArrowUpRight
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const TECH_STACK = [
  { name: 'React', label: 'React' },
  { name: 'Node.js', label: 'Node.js' },
  { name: 'Docker', label: 'Docker' },
  { name: 'PostgreSQL', label: 'PostgreSQL' },
  { name: 'Prisma', label: 'Prisma' },
  { name: 'GitHub', label: 'GitHub' },
  { name: 'AWS', label: 'AWS' }
];

const FEATURES = [
  {
    icon: GitBranch,
    title: 'GitHub Integration',
    description: 'Organize, sync, and deploy your repositories automatically on every commit and pull request.',
    tag: 'CI/CD Pipelines'
  },
  {
    icon: Rocket,
    title: 'One-click Deployments',
    description: 'Build, deploy, and monitor applications with zero configuration or complex pipeline setup.',
    tag: 'Zero Friction'
  },
  {
    icon: Container,
    title: 'Docker Builder',
    description: 'Isolated micro-VM container builds with automatic package caching and fast cold starts.',
    tag: 'Containerized'
  },
  {
    icon: Bot,
    title: 'AI Deployment Assistant',
    description: 'Your smart companion for analyzing stdout logs, diagnosing errors, and suggesting fixes.',
    tag: 'HAVN AI'
  },
  {
    icon: Terminal,
    title: 'Deployment Logs',
    description: 'Stream live build and server logs with full context, search, filtering, and execution history.',
    tag: 'Real-time'
  },
  {
    icon: KeyRound,
    title: 'Environment Variables',
    description: 'Encrypted secret storage with pre-flight schema validation to prevent missing env variables.',
    tag: 'Security'
  }
];

// Refined iOS/macOS Translucent Glass Card with Subtle Lift
function GlassFeatureCard({ 
  feature, 
  index 
}: { 
  feature: typeof FEATURES[0]; 
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  const Icon = feature.icon;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Very subtle cursor parallax tilt (-2.5deg to +2.5deg max)
    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -2.5;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 2.5;

    setTransform(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

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
        transform: transform,
        transition: isHovered 
          ? 'transform 0.15s ease-out, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease' 
          : 'transform 0.4s ease-out, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        animationDelay: `${index * 80}ms`
      }}
      className="group relative backdrop-blur-xl bg-white/40 hover:bg-white/60 dark:bg-[#16191f]/80 dark:hover:bg-[#1e222b]/90 border border-white/60 hover:border-white/90 dark:border-[#282d37] dark:hover:border-[#374151] rounded-3xl p-6 sm:p-7 shadow-lg shadow-sky-900/5 dark:shadow-black/30 hover:shadow-xl hover:shadow-blue-600/10 transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer animate-fade-in-up"
    >
      {/* Light Reflection Glow Overlay */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-white/40 dark:bg-white/5 blur-xl rounded-full pointer-events-none group-hover:translate-x-10 group-hover:translate-y-10 transition-transform duration-700 ease-out" />

      {/* Subtle Top Border Glow */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="space-y-5 relative z-10">
        {/* Card Header: Icon & Tag */}
        <div className="flex items-center justify-between">
          <div className="w-11 h-11 rounded-2xl bg-white/70 dark:bg-[#1e222b] border border-white/80 dark:border-[#282d37] shadow-xs flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 group-hover:scale-105 transition-all duration-300">
            <Icon className="w-5 h-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
          </div>
          <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-[#1e222b]/80 border border-white/70 dark:border-[#282d37] px-3 py-1 rounded-full group-hover:text-blue-950 dark:group-hover:text-white transition-colors shadow-2xs">
            {feature.tag}
          </span>
        </div>

        {/* Card Title & Description */}
        <div className="space-y-2 text-left">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center justify-between">
            <span>{feature.title}</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all duration-300 -translate-x-1 group-hover:translate-x-0" />
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Features() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Seamless Cloud Ocean Extension Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.offsetHeight || 800);
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false;

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
      if (reduceMotion) {
        render();
      }
    };
    window.addEventListener('resize', handleResize);

    const cloudCount = 45;
    interface CloudPuff {
      xRatio: number;
      z: number;
      radius: number;
      opacity: number;
    }

    const clouds: CloudPuff[] = Array.from({ length: cloudCount }, () => ({
      xRatio: (Math.random() - 0.5) * 2.5,
      z: Math.random(),
      radius: 90 + Math.random() * 140,
      opacity: 0.3 + Math.random() * 0.4,
    }));

    const speed = 0.0006;
    const isDark = theme === 'dark';

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Continuous Aerial Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isDark) {
        skyGrad.addColorStop(0, '#0d0f12');
        skyGrad.addColorStop(0.5, '#14171d');
        skyGrad.addColorStop(1, '#0d0f12');
      } else {
        skyGrad.addColorStop(0, '#e0f2fe'); // Soft horizon transition from Hero
        skyGrad.addColorStop(0.5, '#bae6fd'); // Light sky blue
        skyGrad.addColorStop(1, '#f0f9ff'); // Very soft sky bottom
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Render Continuous Cloud Ocean
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
  }, [theme]);

  return (
    <section id="features" className="py-28 relative overflow-hidden text-slate-900 dark:text-white selection:bg-sky-200">
      
      {/* Dynamic Canvas Continuing the Sky & Cloud Ocean Environment */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-24">
        
        {/* Trusted Ecosystems Banner */}
        <div className="space-y-6 text-center">
          <p className="text-[11px] font-mono font-bold text-blue-950/60 dark:text-blue-300/80 uppercase tracking-widest">
            Trusted & Supported Ecosystems
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 opacity-90">
            {TECH_STACK.map((tech) => (
              <div 
                key={tech.name} 
                className="flex items-center gap-2 backdrop-blur-md bg-white/40 dark:bg-[#16191f]/80 border border-white/60 dark:border-[#282d37] px-4 py-1.5 rounded-full text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/70 dark:hover:bg-[#1e222b] hover:border-white dark:hover:border-[#374151] transition-all duration-200 text-xs font-semibold shadow-2xs cursor-default"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-xs" />
                <span>{tech.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section Heading */}
        <div className="space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/50 dark:bg-[#16191f]/90 border border-white/80 dark:border-[#282d37] rounded-full px-4 py-1 text-xs text-blue-900 dark:text-blue-300 font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
              <span>Platform Capabilities</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              Everything You Need to Deploy Better
            </h2>
            
            <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed">
              Designed for modern development workflows. High-performance infrastructure without the ops complexity.
            </p>
          </div>

          {/* 3-Column Light/Dark Glass Feature Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {FEATURES.map((feature, idx) => (
              <GlassFeatureCard 
                key={feature.title} 
                feature={feature} 
                index={idx} 
              />
            ))}
          </div>
        </div>

      </div>

      {/* Embedded Styles for Staggered Entrance and Motion Reduction */}
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