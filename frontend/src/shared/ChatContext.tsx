import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useApp } from './AppContext';
import { ChatMessage, TicketPriority } from './types';
import { sendChat, escalateToTicket, submitAIChatFeedback } from './api';
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

type SuggestedTicketState = {
  title: string;
  description: string;
  priority: TicketPriority;
  show: boolean;
  resolvedByAI?: boolean;
  ticketId?: string;
  knowledgeBaseFallback?: boolean;
} | null;

type ConversationStatus = 'ACTIVE' | 'INVESTIGATING' | 'WAITING_FOR_USER' | 'LIKELY_RESOLVED' | 'ESCALATED' | 'RESOLVED';

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
  contentRef: React.RefObject<HTMLDivElement | null>;
  handleSendPrompt: (text: string) => Promise<void>;
  handleGuidedYes: () => Promise<void>;
  handleGuidedNo: () => void;
  handleConvertTicket: () => Promise<void>;
  handleSatisfactionResolved: () => Promise<void>;
  handleSatisfactionCreateTicket: () => Promise<void>;
  resetThread: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { createTicket, loadTickets, isAuthenticated } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [suggestedTicket, setSuggestedTicket] = useState<SuggestedTicketState>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [collapsedMessages, setCollapsedMessages] = useState<Record<string, boolean>>({});
  const [activeSatisfactionCard, setActiveSatisfactionCard] = useState<SatisfactionCard | null>(null);
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('ACTIVE');
  const [guidedActions, setGuidedActions] = useState<string[]>([]);
  const [guidedState, setGuidedState] = useState<string | null>(null);
  const [isEscalating, setIsEscalating] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  // Logout is the ONLY thing that clears the chat automatically. Tab
  // switches / route changes do not touch this provider at all, since it
  // lives above the router.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      setMessages([WELCOME_MESSAGE]);
      setSuggestedTicket(null);
      setSessionId(null);
      setCollapsedMessages({});
      setActiveSatisfactionCard(null);
      setConversationStatus('ACTIVE');
      setGuidedActions([]);
      setGuidedState(null);
      setIsTyping(false);
      setTypingText('');
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

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
          timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const chatHistory = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
      }));

      const response = await sendChat({
        query: textToSend,
        top_k: 5,
        similarity_threshold: 0.0,
        chat_history: chatHistory,
        session_id: sessionId,
      });

      setSessionId(response.session_id);
      if (response.guided_state === 'RESOLVED') {
        await loadTickets();
      }

      setGuidedActions(response.guided_actions || []);
      setGuidedState(response.guided_state || null);

      if (!response.guided_state && response.satisfaction_card?.show && !activeSatisfactionCard) {
        setActiveSatisfactionCard(response.satisfaction_card);
        if (response.satisfaction_card.reason === 'POSITIVE_TREND') {
          setConversationStatus('LIKELY_RESOLVED');
        } else if (response.satisfaction_card.reason === 'NEGATIVE_STALL') {
          setConversationStatus('WAITING_FOR_USER');
        }
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
      setConversationStatus('RESOLVED');
      setGuidedActions([]);
      setGuidedState('RESOLVED');
      setSuggestedTicket(prev => ({
        ...(prev || {
          title: 'AI Resolved Support Request',
          description: 'Issue resolved by AI Copilot.',
          priority: 'medium' as TicketPriority,
        }),
        show: true,
        resolvedByAI: true,
        ticketId: (feedbackResult.ticket_id ?? undefined) || prev?.ticketId || refreshedAITicket?.id,
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

  const handleGuidedNo = () => {
    setActiveSatisfactionCard(null);
    handleSendPrompt('No');
  };

  const handleConvertTicket = async () => {
    if (!suggestedTicket || !sessionId || isEscalating) return;

    setIsEscalating(true);
    setIsTyping(true);
    const uniqueId = `sys_${sessionId ? sessionId.slice(0, 8) : 'unknown'}_${Date.now()}`;

    try {
      const newTicket = await escalateToTicket(sessionId);
      await loadTickets();
      setSuggestedTicket(null);

      const confirmationMsg: ChatMessage = {
        id: uniqueId,
        sender: 'system',
        text: `✅ **IT Incident Ticket Created Successfully!**\n\n**Ticket Reference:** ${newTicket.ticketNumber || newTicket.id}\n**Priority:** ${newTicket.priority.toUpperCase()}\n**Status:** OPEN\n\nYou can view and track this ticket in the Ticket Queue.`,
        timestamp: new Date().toISOString(),
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
        setSuggestedTicket(prev => prev ? { ...prev, show: true, resolvedByAI: true, ticketId: (feedbackResult.ticket_id ?? undefined) || prev.ticketId || refreshedAITicket?.id } : prev);
      }
      setConversationStatus('RESOLVED');
      setActiveSatisfactionCard(null);
      const resolvedMsg = 'Thank you for the update. I’m glad I could help — feel free to reach out any time.';
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
        const newTicket = await escalateToTicket(sid, 'AI could not resolve; user requested ticket from satisfaction card.');
        await loadTickets();
        const confirmationMsg: ChatMessage = {
          id: uniqueId,
          sender: 'system',
          text: `✅ **IT Incident Ticket Created Successfully!**\n\n**Ticket Reference:** ${newTicket.ticketNumber || newTicket.id}\n**Priority:** ${newTicket.priority.toUpperCase()}\n**Status:** OPEN\n\nYou can view and track this ticket in the Ticket Queue.`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, confirmationMsg]);
      }
      setConversationStatus('ESCALATED');
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
    setConversationStatus('ACTIVE');
    setGuidedActions([]);
    setGuidedState(null);
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
        contentRef,
        handleSendPrompt,
        handleGuidedYes,
        handleGuidedNo,
        handleConvertTicket,
        handleSatisfactionResolved,
        handleSatisfactionCreateTicket,
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