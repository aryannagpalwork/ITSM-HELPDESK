import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Ticket, TicketComment, KnowledgeArticle, DashboardStats, UserRole, AgentMetrics, EmployeeKPIs, AgentKPIs, AdminKPIs } from './types';
import { getInitialStats, MOCK_TICKETS, MOCK_COMMENTS, MOCK_KB_ARTICLES } from './mockData';
import * as ticketApi from './api';
import { AuditLog } from './api';

interface AppContextType {
  currentUser: User;
  tickets: Ticket[];
  comments: TicketComment[];
  kbArticles: KnowledgeArticle[];
  stats: DashboardStats;
  agentMetrics: AgentMetrics | null;
  employeeKPIs: EmployeeKPIs | null;
  roleAgentKPIs: AgentKPIs | null;
  adminKPIs: AdminKPIs | null;
  kpisLoading: boolean;
  kpisError: string | null;
  isAuthenticated: boolean;
  pendingUsers: (User & { status: string; email: string; createdAt: string; specialization?: string | string[] | null })[];
  allUsers: (User & { status: string; email: string; createdAt: string; is_active: boolean; specialization?: string | string[] | null })[];
  usersLoading: boolean;
  usersError: string | null;
  ticketsLoading: boolean;
  ticketsError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, role: string, department?: string, specialization?: string[]) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  resetAllData: () => void;
  loadTickets: (query?: ticketApi.TicketQuery) => Promise<Ticket[]>;
  loadTicketAuditLogs: (ticketId: string) => Promise<AuditLog[]>;
  loadAgentMetrics: () => Promise<void>;
  loadEmployeeKPIs: () => Promise<void>;
  loadRoleAgentKPIs: () => Promise<void>;
  loadAdminKPIs: () => Promise<void>;
  refreshRoleKPIs: () => Promise<void>;
  createTicket: (ticket: Partial<Ticket>, reason?: string, duplicateContext?: { duplicateOfTicketId?: string; duplicateStatus?: string; duplicateSimilarityScore?: number }) => Promise<Ticket>;
  updateTicket: (id: string, updates: Partial<Ticket>, reason?: string) => Promise<Ticket>;
  assignTicket: (id: string, assignedTo?: string, reason?: string) => Promise<void>;
  reassignTicket: (id: string, assignedTo?: string, reason?: string) => Promise<void>;
  listAgents: () => Promise<{ id: string; name: string; email: string; department?: string; specialization?: string; status: string; activeTicketCount: number; available: boolean }[]>;
  escalateTicket: (id: string, priority: string, reason?: string) => Promise<void>;
  resolveTicket: (id: string, resolution?: string, reason?: string) => Promise<void>;
  closeTicket: (id: string, reason?: string) => Promise<void>;
  reopenTicket: (id: string, reason?: string) => Promise<void>;
  deleteTicket: (id: string, reason?: string) => Promise<void>;
  addComment: (ticketId: string, content: string, isInternal: boolean, attachment?: File | null) => Promise<TicketComment>;
  addKBArticle: (article: Omit<KnowledgeArticle, 'id'>) => void;
  loadPendingUsers: () => Promise<void>;
  loadAllUsers: (includeDeleted?: boolean) => Promise<void>;
  approvePendingUser: (userId: string) => Promise<void>;
  rejectPendingUser: (userId: string) => Promise<void>;
  activatePendingUser: (userId: string) => Promise<void>;
  deactivatePendingUser: (userId: string) => Promise<void>;
  createUser: (fullName: string, email: string, role: string, department?: string, password?: string, specialization?: string[]) => Promise<string>;
  updateUser: (userId: string, fullName?: string, department?: string, role?: string, specialization?: string[]) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  changeUserRole: (userId: string, role: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedUser = localStorage.getItem('it_copilot_user');
    return savedUser ? JSON.parse(savedUser) : { id: '', name: '', email: '', role: 'Employee' as UserRole };
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(ticketApi.getAccessToken()));
  const [pendingUsers, setPendingUsers] = useState<(User & { status: string; email: string; createdAt: string; specialization?: string | string[] | null })[]>([]);
  const [allUsers, setAllUsers] = useState<(User & { status: string; email: string; createdAt: string; is_active: boolean; specialization?: string | string[] | null })[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [kbArticles, setKbArticles] = useState<KnowledgeArticle[]>([]);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics | null>(null);
  const [employeeKPIs, setEmployeeKPIs] = useState<EmployeeKPIs | null>(null);
  const [roleAgentKPIs, setRoleAgentKPIs] = useState<AgentKPIs | null>(null);
  const [adminKPIs, setAdminKPIs] = useState<AdminKPIs | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [kpisError, setKpisError] = useState<string | null>(null);

  const register = async (fullName: string, email: string, password: string, role: string, department?: string, specialization?: string[]): Promise<{ message: string }> => {
    // Just register, don't log in automatically
    // Registration returns a message, not tokens — avoids overwriting admin session
    return ticketApi.register(fullName, email, password, role, department, specialization);
  };

  const login = async (email: string, password: string) => {
    const authUser = await ticketApi.login(email, password);
    const user: User = {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      role: authUser.role,
      departmentId: authUser.departmentId,
    };
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('it_copilot_user', JSON.stringify(user));
    await loadTickets();
  };

  const logout = async () => {
    await ticketApi.logout();
    setIsAuthenticated(false);
    localStorage.removeItem('it_copilot_user');
    localStorage.removeItem('it_copilot_role');
    localStorage.removeItem('it_copilot_tickets');
    localStorage.removeItem('it_copilot_comments');
  };

  const switchRole = (role: UserRole) => {
    setCurrentUser(prev => {
      const updated = { ...prev, role };
      localStorage.setItem('it_copilot_user', JSON.stringify(updated));
      localStorage.setItem('it_copilot_role', role);
      return updated;
    });
  };

  const resetAllData = () => {
    localStorage.removeItem('it_copilot_tickets');
    localStorage.removeItem('it_copilot_comments');
    setTickets(MOCK_TICKETS);
    setComments(MOCK_COMMENTS);
    setKbArticles(MOCK_KB_ARTICLES);
  };

  const loadTickets = async (query: ticketApi.TicketQuery = {}): Promise<Ticket[]> => {
    try {
      setTicketsLoading(true);
      setTicketsError(null);
      const response = await ticketApi.listTickets(query);
      setTickets(response.tickets);
      setComments(response.comments);
      return response.tickets;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load tickets';
      console.warn('Unable to load tickets from API.', error);
      setTicketsError(msg);
      return [];
    } finally {
      setTicketsLoading(false);
    }
  };

  const loadTicketAuditLogs = async (ticketId: string) => {
    try {
      return await ticketApi.getTicketAuditLogs(ticketId);
    } catch (error) {
      console.warn('Unable to load audit logs from API.', error);
      return [];
    }
  };

  const loadAgentMetrics = async () => {
    try {
      const metrics = await ticketApi.getAgentMetrics();
      setAgentMetrics(metrics as unknown as AgentMetrics);
    } catch (error) {
      console.warn('Unable to load agent metrics from API.', error);
    }
  };

  const loadEmployeeKPIs = async () => {
    try {
      setKpisLoading(true);
      setKpisError(null);
      const kpis = await ticketApi.getEmployeeKPIs();
      setEmployeeKPIs(kpis);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load employee KPIs';
      console.warn(msg, error);
      setKpisError(msg);
    } finally {
      setKpisLoading(false);
    }
  };

  const loadRoleAgentKPIs = async () => {
    try {
      setKpisLoading(true);
      setKpisError(null);
      const kpis = await ticketApi.getAgentKPIs();
      setRoleAgentKPIs(kpis);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load agent KPIs';
      console.warn(msg, error);
      setKpisError(msg);
    } finally {
      setKpisLoading(false);
    }
  };

  const loadAdminKPIs = async () => {
    try {
      setKpisLoading(true);
      setKpisError(null);
      const kpis = await ticketApi.getAdminKPIs();
      setAdminKPIs(kpis);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load admin KPIs';
      console.warn(msg, error);
      setKpisError(msg);
    } finally {
      setKpisLoading(false);
    }
  };

  const refreshRoleKPIs = async () => {
    const role = currentUser.role;
    const promises: Promise<void>[] = [];
    if (role === 'Employee') {
      promises.push(loadEmployeeKPIs());
    }
    if (role === 'Agent' || role === 'Administrator') {
      promises.push(loadAgentMetrics());
      promises.push(loadRoleAgentKPIs());
    }
    if (role === 'Administrator') {
      promises.push(loadAdminKPIs());
    }
    await Promise.allSettled(promises);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadTickets();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && (currentUser.role === 'Agent' || currentUser.role === 'Administrator')) {
      loadAgentMetrics();
      loadRoleAgentKPIs();
    }
    if (isAuthenticated && currentUser.role === 'Employee') {
      loadEmployeeKPIs();
    }
    if (isAuthenticated && currentUser.role === 'Administrator') {
      loadAdminKPIs();
    }
  }, [isAuthenticated, currentUser.role]);

  const createTicket = async (
    ticketInput: Partial<Ticket>,
    reason?: string,
    duplicateContext?: { duplicateOfTicketId?: string; duplicateStatus?: string; duplicateSimilarityScore?: number },
  ): Promise<Ticket> => {
    const newTicket = await ticketApi.createTicket(ticketInput, currentUser.id, reason, duplicateContext);
    setTickets(prev => [newTicket, ...prev.filter(t => t.id !== newTicket.id)]);
    await refreshRoleKPIs();
    return newTicket;
  };

  const updateTicket = async (id: string, updates: Partial<Ticket>, reason?: string) => {
    const updatedTicket = await ticketApi.updateTicket(id, updates, reason);
    setTickets(prev => prev.map(t => (t.id === id ? updatedTicket : t)));
    await refreshRoleKPIs();
    return updatedTicket;
  };

  const assignTicket = async (id: string, assignedTo?: string, reason?: string) => {
    const updatedTicket = await ticketApi.assignTicket(id, assignedTo, reason);
    setTickets(prev => prev.map(t => (t.id === id ? updatedTicket : t)));
    await refreshRoleKPIs();
  };

  const reassignTicket = async (id: string, assignedTo?: string, reason?: string) => {
    const updatedTicket = await ticketApi.reassignTicket(id, assignedTo, reason);
    setTickets(prev => prev.map(t => (t.id === id ? updatedTicket : t)));
    await refreshRoleKPIs();
    await loadTickets();
  };

  const listAgents = async () => {
    return await ticketApi.listAgents();
  };

  const escalateTicket = async (id: string, priority: string, reason?: string) => {
    const updatedTicket = await ticketApi.escalateTicket(id, priority, reason);
    setTickets(prev => prev.map(t => (t.id === id ? updatedTicket : t)));
    await refreshRoleKPIs();
  };

  const resolveTicket = async (id: string, resolution?: string, reason?: string) => {
    const updatedTicket = await ticketApi.resolveTicket(id, resolution, reason);
    setTickets(prev => prev.map(t => (t.id === id ? updatedTicket : t)));
    await refreshRoleKPIs();
  };

  const closeTicket = async (id: string, reason?: string) => {
    const updatedTicket = await ticketApi.closeTicket(id, reason);
    setTickets(prev => prev.map(t => (t.id === id ? updatedTicket : t)));
    await refreshRoleKPIs();
  };

  const reopenTicket = async (id: string, reason?: string) => {
    const updatedTicket = await ticketApi.reopenTicket(id, reason);
    setTickets(prev => prev.map(t => (t.id === id ? updatedTicket : t)));
    await refreshRoleKPIs();
  };

  const deleteTicket = async (id: string, reason?: string) => {
    setTickets(prev => prev.filter(t => t.id !== id));
    setComments(prev => prev.filter(c => c.ticketId !== id));
    await ticketApi.deleteTicket(id, reason);
    await loadTickets();
    await refreshRoleKPIs();
  };

  const addComment = async (ticketId: string, content: string, isInternal: boolean, attachment?: File | null) => {
    try {
      const saved = await ticketApi.addCommentApi(ticketId, content, isInternal, attachment);
      const newComment: TicketComment = ticketApi.mapTicketComment(saved);
      setComments(prev => [...prev, newComment]);
      return newComment;
    } catch (error) {
      console.warn('Failed to persist comment:', error);
      // Fallback: add locally so the UI still works offline
      const newComment: TicketComment = {
        id: `COM${Date.now()}`,
        ticketId,
        commenterId: currentUser.id,
        commenterName: currentUser.name,
        commenterRole: currentUser.role,
        content,
        isInternal,
        timestamp: new Date().toISOString(),
      };
      setComments(prev => [...prev, newComment]);
      return newComment;
    }
  };

  const addKBArticle = (articleInput: Omit<KnowledgeArticle, 'id'>) => {
    const id = `KB00${kbArticles.length + 1}`;
    const newArticle: KnowledgeArticle = {
      id,
      ...articleInput,
    };
    setKbArticles(prev => [newArticle, ...prev]);
  };

  const loadPendingUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const users = await ticketApi.listPendingUsers();
      setPendingUsers(users);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load pending users';
      console.warn(msg, error);
      setUsersError(msg);
      setPendingUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAllUsers = async (includeDeleted: boolean = false) => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const users = await ticketApi.listAllUsers(includeDeleted);
      setAllUsers(users);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load users from API';
      console.warn(msg, error);
      setUsersError(msg);
      setAllUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const approvePendingUser = async (userId: string) => {
    try {
      await ticketApi.approveUser(userId);
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      await loadAllUsers();
    } catch (error) {
      console.warn('Unable to approve user.', error);
    }
  };

  const rejectPendingUser = async (userId: string) => {
    try {
      await ticketApi.rejectUser(userId);
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      await loadAllUsers();
    } catch (error) {
      console.warn('Unable to reject user.', error);
    }
  };

  const activatePendingUser = async (userId: string) => {
    try {
      await ticketApi.activateUser(userId);
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      await loadAllUsers();
    } catch (error) {
      console.warn('Unable to activate user.', error);
    }
  };

  const deactivatePendingUser = async (userId: string) => {
    try {
      await ticketApi.deactivateUser(userId);
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      await loadAllUsers();
    } catch (error) {
      console.warn('Unable to deactivate user.', error);
    }
  };

  const createUser = async (fullName: string, email: string, role: string, department?: string, password?: string, specialization?: string[]): Promise<string> => {
    try {
      const generatedPassword = await ticketApi.createUser(fullName, email, role, department, password, specialization);
      // A newly created account starts in PENDING status. Refresh both user
      // collections so the admin dashboard badge updates immediately.
      await loadPendingUsers();
      await loadAllUsers();
      return generatedPassword;
    } catch (error) {
      console.warn('Unable to create user.', error);
      throw error;
    }
  };

  const updateUser = async (userId: string, fullName?: string, department?: string, role?: string, specialization?: string[]) => {
    try {
      await ticketApi.updateUser(userId, fullName, department, role, specialization);
      await loadAllUsers();
    } catch (error) {
      console.warn('Unable to update user.', error);
      throw error;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await ticketApi.deleteUser(userId);
      await loadAllUsers();
      await loadPendingUsers();
    } catch (error) {
      console.warn('Unable to delete user.', error);
      throw error;
    }
  };

  const changeUserRole = async (userId: string, role: string) => {
    try {
      await ticketApi.changeUserRole(userId, role);
      await loadAllUsers();
    } catch (error) {
      console.warn('Unable to change user role.', error);
      throw error;
    }
  };

  // Load pending users on mount and when auth/role changes for admin users
  useEffect(() => {
    if (isAuthenticated && currentUser.role === 'Administrator') {
      loadPendingUsers();
      loadAllUsers();
      const refreshTimer = window.setInterval(() => {
        loadPendingUsers();
        loadAllUsers();
      }, 15000);
      return () => window.clearInterval(refreshTimer);
    }
  }, [isAuthenticated, currentUser.role]);

  const stats = getInitialStats(tickets);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        tickets,
        comments,
        kbArticles,
        stats,
        agentMetrics,
        employeeKPIs,
        roleAgentKPIs,
        adminKPIs,
        kpisLoading,
        kpisError,
        isAuthenticated,
        pendingUsers,
        allUsers,
        usersLoading,
        usersError,
        ticketsLoading,
        ticketsError,
        login,
        register,
        logout,
        switchRole,
        resetAllData,
        loadTickets,
        loadTicketAuditLogs,
        loadAgentMetrics,
        loadEmployeeKPIs,
        loadRoleAgentKPIs,
        loadAdminKPIs,
        refreshRoleKPIs,
        createTicket,
        updateTicket,
        assignTicket,
        reassignTicket,
        listAgents,
        escalateTicket,
        resolveTicket,
        closeTicket,
        reopenTicket,
        deleteTicket,
        addComment,
        addKBArticle,
        loadPendingUsers,
        loadAllUsers,
        approvePendingUser,
        rejectPendingUser,
        activatePendingUser,
        deactivatePendingUser,
        createUser,
        updateUser,
        deleteUser,
        changeUserRole,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
