import { Ticket, TicketComment, TicketPriority, TicketStatus, ChatRequest, ChatResponse, User, EmployeeKPIs, AgentKPIs, AdminKPIs, TimelineRange, TicketLifecycleTimeline, AICopilotTimeline } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const ACCESS_TOKEN_KEY = 'it_copilot_access_token';
const REFRESH_TOKEN_KEY = 'it_copilot_refresh_token';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
export const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};
export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

const authHeaders = (): Record<string, string> => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    window.location.href = '#/login';
    throw new Error('Session expired');
  }

  const data = (await response.json()) as TokenResponse;
  setTokens(data.access_token, data.refresh_token);
  return data.access_token;
};

const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
  let response = await fetch(input, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });

  if (response.status === 401) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        return fetch(input, {
          ...init,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init.headers || {}),
          },
        });
      }).catch(err => Promise.reject(err));
    }

    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);
      return fetch(input, {
        ...init,
        headers: {
          Authorization: `Bearer ${newToken}`,
          ...(init.headers || {}),
        },
      });
    } catch (err) {
      processQueue(err, null);
      clearTokens();
      window.location.href = '#/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }

  return response;
};

interface BackendTicketComment {
  id: string;
  ticket_id: string;
  author_id?: string;
  author_name?: string;
  author_role?: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

interface BackendTicket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_at?: string;
  assignment_type?: string;
  assignment_reason?: string;
  matched_specialization?: string;
  assigned_team?: string;
  created_by?: string;
  created_by_name?: string;
  ai_summary?: string;
  resolution?: string;
  ai_analysis_category?: string;
  ai_analysis_priority?: string;
  ai_analysis_department?: string;
  ai_analysis_tags?: string[];
  ai_analysis_confidence?: number;
  ai_analysis_possible_root_cause?: string;
  ai_analysis_suggested_resolution?: string;
  ai_analysis_estimated_sla?: string;
  created_at: string;
  updated_at: string;
  comments?: BackendTicketComment[];
}

interface BackendTicketListResponse {
  items: BackendTicket[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Employee' | 'Agent' | 'Administrator';
  departmentId?: string;
}

interface BackendUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department?: string;
}

interface BackendUserWithStatus extends BackendUser {
  status: string;
  is_active: boolean;
  created_at: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: BackendUser;
}

interface AuditLogMetadata {
  field?: string;
  old_value?: any;
  new_value?: any;
  changes?: Array<{ field: string; old_value: any; new_value: any }>;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: AuditLogMetadata;
  reason?: string;
  created_at: string;
}

export interface TicketQuery {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignment?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Extract a human-readable error message from an API error response.
 * Supports:
 *   - error.response?.data?.message  (axios-like)
 *   - error.message                  (standard Error)
 *   - FastAPI validation array detail  (array of {loc, msg, type})
 *   - Plain string detail
 * Fallback: "Something went wrong"
 */
export const extractApiError = (error: unknown): string => {
  // Try axios-like: error.response?.data?.message
  if (error && typeof error === 'object') {
    const errObj = error as Record<string, unknown>;
    const response = errObj.response as Record<string, unknown> | undefined;
    if (response?.data) {
      const data = response.data as Record<string, unknown>;
      if (typeof data.message === 'string') {
        return data.message;
      }
    }
  }

  // Standard Error object
  if (error instanceof Error) {
    return error.message || 'Something went wrong';
  }

  // Fallback
  return 'Something went wrong';
};

/**
 * Extract a readable error message from a failed API response body.
 * Handles FastAPI validation error arrays and plain detail strings.
 * Formats: "field_name: error_msg" for validation errors.
 */
const extractErrorFromResponse = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    if (data.detail) {
      if (Array.isArray(data.detail)) {
        // FastAPI validation errors: [{loc: ["body","field"], msg: "field required", type: "..."}]
        return data.detail.map((err: any) => {
          const field = err.loc ? err.loc.filter((s: string) => s !== 'body').pop() : null;
          return field ? `${field}: ${err.msg}` : (err.msg || String(err));
        }).join(', ');
      }
      return String(data.detail);
    }
    if (data.message) {
      return String(data.message);
    }
    return `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const statusToFrontend = (status: BackendTicket['status']): TicketStatus => {
  const map: Record<BackendTicket['status'], TicketStatus> = {
    Open: 'open',
    'In Progress': 'in_progress',
    Resolved: 'resolved',
    Closed: 'closed',
  };
  return map[status];
};

const priorityToFrontend = (priority: BackendTicket['priority']): TicketPriority => {
  return priority.toLowerCase() as TicketPriority;
};

const mapSortBy = (sortBy?: string): string => {
  if (sortBy === 'newest' || sortBy === 'oldest') return 'created_at';
  if (sortBy === 'priority') return 'priority';
  return 'created_at';
};

export const mapUser = (user: BackendUser): AuthUser => {
  // Backend already maps internal roles to frontend format via INTERNAL_TO_FRONTEND
  // So role can be either internal (end_user, agent, admin) or frontend (Employee, Agent, Administrator)
  const roleMap: Record<string, AuthUser['role']> = {
    end_user: 'Employee',
    employee: 'Employee',
    Employee: 'Employee',
    agent: 'Agent',
    Agent: 'Agent',
    admin: 'Administrator',
    Administrator: 'Administrator',
  };
  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: roleMap[user.role] || 'Employee',
    departmentId: user.department,
  };
};

const mapRole = (role: string): 'Employee' | 'Agent' | 'Administrator' => {
  const roleMap: Record<string, 'Employee' | 'Agent' | 'Administrator'> = {
    end_user: 'Employee',
    employee: 'Employee',
    Employee: 'Employee',
    agent: 'Agent',
    Agent: 'Agent',
    admin: 'Administrator',
    Administrator: 'Administrator',
  };
  return roleMap[role] || 'Employee';
};

export const listPendingUsers = async (): Promise<(User & { status: string; email: string; createdAt: string })[]> => {
  const response = await apiFetch(`${API_BASE_URL}/admin/users/pending`);
  if (!response.ok) {
    throw new Error(`Unable to fetch pending users: ${response.status}`);
  }
  const data = (await response.json()) as BackendUserWithStatus[];
  return data.map(u => ({
    id: u.id,
    name: u.full_name,
    email: u.email,
    role: mapRole(u.role),
    status: u.status,
    createdAt: u.created_at,
  }));
};

export const approveUser = async (userId: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/admin/users/${userId}/approve`, {
    method: 'PUT',
  });
  if (!response.ok) {
    throw new Error(`Unable to approve user: ${response.status}`);
  }
};

export const rejectUser = async (userId: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/admin/users/${userId}/reject`, {
    method: 'PUT',
  });
  if (!response.ok) {
    throw new Error(`Unable to reject user: ${response.status}`);
  }
};

export const activateUser = async (userId: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/admin/users/${userId}/activate`, {
    method: 'PUT',
  });
  if (!response.ok) {
    throw new Error(`Unable to activate user: ${response.status}`);
  }
};

export const deactivateUser = async (userId: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/admin/users/${userId}/deactivate`, {
    method: 'PUT',
  });
  if (!response.ok) {
    throw new Error(`Unable to deactivate user: ${response.status}`);
  }
};

export const createUser = async (fullName: string, email: string, role: string, department?: string, password?: string): Promise<string> => {
  const userPassword = password || generateRandomPassword();
  const response = await apiFetch(`${API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: fullName,
      email,
      role,
      department: department || undefined,
      password: userPassword,
    }),
  });
  if (!response.ok) {
    const errorMessage = await extractErrorFromResponse(response);
    throw new Error(errorMessage);
  }
  return userPassword;
};

function generateRandomPassword(length: number = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export const updateUser = async (userId: string, fullName?: string, department?: string, role?: string): Promise<void> => {
  const body: Record<string, string> = {};
  if (fullName) body.full_name = fullName;
  if (department) body.department = department;
  if (role) body.role = role;

  const response = await apiFetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorMessage = await extractErrorFromResponse(response);
    throw new Error(errorMessage);
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Unable to delete user: ${response.status}`);
  }
};

export const changeUserRole = async (userId: string, role: string): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/admin/users/${userId}/change-role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    const errorMessage = await extractErrorFromResponse(response);
    throw new Error(errorMessage);
  }
};

export const listAllUsers = async (includeDeleted: boolean = false): Promise<(User & { status: string; email: string; createdAt: string; is_active: boolean })[]> => {
  const params = new URLSearchParams();
  if (includeDeleted) params.set('include_deleted', 'true');
  const url = params.toString() ? `${API_BASE_URL}/admin/users?${params.toString()}` : `${API_BASE_URL}/admin/users`;
  const response = await apiFetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch users: ${response.status}`);
  }
  const data = (await response.json()) as BackendUserWithStatus[];
  return data.map(u => ({
    id: u.id,
    name: u.full_name,
    email: u.email,
    role: mapRole(u.role),
    status: u.status,
    is_active: u.is_active,
    createdAt: u.created_at,
  }));
};

export interface AdminAgent {
  id: string;
  full_name: string;
  email: string;
  department?: string;
  specialization?: string | string[];
  availability?: string;
  max_capacity: number;
  active_ticket_count: number;
  total_assigned: number;
  total_resolved: number;
  last_assigned_at?: string;
  status?: string;
  is_active: boolean;
}

export interface AdminAgentTicket {
  id: string;
  ticket_number: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  employee_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminAgentTicketResponse {
  items: AdminAgentTicket[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  summary: Record<string, number>;
}

export const listAdminAgents = async (params: {
  page?: number;
  pageSize?: number;
  search?: string;
  department?: string;
  specialization?: string;
  availability?: string;
} = {}): Promise<{ items: AdminAgent[]; total: number; page: number; page_size: number; pages: number }> => {
  const query = new URLSearchParams({
    page: String(params.page || 1), page_size: String(params.pageSize || 25),
  });
  if (params.search) query.set('search', params.search);
  if (params.department) query.set('department', params.department);
  if (params.specialization) query.set('specialization', params.specialization);
  if (params.availability) query.set('availability', params.availability);
  const response = await apiFetch(`${API_BASE_URL}/admin/agents?${query.toString()}`);
  if (!response.ok) throw new Error(`Unable to fetch agents: ${response.status}`);
  return await response.json();
};

export const getAdminAgent = async (agentId: string): Promise<AdminAgent> => {
  const response = await apiFetch(`${API_BASE_URL}/admin/agents/${agentId}`);
  if (!response.ok) throw new Error(`Unable to fetch agent: ${response.status}`);
  return await response.json();
};

export const listAdminAgentTickets = async (agentId: string, params: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} = {}): Promise<AdminAgentTicketResponse> => {
  const query = new URLSearchParams({
    page: String(params.page || 1), page_size: String(params.pageSize || 25),
    sort_by: params.sortBy || 'created_at', sort_order: params.sortOrder || 'desc',
  });
  if (params.search) query.set('search', params.search);
  const response = await apiFetch(`${API_BASE_URL}/admin/agents/${agentId}/tickets?${query.toString()}`);
  if (!response.ok) throw new Error(`Unable to fetch assigned tickets: ${response.status}`);
  return await response.json();
};

export const register = async (fullName: string, email: string, password: string, role: string): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: fullName, email, password, role }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(errorData.detail || 'Registration failed');
  }
  const data = await response.json();
  return { message: data.detail || 'Account created successfully. Please wait for admin approval.' };
};

export const login = async (email: string, password: string): Promise<AuthUser> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Invalid email or password' }));
    throw new Error(errorData.detail || 'Invalid email or password');
  }
  const data = (await response.json()) as TokenResponse;
  setTokens(data.access_token, data.refresh_token);
  return mapUser(data.user);
};

export const logout = async (): Promise<void> => {
  try {
    await apiFetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
  } finally {
    clearTokens();
  }
};

export const mapTicketComment = (comment: BackendTicketComment): TicketComment => ({
  id: comment.id,
  ticketId: comment.ticket_id,
  commenterId: comment.author_id || '',
  commenterName: comment.author_name,
  commenterRole: comment.author_role,
  content: comment.content,
  isInternal: comment.is_internal,
  timestamp: comment.created_at,
});

export const mapTicket = (ticket: BackendTicket): Ticket => ({
  id: ticket.id,
  ticketNumber: ticket.ticket_number,
  title: ticket.title,
  description: ticket.description,
  category: ticket.category,
  status: statusToFrontend(ticket.status),
  priority: priorityToFrontend(ticket.priority),
  userId: ticket.created_by || '',
  agentId: ticket.assigned_to || undefined,
  aiSummary: ticket.ai_summary || undefined,
  suggestedResolution: ticket.resolution || undefined,
  resolution: ticket.resolution || undefined,
  createdAt: ticket.created_at,
  updatedAt: ticket.updated_at,
  userName: ticket.created_by_name || 'Unassigned requester',
  agentName: ticket.assigned_to_name || undefined,
  departmentName: ticket.category,
  
  // AI Analysis fields
  aiAnalysisCategory: ticket.ai_analysis_category,
  aiAnalysisPriority: ticket.ai_analysis_priority,
  aiAnalysisDepartment: ticket.ai_analysis_department,
  aiAnalysisTags: ticket.ai_analysis_tags,
  aiAnalysisConfidence: ticket.ai_analysis_confidence,
  aiAnalysisPossibleRootCause: ticket.ai_analysis_possible_root_cause,
  aiAnalysisSuggestedResolution: ticket.ai_analysis_suggested_resolution,
  aiAnalysisEstimatedSla: ticket.ai_analysis_estimated_sla,
  
  // Assigned team
  assignedTeam: ticket.assigned_team,
  assignmentType: ticket.assignment_type,
  assignmentReason: ticket.assignment_reason,
  matchedSpecialization: ticket.matched_specialization,
  assignedAt: ticket.assigned_at,
});

export const listTickets = async (query: TicketQuery = {}) => {
  const params = new URLSearchParams({
    page: '1',
    page_size: '100',
    sort_by: mapSortBy(query.sortBy),
    sort_order: query.sortBy === 'oldest' ? 'asc' : query.sortOrder || 'desc',
  });

  if (query.search) params.set('search', query.search);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.priority && query.priority !== 'all') params.set('priority', query.priority);
  if (query.category) params.set('category', query.category);
  if (query.assignment) params.set('assignment', query.assignment);

  const response = await apiFetch(`${API_BASE_URL}/tickets?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Unable to fetch tickets: ${response.status}`);
  }

  const data = (await response.json()) as BackendTicketListResponse;
  return {
    tickets: data.items.map(mapTicket),
    comments: data.items.flatMap(ticket => (ticket.comments || []).map(mapTicketComment)),
  };
};

export const getTicket = async (ticketId: string) => {
  const response = await apiFetch(`${API_BASE_URL}/tickets/${ticketId}`);
  if (!response.ok) {
    throw new Error(`Unable to fetch ticket: ${response.status}`);
  }
  return mapTicket(await response.json() as BackendTicket);
};

export const getTicketAuditLogs = async (ticketId: string): Promise<AuditLog[]> => {
  const response = await apiFetch(`${API_BASE_URL}/tickets/${ticketId}/audit-logs`);
  if (!response.ok) {
    throw new Error(`Unable to fetch audit logs: ${response.status}`);
  }
  return await response.json() as AuditLog[];
};

export const createTicket = async (ticket: Partial<Ticket>, createdBy?: string, reason?: string): Promise<Ticket> => {
  const params = new URLSearchParams();
  if (reason) params.set('reason', reason);
  
  const response = await apiFetch(`${API_BASE_URL}/tickets${params.toString() ? `?${params.toString()}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: ticket.title,
      description: ticket.description,
      category: ticket.category || ticket.departmentName || 'General',
      priority: ticket.priority || 'medium',
      status: ticket.status || 'open',
      assigned_to: ticket.agentId,
      created_by: createdBy || ticket.userId,
      ai_summary: ticket.aiSummary,
      resolution: ticket.suggestedResolution || ticket.resolution,
    }),
  });

  if (!response.ok) {
    throw new Error(`Unable to create ticket: ${response.status}`);
  }

  return mapTicket((await response.json()) as BackendTicket);
};

export const updateTicket = async (id: string, updates: Partial<Ticket>, reason?: string): Promise<Ticket> => {
  const response = await apiFetch(`${API_BASE_URL}/tickets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticket: {
        title: updates.title,
        description: updates.description,
        category: updates.category || updates.departmentName,
        priority: updates.priority,
        status: updates.status,
        assigned_to: updates.agentId,
        ai_summary: updates.aiSummary,
        resolution: updates.suggestedResolution || updates.resolution,
      },
      reason,
    }),
  });

  if (!response.ok) {
    throw new Error(`Unable to update ticket: ${response.status}`);
  }

  return mapTicket((await response.json()) as BackendTicket);
};

export const reassignTicket = async (id: string, assignedTo?: string, reason?: string): Promise<Ticket> => {
  const response = await apiFetch(`${API_BASE_URL}/tickets/${id}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assigned_to: assignedTo, reason }),
  });

  if (!response.ok) {
    throw new Error(`Unable to assign ticket: ${response.status}`);
  }

  return mapTicket((await response.json()) as BackendTicket);
};

export const listAgents = async (): Promise<{ id: string; name: string; email: string; department?: string; specialization?: string; status: string; activeTicketCount: number; available: boolean }[]> => {
  const response = await apiFetch(`${API_BASE_URL}/tickets/agents`);
  if (!response.ok) {
    throw new Error(`Unable to fetch agents: ${response.status}`);
  }
  return await response.json();
};

export const escalateTicket = async (id: string, priority: string, reason?: string): Promise<Ticket> => {
  const response = await apiFetch(`${API_BASE_URL}/tickets/${id}/escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priority: priority.charAt(0).toUpperCase() + priority.slice(1), reason }),
  });

  if (!response.ok) {
    throw new Error(`Unable to escalate ticket: ${response.status}`);
  }

  return mapTicket((await response.json()) as BackendTicket);
};

export const resolveTicket = async (id: string, resolution?: string, reason?: string): Promise<Ticket> => {
  const response = await apiFetch(`${API_BASE_URL}/tickets/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution, reason }),
  });

  if (!response.ok) {
    throw new Error(`Unable to resolve ticket: ${response.status}`);
  }

  return mapTicket((await response.json()) as BackendTicket);
};

export const closeTicket = async (id: string, reason?: string): Promise<Ticket> => {
  const response = await apiFetch(`${API_BASE_URL}/tickets/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error(`Unable to close ticket: ${response.status}`);
  }

  return mapTicket((await response.json()) as BackendTicket);
};

export const reopenTicket = async (id: string, reason?: string): Promise<Ticket> => {
  const response = await apiFetch(`${API_BASE_URL}/tickets/${id}/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error(`Unable to reopen ticket: ${response.status}`);
  }

  return mapTicket((await response.json()) as BackendTicket);
};

export const deleteTicket = async (id: string, reason?: string): Promise<void> => {
  const params = new URLSearchParams();
  if (reason) params.set('reason', reason);
  const response = await apiFetch(`${API_BASE_URL}/tickets/${id}${params.toString() ? `?${params.toString()}` : ''}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Unable to delete ticket: ${response.status}`);
  }
};

export const sendChat = async (request: ChatRequest): Promise<ChatResponse> => {
  const response = await apiFetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Chat failed' }));
    throw new Error(error.detail || 'Chat failed');
  }
  return await response.json();
};

export interface KnowledgeDocument {
  id: number;
  title: string;
  filename: string;
  file_type: string;
  category: string | null;
  tags: string[];
  uploaded_by: string | null;
  uploaded_at: string;
  status: string; // pending, processing, processed, error, deleted
  file_path: string;
  file_size: number | null;
}

export const listKnowledgeDocuments = async (search?: string, category?: string): Promise<KnowledgeDocument[]> => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  const response = await apiFetch(`${API_BASE_URL}/knowledge${params.toString() ? `?${params.toString()}` : ''}`);
  if (!response.ok) throw new Error('Failed to fetch documents');
  return await response.json();
};

export const uploadKnowledgeDocument = async (
  file: File,
  title?: string,
  category?: string,
  tags?: string[]
): Promise<KnowledgeDocument> => {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  if (category) formData.append('category', category);
  if (tags?.length) formData.append('tags', tags.join(','));

  const requestUrl = `${API_BASE_URL}/knowledge/upload`;
  const requestPayload = {
    file: {
      name: file.name,
      type: file.type,
      size: file.size,
    },
    title: title || null,
    category: category || null,
    tags: tags || [],
  };

  console.log('[KnowledgeBase Upload] Request', {
    url: requestUrl,
    method: 'POST',
    headers: getAccessToken() ? { Authorization: 'Bearer <present>' } : {},
    payload: requestPayload,
    hasAuthorization: Boolean(getAccessToken()),
    contentType: 'browser-managed multipart/form-data',
  });

  try {
    // Do not set Content-Type manually: fetch adds multipart boundaries for FormData.
    const response = await apiFetch(requestUrl, {
      method: 'POST',
      body: formData,
    });

    console.log('[KnowledgeBase Upload] Response', {
      url: requestUrl,
      status: response.status,
      ok: response.ok,
      response,
    });

    if (!response.ok) {
      let errorMessage = 'Upload failed';
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // FastAPI validation error array
            errorMessage = errorData.detail.map((err: any) => err.msg || String(err)).join(', ');
          } else if (typeof errorData.detail === 'string') {
            // Simple string detail
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        }
      } catch {
        // Fallback if json parsing fails
        errorMessage = 'Upload failed';
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('[KnowledgeBase Upload] Error', {
      url: requestUrl,
      payload: requestPayload,
      error,
    });
    throw error;
  }
};

export const deleteKnowledgeDocument = async (documentId: number): Promise<void> => {
  const response = await apiFetch(`${API_BASE_URL}/knowledge/${documentId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete document');
};

export const escalateToTicket = async (sessionId: string, userFeedback?: string): Promise<Ticket> => {
  const response = await apiFetch(`${API_BASE_URL}/chat/escalate-to-ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      user_feedback: userFeedback,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Escalation failed' }));
    throw new Error(error.detail || 'Escalation failed');
  }
  return mapTicket(await response.json());
};

export const getAgentMetrics = async (): Promise<Record<string, number>> => {
  const response = await apiFetch(`${API_BASE_URL}/tickets/metrics/agent`);
  if (!response.ok) {
    throw new Error(`Unable to fetch agent metrics: ${response.status}`);
  }
  return await response.json();
};

export const getEmployeeKPIs = async (): Promise<EmployeeKPIs> => {
  const response = await apiFetch(`${API_BASE_URL}/kpi/employee`);
  if (!response.ok) {
    throw new Error(`Unable to fetch employee KPIs: ${response.status}`);
  }
  return await response.json();
};

export const getAgentKPIs = async (): Promise<AgentKPIs> => {
  const response = await apiFetch(`${API_BASE_URL}/kpi/agent`);
  if (!response.ok) {
    throw new Error(`Unable to fetch agent KPIs: ${response.status}`);
  }
  return await response.json();
};

export const getAdminKPIs = async (): Promise<AdminKPIs> => {
  const response = await apiFetch(`${API_BASE_URL}/kpi/admin`);
  if (!response.ok) {
    throw new Error(`Unable to fetch admin KPIs: ${response.status}`);
  }
  return await response.json();
};

export const getAdminTicketTimeline = async (range: TimelineRange): Promise<TicketLifecycleTimeline> => {
  const response = await apiFetch(`${API_BASE_URL}/kpi/admin/timeline/tickets?range=${range}`);
  if (!response.ok) {
    throw new Error(`Unable to fetch ticket timeline: ${response.status}`);
  }
  return await response.json();
};

export const getAdminAICopilotTimeline = async (range: TimelineRange): Promise<AICopilotTimeline> => {
  const response = await apiFetch(`${API_BASE_URL}/kpi/admin/timeline/ai?range=${range}`);
  if (!response.ok) {
    throw new Error(`Unable to fetch AI copilot timeline: ${response.status}`);
  }
  return await response.json();
};
