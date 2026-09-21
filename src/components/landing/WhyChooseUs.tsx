import React, { useEffect, useRef, useState } from 'react';
import { 
  Bot, 
  KeyRound, 
  GitBranch, 
  GraduationCap, 
  Terminal, 
  HeartHandshake, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useTheme } from '../../context/ThemeContext';

interface USPItem {
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  title: string;
  summary: string;
  badge: string;
  bulletPoints: string[];
}

const US_POINTS: USPItem[] = [
  {
    icon: HeartHandshake,
    tag: 'Empowering & Accessible',
    title: 'Beginner-Friendly Deployment Experience',
    summary: 'Most cloud consoles throw dense stack traces and obscure exit codes at you. HAVN translates infrastructure complexity into intuitive, step-by-step guidance so you understand what is happening under the hood.',
    badge: 'Human-First Architecture',
    bulletPoints: [
      'No previous DevOps or cloud architecture experience required',
      'Intuitive error states with clear contextual explanations',
      'Guided workflows designed to demystify containerization'
    ]
  },
  {
    icon: Bot,
    tag: 'AI Diagnostics',
    title: 'HAVN AI Assistant for Logs',
    summary: 'Our integrated Google Gemini AI engine inspects stdout and stderr streams in real time. It decodes cryptic build and runtime exceptions into plain English, providing verified root causes and actionable code remedies.',
    badge: 'Interactive Terminal Citations',
    bulletPoints: [
      'Plain-English root cause breakdowns for failed builds',
      'Dual-mode intelligence: Beginner-friendly & Expert modes',
      'Clickable log sequence badges that navigate directly to failure lines'
    ]
  },
  {
    icon: ShieldCheck,
    tag: 'Pre-Flight Safety',
    title: 'Environment Variable Validation',
    summary: 'Runtime crashes due to missing secrets are the number-one cause of failed deployments. HAVN proactively performs pre-flight schema checks, highlighting missing variables before the Docker build ever starts.',
    badge: 'Zero Runtime Surprises',
    bulletPoints: [
      'Pre-flight schema inspection for required environment secrets',
      'Encrypted key-value matrix with instant validation status',
      'Eliminates silent 500 runtime crashes after successful builds'
    ]
  },
  {
    icon: GitBranch,
    tag: 'Streamlined DevOps',
    title: 'Developer-Friendly Deployment Workflow',
    summary: 'Connect your GitHub account in seconds. HAVN automatically detects changes, orchestrates isolated container builds, deploys edge routes, and provisions managed databases—all managed from a unified dashboard.',
    badge: 'Git-to-Cloud in Seconds',
    bulletPoints: [
      'One-click GitHub repository import with branch filtering',
      'Automated container builds with caching for lightning cold starts',
      'Seamless managed PostgreSQL database provisioning'
    ]
  },
  {
    icon: GraduationCap,
    tag: 'Skill Acceleration',
    title: 'Learning-Focused Cloud Platform',
    summary: 'HAVN is specifically tailored for engineers mastering modern cloud development. Every pipeline event, log stream, and environment config is structured to help you learn DevOps principles by doing.',
    badge: 'Master DevOps by Doing',
    bulletPoints: [
      'Interactive explanations of Dockerfiles and container lifecycles',
      'Transparent deployment duration, exit codes, and health monitors',
      'Ideal companion for students, bootcampers, and growing teams'
    ]
  },
  {
    icon: Terminal,
    tag: 'Crystal Readability',
    title: 'Clear, Human-Readable Deployment Logs',
    summary: 'Never drown in endless unformatted terminal walls again. HAVN streams structured build and runtime logs with explicit status glyphs, lifecycle markers, sequence numbers, and real-time filtering.',
    badge: 'High-Contrast Developer Console',
    bulletPoints: [
      'High-contrast ANSI styling with status glyphs (✓, ✕, ⚠, ℹ, →)',
      'Deterministic sequence numbering for reproducible diagnostics',
      'Live search and log stream categorization (STDOUT, STDERR, SYSTEM)'
    ]
  }
];

function USPCard({ 
  item, 
  index 
}: { 
  item: USPItem; 
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  const Icon = item.icon;

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
        animationDelay: `${index * 80}ms`
      }}
      className="group relative backdrop-blur-xl bg-white/40 hover:bg-white/60 dark:bg-[#16191f]/80 dark:hover:bg-[#1e222b]/90 border border-white/60 hover:border-white/90 dark:border-[#282d37] dark:hover:border-[#374151] rounded-3xl p-7 sm:p-8 shadow-lg shadow-sky-900/5 dark:shadow-black/30 hover:shadow-xl hover:shadow-blue-600/10 transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default motion-safe:animate-fade-in-up"
    >
      {/* Light Reflection Glow Overlay */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-white/40 dark:bg-white/5 blur-xl rounded-full pointer-events-none group-hover:translate-x-10 group-hover:translate-y-10 transition-transform duration-700 ease-out" />

      {/* Top Border Highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="space-y-5 relative z-10">
        {/* Card Header: Icon & Badge */}
        <div className="flex items-center justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/70 dark:bg-[#1e222b] border border-white/80 dark:border-[#282d37] shadow-xs flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 group-hover:scale-105 transition-all duration-300">
            <Icon className="w-6 h-6 transition-transform duration-300 group-hover:-translate-y-0.5" />
          </div>
          <span className="text-[11px] font-mono font-bold text-blue-800 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 px-3 py-1 rounded-full shadow-2xs">
            {item.badge}
          </span>
        </div>

        {/* Card Title & Description */}
        <div className="space-y-2.5 text-left">
          <p className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {item.tag}
          </p>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
            {item.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            {item.summary}
          </p>
        </div>

        {/* Bullet Points */}
        <div className="pt-2 border-t border-slate-200/50 dark:border-[#282d37] space-y-2">
          {item.bulletPoints.map((point, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{point}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WhyChooseUs() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dynamic Sky & Cloud Ocean Background Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.offsetHeight || 900);

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
      opacity: 0.32 + Math.random() * 0.38,
    }));

    const speed = 0.0004;
    const isDark = theme === 'dark';

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Sky Gradient Continuation
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isDark) {
        skyGrad.addColorStop(0, '#0d0f12');
        skyGrad.addColorStop(0.5, '#14171d');
        skyGrad.addColorStop(1, '#0d0f12');
      } else {
        skyGrad.addColorStop(0, '#f0f9ff'); // Smooth match with Features bottom
        skyGrad.addColorStop(0.5, '#bae6fd');
        skyGrad.addColorStop(1, '#e0f2fe'); // Smooth match with FAQ top
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
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  return (
    <section 
      id="why-choose-us" 
      className="py-28 relative overflow-hidden text-slate-900 dark:text-white selection:bg-blue-600/30 selection:text-white"
    >
      {/* Background Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
        
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/50 dark:bg-[#16191f]/90 border border-white/80 dark:border-[#282d37] rounded-full px-4 py-1 text-xs text-blue-900 dark:text-blue-300 font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>The HAVN Advantage</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Why Engineering Teams &amp; Learners Choose HAVN
          </h2>

          <p className="text-base sm:text-lg text-slate-700 dark:text-slate-300 font-normal leading-relaxed">
            Traditional cloud platforms assume you are already a seasoned DevOps architect. HAVN removes the intimidation from cloud infrastructure—combining automated container workflows with proactive AI diagnostics and an empowering learning environment.
          </p>
        </div>

        {/* 6 Core USPs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {US_POINTS.map((item, index) => (
            <USPCard key={item.title} item={item} index={index} />
          ))}
        </div>

        {/* Bottom Banner / Action Reassurance */}
        <div className="pt-4 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-2xl bg-white/40 dark:bg-[#16191f]/85 border border-white/70 dark:border-[#282d37] rounded-3xl p-6 sm:p-8 shadow-xl shadow-sky-900/5 dark:shadow-black/30 max-w-4xl mx-auto w-full text-left">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Ready to experience cloud deployments without the headache?
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-normal">
                Deploy your first GitHub repository in under 60 seconds with guided AI assistance.
              </p>
            </div>

            <button
              onClick={() => navigate(ROUTES.SIGNUP)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
