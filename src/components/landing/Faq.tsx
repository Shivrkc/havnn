import { useState, useRef, useEffect } from 'react';
import { HelpCircle, Plus, Minus, ArrowUpRight } from 'lucide-react';
import { GithubLogo } from '../ui/BrandIcons';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { EASE_PREMIUM, useMotionEnvironment } from './motionSystem';

interface FaqItem {
  question: string;
  answer: string;
}

const HAVN_FAQS: FaqItem[] = [
  {
    question: 'What is HAVN?',
    answer: 'HAVN is a developer-centric cloud deployment platform designed to make containerized hosting intuitive, transparent, and accessible. It bridges the gap between simple static hosts and complex enterprise cloud consoles.'
  },
  {
    question: 'How does HAVN deploy an application?',
    answer: 'Connect your GitHub account and choose a repository. On every git push or pull request, HAVN checks your environment secrets, builds an isolated container image with layer caching, and routes traffic through our edge proxy with automatic SSL.'
  },
  {
    question: 'Does HAVN work with GitHub?',
    answer: 'Yes. HAVN uses official GitHub OAuth integration to automatically detect repositories, listen for webhook commit triggers, and provision branch deployments with zero complex configuration.'
  },
  {
    question: 'What does environment variable validation do?',
    answer: 'Missing runtime secrets are the #1 cause of deployment failure. HAVN runs pre-flight schema checks against your configuration before launching containers, alerting you immediately to missing keys to prevent silent runtime crashes.'
  },
  {
    question: 'What does the HAVN AI Assistant do?',
    answer: 'HAVN AI inspects build and runtime stdout/stderr log streams in real time. Instead of forcing you to decipher cryptic stack traces, HAVN AI decodes errors into plain English root causes and suggests actionable fixes.'
  },
  {
    question: 'Is HAVN beginner-friendly?',
    answer: 'Yes! HAVN is tailored to demystify DevOps for students and independent builders. Every pipeline event, log trace, and environment variable is presented with clear contextual guidance rather than obscure exit codes.'
  }
];

export default function Faq() {
  const containerRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [maxTravel, setMaxTravel] = useState(380);
  const [isDesktop, setIsDesktop] = useState(true);

  const { isCinematicActive } = useMotionEnvironment();

  // Desktop vs mobile viewport tracking
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isScrollDriven = isDesktop && isCinematicActive;

  // Local section scroll progress across the FAQ reading window
  // Tightened offset and 120vh container height gives quick, intentional traversal
  // The complete question list traverses in roughly one continuous scroll gesture
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.12', 'end 0.80'],
  });

  // Calculate dynamic travel distance based on total list height and visible reading window
  useEffect(() => {
    if (!isScrollDriven) return;
    const updateTravel = () => {
      if (!listRef.current || !viewportRef.current) return;
      const listH = listRef.current.scrollHeight;
      const vpH = viewportRef.current.clientHeight;
      const travel = Math.max(0, listH - vpH + 36);
      setMaxTravel(travel);
    };

    updateTravel();
    const ro = new ResizeObserver(updateTravel);
    if (listRef.current) ro.observe(listRef.current);
    if (viewportRef.current) ro.observe(viewportRef.current);
    window.addEventListener('resize', updateTravel);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateTravel);
    };
  }, [isScrollDriven, openIndex]);

  // Direct transform interpolation: proportional to native document scroll
  const listY = useTransform(scrollYProgress, [0, 1], [0, -maxTravel]);

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      ref={containerRef}
      id="faq"
      className={`${
        isScrollDriven ? 'relative min-h-[120vh]' : 'py-20 sm:py-24 relative overflow-hidden'
      } text-slate-900 dark:text-white selection:bg-blue-600/30`}
    >
      <div className={`${
        isScrollDriven
          ? 'sticky top-24 lg:top-28 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2'
          : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10'
      }`}>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">

          {/* LEFT COLUMN: Eyebrow + Heading + Subtitle + Reassurance (Firmly anchored) */}
          <div className="lg:col-span-5 text-left space-y-5">
            <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/60 dark:bg-[#16191f]/90 border border-slate-200/80 dark:border-[#282d37] rounded-full px-4 py-1 text-xs text-blue-900 dark:text-[#7BBBFF] font-bold shadow-xs">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600 dark:text-[#7BBBFF]" />
              <span>Got Questions?</span>
            </div>

            <h2 className="font-display text-3xl sm:text-5xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              Frequently Asked Questions
            </h2>

            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed font-normal">
              Everything you need to know about setting up integrations, automated builds, environment validations, and AI diagnostics on HAVN.
            </p>

            <div className="pt-2">
              <div className="p-5 rounded-2xl bg-white/50 dark:bg-[#16191f]/80 border border-slate-200/70 dark:border-[#282d37] backdrop-blur-md space-y-2">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Still have questions?
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Explore our GitHub repository to learn more about our architecture or connect with the project.
                </p>
                <a
                  href="https://github.com/Shivrkc/cloudforge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-[#7BBBFF] hover:underline pt-1"
                >
                  <GithubLogo className="w-3.5 h-3.5 fill-current" />
                  <span>Visit GitHub Repository</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: FAQ Question Reading Viewport */}
          <div
            ref={viewportRef}
            className={`lg:col-span-7 ${
              isScrollDriven
                ? 'h-[520px] lg:h-[540px] overflow-hidden relative pr-1'
                : 'space-y-3.5 text-left'
            }`}
          >
            {/* Top & Bottom Ambient Edge Fades for the Desktop Reading Window */}
            {isScrollDriven && (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[var(--color-background)] to-transparent z-20"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--color-background)] to-transparent z-20"
                />
              </>
            )}

            {/* Vertically Translated Question List */}
            <motion.div
              ref={listRef}
              data-faq-list
              style={isScrollDriven ? { y: listY, willChange: 'transform' } : undefined}
              className="space-y-3.5 text-left pt-1 pb-4"
            >
              {HAVN_FAQS.map((faq, index) => {
                const isOpen = openIndex === index;
                const contentId = `faq-answer-${index}`;
                const headerId = `faq-header-${index}`;

                return (
                  <div
                    key={faq.question}
                    data-faq-item={index + 1}
                    className={`rounded-2xl transition-colors duration-200 border ${
                      isScrollDriven ? 'bg-white/85 dark:bg-[#16191f]/95' : 'backdrop-blur-xl bg-white/70 dark:bg-[#16191f]/95'
                    } ${
                      isOpen
                        ? 'border-blue-500/40 dark:border-blue-500/30 shadow-md'
                        : 'hover:bg-white/95 dark:hover:bg-[#1e222b]/95 border-white/80 dark:border-[#282d37]'
                    }`}
                  >
                    <h3>
                      <button
                        type="button"
                        id={headerId}
                        aria-expanded={isOpen}
                        aria-controls={contentId}
                        onClick={() => toggleAccordion(index)}
                        className="w-full px-5 sm:px-6 py-4 sm:py-4.5 flex items-center justify-between text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-2xl"
                      >
                        <span className={`font-semibold text-sm sm:text-base lg:text-lg leading-snug transition-colors ${
                          isOpen ? 'text-blue-600 dark:text-[#7BBBFF]' : 'text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-[#7BBBFF]'
                        }`}>
                          {faq.question}
                        </span>
                        <motion.span
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.25, ease: EASE_PREMIUM }}
                          className={`ml-3 sm:ml-4 p-1.5 rounded-lg border shrink-0 transition-colors ${
                            isOpen
                              ? 'bg-blue-50 dark:bg-[#1e222b] border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-[#7BBBFF]'
                              : 'bg-slate-100/80 dark:bg-[#1e222b]/60 border-slate-200 dark:border-[#282d37] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                          }`}
                        >
                          {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </motion.span>
                      </button>
                    </h3>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={contentId}
                          role="region"
                          aria-labelledby={headerId}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{
                            height: 'auto',
                            opacity: 1,
                            transition: {
                              height: { duration: 0.32, ease: EASE_PREMIUM },
                              opacity: { duration: 0.25, delay: 0.05 }
                            }
                          }}
                          exit={{
                            height: 0,
                            opacity: 0,
                            transition: {
                              height: { duration: 0.25, ease: EASE_PREMIUM },
                              opacity: { duration: 0.15 }
                            }
                          }}
                          className="overflow-hidden"
                        >
                          <p className="px-5 sm:px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                            {faq.answer}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          </div>

        </div>

      </div>
    </section>
  );
}