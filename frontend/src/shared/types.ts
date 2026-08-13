/**
 * Shared Type Definitions for ITSM Helpdesk Copilot
 */

export type UserRole = 'Employee' | 'Agent' | 'Administrator';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string;
  specialization?: string | string[] | null;
  createdAt?: string;
}

export interface Department {
  id: string;
  name: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_user_response' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Ticket {
  id: string;
  ticketNumber?: string;
  title: string;
  description: string;
  category?: string;
  status: TicketStatus;
  awaitingCustomerResponse?: boolean;
  priority: TicketPriority;
  userId: string;
  agentId?: string;
  departmentId?: string;
  aiSummary?: string;
  suggestedResolution?: string;
  resolution?: string;
  resolvedBy?: string;
  resolutionSource?: string;
  aiResolved?: boolean;
  createdAt: string;
  updatedAt: string;
  
  // AI Analysis fields
  aiAnalysisCategory?: string;
  aiAnalysisPriority?: string;
  aiAnalysisDepartment?: string;
  aiAnalysisTags?: string[];
  aiAnalysisConfidence?: number;
  aiAnalysisPossibleRootCause?: string;
  aiAnalysisSuggestedResolution?: string;
  aiAnalysisEstimatedSla?: string;
  slaTargetHours?: number;
  slaStartedAt?: string;
  slaDueAt?: string;
  slaRemainingHours?: number;
  slaStatus?: 'Active' | 'Near Breach' | 'Within SLA' | 'Breached' | 'Completed';
  slaBreached?: boolean;
  resolutionDurationHours?: number;
  slaCompliant?: boolean;
  
  // Assigned team
  assignedTeam?: string;
  
  // Joins (Optional)
  userName?: string;
  agentName?: string;
  departmentName?: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  commenterId: string;
  commenterName?: string;
  commenterRole?: string;
  content: string;
  isInternal: boolean; // true for internal agent-only notes, false for customer-facing
  timestamp: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}

export interface SystemAlert {
  id: string;
  title: string;
  message: string;
  recommendation?: string | null;
  source: 'manual' | 'auto_detected';
  category?: string | null;
  status: 'active' | 'resolved';
  createdBy?: string | null;
  createdAt: string;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  ticketCount?: number | null;
  relatedTicketIds?: string[] | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  targetRoles?: string[] | null;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: 'alert' | 'info' | 'ticket.assigned' | 'ticket.unassigned' | 'ticket.response' | 'feedback_request';
  title?: string;
  message: string;
  ticketId?: string | null;
  alertId?: string | null;
  read: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  avgResolutionTimeHours: number;
  kbUsageCount: number;
  aiAccuracyRate: number;
  ticketsByPriority: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  ticketsByStatus: {
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  };
  dailyTicketVolume: {
    date: string;
    created: number;
    resolved: number;
  }[];
}

export interface ChatMessageInput {
  role: string;
  content: string;
}

export interface ChatRequest {
  query: string;
  top_k?: number;
  similarity_threshold?: number;
  chat_history?: ChatMessageInput[];
  session_id?: string | null;
}

export interface RetrievedDocumentSource {
  chunk_id: string;
  document_id: number | null;
  document_title: string | null;
  text: string;
  similarity_score: number;
  page_number: number | null;
  heading: string | null;
  section: string | null;
  chunk_number: number | null;
}

export interface SatisfactionCard {
  show: boolean;
  /** "POSITIVE_TREND" | "NEGATIVE_STALL" | null */
  reason?: string | null;
  session_id?: string | null;
}

export interface ChatResponse {
  answer: string;
  /** NOTE: Sources + confidence are kept in payload for backwards compatibility,
   *  but the CHAT UI no longer displays them. They remain in backend logs only. */
  sources: RetrievedDocumentSource[];
  confidence: number;
  retrieved_documents: number;
  session_id: string | null;
  suggested_ticket: any; // Or define GeneratedTicketDetails type if needed
  satisfaction_card: SatisfactionCard | null;
  diagnostic_question?: string | null;
  guided_actions?: string[];
  guided_state?: string | null;
  ticket_id?: string | null;
  ticket_number?: string | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  suggestedAction?: 'create_ticket' | 'troubleshoot_further';
  suggestedTicketFields?: {
    title: string;
    description: string;
    priority: TicketPriority;
  };
  sources?: RetrievedDocumentSource[];
  confidence?: number;
  contextArticles?: KnowledgeArticle[];
}

export interface AgentMetrics {
  assignedTickets: number;
  openTickets: number;
  inProgress: number;
  waiting: number;
  resolvedToday: number;
  overdueTickets: number;
  avgResolutionTime: number;
  activeSlaBreaches: number;
  agentWorkload: number;
  ticketsResolved: number;
  avgResolutionTimeHours: number;
  firstResponseTime: number;
  slaCompliance: number;
  resolutionRate: number;
  reopenRate: number;
}

export interface TicketProgress {
  status: TicketStatus;
  priority: TicketPriority;
  sla: string;
  progress: number;
  resolutionStage: string;
  assignee: string;
  lastActivity: string;
}

export interface AICopilotEmployeeKPIs {
  aiChats: number;
  aiResolved: number;
  aiEscalated: number;
  successRate: number;
  articlesViewed: number;
  timeSavedMinutes: number;
}

export interface EmployeeKPIs {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  mttrHours: number;
  fcrRate: number;
  avgFirstResponseHours: number;
  firstResponseSlaCompliance: number;
  reopenedTickets: number;
  aiCopilot: AICopilotEmployeeKPIs;
}

// ─── KPI Timeline Types ──────────────────────────────────────────────────

export interface TimelinePoint {
  label: string;
  value: number;
}

export interface TicketLifecycleTimeline {
  created: TimelinePoint[];
  resolved: TimelinePoint[];
  aiResolved: TimelinePoint[];
  agentResolved: TimelinePoint[];
  inProgress: TimelinePoint[];
}

export interface AICopilotTimeline {
  chats: TimelinePoint[];
  resolved: TimelinePoint[];
  escalated: TimelinePoint[];
}

export interface AnalyticsMetric {
  name: string;
  value: number;
}

export interface SLAAnalytics {
  priority: string;
  slaTargetHours: number | null;
  withinSla: number;
  breached: number;
  active: number;
  nearBreach: number;
  averageResolutionHours: number;
  compliance: number;
}

export interface AdminAnalytics {
  month: number;
  year: number;
  days: string[];
  ticketLifecycle: TicketLifecycleTimeline;
  aiCopilot: AICopilotTimeline;
  resolution: AnalyticsMetric[];
  sla: AnalyticsMetric[];
  slaByPriority: SLAAnalytics[];
  totals: Record<string, number>;
}

export type TimelineRange = 'today' | '7d' | '30d';

export interface AICopilotAgentKPIs {
  suggestionsGenerated: number;
  suggestionsAccepted: number;
  acceptanceRate: number;
  resolutionDrafts: number;
  kbSearches: number;
  timeSavedMinutes: number;
}

export interface AgentKPIs {
  assignedTickets: number;
  openTickets: number;
  inProgress: number;
  waiting: number;
  resolvedTickets: number;
  resolvedToday: number;
  overdueTickets: number;
  agentMttrHours: number;
  aiMttrHours: number;
  agentFcrRate: number;
  avgFirstResponseHours: number;
  firstResponseSlaCompliance: number;
  resolutionRate: number;
  slaCompliance: number;
  reopenRate: number;
  aiCopilot: AICopilotAgentKPIs;
}

export interface AICopilotAdminKPIs {
  totalAIChats: number;
  aiResolved: number;
  aiEscalated: number;
  successRate: number;
  knowledgeHits: number;
  hoursSaved: number;
}

export interface AdminKPIs {
  systemUsers: number;
  activeAgents: number;
  agentMttrHours: number;
  aiMttrHours: number;
  orgAgentFcrRate: number;
  slaCompliance: number;
  slaBreaches: number;
  activeSlaTickets: number;
  nearBreachTickets: number;
  criticalSlaBreaches: number;
  firstResponseSlaCompliance: number;
  ticketBacklog: number;
  aiResolutionRate: number;
  aiQueries: number;
  aiCopilot: AICopilotAdminKPIs;
}

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  agentId: string;
  agentName?: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface AgentAvailability {
  agentId: string;
  name: string;
  onLeaveToday: boolean;
  openTicketCount: number;
  department?: string | null;
  specialization?: string | string[] | null;
}

export interface CurrentlyOnLeave {
  agentId: string;
  agentName: string;
  startDate: string;
  endDate: string;
  openTicketCount: number;
  status: 'on_leave';
}
