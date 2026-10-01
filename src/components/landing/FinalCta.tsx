import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Terminal, CheckCircle2 } from 'lucide-react';
import { GithubLogo } from '../ui/BrandIcons';
import { motion, useScroll, useTransform } from 'motion/react';
import { ROUTES } from '../../constants/routes';

export default function FinalCta() {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const cardScale = useTransform(scrollYProgress, [0, 0.4, 0.85, 1], [0.98, 1, 1, 0.99]);
  const cardOpacity = useTransform(scrollYProgress, [0, 0.25, 0.85, 1], [0.6, 1, 1, 0.8]);

  return (
    <section ref={sectionRef} className="py-16 sm:py-20 relative z-10 text-slate-900 dark:text-white selection:bg-blue-600/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Large Prominent Glass Card */}
        <motion.div
          style={{ scale: cardScale, opacity: cardOpacity }}
          className="relative overflow-hidden backdrop-blur-2xl bg-white/70 dark:bg-[#16191f]/90 border border-white/80 dark:border-[#282d37] rounded-3xl p-7 sm:p-12 lg:p-16 shadow-2xl shadow-sky-900/10 dark:shadow-black/40"
        >
          {/* Subtle Ambient Background Gradient Layers */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-sky-500/10 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">

            {/* Left Content Column */}
            <div className="lg:col-span-8 space-y-4 sm:space-y-5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-600 dark:text-[#7BBBFF] block">
                Ready to get started?
              </span>

              {/* Heading */}
              <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.08] max-w-2xl">
                From Code to Cloud in Minutes.
              </h2>

              {/* Subtitle */}
              <p className="max-w-xl text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
                Connect your GitHub repository and experience automated container deployments with intelligent AI log diagnostics and zero ops friction.
              </p>

              {/* CTA Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3.5">
                <button
                  onClick={() => navigate(ROUTES.SIGNUP)}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 group cursor-pointer active:scale-95"
                >
                  <span>Start Deploying Free</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <a
                  href="https://github.com/Shivrkc/cloudforge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl backdrop-blur-md bg-white/60 hover:bg-white/80 dark:bg-[#1e222b] dark:hover:bg-[#252a35] text-slate-800 dark:text-slate-200 font-semibold border border-slate-200/80 dark:border-[#282d37] shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <GithubLogo className="w-4 h-4 fill-current" />
                  <span>View on GitHub</span>
                </a>
              </div>
            </div>

            {/* Right Terminal Micro-Card */}
            <div className="lg:col-span-4 w-full flex justify-center lg:justify-end">
              <div className="w-full max-w-sm rounded-2xl bg-[#0d0f12] border border-[#282d37] p-5 font-mono text-xs shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#282d37] text-slate-400">
                  <span className="flex items-center gap-2 text-[11px]">
                    <Terminal className="w-3.5 h-3.5 text-blue-400" />
                    havn-cli // automated
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Ready</span>
                </div>

                <div className="space-y-1.5 text-slate-300 text-[11px]">
                  <p className="text-slate-500">$ havn deploy --prod</p>
                  <p className="text-emerald-400">✓ Repository verified</p>
                  <p className="text-emerald-400">✓ 8 secrets validated</p>
                  <p className="text-blue-400">⚡ https://app.havn.cloud</p>
                </div>

                <div className="pt-2 border-t border-[#282d37] flex items-center gap-1.5 text-[10px] text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Zero ops complexity required</span>
                </div>
              </div>
            </div>

          </div>

        </motion.div>

      </div>
    </section>
  );
}
