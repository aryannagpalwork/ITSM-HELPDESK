import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useApp } from './AppContext';
import { ChatMessage, TicketPriority } from './types';
import { sendChat, escalateToTicket, submitAIChatFeedback, getChatHistory } from './api';
import type { SatisfactionCard } from './types';

// ─────────────────────────────────────────────────────────────────────────
// Lifetime: this state lives above the router (mounted once at app root,
// see App.tsx), so navigating between tabs/pages never unmounts it and
// never wipes it. It is only ever cleared by:
//   1. The user clicking "Reset Thread" (explicit, in-session new chat).
//   2. Logout (isAuthenticated flips to false — see the effect below).
// A finished conversation is NOT auto-cleared; the user can keep talking
// about a new issue in the same thread, or hit Reset Thread first if they
// want a clean slate. This matches how ChatGPT / Intercom-style copilots
// handle "did my chat survive switching tabs."
// ─────────────────────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  sender: 'assistant',
  text: "Hello! I am your Enterprise ITSM Helpdesk Copilot. I have real-time semantic access to the entire company knowledge base and active systems catalogs.\n\nHow can I help you today? Feel free to describe any issues (e.g., password lockouts, VPN connection errors, hardware procurement, or email sync setups).",
  timestamp: new Date().toISOString(),
};

const CONTINUE_PROMPT_MESSAGE: ChatMessage = {
  id: 'continue_prompt',
  sender: 'assistant',
  text: "I am here to help resolve your issue. Tell me what you need help with.",
  timestamp: new Date().toISOString(),
};

const FRESH_QUERY_MESSAGE: ChatMessage = {
  id: 'fresh_query',
  sender: 'assistant',
  text: "Tell me your query.",
  timestamp: new Date().toISOString(),
};

type SuggestedTicketState = {
  title: string;
  description: string;
  priority: TicketPriority;
  show: boolean;
  resolvedByAI?: boolean;
  ticketId?: string;
  knowledgeBaseFallback?: boolean;
} | null;

type ConversationStatus = 'ACTIVE' | 'AWAITING_SATISFACTION' | 'ISSUE_RESOLVED' | 'TICKET_CREATED' | 'CONTINUING' | 'NEW_CONVERSATION';

type TicketSource = 'AI_RESOLVED' | 'FILE_INCIDENT' | null;

type CreatedTicketInfo = {
  ticketNumber: string;
  ticketId: string;
} | null;

interface ChatContextType {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isTyping: boolean;
  typingText: string;
  suggestedTicket: SuggestedTicketState;
  sessionId: string | null;
  collapsedMessages: Record<string, boolean>;
  toggleCollapse: (msgId: string) => void;
  activeSatisfactionCard: SatisfactionCard | null;
  conversationStatus: ConversationStatus;
  guidedActions: string[];
  guidedState: string | null;
  isEscalating: boolean;
  isFeedbackLoading: boolean;
  ticketCreatedForIssue: boolean;
  createdTicketInfo: CreatedTicketInfo;
  ticketSource: TicketSource;
  activeTicketId: string | null;
  currentIssueResolved: boolean;
  currentIssueShownSatisfaction: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  handleSendPrompt: (text: string, preserveHistory?: boolean, forceNewSession?: boolean) => Promise<void>;
  handleGuidedYes: () => Promise<void>;
  handleGuidedNo: () => Promise<void>;
  handleConvertTicket: () => Promise<void>;
  handleSatisfactionResolved: () => Promise<void>;
  handleSatisfactionCreateTicket: () => Promise<void>;
  continueInThisChat: () => void;
  startNewQuery: () => void;
  resetThread: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { createTicket, loadTickets, isAuthenticated } = useApp();

  const SESSION_STORAGE_KEY = 'copilot_session_id';

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [suggestedTicket, setSuggestedTicket] = useState<SuggestedTicketState>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [collapsedMessages, setCollapsedMessages] = useState<Record<string, boolean>>({});
  const [activeSatisfactionCard, setActiveSatisfactionCard] = useState<SatisfactionCard | null>(null);
  const [pendingSatisfactionCard, setPendingSatisfactionCard] = useState<SatisfactionCard | null>(null);
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('ACTIVE');
  const [guidedActions, setGuidedActions] = useState<string[]>([]);
  const [guidedState, setGuidedState] = useState<string | null>(null);
  const [isEscalating, setIsEscalating] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [ticketCreatedForIssue, setTicketCreatedForIssue] = useState(false);
  const [createdTicketInfo, setCreatedTicketInfo] = useState<CreatedTicketInfo>(null);
  const [ticketSource, setTicketSource] = useState<TicketSource>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [currentIssueResolved, setCurrentIssueResolved] = useState(false);
  const [currentIssueShownSatisfaction, setCurrentIssueShownSatisfaction] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([WELCOME_MESSAGE]);
  const sessionIdRef = useRef<string | null>(null);

  // Keep refs in sync with state so async handlers always
  // read the latest value instead of a stale closure.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Logout is the ONLY thing that clears the chat automatically. Tab
  // switches / route changes do not touch this provider at all, since it
  // lives above the router.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      setMessages([WELCOME_MESSAGE]);
      setSuggestedTicket(null);
      setSessionId(null);
      try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch (e) { /* ignore */ }
      setCollapsedMessages({});
      setActiveSatisfactionCard(null);
      setPendingSatisfactionCard(null);
      setConversationStatus('ACTIVE');
      setGuidedActions([]);
      setGuidedState(null);
      setIsTyping(false);
      setTypingText('');
      setTicketCreatedForIssue(false);
      setCreatedTicketInfo(null);
      setTicketSource(null);
      setActiveTicketId(null);
      setCurrentIssueResolved(false);
      setCurrentIssueShownSatisfaction(false);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  // On mount, attempt to restore session from sessionStorage. If there is an
  // in-flight assistant response (last message is user without assistant reply)
  // poll the history endpoint until the assistant message appears.
  useEffect(() => {
    let pollId: number | null = null;
    let pollTimeout: number | null = null;

    const tryRestore = async (storedId: string) => {
      try {
        const resp = await getChatHistory(storedId);
        const msgs = (resp.messages || []).map(m => ({ id: String(m.id || `${m.sender}_${Date.now()}`), sender: m.sender as 'user' | 'assistant' | 'system', text: m.text, timestamp: m.timestamp } as ChatMessage));
        
        // Reconstruct ticket success message if ticket was created and conversation is ESCALATED
        // but the success message is not already in the restored messages
        const conversation = resp.conversation as any;
        if (resp.conversation_status === 'ESCALATED' && conversation?.ticket_id && conversation?.ticket_number) {
          const hasTicketSuccessMsg = msgs.some(m => 
            m.sender === 'system' && m.text.includes('IT Incident Ticket Created Successfully')
          );
          if (!hasTicketSuccessMsg) {
            const successMsg: ChatMessage = {
              id: `sys_reconstructed_${storedId?.slice(0, 8)}_ticket`,
              sender: 'system',
              text: `✅ **IT Incident Ticket Created Successfully!**\n\n**Ticket Reference:** ${conversation.ticket_number || conversation.ticket_id}\n**Priority:** ${(conversation.priority || 'MEDIUM').toUpperCase()}\n**Status:** OPEN\n\nYou can view and track this ticket in the Ticket Queue.`,
              timestamp: new Date().toISOString(),
            };
            msgs.push(successMsg);
          }
        }
        
        // If there are no messages, keep welcome message. If there ARE
        // restored messages, prepend the welcome message back in — it's a
        // frontend-only greeting that's never saved to chat_history on the
        // backend, so a plain restore would otherwise silently drop it.
        if (msgs.length > 0) setMessages([WELCOME_MESSAGE, ...msgs] as ChatMessage[]);
        setSessionId(resp.session_id || storedId);
        if (resp.conversation_status) setConversationStatus(resp.conversation_status as ConversationStatus || 'ACTIVE');

        // Detect in-flight: last message from user with no assistant after it
        const last = resp.messages && resp.messages.length ? resp.messages[resp.messages.length - 1] : null;
        const lastIsUser = last && last.sender === 'user';
        const hasAssistantAfter = resp.messages && resp.messages.some((m: any, idx: number) => m.sender === 'assistant' && idx > (resp.messages.length - 1));

        if (lastIsUser && !hasAssistantAfter) {
          setIsTyping(true);
          setTypingText('AI is responding...');

          const startLen = resp.messages.length;
          const start = Date.now();

          pollId = window.setInterval(async () => {
            try {
              const updated = await getChatHistory(storedId);
              const updatedMsgs = updated.messages || [];
              // Find first assistant message after startLen
              if (updatedMsgs.length > startLen) {
                const newAssistant = updatedMsgs.slice(startLen).find((m: any) => m.sender === 'assistant');
                if (newAssistant) {
                  // append assistant message with typing animation
                  setIsTyping(false);
                  simulateTyping(newAssistant.text, `bot_${Date.now()}`);
                  if (pollId) { window.clearInterval(pollId); pollId = null; }
                  if (pollTimeout) { window.clearTimeout(pollTimeout); pollTimeout = null; }
                }
              }
              // Stop polling after 60s
              if (Date.now() - start > 60000) {
                if (pollId) { window.clearInterval(pollId); pollId = null; }
                setIsTyping(false);
                setTypingText('');
              }
            } catch (err) {
              console.error('[Restore Poll] failed to fetch history', err);
            }
          }, 2000);

          pollTimeout = window.setTimeout(() => {
            if (pollId) { window.clearInterval(pollId); pollId = null; }
            setIsTyping(false);
            setTypingText('');
          }, 61000);
        }
      } catch (err) {
        console.error('[Session Restore] failed:', err);
      }
    };

    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) tryRestore(stored);
    } catch (e) {
      /* ignore sessionStorage errors */
    }

    return () => {
      if (pollId) window.clearInterval(pollId);
      if (pollTimeout) window.clearTimeout(pollTimeout);
    };
  }, []);

  const simulateTyping = async (text: string, msgId: string) => {
    setTypingText('');
    const indexRef = { current: 0 };
    const speed = 15;

    const typeChar = () => {
      if (indexRef.current < text.length) {
        const char = text.charAt(indexRef.current);
        indexRef.current++;
        setTypingText(prev => prev + char);
        setTimeout(typeChar, speed);
      } else {
        setTypingText('');
        const botMsg: ChatMessage = {
          id: msgId,
          sender: 'assistant',
          text: text,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, botMsg]);
        setIsTyping(false);
      }
    };

    typeChar();
  };

  // When typing finishes, show any pending satisfaction card
  useEffect(() => {
    if (!isTyping && pendingSatisfactionCard?.show && !activeSatisfactionCard) {
      setActiveSatisfactionCard(pendingSatisfactionCard);
      if (pendingSatisfactionCard.reason === 'POSITIVE_TREND') {
        setConversationStatus('LIKELY_RESOLVED');
      } else if (pendingSatisfactionCard.reason === 'NEGATIVE_STALL') {
        setConversationStatus('WAITING_FOR_USER');
      }
      setPendingSatisfactionCard(null);
    }
  }, [isTyping, pendingSatisfactionCard, activeSatisfactionCard]);

  const handleSendPrompt = async (
    textToSend: string,
    preserveHistory: boolean = true,
    forceNewSession: boolean = false,
  ) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const chatHistory = preserveHistory
        ? messagesRef.current.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text,
          }))
        : [];

      const response = await sendChat({
        query: textToSend,
        top_k: 5,
        similarity_threshold: 0.0,
        chat_history: chatHistory,
        session_id: forceNewSession ? null : sessionIdRef.current,
        reset_satisfaction: conversationStatus === 'CONTINUING' || conversationStatus === 'NEW_CONVERSATION',
      });

      // After sending, transition from CONTINUING/NEW_CONVERSATION to ACTIVE
      // (we are now in a new issue within the same or new session)
      if (conversationStatus === 'CONTINUING' || conversationStatus === 'NEW_CONVERSATION') {
        setConversationStatus('ACTIVE');
      }

      setSessionId(response.session_id);
      try { if (response.session_id) sessionStorage.setItem(SESSION_STORAGE_KEY, response.session_id); } catch (e) { /* ignore */ }
      if (response.guided_state === 'RESOLVED') {
        await loadTickets();
      }

      setGuidedActions(response.guided_actions || []);
      setGuidedState(response.guided_state || null);

      if (response.guided_state === 'RESOLVED') {
        setConversationStatus('ISSUE_RESOLVED');
        setCurrentIssueResolved(true);
        setActiveSatisfactionCard(null);
        setPendingSatisfactionCard(null);
        setSuggestedTicket(prev => prev ? { ...prev, resolvedByAI: true } : prev);
      } else if (!response.guided_state && response.satisfaction_card?.show && !activeSatisfactionCard && !pendingSatisfactionCard) {
        // Store in pending state; it will be shown after typing completes
        setPendingSatisfactionCard(response.satisfaction_card);
      }

      simulateTyping(response.answer, `bot_${Date.now()}`);

      if (response.suggested_ticket) {
        setSuggestedTicket({
          title: response.suggested_ticket.title || 'Support Request',
          description: response.suggested_ticket.description || textToSend,
          priority: (response.suggested_ticket.priority?.toLowerCase() || 'medium') as TicketPriority,
          show: true,
          ticketId: response.ticket_id ?? undefined,
          knowledgeBaseFallback: response.suggested_ticket.knowledge_base_fallback === true,
        });
      } else if (response.ticket_id) {
        setSuggestedTicket(previous => previous ? { ...previous, ticketId: response.ticket_id ?? undefined } : previous);
      } else if (response.guided_state && response.guided_state !== 'RESOLVED' && response.guided_state !== 'NO_SOLUTION') {
        setSuggestedTicket(previous => previous || {
          title: textToSend.length > 80 ? `${textToSend.slice(0, 77)}...` : textToSend,
          description: textToSend,
          priority: 'medium',
          show: true,
        });
      }
    } catch (error) {
      console.error('Chat failed:', error);
      const errorMsg: ChatMessage = {
        id: `err_${sessionId ? sessionId.slice(0, 8) : 'unknown'}_${Date.now()}`,
        sender: 'system',
        text: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
      setIsTyping(false);
    }
  };

  const handleGuidedYes = async () => {
    if (!sessionId || isFeedbackLoading) return;
    setIsFeedbackLoading(true);
    try {
      const feedbackResult = await submitAIChatFeedback(sessionId, 'positive');
      const refreshedTickets = await loadTickets();
      const refreshedAITicket = refreshedTickets.find(ticket => ticket.aiResolved === true);
    setConversationStatus('ISSUE_RESOLVED');
    setCurrentIssueResolved(true);
    setGuidedActions([]);
    setGuidedState('RESOLVED');
      setTicketSource('AI_RESOLVED');
      const resolvedTicketId = (feedbackResult.ticket_id ?? undefined) || suggestedTicket?.ticketId || refreshedAITicket?.id;
      setActiveTicketId(resolvedTicketId || null);
      setSuggestedTicket(prev => ({
        ...(prev || {
          title: 'AI Resolved Support Request',
          description: 'Issue resolved by AI Copilot.',
          priority: 'medium' as TicketPriority,
        }),
        show: true,
        resolvedByAI: true,
        ticketId: resolvedTicketId,
      }));
      setMessages(prev => [...prev, {
        id: `resolved_${Date.now()}`,
        sender: 'assistant',
        text: 'Thanks for confirming. Your issue has been marked as Resolved by AI.',
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      console.error('[Guided Resolution] Failed:', error);
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const handleGuidedNo = async () => {
    if (!sessionId || isFeedbackLoading) return;
    setIsFeedbackLoading(true);
    try {
      try {
        await submitAIChatFeedback(sessionId, 'negative');
      } catch (error) {
        console.error('[Guided No Feedback] Failed:', error);
      }
      setActiveSatisfactionCard(null);
      await handleSendPrompt('No');
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const handleConvertTicket = async () => {
    if (!suggestedTicket || !sessionId || isEscalating) return;

    setIsEscalating(true);
    setIsTyping(true);
    const uniqueId = `sys_${sessionId ? sessionId.slice(0, 8) : 'unknown'}_${Date.now()}`;

    try {
      // Smart ticket grouping: if same source, pass existing ticket ID to append
      const existingId = (ticketSource === 'FILE_INCIDENT' && activeTicketId) ? activeTicketId : undefined;
      const newTicket = await escalateToTicket(sessionId, undefined, 'FILE_INCIDENT', existingId, suggestedTicket.title);
      await loadTickets();
      setSuggestedTicket(null);
      setTicketCreatedForIssue(true);
      setTicketSource('FILE_INCIDENT');
      setConversationStatus('TICKET_CREATED');
      setActiveTicketId(newTicket.id);
      setCreatedTicketInfo({
        ticketNumber: newTicket.ticketNumber || newTicket.id,
        ticketId: newTicket.id,
      });

      const confirmationMsg: ChatMessage = {
        id: uniqueId,
        sender: 'system',
        text: `✅ **IT Incident Ticket Created Successfully!**\n\n**Ticket Reference:** ${newTicket.ticketNumber || newTicket.id}\n**Priority:** ${newTicket.priority.toUpperCase()}\n**Status:** OPEN\n\nYour issue has been handed over to IT Support.`,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, confirmationMsg]);
      // Mark conversation as escalated/ended after successful ticket creation
      setConversationStatus('ESCALATED');
      setIsTyping(false);
      setIsEscalating(false);
    } catch (error) {
      console.error('[Ticket Escalation] Failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create support ticket. Please try again.';
      const errorMsg: ChatMessage = {
        id: `err_${sessionId ? sessionId.slice(0, 8) : 'unknown'}_${Date.now()}`,
        sender: 'system',
        text: `❌ **Ticket Creation Failed**\n\n${errorMessage}\n\nPlease try again or contact IT support directly.`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
      setIsTyping(false);
      setIsEscalating(false);
    }
  };

  const handleSatisfactionResolved = async () => {
    if (!activeSatisfactionCard || isFeedbackLoading) return;
    const sid = activeSatisfactionCard.session_id || sessionId;
    setIsFeedbackLoading(true);
    try {
      if (sid) {
        const feedbackResult = await submitAIChatFeedback(sid, 'positive');
        const refreshedTickets = await loadTickets();
        const refreshedAITicket = refreshedTickets.find(ticket => ticket.aiResolved === true);
        const resolvedTicketId = (feedbackResult.ticket_id ?? undefined) || suggestedTicket?.ticketId || refreshedAITicket?.id;
        setActiveTicketId(resolvedTicketId || null);
        setSuggestedTicket(prev => prev ? { ...prev, show: true, resolvedByAI: true, ticketId: resolvedTicketId } : prev);
      }
    setConversationStatus('ISSUE_RESOLVED');
    setCurrentIssueResolved(true);
    setTicketSource('AI_RESOLVED');
      setActiveSatisfactionCard(null);
      const resolvedMsg = 'Thanks for confirming. Your issue has been marked as Resolved by AI.';
      setMessages(prev => [...prev, { id: `assist_${Date.now()}`, sender: 'assistant', text: resolvedMsg, timestamp: new Date().toISOString() }]);
    } catch (error) {
      console.error('[Satisfaction Feedback] Failed:', error);
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const handleSatisfactionCreateTicket = async () => {
    if (isFeedbackLoading) return;
    const sid = activeSatisfactionCard?.session_id || sessionId;
    setIsFeedbackLoading(true);
    setIsEscalating(true);
    setIsTyping(true);
    const uniqueId = `sys_${sid ? sid.slice(0, 8) : 'unknown'}_${Date.now()}`;
    try {
      if (sid) {
        try { await submitAIChatFeedback(sid, 'negative'); } catch (_f) { /* ignore secondary feedback errors */ }
      }
      if (suggestedTicket && sid) {
        await handleConvertTicket();
      } else if (sid) {
        const existingId = (ticketSource === 'FILE_INCIDENT' && activeTicketId) ? activeTicketId : undefined;
        const newTicket = await escalateToTicket(sid, 'AI could not resolve; user requested ticket from satisfaction card.', 'FILE_INCIDENT', existingId, suggestedTicket?.title);
        await loadTickets();
        setTicketCreatedForIssue(true);
        setTicketSource('FILE_INCIDENT');
        setActiveTicketId(newTicket.id);
        setCreatedTicketInfo({
          ticketNumber: newTicket.ticketNumber || newTicket.id,
          ticketId: newTicket.id,
        });
        const confirmationMsg: ChatMessage = {
          id: uniqueId,
          sender: 'system',
          text: `✅ **IT Incident Ticket Created Successfully!**\n\n**Ticket Reference:** ${newTicket.ticketNumber || newTicket.id}\n**Priority:** ${newTicket.priority.toUpperCase()}\n**Status:** OPEN\n\nYour issue has been handed over to IT Support.`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, confirmationMsg]);
      }
    setConversationStatus('TICKET_CREATED');
    setActiveSatisfactionCard(null);
    setSuggestedTicket(null);
  } catch (error) {
    console.error('[Satisfaction Ticket] Failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create support ticket. Please try again.';
      const errorMsg: ChatMessage = {
        id: `err_${sid ? sid.slice(0, 8) : 'unknown'}_${Date.now()}`,
        sender: 'system',
        text: `❌ **Ticket Creation Failed**\n\n${errorMessage}\n\nPlease try again or contact IT support directly.`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsFeedbackLoading(false);
      setIsEscalating(false);
      setIsTyping(false);
    }
  };

  const toggleCollapse = (msgId: string) => {
    setCollapsedMessages(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // The explicit "start fresh, in-session" action — this is the only place
  // a finished/abandoned conversation actually goes away before logout.
  const resetThread = () => {
    setMessages([WELCOME_MESSAGE]);
    setSuggestedTicket(null);
    setSessionId(null);
    setCollapsedMessages({});
    setActiveSatisfactionCard(null);
    setPendingSatisfactionCard(null);
    setConversationStatus('ACTIVE');
    setGuidedActions([]);
    setGuidedState(null);
    setTicketCreatedForIssue(false);
    setCreatedTicketInfo(null);
    setTicketSource(null);
    setActiveTicketId(null);
    setCurrentIssueResolved(false);
    setCurrentIssueShownSatisfaction(false);
    try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch (e) { /* ignore */ }
  };

  // Keep the conversation linked to the existing issue; add a prompt and unfreeze input.
  const continueInThisChat = () => {
    setTicketCreatedForIssue(false);
    setCurrentIssueResolved(false);
    setCurrentIssueShownSatisfaction(false);
    setConversationStatus('CONTINUING');
    setActiveSatisfactionCard(null);
    setGuidedActions([]);
    setGuidedState(null);
    const promptMsg: ChatMessage = {
      ...CONTINUE_PROMPT_MESSAGE,
      id: `continue_prompt_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, promptMsg]);
  };

  // Start a fresh issue context — reset everything and show a short prompt.
  const startNewQuery = () => {
    setMessages([FRESH_QUERY_MESSAGE]);
    setSuggestedTicket(null);
    setSessionId(null);
    setCollapsedMessages({});
    setActiveSatisfactionCard(null);
    setConversationStatus('NEW_CONVERSATION');
    setGuidedActions([]);
    setGuidedState(null);
    setTicketCreatedForIssue(false);
    setCreatedTicketInfo(null);
    setTicketSource(null);
    setActiveTicketId(null);
    setCurrentIssueResolved(false);
    setCurrentIssueShownSatisfaction(false);
    try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch (e) { /* ignore */ }
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        setInput,
        isTyping,
        typingText,
        suggestedTicket,
        sessionId,
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
        ticketSource,
        activeTicketId,
        currentIssueResolved,
        currentIssueShownSatisfaction,
        contentRef,
        handleSendPrompt,
        handleGuidedYes,
        handleGuidedNo,
        handleConvertTicket,
        handleSatisfactionResolved,
        handleSatisfactionCreateTicket,
        continueInThisChat,
        startNewQuery,
        resetThread,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};