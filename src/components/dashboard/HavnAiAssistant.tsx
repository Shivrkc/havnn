import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, Send, RefreshCw, AlertTriangle, 
  HelpCircle, Zap, BookOpen, FileText, CheckCircle2,
  X, Compass, ShieldCheck, ArrowDown, Clock
} from 'lucide-react';
import { queryDeploymentAi, AiAction, AiMode } from '../../services/ai.service';
import havnUpiQr from '../../assets/havn-upi-qr.jpeg';

const SUPPORT_PROMPT_STORAGE_KEY = 'havn-ai-support-prompt-seen';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  mode?: AiMode;
  action?: AiAction;
  citedSequences?: number[];
  timestamp: Date;
}

interface HavnAiAssistantProps {
  deploymentId: string;
  deploymentStatus: string;
  projectName?: string;
  onSelectSequence?: (sequence: number) => void;
}

export const HavnAiAssistant: React.FC<HavnAiAssistantProps> = ({
  deploymentId,
  deploymentStatus,
  projectName,
  onSelectSequence,
}) => {
  const [mode, setMode] = useState<AiMode>('beginner');
  const [messages, setMessages] = useState<Message[]>([]);
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<{ action: AiAction; question?: string; mode: AiMode } | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

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

  /**
   * Executes the actual AI query.
   */
  const executeAiQuery = async (
    action: AiAction,
    question?: string,
    queryMode: AiMode = mode,
    isRetry: boolean = false
  ) => {
    if (isLoading || isSubmittingRef.current) return; // Prevent duplicate submissions
    isSubmittingRef.current = true;
    setIsLoading(true);
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
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
    }

    try {
      const result = await queryDeploymentAi(deploymentId, {
        mode: queryMode,
        action,
        question: action === 'custom' ? question : undefined,
      });

      const aiMessage: Message = {
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: 'ai',
        text: result.answer,
        mode: result.mode,
        action: result.action,
        citedSequences: result.citedSequences,
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
    if (isLoading || isSubmittingRef.current) return;
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
    if (isLoading || isSubmittingRef.current) return;
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
          <h4 key={idx} className="text-sm font-bold text-blue-300 mt-3 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            {title}
          </h4>
        );
      }

      // Heading 2: ## ...
      if (line.startsWith('## ')) {
        const title = line.replace('## ', '').trim();
        return (
          <h3 key={idx} className="text-sm font-extrabold text-white mt-4 mb-2 pb-1 border-b border-slate-800">
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
          <li key={idx} className="text-xs text-slate-300 ml-4 list-disc leading-relaxed my-0.5">
            {renderLineWithBadges(itemContent)}
          </li>
        );
      }

      // Numbered steps
      const stepMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
      if (stepMatch) {
        return (
          <div key={idx} className="text-xs text-slate-300 flex items-start gap-2 my-1">
            <span className="text-blue-400 font-bold shrink-0">{stepMatch[1]}.</span>
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
        <p key={idx} className="text-xs text-slate-300 leading-relaxed my-1">
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
            className="inline-flex items-center gap-1 font-mono text-[10px] font-bold bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800/80 px-1.5 py-0.2 rounded-md mx-0.5 transition-colors cursor-pointer"
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
    <div className="flex flex-col flex-1 min-h-0 bg-slate-950 text-slate-200">
      {/* AI Controls Header: Mode Switcher & Quick Actions */}
      <div className="p-4 sm:px-6 bg-slate-900/95 border-b border-slate-800 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Mode Switcher */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                HAVN AI Diagnostics
              </span>
            </div>

            {/* Beginner / Expert Mode Toggle */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMode('beginner')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'beginner'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Beginner Mode: Plain-English, step-by-step guidance without confusing jargon"
              >
                Beginner
              </button>
              <button
                type="button"
                onClick={() => setMode('expert')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'expert'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Expert Mode: Root cause analysis, exact sequence citations, and shell commands"
              >
                Expert
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Grounded on BuildLogs
          </div>
        </div>

        {/* Quick Action Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleActionClick('summary');
            }}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            Summary
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleActionClick('analysis');
            }}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Analysis
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleActionClick('optimization');
            }}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            Optimization
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleActionClick('learn');
            }}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            Learn
          </button>
        </div>
      </div>

      {/* Messages Chat Stream */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 min-h-0 overflow-y-auto p-5 sm:px-6 space-y-4 selection:bg-blue-600 selection:text-white"
      >
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center py-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-950/40 border border-blue-800/40 flex items-center justify-center text-blue-400 shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-sm font-bold text-slate-300">
                Ask HAVN AI about this deployment
              </h4>
              <p className="text-xs text-slate-500">
                Get plain-English explanations or deep technical root cause analysis based directly on your container build logs.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleActionClick('analysis');
                }}
                className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                Why did my build {deploymentStatus === 'FAILED' ? 'fail' : 'complete'}?
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleActionClick('optimization');
                }}
                className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                How can I optimize this Dockerfile?
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
              <div className="bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl rounded-tr-xs max-w-lg shadow-md">
                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-blue-200 uppercase font-mono">
                  <span>{msg.mode} Mode</span>
                  {msg.action && <span>• {msg.action}</span>}
                </div>
                {msg.text}
              </div>
            ) : (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl rounded-tl-xs p-5 max-w-2xl w-full shadow-lg space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs font-bold text-white">HAVN AI Diagnosis</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-bold">
                      {msg.mode}
                    </span>
                  </div>
                  {msg.citedSequences && msg.citedSequences.length > 0 && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      Citations: {msg.citedSequences.map((s) => `#${s}`).join(', ')}
                    </div>
                  )}
                </div>

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
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl rounded-tl-xs p-5 max-w-md shadow-lg flex items-center gap-3 text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
              <span>Analyzing deployment context & BuildLogs...</span>
            </div>
          </div>
        )}

        {/* Error Alert with Retry */}
        {errorMessage && (
          <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-2xl flex items-start justify-between gap-3 text-xs text-red-300">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  {errorMessage.includes('free-tier quota') || errorMessage.includes('quota has been exhausted')
                    ? 'AI Free-Tier Quota Exhausted'
                    : errorMessage.includes('rate limit')
                    ? 'AI Rate Limit Reached'
                    : errorMessage.includes('high demand') || errorMessage.includes('unavailable')
                    ? 'AI Service Busy'
                    : 'AI Diagnostics Notice'}
                </p>
                <p className="text-slate-400 leading-relaxed">{errorMessage}</p>
                {retryAfterSeconds && (
                  <p className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1 mt-1">
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
                className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-white rounded-xl font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
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
            className="sticky bottom-2 ml-auto mr-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-black/50 text-xs font-bold flex items-center gap-1.5 transition-all animate-bounce cursor-pointer border border-blue-400/30 z-20"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Scroll to latest</span>
          </button>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Query Input Bar */}
      <form
        onSubmit={handleCustomSubmit}
        className="p-4 sm:px-6 bg-slate-900/95 border-t border-slate-800 shrink-0"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            disabled={isLoading}
            placeholder={`Ask anything about this deployment (${mode} mode)...`}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-500 font-medium transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !customQuestion.trim()}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Ask</span>
          </button>
        </div>
      </form>

      {/* Voluntary ₹20 Support Prompt Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-4 motion-safe:animate-fade-in-up">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-white tracking-wide">
                ₹20 do, phir bataunga 😄
              </h3>
              <p className="text-xs text-slate-400">
                Support HAVN development with a small voluntary coffee!
              </p>
            </div>

            {/* QR Code Container using exact existing havn-upi-qr.jpeg asset */}
            <div className="bg-white p-2 rounded-2xl shadow-inner inline-block mx-auto">
              <img
                src={havnUpiQr}
                alt="HAVN UPI Support QR Code - Shiv Ram Krishna Chaman"
                className="w-56 h-auto rounded-xl object-contain mx-auto"
              />
            </div>

            <p className="text-xs font-medium text-slate-400">
              Scan & support HAVN
            </p>

            {/* Action Buttons: Already Done OR Skip both continue the original AI request */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSupportModalContinue}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Already Done
              </button>
              <button
                type="button"
                onClick={handleSupportModalContinue}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all border border-slate-700 cursor-pointer"
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
