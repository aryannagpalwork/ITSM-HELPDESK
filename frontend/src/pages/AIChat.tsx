import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChat } from '../shared/ChatContext';
import { useTheme } from '../shared/ThemeContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Sparkles, 
  Send, 
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MessageSquare, 
  Bot,
  User,
  PlusCircle,
  CheckCircle
} from 'lucide-react';
import { DuplicateWarningModal } from '../shared/DuplicateWarningModal';

export const AIChat: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tokens } = useTheme();
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);

  const autoResize = React.useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, []);

  const {
    messages,
    input,
    setInput,
    isTyping,
    typingText,
    suggestedTicket,
    collapsedMessages,
    toggleCollapse,
    activeSatisfactionCard,
    conversationStatus,
    guidedActions,
    guidedState,
    isEscalating,
    isFeedbackLoading,
    ticketCreatedForIssue,
    createdTicketInfo,
    currentIssueResolved,
    chatDuplicateWarning,
    contentRef,
    handleSendPrompt,
    handleGuidedYes,
    handleGuidedNo,
    handleConvertTicket,
    handleSatisfactionResolved,
    handleSatisfactionCreateTicket,
    handleChatCreateAnyway,
    dismissChatDuplicateWarning,
    continueInThisChat,
    startNewQuery,
    resetThread,
  } = useChat();

  useEffect(() => { autoResize(); }, [input, autoResize]);

    const [isProcessing, setIsProcessing] = useState(false);
    const isProcessingRef = useRef(false);
    const conversationEndedRef = useRef(false);
    const isAtBottomRef = useRef(true);
    const conversationStatusRef = useRef(conversationStatus);

    useEffect(() => {
      conversationStatusRef.current = conversationStatus;
    }, [conversationStatus]);

    const beginProcessing = () => {
      if (isProcessingRef.current) return false;
      isProcessingRef.current = true;
      setIsProcessing(true);
      return true;
    };

    const finishProcessing = () => {
      isProcessingRef.current = false;
      setIsProcessing(false);
    };

    const handleSendPromptWrapper = async (textToSend: string) => {
      if (!textToSend.trim() || !beginProcessing()) return;

      const isFreshQuery = conversationEndedRef.current || conversationStatusRef.current === 'ISSUE_RESOLVED';
      conversationEndedRef.current = false;

      try {
        await handleSendPrompt(textToSend, !isFreshQuery, isFreshQuery);
      } finally {
        finishProcessing();
      }
    };

    const handleGuidedYesWrapper = async () => {
      if (!beginProcessing()) return;
      try {
        await handleGuidedYes();
        conversationEndedRef.current = true;
      } finally {
        finishProcessing();
      }
    };

    const handleGuidedNoWrapper = async () => {
      if (!beginProcessing()) return;
      try {
        await handleGuidedNo();
      } finally {
        finishProcessing();
      }
    };

    const handleConvertTicketWrapper = async () => {
      if (!beginProcessing()) return;
      try {
        await handleConvertTicket();
        conversationEndedRef.current = true;
      } finally {
        finishProcessing();
      }
    };

    const handleSatisfactionResolvedWrapper = async () => {
      if (!beginProcessing()) return;
      try {
        await handleSatisfactionResolved();
        conversationEndedRef.current = true;
      } finally {
        finishProcessing();
      }
    };

    const handleSatisfactionCreateTicketWrapper = async () => {
      if (!beginProcessing()) return;
      try {
        await handleSatisfactionCreateTicket();
        conversationEndedRef.current = true;
      } finally {
        finishProcessing();
      }
    };

    useEffect(() => {
      if (contentRef.current && isAtBottomRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    }, [messages, isTyping, typingText]);

    const handleConversationScroll = () => {
      const content = contentRef.current;
      if (!content) return;

      isAtBottomRef.current = content.scrollHeight - content.scrollTop - content.clientHeight < 24;
    };

  useEffect(() => {
    if (!isTyping && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isTyping]);

  useEffect(() => {
    const state = location.state as { initialPrompt?: string };
    if (state?.initialPrompt) {
      handleSendPromptWrapper(state.initialPrompt);
    }
  }, [location]);

  const shouldCollapse = (text: string) => {
    return text.length > 1200;
  };

  const isConversationEnded = () => {
    return conversationStatus === 'ISSUE_RESOLVED' || conversationStatus === 'TICKET_CREATED';
  };

  const renderSatisfactionCard = () => {
    if (ticketCreatedForIssue || currentIssueResolved || !activeSatisfactionCard?.show || guidedState === 'NO_SOLUTION') return null;
    const isPositive = activeSatisfactionCard.reason === 'POSITIVE_TREND';
    const title = isPositive
      ? 'Glad that helped — was your issue fully resolved?'
      : 'Let me help escalate this for you';
    const subtitle = isPositive
      ? 'Quick feedback below helps our training models.'
      : 'It looks like we haven’t been able to resolve your issue yet. Would you like to open an official IT support ticket?';
    return (
      <div className="flex justify-center mt-2">
        <div
          className="max-w-xl w-full rounded-2xl p-5"
          style={{
            backgroundColor: isPositive ? tokens.statusSuccessBg : tokens.statusWarningBg,
            border: `1px solid ${isPositive ? tokens.statusSuccess : tokens.statusWarning}26`,
          }}
        >
          <div className="flex items-center space-x-2 mb-2">
            <MessageSquare
              className="w-4 h-4"
              style={{ color: isPositive ? tokens.statusSuccess : tokens.statusWarning }}
            />
            <h5 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h5>
          </div>
          <p
            className="text-[11px] leading-relaxed mb-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            {subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              disabled={isFeedbackLoading}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              style={{
                backgroundColor: tokens.statusSuccess,
                color: 'white',
              }}
              onMouseEnter={(e) => {
                if (!isFeedbackLoading) e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              onClick={handleSatisfactionResolvedWrapper}
            >
              Yes, Issue Resolved
            </button>
            <button
              disabled={isFeedbackLoading || isEscalating}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border shadow-sm"
              style={{
                backgroundColor: tokens.statusWarningBg,
                color: 'var(--text-primary)',
                borderColor: `${tokens.statusWarning}55`,
              }}
              onMouseEnter={(e) => {
                if (!isFeedbackLoading && !isEscalating) {
                  e.currentTarget.style.backgroundColor = tokens.statusWarning + '26';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = tokens.statusWarningBg;
              }}
              onClick={handleSatisfactionCreateTicketWrapper}
            >
              No, Create Support Ticket
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGuidedActions = () => {
    if (ticketCreatedForIssue || currentIssueResolved || isProcessing || suggestedTicket?.ticketId || guidedActions.length < 2 || guidedState === 'RESOLVED' || guidedState === 'NO_SOLUTION') return null;
    return (
      <div className="flex justify-center mt-2">
        <div className="max-w-xl w-full flex gap-2">
          <button
            disabled={isProcessing || isFeedbackLoading || isTyping}
            onClick={handleGuidedYesWrapper}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: tokens.statusSuccessBg, color: tokens.statusSuccess, borderColor: `${tokens.statusSuccess}55` }}
          >
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: tokens.statusSuccess, color: 'white' }}>✓</span>
            Yes, resolved
          </button>
          <button
            disabled={isProcessing || isFeedbackLoading || isTyping}
            onClick={handleGuidedNoWrapper}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: tokens.statusWarningBg, color: 'var(--text-primary)', borderColor: `${tokens.statusWarning}55` }}
          >
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: tokens.statusWarning, color: 'white' }}>×</span>
            No, try another step
          </button>
        </div>
      </div>
    );
  };


  return (
    <div id="ai-chat-container" className="flex-1 flex h-full font-sans" style={{ backgroundColor: 'var(--app-bg)' }}>
      
      {/* Main Conversation Thread Column */}
      <div className="flex-1 flex flex-col justify-between h-full" style={{ backgroundColor: 'var(--app-bg)', borderRight: '1px solid var(--border)' }}>
        {/* Top Chat Bar */}
        <div 
          className="px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-md flex items-center justify-between sticky top-0 z-10"
          style={{ backgroundColor: 'var(--navbar-bg)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: tokens.accentPrimaryBg, border: `1px solid ${tokens.accentPrimary}33` }}>
              <Sparkles className="w-4 h-4" style={{ color: tokens.accentPrimary }} />
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Enterprise IT Support Copilot</h1>
              <div className="flex items-center space-x-1.5 text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: tokens.statusSuccess }} />
                <span>RAG Index Active • Gemini Model Ready</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => {
              if (isProcessingRef.current) return;
              resetThread();
              conversationEndedRef.current = false;
            }}
            disabled={isProcessing}
            className="p-1.5 rounded-lg transition-all text-[10px] flex items-center gap-1.5 cursor-pointer border"
            style={{ backgroundColor: 'var(--card-bg-solid)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--card-bg-solid)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <PlusCircle className="w-3 h-3" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Scrollable Messages */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8"
          onScroll={handleConversationScroll}
        >
          {messages.map((msg, idx) => {
            const isBot = msg.sender === 'assistant';
            const isSystem = msg.sender === 'system';
            const isCollapsed = collapsedMessages[msg.id];
            const showCollapse = isBot && shouldCollapse(msg.text);

            if (isSystem) {
              return (
                <div key={msg.id || idx} className="flex justify-center">
                  <div 
                    className="max-w-lg rounded-2xl p-5"
                    style={{ backgroundColor: tokens.statusSuccessBg, color: 'var(--text-secondary)', border: `1px solid ${tokens.statusSuccess}20` }}
                  >
                    <div className="text-sm leading-relaxed">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-lg my-3 text-sm"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code 
                                className={`${className} px-1.5 py-0.5 rounded text-xs`} 
                                style={{ backgroundColor: 'var(--border)' }}
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={msg.id || idx}
                className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'}`}
              >
                <div 
                  className={`flex gap-4 ${isBot ? 'max-w-[680px] w-full' : 'max-w-[450px] w-full justify-end'}`}
                >
                  {isBot && (
                    <div className="flex-shrink-0">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: tokens.accentPrimaryBg, border: `1px solid ${tokens.accentPrimary}4d` }}
                      >
                        <Bot className="w-4 h-4" style={{ color: tokens.accentPrimary }} />
                      </div>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div 
                      className="text-sm" 
                      style={{ color: isBot ? 'var(--text-primary)' : '#ffffff' }}
                    >
                      {/* Message Content */}
                      <div 
                        className={`rounded-2xl ${!isBot ? 'px-4 py-3' : ''}`}
                        style={!isBot ? { backgroundColor: tokens.accentPrimary } : {}}
                      >
                        <div 
                          className={`leading-relaxed ${showCollapse && isCollapsed ? 'max-h-[350px] overflow-hidden' : ''}`}
                        >
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ ...props }) => <h1 className="text-lg font-bold mb-3 mt-4" style={{ color: isBot ? 'var(--text-primary)' : '#ffffff' }} {...props} />,
                              h2: ({ ...props }) => <h2 className="text-base font-semibold mb-2 mt-3" style={{ color: isBot ? 'var(--text-primary)' : '#ffffff' }} {...props} />,
                              h3: ({ ...props }) => <h3 className="text-sm font-semibold mb-1.5 mt-2" style={{ color: isBot ? 'var(--text-primary)' : '#ffffff' }} {...props} />,
                              p: ({ ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                              ul: ({ ...props }) => <ul className="list-disc list-outside mb-3 last:mb-0 pl-5 space-y-1" {...props} />,
                              ol: ({ ...props }) => <ol className="list-decimal list-outside mb-3 last:mb-0 pl-5 space-y-1" {...props} />,
                              li: ({ ...props }) => <li className="mb-0.5 last:mb-0" {...props} />,
                              blockquote: ({ ...props }) => <blockquote 
                                className="border-l-2 pl-4 py-1 my-3 rounded-r-lg" 
                                style={{ 
                                  borderColor: `${tokens.accentPrimary}80`, 
                                  color: 'var(--text-secondary)', 
                                  backgroundColor: 'var(--card-bg)' 
                                }} 
                                {...props} 
                              />,
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <div className="my-3">
                                    <SyntaxHighlighter
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      className="rounded-lg text-sm"
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  </div>
                                ) : (
                                  <code 
                                    className={`${className} px-1.5 py-0.5 rounded text-xs font-mono`} 
                                    style={{ backgroundColor: 'var(--border)' }}
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>

                        {/* Collapse Toggle */}
                        {showCollapse && (
                          <button 
                            onClick={() => toggleCollapse(msg.id)}
                            className="text-xs flex items-center gap-1.5 mt-2"
                            style={{ color: tokens.accentPrimary }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                          >
                            {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                            <span>{isCollapsed ? 'Show More' : 'Show Less'}</span>
                          </button>
                        )}
                      </div>

                      {/* Metadata (Timestamp) */}
                      <div 
                        className={`flex items-center gap-2 text-[10px] font-mono mt-2 ${isBot ? '' : 'justify-end'}`}
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!isBot && (
                    <div className="flex-shrink-0">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border-strong)' }}
                      >
                        <User className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex w-full justify-start">
              <div className="flex gap-4 max-w-[680px] w-full">
                <div className="flex-shrink-0">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: tokens.accentPrimaryBg, border: `1px solid ${tokens.accentPrimary}4d` }}
                  >
                    <Bot className="w-4 h-4" style={{ color: tokens.accentPrimary }} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    <div className="rounded-2xl">
                      <div className="leading-relaxed">
                        {typingText && (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <div className="my-3">
                                    <SyntaxHighlighter
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      className="rounded-lg text-sm"
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  </div>
                                ) : (
                                  <code 
                                    className={`${className} px-1.5 py-0.5 rounded text-xs font-mono`} 
                                    style={{ backgroundColor: 'var(--border)' }}
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {typingText}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                    {!typingText && (
                      <div className="flex items-center space-x-1.5 mt-2">
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: tokens.accentPrimary, animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: tokens.accentPrimary, animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: tokens.accentPrimary, animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Conversation Satisfaction Prompt — rendered exactly once when the backend signals it. */}
          {renderSatisfactionCard()}
          {renderGuidedActions()}

          {/* Frozen state after ticket creation OR AI resolution */}
          {(ticketCreatedForIssue || currentIssueResolved) && (
            <div className="flex justify-center mt-2">
              <div
                className="max-w-xl w-full rounded-2xl p-5"
                style={{
                  backgroundColor: tokens.statusSuccessBg,
                  border: `1px solid ${tokens.statusSuccess}26`,
                }}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="w-4 h-4" style={{ color: tokens.statusSuccess }} />
                  <h5 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    {ticketCreatedForIssue && createdTicketInfo
                      ? `Ticket ${createdTicketInfo.ticketNumber} has been created and handed over to IT Support.`
                      : 'Your issue has been resolved by AI.'}
                  </h5>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <button
                    disabled={isProcessing || isTyping}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    style={{
                      backgroundColor: tokens.accentPrimary,
                      color: 'var(--accent-primary-contrast)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isProcessing && !isTyping) e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onClick={() => {
                      continueInThisChat();
                      conversationEndedRef.current = false;
                    }}
                  >
                    Continue in This Chat
                  </button>
                  <button
                    disabled={isProcessing || isTyping}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border shadow-sm"
                    style={{
                      backgroundColor: 'var(--card-bg-solid)',
                      color: 'var(--text-primary)',
                      borderColor: 'var(--border)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isProcessing && !isTyping) e.currentTarget.style.backgroundColor = 'var(--hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--card-bg-solid)';
                    }}
                    onClick={() => {
                      if (isProcessingRef.current) return;
                      startNewQuery();
                      conversationEndedRef.current = false;
                    }}
                  >
                    Start a New Conversation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar Section */}
        <div 
          className="p-4 sm:p-6"
          style={{ backgroundColor: 'var(--app-bg)', borderTop: '1px solid var(--border)' }}
        >
          <div className="max-w-3xl mx-auto">
            {isConversationEnded() && (
              <div 
                className="p-3 rounded-xl mb-4 text-center text-[11px] font-semibold"
                style={{ backgroundColor: tokens.statusSuccessBg, color: tokens.statusSuccess, border: `1px solid ${tokens.statusSuccess}26` }}
              >
                ✓ This conversation has ended. To start a new conversation, click the "New Chat" button above.
              </div>
            )}
            <div 
              className="relative flex items-end rounded-2xl transition-all p-3"
              style={{ backgroundColor: isConversationEnded() ? 'var(--card-bg-solid)' : 'var(--input-bg)', border: `1px solid ${isConversationEnded() ? 'var(--border)' : 'var(--border)'}`, opacity: isConversationEnded() ? 0.6 : 1 }}
              onFocus={(e) => { if (!isConversationEnded()) e.currentTarget.style.borderColor = tokens.accentPrimary; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <MessageSquare className="w-5 h-5 mr-3 mb-0.5" style={{ color: 'var(--text-tertiary)' }} />
              <textarea 
                ref={inputRef}
                id="ai-copilot-message"
                name="message"
                placeholder={(ticketCreatedForIssue || currentIssueResolved) ? "Issue resolved. Choose an action below." : "Ask IT support or troubleshoot connection problems..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onInput={autoResize}
                disabled={isProcessing || isTyping || isConversationEnded()}
                onKeyDown={(e) => {
                  if (
                    !isProcessing &&
                    !isTyping &&
                    !isConversationEnded() &&
                    e.key === 'Enter' &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    handleSendPromptWrapper(input);
                  }
                }}
                className="flex-1 bg-transparent border-none text-sm outline-none resize-none max-h-48"
                style={{ color: 'var(--text-primary)', height: 'auto', overflowY: 'auto' }}
                rows={1}
              />
              <button 
                onClick={() => handleSendPromptWrapper(input)}
                disabled={isProcessing || isTyping || isConversationEnded()}
                className="p-2 rounded-xl transition-all shrink-0 cursor-pointer ml-2"
                style={{ backgroundColor: tokens.accentPrimary, color: 'var(--accent-primary-contrast)' }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p 
              className="text-[10px] font-mono text-center mt-3 uppercase tracking-wide"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Copilot uses automated retrieval over your organization's service catalog
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: AI suggested ticket ticket proposal */}
      <div 
        className="hidden lg:flex w-80 p-6 flex-col justify-between shrink-0 h-full"
        style={{ backgroundColor: 'var(--app-bg)' }}
      >
        <div className="space-y-6">
          <div 
            className="flex items-center space-x-2 text-[10px] uppercase font-mono tracking-wider font-semibold mb-3 pb-3"
            style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: tokens.accentPrimary }} />
            <span>AI Copilot Analysis</span>
          </div>

          {ticketCreatedForIssue && createdTicketInfo ? (
            <div
              className="p-5 rounded-xl"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: `1px solid ${tokens.statusSuccess}26`,
              }}
            >
              <div className="flex items-center space-x-2 mb-3" style={{ color: tokens.statusSuccess }}>
                <CheckCircle className="w-4 h-4" />
                <h4 className="text-xs font-semibold">Ticket Created</h4>
              </div>
              <div
                className="space-y-3 p-3 rounded-lg mb-3"
                style={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border)' }}
              >
                <div>
                  <span className="block text-[8px] font-mono uppercase" style={{ color: 'var(--text-tertiary)' }}>Ticket Reference</span>
                  <h5 className="text-[10px] font-semibold font-mono mt-0.5" style={{ color: 'var(--text-primary)' }}>{createdTicketInfo.ticketNumber}</h5>
                </div>
                <div>
                  <span className="block text-[8px] font-mono uppercase" style={{ color: 'var(--text-tertiary)' }}>Status</span>
                  <span className="block text-[9px] font-mono font-semibold uppercase mt-0.5" style={{ color: tokens.statusSuccess }}>OPEN</span>
                </div>
              </div>
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                Your issue has been handed over to IT Support. Use <strong>Continue in This Chat</strong> to add more context, or <strong>Start a New Conversation</strong> for a different issue.
              </p>
            </div>
          ) : currentIssueResolved ? (
            <div
              className="p-5 rounded-xl"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: `1px solid ${tokens.statusSuccess}26`,
              }}
            >
              <div className="flex items-center space-x-2 mb-3" style={{ color: tokens.statusSuccess }}>
                <CheckCircle className="w-4 h-4" />
                <h4 className="text-xs font-semibold">Issue Resolved by AI</h4>
              </div>
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                Your issue has been successfully resolved by the AI Copilot. Use <strong>Continue in This Chat</strong> to ask follow-up questions, or <strong>Start a New Conversation</strong> for a different issue.
              </p>
            </div>
          ) : suggestedTicket && suggestedTicket.show ? (
            <div 
              className="p-5 rounded-xl"
              style={{ 
                backgroundColor: 'var(--card-bg)', 
                border: `1px solid ${tokens.accentPrimary}26`
              }}
            >
              <div className="flex items-center space-x-2 mb-3" style={{ color: tokens.accentPrimary }}>
                <PlusCircle className="w-4 h-4" />
                <h4 className="text-xs font-semibold">
                  {suggestedTicket.knowledgeBaseFallback ? 'Create IT Support Ticket' : 'Incident Proposal'}
                </h4>
              </div>
              <p 
                className="text-[10px] leading-relaxed mb-4"
                style={{ color: 'var(--text-secondary)' }}
              >
                {suggestedTicket.knowledgeBaseFallback
                  ? 'The Knowledge Base did not contain enough relevant information for this query. File a ticket so the IT team can help.'
                  : 'The Copilot has analyzed your problem and prepared an automated Service Ticket template to bypass standard level-1 queues.'}
              </p>

              <div 
                className="space-y-3 p-3 rounded-lg mb-4"
                style={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border)' }}
              >
                <div>
                  <span className="block text-[8px] font-mono uppercase" style={{ color: 'var(--text-tertiary)' }}>Suggested Headline</span>
                  <h5 className="text-[10px] font-semibold truncate mt-0.5" style={{ color: 'var(--text-primary)' }}>{suggestedTicket.title}</h5>
                </div>
                <div>
                  <span className="block text-[8px] font-mono uppercase" style={{ color: 'var(--text-tertiary)' }}>SLA Severity</span>
                  <span className="block text-[9px] font-mono font-semibold uppercase mt-0.5" style={{ color: tokens.statusWarning }}>{suggestedTicket.priority}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (suggestedTicket.resolvedByAI) {
                    const base = location.pathname.startsWith('/admin')
                      ? '/admin/tickets'
                      : location.pathname.startsWith('/agent')
                        ? '/agent/tickets'
                        : '/tickets';
                    navigate(suggestedTicket.ticketId ? `${base}/${suggestedTicket.ticketId}` : `${base}?status=resolved_ai`);
                    return;
                  }
                  handleConvertTicketWrapper();
                }}
                className="w-full py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md"
                style={{ backgroundColor: suggestedTicket.resolvedByAI ? tokens.statusSuccess : tokens.accentPrimary, color: 'var(--accent-primary-contrast)', boxShadow: `0 4px 12px ${tokens.accentPrimary}1a` }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                <span>{suggestedTicket.resolvedByAI ? 'View Resolution' : suggestedTicket.knowledgeBaseFallback ? 'Create Ticket / File Incident' : 'File Support Incident'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div 
              className="p-5 rounded-xl text-center"
              style={{ border: '1px dashed var(--border)' }}
            >
              <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--border-strong)' }} />
              <h4 className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Analysis Idle</h4>
              <p 
                className="text-[9px] max-w-xs mx-auto mt-1"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Describe your technical difficulties in the conversation thread to trigger real-time ticket formulation models.
              </p>
            </div>
          )}

          {/* Quick recommendations */}
          <div 
            className="p-4 rounded-xl"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
          >
            <h5 className="text-[10px] font-semibold mb-2 font-mono uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Helpful Quick Queries</h5>
            <div className="space-y-1.5 text-[9px] font-medium">
              <button 
                onClick={() => handleSendPromptWrapper("My laptop Okta MFA push is failing, how can I re-enroll my device?")}
                className="w-full text-left py-1.5 px-2 rounded border transition-all text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer flex justify-between"
                style={{ backgroundColor: 'var(--card-bg-solid)', borderColor: 'transparent', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { 
                  e.currentTarget.style.backgroundColor = 'var(--hover)'; 
                  e.currentTarget.style.borderColor = 'var(--border)'; 
                  e.currentTarget.style.color = 'var(--text-primary)'; 
                }}
                onMouseLeave={(e) => { 
                  e.currentTarget.style.backgroundColor = 'var(--card-bg-solid)'; 
                  e.currentTarget.style.borderColor = 'transparent'; 
                  e.currentTarget.style.color = 'var(--text-secondary)'; 
                }}
              >
                <span>"Locked out of Okta SSO"</span>
                <ArrowUpRight className="w-2.5 h-2.5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
              <button 
                onClick={() => handleSendPromptWrapper("Cannot connect to remote database from staging cluster, receiving RDS timeout")}
                className="w-full text-left py-1.5 px-2 rounded border transition-all text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer flex justify-between"
                style={{ backgroundColor: 'var(--card-bg-solid)', borderColor: 'transparent', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { 
                  e.currentTarget.style.backgroundColor = 'var(--hover)'; 
                  e.currentTarget.style.borderColor = 'var(--border)'; 
                  e.currentTarget.style.color = 'var(--text-primary)'; 
                }}
                onMouseLeave={(e) => { 
                  e.currentTarget.style.backgroundColor = 'var(--card-bg-solid)'; 
                  e.currentTarget.style.borderColor = 'transparent'; 
                  e.currentTarget.style.color = 'var(--text-secondary)'; 
                }}
              >
                <span>"PostgreSQL RDS Timeout"</span>
                <ArrowUpRight className="w-2.5 h-2.5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
              <button 
                onClick={() => handleSendPromptWrapper("How do I connect our macOS devices to Company Wi-Fi network?")}
                className="w-full text-left py-1.5 px-2 rounded border transition-all text-ellipsis overflow-hidden whitespace-nowrap cursor-pointer flex justify-between"
                style={{ backgroundColor: 'var(--card-bg-solid)', borderColor: 'transparent', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { 
                  e.currentTarget.style.backgroundColor = 'var(--hover)'; 
                  e.currentTarget.style.borderColor = 'var(--border)'; 
                  e.currentTarget.style.color = 'var(--text-primary)'; 
                }}
                onMouseLeave={(e) => { 
                  e.currentTarget.style.backgroundColor = 'var(--card-bg-solid)'; 
                  e.currentTarget.style.borderColor = 'transparent'; 
                  e.currentTarget.style.color = 'var(--text-secondary)'; 
                }}
              >
                <span>"Connect to secure office Wi-Fi"</span>
                <ArrowUpRight className="w-2.5 h-2.5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>
          </div>
        </div>

        <div 
          className="p-3.5 rounded-lg text-[9px] leading-relaxed font-mono"
          style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-tertiary)', border: '1px solid var(--border)' }}
        >
          SYSTEM NOTE: Chat logs, metadata, and matched documents are captured to train custom Llama and Gemini operational models.
        </div>
      </div>

      {chatDuplicateWarning && (
        <DuplicateWarningModal
          warning={chatDuplicateWarning}
          onDismiss={dismissChatDuplicateWarning}
          onCreateAnyway={handleChatCreateAnyway}
          isSubmitting={isEscalating || isFeedbackLoading}
        />
      )}

    </div>
  );
};
