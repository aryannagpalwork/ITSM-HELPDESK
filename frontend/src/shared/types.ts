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
  specialization?: string;
  createdAt?: string;
}

export interface Department {
  id: string;
  name: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Ticket {
  id: string;
  ticketNumber?: string;
  title: string;
  description: string;
  category?: string;
  status: TicketStatus;
  priority: TicketPriority;
  userId: string;
  agentId?: string;
  departmentId?: string;
  aiSummary?: string;
  suggestedResolution?: string;
  resolution?: string;
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

export interface ChatResponse {
  answer: string;
  sources: RetrievedDocumentSource[];
  confidence: number;
  retrieved_documents: number;
  session_id: string | null;
  suggested_ticket: any; // Or define GeneratedTicketDetails type if needed
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
}

export interface AICopilotTimeline {
  chats: TimelinePoint[];
  resolved: TimelinePoint[];
  escalated: TimelinePoint[];
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
  mttrHours: number;
  fcrRate: number;
  avgFirstResponseHours: number;
  resolutionRate: number;
  slaCompliance: number;
  reopenRate: number;
  csatScore: number;
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
  orgMttrHours: number;
  orgFcrRate: number;
  orgCsatScore: number;
  slaCompliance: number;
  slaBreaches: number;
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
}

export interface CurrentlyOnLeave {
  agentId: string;
  agentName: string;
  startDate: string;
  endDate: string;
  openTicketCount: number;
  status: 'on_leave';
}
