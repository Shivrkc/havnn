import { useRef } from 'react';
import { motion, MotionStyle } from 'motion/react';
import {
  GithubLogo,
  DockerLogo,
  PostgreSQLLogo,
  AwsLogo,
  KubernetesLogo
} from '../ui/BrandIcons';

interface TechItem {
  name: string;
  category: string;
  icon: React.ReactNode;
}

export interface TechStripMotionProps {
  style?: MotionStyle;
}

export default function TechStrip({ style }: TechStripMotionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);

  const technologies: TechItem[] = [
    {
      name: 'GitHub',
      category: 'Source Control & Webhooks',
      icon: <GithubLogo className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />,
    },
    {
      name: 'Docker',
      category: 'Isolated Containerization',
      icon: <DockerLogo className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />,
    },
    {
      name: 'PostgreSQL',
      category: 'Managed Relational Databases',
      icon: <PostgreSQLLogo className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />,
    },
    {
      name: 'AWS',
      category: 'Cloud Infrastructure & S3',
      icon: <AwsLogo className="w-5 h-3.5 sm:w-6 sm:h-4.5" />,
    },
    {
      name: 'Kubernetes',
      category: 'Container Orchestration',
      icon: <KubernetesLogo className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />,
    },
  ];

  const sequence = [...technologies, ...technologies];

  const renderLogoItem = (tech: TechItem, key: string, isClone: boolean) => (
    <div
      key={key}
      className="flex items-center gap-2 sm:gap-2.5 group/item cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors duration-200 select-none shrink-0"
      title={`${tech.name} - ${tech.category}`}
      aria-label={isClone ? undefined : `${tech.name}: ${tech.category}`}
      tabIndex={isClone ? -1 : 0}
    >
      <div className="text-slate-500 dark:text-slate-400 group-hover/item:text-blue-600 dark:group-hover/item:text-[#7BBBFF] transition-colors duration-200">
        {tech.icon}
      </div>
      <span className="text-xs sm:text-sm font-semibold tracking-tight text-slate-700 dark:text-slate-300 group-hover/item:text-slate-900 dark:group-hover/item:text-white transition-colors duration-200 whitespace-nowrap">
        {tech.name}
      </span>
    </div>
  );

  return (
    <motion.section
      ref={sectionRef}
      style={style}
      id="tech-strip"
      className="relative z-20 w-full py-8 md:py-10 border-y border-slate-200/50 dark:border-[#282d37]/60 bg-white/40 dark:bg-[#0d0f12]/60 backdrop-blur-md overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">

          {/* Header Label: DevOps Stack positioning */}
          <div className="shrink-0 text-center md:text-left">
            <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">
              Supported DevOps Stacks
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-normal mt-0.5">
              Deploy any application containerized or pushed via Git
            </p>
          </div>

          {/* Continuous Infinite Logo Marquee (hardware-accelerated CSS animation) */}
          <div
            className="flex-1 min-w-0 w-full overflow-hidden relative group [mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]"
            aria-label="Supported DevOps Stacks Marquee"
          >
            <div className="flex animate-tech-marquee">
              {/* Primary Sequence Track */}
              <div className="flex shrink-0 items-center gap-8 sm:gap-12 lg:gap-16 pr-8 sm:pr-12 lg:pr-16">
                {sequence.map((tech, idx) =>
                  renderLogoItem(tech, `orig-${tech.name}-${idx}`, false)
                )}
              </div>

              {/* Duplicate Clone Track for Seamless Loop */}
              <div
                className="flex shrink-0 items-center gap-8 sm:gap-12 lg:gap-16 pr-8 sm:pr-12 lg:pr-16"
                aria-hidden="true"
              >
                {sequence.map((tech, idx) =>
                  renderLogoItem(tech, `clone-${tech.name}-${idx}`, true)
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </motion.section>
  );
}
