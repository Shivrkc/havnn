import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, Send, RefreshCw, AlertTriangle, 
  HelpCircle, Zap, BookOpen, FileText, CheckCircle2,
  X, Compass, ShieldCheck, ArrowDown, Clock
} from 'lucide-react';
import { queryDeploymentAi, AiAction, AiMode } from '../../services/ai.service';
import havnUpiQr from '../../assets/havn-upi-qr.jpeg';
import HavnMascot from '../auth/HavnMascot';

const SUPPORT_PROMPT_STORAGE_KEY = 'havn-ai-support-prompt-seen';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  mode?: AiMode;
  action?: AiAction;
  question?: string;
  citedSequences?: number[];
  invalidCitations?: number[];
  citationsValidated?: boolean;
  cached?: boolean;
  cachedAt?: string;
  warning?: string;
  timestamp: Date;
}

interface HavnAiAssistantProps {
  deploymentId: string;
  deploymentStatus: string;
  projectName?: string;
  onSelectSequence?: (sequence: number) => void;
  isFullscreen?: boolean;
  isActive?: boolean;
}

export const HavnAiAssistant: React.FC<HavnAiAssistantProps> = ({
  deploymentId,
  deploymentStatus,
  projectName,
  onSelectSequence,
  isFullscreen = false,
  isActive = true,
}) => {
  const [mode, setMode] = useState<AiMode>('beginner');
  const [messages, setMessages] = useState<Message[]>([]);
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<{ action: AiAction; question?: string; mode: AiMode } | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Entrance cycle key to cleanly replay entrance animation when switching to AI tab
  const [entranceCycle, setEntranceCycle] = useState<number>(0);

  // Yeti greeting speech bubble state ("👋 Hi, I'm Hakka!")
  const [showGreeting, setShowGreeting] = useState<boolean>(false);

  // Re-trigger entrance animation when entering empty AI state or switching tabs to AI
  useEffect(() => {
    if (isActive && messages.length === 0 && !isLoading) {
      setEntranceCycle((c) => c + 1);
    }
  }, [isActive, messages.length, isLoading]);

  useEffect(() => {
    if (isActive && messages.length === 0 && !isLoading) {
      setShowGreeting(false);
      // Show greeting bubble during wave (~450ms after entrance starts)
      const showTimer = setTimeout(() => {
        setShowGreeting(true);
      }, 450);

      // Fade out smoothly after wave settles (~2800ms after entrance)
      const hideTimer = setTimeout(() => {
        setShowGreeting(false);
      }, 2800);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    } else {
      setShowGreeting(false);
    }
  }, [isActive, entranceCycle, messages.length, isLoading]);

  // Voluntary ₹20 support prompt state
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const pendingRequestRef = useRef<{ action: AiAction; question?: string; mode: AiMode } | null>(null);

  // Scroll management
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isAutoScrollRef = useRef<boolean>(true);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);

  const scrollToBottom = useCallback((force = false) => {
    if ((force || isAutoScrollRef.current) && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setIsAtBottom(true);
    }
  }, []);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const atBottom = scrollHeight - (scrollTop + clientHeight) < 60;
    isAutoScrollRef.current = atBottom;
    setIsAtBottom(atBottom);
  };

  const handleJumpToBottom = () => {
    isAutoScrollRef.current = true;
    scrollToBottom(true);
  };

  useEffect(() => {
    if (isAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [messages, isLoading, scrollToBottom]);

  // 3-second button cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setTimeout(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  /**
   * Executes the actual AI query.
   */
  const executeAiQuery = async (
    action: AiAction,
    question?: string,
    queryMode: AiMode = mode,
    isRetry: boolean = false
  ) => {
    if (isLoading || isSubmittingRef.current || (cooldownSeconds > 0 && !isRetry)) return; // Prevent duplicate submissions
    isSubmittingRef.current = true;
    setIsLoading(true);
    setCooldownSeconds(3);
    setErrorMessage(null);
    setRetryAfterSeconds(null);
    setLastAction({ action, question, mode: queryMode });

    // When a new query is submitted, ensure auto-scroll brings user down to view the new query
    isAutoScrollRef.current = true;
    setIsAtBottom(true);

    if (!isRetry) {
      // Format user-facing prompt label for chat history
      let userPromptLabel = '';
      switch (action) {
        case 'summary':
          userPromptLabel = 'Generate deployment summary';
          break;
        case 'analysis':
          userPromptLabel = 'Analyze deployment logs & root cause';
          break;
        case 'optimization':
          userPromptLabel = 'Suggest build optimizations';
          break;
        case 'learn':
          userPromptLabel = 'Explain build concepts & errors';
          break;
        case 'custom':
        default:
          userPromptLabel = question || 'Custom analysis request';
          break;
      }

      const userMessage: Message = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: 'user',
        text: userPromptLabel,
        mode: queryMode,
        action,
        question: action === 'custom' ? question : undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
    }

    try {
      const result = await queryDeploymentAi(deploymentId, {
        mode: queryMode,
        action,
        question: action === 'custom' ? question : undefined,
        bypassCache: isRetry,
      });

      const aiMessage: Message = {
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: 'ai',
        text: result.answer,
        mode: result.mode,
        action: result.action,
        question: result.question || (action === 'custom' ? question : undefined),
        citedSequences: result.citedSequences,
        invalidCitations: result.invalidCitations,
        citationsValidated: result.citationsValidated,
        cached: result.cached,
        cachedAt: result.cachedAt,
        warning: result.warning,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Clear custom question input ONLY after successful execution
      if (action === 'custom') {
        setCustomQuestion('');
      }
    } catch (err: any) {
      const backendError = err.response?.data;
      let errorText =
        backendError?.message ||
        err.message ||
        'Failed to get diagnosis from HAVN AI. Please retry.';
      const status = err.response?.status;
      const code = backendError?.code;

      // Sanitize if errorText contains raw JSON or Google RPC details
      if (typeof errorText === 'string' && errorText.includes('{') && errorText.includes('}')) {
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) {
            errorText = parsed.error.message;
          } else if (parsed.message) {
            errorText = parsed.message;
          }
        } catch {
          // Keep fallback
        }
      }

      const isQuotaExhausted =
        code === 'AI_QUOTA_EXHAUSTED' ||
        (typeof errorText === 'string' &&
          (errorText.includes('free-tier quota has been exhausted') ||
            errorText.includes('free_tier_requests') ||
            errorText.includes('plan and billing details') ||
            (errorText.toLowerCase().includes('quota') &&
              !errorText.toLowerCase().includes('rate limit'))));

      const isRateLimit =
        code === 'AI_RATE_LIMIT_EXCEEDED' ||
        (typeof errorText === 'string' &&
          (errorText.toLowerCase().includes('rate limit') ||
            errorText.includes('per_minute')));

      if (isQuotaExhausted) {
        errorText =
          'Gemini free-tier quota has been exhausted. Please try again after the quota resets or check your Google AI Studio quota.';
      } else if (isRateLimit) {
        errorText = 'AI rate limit reached. Please wait a moment before retrying.';
      } else if (status === 503 || code === 'AI_PROVIDER_UNAVAILABLE') {
        errorText =
          'The AI model is currently experiencing high demand. Spikes in demand are temporary. Please retry in a few moments.';
      } else if (status === 502 || code === 'AI_MODEL_UNAVAILABLE') {
        errorText =
          'Configured AI model is currently unavailable. Please verify GEMINI_MODEL.';
      }

      const retryAfter =
        backendError?.retryAfterSec ||
        (err.response?.headers?.['retry-after']
          ? parseInt(err.response.headers['retry-after'], 10)
          : null);

      // Do NOT show a short wait countdown for daily/free-tier quota exhaustion
      if (retryAfter && !isNaN(retryAfter) && !isQuotaExhausted) {
        setRetryAfterSeconds(retryAfter);
      } else {
        setRetryAfterSeconds(null);
      }

      setErrorMessage(errorText);
      // NOTE: We do NOT clear customQuestion on error so the user's typed question is preserved!
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  /**
   * Intercepts action triggers to show voluntary support prompt on user's FIRST request.
   */
  const handleActionClick = (action: AiAction, question?: string) => {
    if (isLoading || isSubmittingRef.current || cooldownSeconds > 0) return;
    const hasSeenPrompt = localStorage.getItem(SUPPORT_PROMPT_STORAGE_KEY);

    if (!hasSeenPrompt) {
      pendingRequestRef.current = { action, question, mode };
      setShowSupportModal(true);
      return;
    }

    // Directly execute if already seen
    executeAiQuery(action, question, mode, false);
  };

  const handleSupportModalContinue = () => {
    localStorage.setItem(SUPPORT_PROMPT_STORAGE_KEY, 'true');
    setShowSupportModal(false);
    const pending = pendingRequestRef.current;
    pendingRequestRef.current = null;
    if (pending) {
      executeAiQuery(pending.action, pending.question, pending.mode, false);
    }
  };

  const handleCustomSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoading || isSubmittingRef.current || cooldownSeconds > 0) return;
    const trimmed = customQuestion.trim();
    if (!trimmed) return;

    handleActionClick('custom', trimmed);
  };

  const handleRetry = () => {
    if (lastAction && !isLoading && !isSubmittingRef.current) {
      executeAiQuery(lastAction.action, lastAction.question, lastAction.mode, true);
    }
  };

  /**
   * Renders AI markdown-styled text with headers, bullet points, code blocks,
   * and clickable sequence badges.
   */
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Heading 3: ### ...
      if (line.startsWith('### ')) {
        const title = line.replace('### ', '').trim();
        return (
          <h4 key={idx} className="text-sm font-bold text-blue-700 dark:text-blue-400 mt-3 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400"></span>
            {title}
          </h4>
        );
      }

      // Heading 2: ## ...
      if (line.startsWith('## ')) {
        const title = line.replace('## ', '').trim();
        return (
          <h3 key={idx} className="text-sm font-extrabold text-slate-900 dark:text-white mt-4 mb-2 pb-1 border-b border-slate-200 dark:border-[#282d37]">
            {title}
          </h3>
        );
      }

      // Code block delimiters: ```bash / ```
      if (line.startsWith('```')) {
        return null;
      }

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemContent = line.trim().substring(2);
        return (
          <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 ml-4 list-disc leading-relaxed my-0.5">
            {renderLineWithBadges(itemContent)}
          </li>
        );
      }

      // Numbered steps
      const stepMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
      if (stepMatch) {
        return (
          <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 my-1">
            <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">{stepMatch[1]}.</span>
            <span className="leading-relaxed">{renderLineWithBadges(stepMatch[2])}</span>
          </div>
        );
      }

      // Empty line spacing
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }

      // Standard text line
      return (
        <p key={idx} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed my-1">
          {renderLineWithBadges(line)}
        </p>
      );
    });
  };

  /**
   * Replaces [Seq #N] sequence citations with clickable pill badges.
   */
  const renderLineWithBadges = (content: string) => {
    const parts = content.split(/(\[Seq\s*#\d+\])/gi);
    return parts.map((part, i) => {
      const match = part.match(/\[Seq\s*#(\d+)\]/i);
      if (match) {
        const seqNum = parseInt(match[1], 10);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelectSequence && onSelectSequence(seqNum)}
            className="inline-flex items-center gap-1 font-mono text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-1.5 py-0.2 rounded-md mx-0.5 transition-colors cursor-pointer"
            title={`Jump to Log Sequence #${seqNum}`}
          >
            Seq #{seqNum}
          </button>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white/75 dark:bg-[#0d0f12]/85 backdrop-blur-md text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* AI Controls Header: Single Compact Row on Desktop */}
      <div className={`px-4 ${isFullscreen ? 'sm:px-8 lg:px-10' : 'sm:px-6'} py-2 bg-white/80 dark:bg-[#16191f]/80 backdrop-blur-lg border-b border-sky-200/60 dark:border-[#282d37] flex flex-wrap items-center justify-between gap-2.5 shrink-0`}>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Title & Mode Switcher */}
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              HAVN AI Diagnostics
            </span>
          </div>

          {/* Beginner / Expert Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-[#1e222b] p-0.5 rounded-lg border border-slate-200 dark:border-[#282d37]">
            <button
              type="button"
              onClick={() => setMode('beginner')}
              className={`px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded transition-all cursor-pointer ${
                mode === 'beginner'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Beginner Mode: Plain-English, step-by-step guidance without confusing jargon"
            >
              Beginner
            </button>
            <button
              type="button"
              onClick={() => setMode('expert')}
              className={`px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded transition-all cursor-pointer ${
                mode === 'expert'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Expert Mode: Root cause analysis, exact sequence citations, and shell commands"
            >
              Expert
            </button>
          </div>

          {/* Quick Action Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              disabled={isLoading || cooldownSeconds > 0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleActionClick('summary');
              }}
              className="px-2.5 py-1 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#282d37] text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <FileText className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>Summary</span>
            </button>

            <button
              type="button"
              disabled={isLoading || cooldownSeconds > 0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleActionClick('analysis');
              }}
              className="px-2.5 py-1 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#282d37] text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Analysis</span>
            </button>

            <button
              type="button"
              disabled={isLoading || cooldownSeconds > 0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleActionClick('optimization');
              }}
              className="px-2.5 py-1 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#282d37] text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <Compass className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Optimization</span>
            </button>

            <button
              type="button"
              disabled={isLoading || cooldownSeconds > 0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleActionClick('learn');
              }}
              className="px-2.5 py-1 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#282d37] text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <BookOpen className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <span>Learn</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          {cooldownSeconds > 0 && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 animate-pulse">
              <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              {cooldownSeconds}s
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Grounded on BuildLogs
          </div>
        </div>
      </div>

      {/* Messages Chat Stream */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className={`relative flex-1 min-h-0 overflow-y-auto space-y-4 selection:bg-blue-600 selection:text-white ${
          isFullscreen ? 'p-6 sm:px-10 lg:px-16' : 'p-5 sm:px-6'
        }`}
      >
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center py-6 text-center text-slate-500 dark:text-slate-400 space-y-3.5 max-w-lg mx-auto select-none">
            {/* Hakka Mascot with Entrance Jump + Physical Wave Animation (1.6s then breathing idle) */}
            <div className="w-36 h-36 sm:w-40 sm:h-40 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-radial from-sky-400/20 via-blue-400/10 to-transparent dark:from-blue-500/15 dark:via-sky-400/5 dark:to-transparent pointer-events-none rounded-full blur-md" />

              {/* Friendly Yeti Greeting Speech Bubble ("👋 Hi, I'm Hakka!") */}
              <div
                className={`absolute -top-8 left-1/2 -translate-x-1/2 z-20 transition-all duration-500 ease-out transform ${
                  showGreeting
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-90 translate-y-1 pointer-events-none'
                }`}
              >
                <div className="relative bg-white/95 dark:bg-[#16191f]/95 backdrop-blur-md border border-sky-200/90 dark:border-[#282d37] text-slate-800 dark:text-slate-100 text-xs font-bold px-3.5 py-1.5 rounded-2xl shadow-md shadow-sky-950/10 dark:shadow-black/40 flex items-center gap-1.5 select-none whitespace-nowrap">
                  <span>👋 Hi, I'm Hakka!</span>
                  {/* Subtle speech tail pointing down to mascot */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-[#16191f] border-b border-r border-sky-200/90 dark:border-[#282d37] transform rotate-45" />
                </div>
              </div>

              <HavnMascot
                key={`hakka-mascot-${entranceCycle}`}
                focusedField="idle"
                className="w-full h-full relative z-10"
              />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                Ask HAVN AI about this build
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                Understand the failure. Fix it faster.
              </p>
            </div>

            {/* Empty State Four Action Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                disabled={isLoading || cooldownSeconds > 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleActionClick('summary');
                }}
                className="px-3 py-1.5 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-xl border border-sky-200/80 dark:border-[#282d37] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Summary</span>
              </button>
              <button
                type="button"
                disabled={isLoading || cooldownSeconds > 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleActionClick('analysis');
                }}
                className="px-3 py-1.5 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-xl border border-sky-200/80 dark:border-[#282d37] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Analysis</span>
              </button>
              <button
                type="button"
                disabled={isLoading || cooldownSeconds > 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleActionClick('optimization');
                }}
                className="px-3 py-1.5 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-xl border border-sky-200/80 dark:border-[#282d37] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Optimization</span>
              </button>
              <button
                type="button"
                disabled={isLoading || cooldownSeconds > 0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleActionClick('learn');
                }}
                className="px-3 py-1.5 bg-white/90 hover:bg-sky-50 text-slate-700 hover:text-blue-700 dark:bg-[#1e222b] dark:hover:bg-[#252a35] dark:text-slate-300 dark:hover:text-white rounded-xl border border-sky-200/80 dark:border-[#282d37] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Learn</span>
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            {msg.sender === 'user' ? (
              <div className={`bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl rounded-tr-xs shadow-md ${
                isFullscreen ? 'max-w-2xl' : 'max-w-lg'
              }`}>
                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-blue-200 uppercase font-mono">
                  <span>{msg.mode} Mode</span>
                  {msg.action && <span>• {msg.action}</span>}
                </div>
                {msg.text}
              </div>
            ) : (
              <div className={`bg-white/95 dark:bg-[#16191f]/90 backdrop-blur-xl border border-sky-200/80 dark:border-[#282d37] rounded-2xl rounded-tl-xs p-5 w-full shadow-md shadow-sky-950/5 dark:shadow-black/30 space-y-2.5 text-slate-800 dark:text-slate-200 ${
                isFullscreen ? 'max-w-4xl xl:max-w-5xl' : 'max-w-3xl'
              }`}>
                <div className="flex items-center justify-between border-b border-sky-100 dark:border-[#282d37] pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {msg.action === 'custom' ? 'HAVN AI Answer' : 'HAVN AI Diagnosis'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1e222b] text-slate-600 dark:text-slate-300 uppercase font-bold border border-slate-200 dark:border-[#282d37]">
                      {msg.mode}
                    </span>
                    {msg.cached && (
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1"
                        title={msg.cachedAt ? `Cached response (${new Date(msg.cachedAt).toLocaleTimeString()})` : "Cached diagnosis"}
                      >
                        <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Cached
                      </span>
                    )}
                  </div>
                  {msg.citedSequences && msg.citedSequences.length > 0 && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                      <span>Citations: {msg.citedSequences.map((s) => `#${s}`).join(', ')}</span>
                      {msg.citationsValidated && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-bold">
                          Verified
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {msg.warning && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{msg.warning}</span>
                  </div>
                )}

                <div className="text-xs space-y-1">
                  {renderFormattedText(msg.text)}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white/95 dark:bg-[#16191f]/90 border border-sky-200/80 dark:border-[#282d37] rounded-2xl rounded-tl-xs p-5 max-w-md shadow-md shadow-sky-950/5 dark:shadow-black/20 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span>Analyzing deployment context & BuildLogs...</span>
            </div>
          </div>
        )}

        {/* Error Alert with Retry */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-start justify-between gap-3 text-xs text-rose-800 dark:text-rose-300 shadow-sm">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-900 dark:text-rose-200">
                  {errorMessage.includes('free-tier quota') || errorMessage.includes('quota has been exhausted')
                    ? 'AI Free-Tier Quota Exhausted'
                    : errorMessage.includes('rate limit')
                    ? 'AI Rate Limit Reached'
                    : errorMessage.includes('high demand') || errorMessage.includes('unavailable')
                    ? 'AI Service Busy'
                    : 'AI Diagnostics Notice'}
                </p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{errorMessage}</p>
                {retryAfterSeconds && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    Suggested wait: {retryAfterSeconds} seconds before retrying.
                  </p>
                )}
              </div>
            </div>
            {lastAction && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isLoading}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50 shadow-xs"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Floating "Scroll to latest" button */}
        {!isAtBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={handleJumpToBottom}
            className="sticky bottom-2 ml-auto mr-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-500/25 text-xs font-bold flex items-center gap-1.5 transition-all animate-bounce cursor-pointer border border-blue-400/40 z-20"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Scroll to latest</span>
          </button>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Query Input Bar: Compact Height */}
      <form
        onSubmit={handleCustomSubmit}
        className={`px-4 ${isFullscreen ? 'sm:px-8 lg:px-10' : 'sm:px-6'} py-2.5 bg-white/80 dark:bg-[#16191f]/80 backdrop-blur-lg border-t border-sky-200/60 dark:border-[#282d37] shrink-0`}
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            disabled={isLoading || cooldownSeconds > 0}
            placeholder={`Ask anything about this deployment (${mode} mode)...`}
            className="flex-1 bg-white/95 dark:bg-[#12151a]/95 border border-slate-200 dark:border-[#282d37] focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-blue-500 font-medium transition-all shadow-2xs"
          />
          <button
            type="submit"
            disabled={isLoading || cooldownSeconds > 0 || !customQuestion.trim()}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-xs"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Ask</span>
          </button>
        </div>
      </form>

      {/* Voluntary ₹20 Support Prompt Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white/95 dark:bg-[#16191f]/95 backdrop-blur-xl border border-sky-200/80 dark:border-[#282d37] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-4 motion-safe:animate-fade-in-up">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-wide">
                ₹20 do, phir bataunga 😄
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Support HAVN development with a small voluntary coffee!
              </p>
            </div>

            {/* QR Code Container using exact existing havn-upi-qr.jpeg asset */}
            <div className="bg-sky-50/50 dark:bg-white p-2 rounded-2xl border border-sky-100 dark:border-slate-300 inline-block mx-auto">
              <img
                src={havnUpiQr}
                alt="HAVN UPI Support QR Code - Shiv Ram Krishna Chaman"
                className="w-56 h-auto rounded-xl object-contain mx-auto"
              />
            </div>

            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Scan & support HAVN
            </p>

            {/* Action Buttons: Already Done OR Skip both continue the original AI request */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSupportModalContinue}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Already Done
              </button>
              <button
                type="button"
                onClick={handleSupportModalContinue}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-[#1e222b] hover:bg-slate-200 dark:hover:bg-[#252a35] text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all border border-slate-200 dark:border-[#282d37] cursor-pointer"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
