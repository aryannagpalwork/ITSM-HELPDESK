import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../shared/AppContext';
import { useTheme } from '../shared/ThemeContext';
import { ChatMessage, TicketPriority } from '../shared/types';
import { sendChat, escalateToTicket } from '../shared/api';
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
  PlusCircle
} from 'lucide-react';

export const AIChat: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { createTicket, loadTickets } = useApp();
  const { tokens } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [suggestedTicket, setSuggestedTicket] = useState<{
    title: string;
    description: string;
    priority: TicketPriority;
    show: boolean;
  } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [collapsedMessages, setCollapsedMessages] = useState<Record<string, boolean>>({});

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages, isTyping, typingText]);

  useEffect(() => {
    const welcomeMsg: ChatMessage = {
      id: 'welcome',
      sender: 'assistant',
      text: "Hello! I am your Enterprise ITSM Helpdesk Copilot. I have real-time semantic access to the entire company knowledge base and active systems catalogs.\n\nHow can I help you today? Feel free to describe any issues (e.g., password lockouts, VPN connection errors, hardware procurement, or email sync setups).",
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMsg]);

    const state = location.state as { initialPrompt?: string };
    if (state?.initialPrompt) {
      handleSendPrompt(state.initialPrompt);
    }
  }, [location]);

  const simulateTyping = async (text: string, msgId: string) => {
    setTypingText('');
    let index = 0;
    const speed = 15;

    const typeChar = () => {
      if (index < text.length) {
        setTypingText(prev => prev + text.charAt(index));
        index++;
        setTimeout(typeChar, speed);
      } else {
        setTypingText('');
        const botMsg: ChatMessage = {
          id: msgId,
          sender: 'assistant',
          text: text,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, botMsg]);
        setIsTyping(false);
      }
    };

    typeChar();
  };

  const handleSendPrompt = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setSuggestedTicket(null);

    try {
      const chatHistory = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await sendChat({
        query: textToSend,
        top_k: 5,
        similarity_threshold: 0.0,
        chat_history: chatHistory,
        session_id: sessionId
      });

      setSessionId(response.session_id);

      simulateTyping(response.answer, `bot_${Date.now()}`);

      if (response.suggested_ticket) {
        setSuggestedTicket({
          title: response.suggested_ticket.title || 'Support Request',
          description: response.suggested_ticket.description || textToSend,
          priority: (response.suggested_ticket.priority?.toLowerCase() || 'medium') as TicketPriority,
          show: true
        });
      }
    } catch (error) {
      console.error('Chat failed:', error);
      const errorMsg: ChatMessage = {
        id: `err_${sessionId ? sessionId.slice(0, 8) : 'unknown'}_${Date.now()}`,
        sender: 'system',
        text: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
      setIsTyping(false);
    }
  };

    const [isEscalating, setIsEscalating] = useState(false);

  const handleConvertTicket = async () => {
    if (!suggestedTicket || !sessionId || isEscalating) return;

    setIsEscalating(true);
    setIsTyping(true);
    const uniqueId = `sys_${sessionId ? sessionId.slice(0, 8) : 'unknown'}_${Date.now()}`;

    try {
      console.log('[Ticket Escalation] Starting escalation for session:', sessionId);
      const newTicket = await escalateToTicket(sessionId);
      console.log('[Ticket Escalation] Success, ticket:', newTicket.id, newTicket.ticketNumber);

      // Refresh tickets in AppContext so My Tickets and Dashboard update immediately
      await loadTickets();
      console.log('[Ticket Escalation] Tickets refreshed in context');

      setSuggestedTicket(null);

      const confirmationMsg: ChatMessage = {
        id: uniqueId,
        sender: 'system',
        text: `✅ **IT Incident Ticket Created Successfully!**\n\n**Ticket Reference:** ${newTicket.ticketNumber || newTicket.id}\n**Priority:** ${newTicket.priority.toUpperCase()}\n**Status:** OPEN\n\nYou can view and track this ticket in the Ticket Queue.`,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, confirmationMsg]);
      setIsTyping(false);
      setIsEscalating(false);
    } catch (error) {
      console.error('[Ticket Escalation] Failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create support ticket. Please try again.';
      const errorMsg: ChatMessage = {
        id: `err_${sessionId ? sessionId.slice(0, 8) : 'unknown'}_${Date.now()}`,
        sender: 'system',
        text: `❌ **Ticket Creation Failed**\n\n${errorMessage}\n\nPlease try again or contact IT support directly.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
      setIsTyping(false);
      setIsEscalating(false);
    }
  };  const toggleCollapse = (msgId: string) => {
    setCollapsedMessages(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const shouldCollapse = (text: string) => {
    return text.length > 1200;
  };

  return (
    <div id="ai-chat-container" className="flex-1 flex h-full font-sans" style={{ backgroundColor: 'var(--app-bg)' }}>
      
      {/* Main Conversation Thread Column */}
      <div className="flex-1 flex flex-col justify-between h-full" style={{ backgroundColor: 'var(--app-bg)', borderRight: '1px solid var(--border)' }}>
        {/* Top Chat Bar */}
        <div 
          className="px-6 py-4 backdrop-blur-md flex items-center justify-between sticky top-0 z-10"
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
              setMessages([messages[0]]);
              setSuggestedTicket(null);
              setSessionId(null);
              setCollapsedMessages({});
            }}
            className="p-1.5 rounded-lg transition-all text-[10px] flex items-center gap-1.5 cursor-pointer border"
            style={{ backgroundColor: 'var(--card-bg-solid)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--card-bg-solid)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Thread</span>
          </button>
        </div>

        {/* Scrollable Messages */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto p-6 space-y-8"
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
                      style={{ color: isBot ? 'var(--text-primary)' : 'var(--text-primary)' }}
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
                              h1: ({ ...props }) => <h1 className="text-lg font-bold mb-3 mt-4" style={{ color: 'var(--text-primary)' }} {...props} />,
                              h2: ({ ...props }) => <h2 className="text-base font-semibold mb-2 mt-3" style={{ color: 'var(--text-primary)' }} {...props} />,
                              h3: ({ ...props }) => <h3 className="text-sm font-semibold mb-1.5 mt-2" style={{ color: 'var(--text-primary)' }} {...props} />,
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
        </div>

        {/* Input Bar Section */}
        <div 
          className="p-6"
          style={{ backgroundColor: 'var(--app-bg)', borderTop: '1px solid var(--border)' }}
        >
          <div className="max-w-3xl mx-auto">
            <div 
              className="relative flex items-end rounded-2xl transition-all p-3"
              style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = tokens.accentPrimary; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <MessageSquare className="w-5 h-5 mr-3 mb-0.5" style={{ color: 'var(--text-tertiary)' }} />
              <textarea 
                placeholder="Ask IT support or troubleshoot connection problems..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt(input);
                  }
                }}
                className="flex-1 bg-transparent border-none text-sm outline-none resize-none max-h-48"
                style={{ color: 'var(--text-primary)' }}
                rows={1}
              />
              <button 
                onClick={() => handleSendPrompt(input)}
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
        className="w-80 p-6 flex flex-col justify-between shrink-0 h-full"
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

          {suggestedTicket && suggestedTicket.show ? (
            <div 
              className="p-5 rounded-xl"
              style={{ 
                backgroundColor: 'var(--card-bg)', 
                border: `1px solid ${tokens.accentPrimary}26`
              }}
            >
              <div className="flex items-center space-x-2 mb-3" style={{ color: tokens.accentPrimary }}>
                <PlusCircle className="w-4 h-4" />
                <h4 className="text-xs font-semibold">Incident Proposal</h4>
              </div>
              <p 
                className="text-[10px] leading-relaxed mb-4"
                style={{ color: 'var(--text-secondary)' }}
              >
                The Copilot has analyzed your problem and prepared an automated Service Ticket template to bypass standard level-1 queues.
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
                onClick={handleConvertTicket}
                className="w-full py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md"
                style={{ backgroundColor: tokens.accentPrimary, color: 'var(--accent-primary-contrast)', boxShadow: `0 4px 12px ${tokens.accentPrimary}1a` }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                <span>File Support Incident</span>
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
                onClick={() => handleSendPrompt("My laptop Okta MFA push is failing, how can I re-enroll my device?")}
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
                onClick={() => handleSendPrompt("Cannot connect to remote database from staging cluster, receiving RDS timeout")}
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
                onClick={() => handleSendPrompt("How do I connect our macOS devices to Company Wi-Fi network?")}
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

    </div>
  );
};
