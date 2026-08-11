import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../shared/AppContext';
import { 
  Sparkles, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Activity,
  Search,
  Timer,
  Eye,
  History,
  ArrowUpRight,
  Zap,
  Target,
  RefreshCcw,
  MessageSquare,
  CheckCheck,
  AlertTriangle,
  BookOpen,
  Save,
  Loader2
} from 'lucide-react';
import { TicketPriority, TicketStatus, TimelineRange, TicketLifecycleTimeline } from '../../shared/types';
import { getEmployeeTicketTimeline } from '../../shared/api';
import TicketLifecycleDetailChart from '../admin/components/charts/TicketLifecycleDetailChart';
import { TicketStatusOverviewStepper } from '../../components/TicketStatusOverviewStepper';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, tickets, createTicket, employeeKPIs, kpisLoading, kpisError, loadEmployeeKPIs } = useApp();

  useEffect(() => {
    if (!employeeKPIs) {
      loadEmployeeKPIs();
    }
  }, []);

  const [ticketLifecycle, setTicketLifecycle] = useState<TicketLifecycleTimeline | null>(null);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium');

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [range, setRange] = useState<TimelineRange>('7d');
  useEffect(() => {
    let active = true;
    getEmployeeTicketTimeline(range).then(data => {
      if (active) setTicketLifecycle(data);
    }).catch(() => {
      if (active) setTicketLifecycle(null);
    });
    return () => { active = false; };
  }, [range]);
  const [chartFilter, setChartFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [resolutionModal, setResolutionModal] = useState<{ title: string; resolution: string } | null>(null);

  // Only show tickets created by the logged-in employee
  const myTickets = useMemo(() => {
    return tickets.filter(t => t.userId === currentUser.id);
  }, [tickets, currentUser.id]);

  // Prefer backend KPIs when loaded; fallback to local computation preserves responsiveness
  const totalTickets = employeeKPIs?.totalTickets ?? myTickets.length;
  const openTickets = employeeKPIs?.openTickets ?? myTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const resolvedTickets = employeeKPIs?.resolvedTickets ?? myTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const mttrHours = employeeKPIs?.mttrHours ?? (() => {
    const resolvedOnes = myTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    if (resolvedOnes.length === 0) return 0;
    const totalHours = resolvedOnes.reduce((sum, t) => {
      const created = new Date(t.createdAt).getTime();
      const updated = new Date(t.updatedAt).getTime();
      const hours = (updated - created) / (1000 * 60 * 60);
      return sum + (hours > 0 ? hours : 24);
    }, 0);
    return Math.round((totalHours / resolvedOnes.length) * 10) / 10;
  })();
  const fcrRate = employeeKPIs?.fcrRate ?? 0;
  const avgFirstResponseHours = employeeKPIs?.avgFirstResponseHours ?? 0;
  const reopenedTickets = employeeKPIs?.reopenedTickets ?? 0;
  const aiCopilot = employeeKPIs?.aiCopilot;

  const chartTickets = useMemo(() => myTickets.filter(ticket => {
    if (chartFilter === 'resolved') return ticket.status === 'resolved' || ticket.status === 'closed';
      if (chartFilter === 'open') return ticket.status === 'open' || ticket.status === 'in_progress' || ticket.status === 'waiting_for_user_response';
    return true;
  }), [myTickets, chartFilter]);

  const trendData = useMemo(() => {
    const today = new Date();
    const days = range === '30d' ? 30 : 7;
    const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - (days - 1 - index));
      const key = dayKey(date);
      return {
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        created: chartTickets.filter(ticket => dayKey(new Date(ticket.createdAt)) === key).length,
        resolved: chartTickets.filter(ticket =>
          (ticket.status === 'resolved' || ticket.status === 'closed') && dayKey(new Date(ticket.updatedAt)) === key
        ).length,
      };
    });
  }, [chartTickets, range]);

  const severityData = useMemo(() => (
    (['low', 'medium', 'high', 'critical'] as const).map(priority => ({
      priority: priority[0].toUpperCase() + priority.slice(1),
      count: chartTickets.filter(ticket => ticket.priority === priority).length,
      color: { low: '#3b82f6', medium: '#22c55e', high: '#f59e0b', critical: '#f43f5e' }[priority],
    }))
  ), [chartTickets]);

  // Get unique categories from employee's tickets
  const categories = useMemo(() => {
    const cats = new Set<string>();
    myTickets.forEach(t => { if (t.category) cats.add(t.category); });
    return ['all', ...Array.from(cats)];
  }, [myTickets]);

  // Filtered & sorted tickets
  const filteredTickets = useMemo(() => {
    let result = [...myTickets];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        (t.ticketNumber || t.id).toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(t => t.category === categoryFilter);
    }

    // Sort: newest first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return result;
  }, [myTickets, search, statusFilter, priorityFilter, categoryFilter]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    await createTicket({
      title: newTitle,
      description: newDesc,
      priority: newPriority,
    });

    setNewTitle('');
    setNewDesc('');
    setNewPriority('medium');
    setIsCreateOpen(false);
  };

  const handleKpiKeyDown = (e: React.KeyboardEvent, status: 'all' | 'open' | 'resolved') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleKpiFilter(status);
    }
  };

  const handleKpiFilter = (status: string) => {
    const query = status === 'all' ? '' : `?status=${status}`;
    navigate(`/tickets${query}`);
  };

  const getPriorityBadgeColor = (prio: TicketPriority) => {
    switch (prio) {
      case 'low': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      case 'critical': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    }
  };

const getStatusBadgeColor = (status: TicketStatus) => {
  switch (status) {
    case 'open': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'in_progress': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
    case 'waiting_for_user_response': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'resolved': return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
    case 'closed': return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
  }
};

  return (
    <div className="flex-1 bg-app p-8 overflow-y-auto h-full font-sans">
      {/* Title & Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center space-x-2 text-[10px] uppercase font-mono tracking-wider text-accent font-semibold mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span>Employee Portal</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Welcome back, {currentUser.name}</h1>
          <p className="text-xs text-secondary">
            Track your tickets, review resolution history, or chat with AI Helpdesk.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/chat')}
            className="px-4 py-2 bg-card-solid hover-surface border border-token rounded-lg text-xs font-semibold text-accent flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chat with AI Helpdesk</span>
          </button>
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 accent-btn rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Ticket</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-semibold">My Ticket Performance</span>
          </div>
          {kpisLoading && (
            <span className="text-[9px] text-tertiary flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Refreshing
            </span>
          )}
          {!kpisLoading && employeeKPIs && (
            <button
              onClick={loadEmployeeKPIs}
              className="text-[9px] text-tertiary hover-text flex items-center gap-1 transition-colors"
              title="Refresh KPIs"
            >
              <RefreshCcw className="w-3 h-3" /> Refresh
            </button>
          )}
        </div>
        {kpisError && (
          <div className="mb-3 p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg flex items-center gap-2 text-[10px] text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Couldn't load live KPIs — showing fallback values. {kpisError}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div role="button" tabIndex={0} onClick={() => handleKpiFilter('all')} onKeyDown={(e) => handleKpiKeyDown(e, 'all')} className="min-w-0 p-4 bg-card border border-token rounded-xl cursor-pointer hover-elev focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50">
            <span className="text-[9px] font-mono uppercase text-tertiary">Total Tickets</span>
            <h2 className="text-xl font-bold text-primary mt-1">{totalTickets}</h2>
            <div className="flex items-center space-x-1.5 text-[9px] text-secondary mt-1.5">
              <Clock className="w-2.5 h-2.5 text-tertiary" />
              <span>All time</span>
            </div>
          </div>
          <div role="button" tabIndex={0} onClick={() => handleKpiFilter('open')} onKeyDown={(e) => handleKpiKeyDown(e, 'open')} className="min-w-0 p-4 bg-card border border-token rounded-xl cursor-pointer hover-elev focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50">
            <span className="text-[9px] font-mono uppercase text-tertiary">Open</span>
            <h2 className="text-xl font-bold text-emerald-400 mt-1">{openTickets}</h2>
            <div className="flex items-center space-x-1.5 text-[9px] text-secondary mt-1.5">
              <AlertCircle className="w-2.5 h-2.5 text-emerald-500" />
              <span>Awaiting action</span>
            </div>
          </div>
          <div role="button" tabIndex={0} onClick={() => handleKpiFilter('resolved')} onKeyDown={(e) => handleKpiKeyDown(e, 'resolved')} className="min-w-0 p-4 bg-card border border-token rounded-xl cursor-pointer hover-elev focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50">
            <span className="text-[9px] font-mono uppercase text-tertiary">Resolved</span>
            <h2 className="text-xl font-bold text-sky-400 mt-1">{resolvedTickets}</h2>
            <div className="flex items-center space-x-1.5 text-[9px] text-secondary mt-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-sky-500" />
              <span>Completed</span>
            </div>
          </div>
          {false && <>
          <div role="button" tabIndex={0} onClick={() => handleKpiFilter('resolved')} onKeyDown={(e) => handleKpiKeyDown(e, 'resolved')} className="min-w-0 p-4 bg-card border border-token rounded-xl cursor-pointer hover-elev focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50">
            <span className="text-[9px] font-mono uppercase text-tertiary">Mean Time To Resolution </span>
            <h2 className="text-xl font-bold text-accent mt-1">
              {mttrHours > 0 ? `${mttrHours}h` : 'N/A'}
            </h2>
            <div className="flex items-center space-x-1.5 text-[9px] text-secondary mt-1.5">
              <Timer className="w-2.5 h-2.5 text-accent" />
              <span>Mean time to resolve</span>
            </div>
          </div>
          <div role="button" tabIndex={0} onClick={() => handleKpiFilter('resolved')} onKeyDown={(e) => handleKpiKeyDown(e, 'resolved')} className="min-w-0 p-4 bg-card border border-token rounded-xl cursor-pointer hover-elev focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50">
            <span className="text-[9px] font-mono uppercase text-tertiary">First Contact Resolution </span>
            <h2 className="text-xl font-bold text-green-400 mt-1">
              {employeeKPIs ? `${fcrRate}%` : '—'}
            </h2>
            <div className="flex items-center space-x-1.5 text-[9px] text-secondary mt-1.5">
              <Target className="w-2.5 h-2.5 text-green-500" />
              <span>First contact resolution</span>
            </div>
          </div>
          </>}
          {false && <>
            <div className="p-4 bg-card border border-token rounded-xl">
            <span className="text-[9px] font-mono uppercase text-tertiary">First Response</span>
            <h2 className="text-xl font-bold text-amber-400 mt-1">
              {employeeKPIs ? (avgFirstResponseHours > 0 ? `${avgFirstResponseHours}h` : '< 1h') : '—'}
            </h2>
            <div className="flex items-center space-x-1.5 text-[9px] text-secondary mt-1.5">
              <Zap className="w-2.5 h-2.5 text-amber-500" />
              <span>Avg agent response</span>
            </div>
          </div>
          <div className="p-4 bg-card border border-token rounded-xl">
            <span className="text-[9px] font-mono uppercase text-tertiary">Reopened</span>
            <h2 className={`text-xl font-bold mt-1 ${reopenedTickets > 0 ? 'text-rose-400' : 'text-secondary'}`}>
              {employeeKPIs ? reopenedTickets : '—'}
            </h2>
            <div className="flex items-center space-x-1.5 text-[9px] text-secondary mt-1.5">
              <RefreshCcw className="w-2.5 h-2.5 text-rose-500" />
              <span>Reopened tickets</span>
            </div>
            </div>
          <div className="p-4 bg-card border border-token rounded-xl">
            <span className="text-[9px] font-mono uppercase text-tertiary">Resolved Today</span>
            <h2 className="text-xl font-bold text-violet-400 mt-1">
              {employeeKPIs ? resolvedTickets : totalTickets}
            </h2>
            <div className="flex items-center space-x-1.5 text-[9px] text-secondary mt-1.5">
              <CheckCheck className="w-2.5 h-2.5 text-violet-500" />
              <span>Current progress</span>
            </div>
          </div>
          </>}
        </div>
      </div>

      {/* AI Copilot Utility Card (removed from the employee view) */}
      {false && (
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-semibold">AI Copilot Utility</span>
        </div>
        <div className="bg-gradient-to-br from-violet-950/30 via-zinc-900/30 to-indigo-950/20 border border-violet-500/10 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
          {!aiCopilot && (
            <div className="text-center py-8 text-[10px] text-tertiary flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
              <span>Loading AI Copilot metrics…</span>
            </div>
          )}
          {aiCopilot && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative">
              <div className="p-3 bg-card border border-token rounded-xl">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="w-3 h-3 text-violet-400" />
                  <span className="text-[8px] font-mono uppercase text-tertiary">AI Chats</span>
                </div>
                <div className="text-lg font-bold text-primary">{aiCopilot.aiChats}</div>
                <div className="text-[8px] text-tertiary mt-0.5">Total sessions</div>
              </div>
              <div className="p-3 bg-card border border-token rounded-xl">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-[8px] font-mono uppercase text-tertiary">AI Resolved</span>
                </div>
                <div className="text-lg font-bold text-emerald-400">{aiCopilot.aiResolved}</div>
                <div className="text-[8px] text-tertiary mt-0.5">Self-serve solved</div>
              </div>
              <div className="p-3 bg-card border border-token rounded-xl">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ArrowUpRight className="w-3 h-3 text-amber-400" />
                  <span className="text-[8px] font-mono uppercase text-tertiary">Escalated</span>
                </div>
                <div className="text-lg font-bold text-amber-400">{aiCopilot.aiEscalated}</div>
                <div className="text-[8px] text-tertiary mt-0.5">To support tickets</div>
              </div>
              <div className="p-3 bg-card border border-token rounded-xl">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Target className="w-3 h-3 text-accent" />
                  <span className="text-[8px] font-mono uppercase text-tertiary">Success Rate</span>
                </div>
                <div className="text-lg font-bold text-accent">{aiCopilot.successRate}%</div>
                <div className="text-[8px] text-tertiary mt-0.5">AI resolution rate</div>
              </div>
              <div className="p-3 bg-card border border-token rounded-xl">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <BookOpen className="w-3 h-3 text-sky-400" />
                  <span className="text-[8px] font-mono uppercase text-tertiary">Articles Viewed</span>
                </div>
                <div className="text-lg font-bold text-sky-400">{aiCopilot.articlesViewed}</div>
                <div className="text-[8px] text-tertiary mt-0.5">KB articles consulted</div>
              </div>
              <div className="p-3 bg-card border border-token rounded-xl">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Save className="w-3 h-3 text-green-400" />
                  <span className="text-[8px] font-mono uppercase text-tertiary">Time Saved</span>
                </div>
                <div className="text-lg font-bold text-green-400">
                  {aiCopilot.timeSavedMinutes >= 60
                    ? `${(aiCopilot.timeSavedMinutes / 60).toFixed(1)}h`
                    : `${Math.round(aiCopilot.timeSavedMinutes)}m`}
                </div>
                <div className="text-[8px] text-tertiary mt-0.5">Estimated minutes</div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Employee Analytics */}
      <div className="mb-8" id="employee-analytics">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-semibold">Analytics &amp; Trends</span>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {false && <div className="xl:col-span-2 h-[420px] bg-card border border-token p-5 rounded-2xl min-w-0"><TicketLifecycleDetailChart data={ticketLifecycle} /></div>}
          {false && (
          <div className="xl:col-span-2 bg-card border border-token p-5 rounded-2xl min-w-0">
            <h3 className="text-sm font-semibold text-primary">Ticket Volume Lifecycle</h3>
            <p className="text-xs text-secondary mt-1">Created vs resolved tickets across the selected period{chartFilter !== 'all' ? ` · Filtered: ${chartFilter}` : ''}</p>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="employeeCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff4d4d" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ff4d4d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--card-bg-solid)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 11 }} />
                  <Area type="monotone" dataKey="created" name="Created" stroke="#ff4d4d" fill="url(#employeeCreated)" strokeWidth={2} />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" fill="none" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          )}
          <div className="xl:col-span-3 bg-card border border-token p-5 rounded-2xl min-w-0">
            <TicketStatusOverviewStepper tickets={myTickets} />
            {false && (
            <>
            <h3 className="text-sm font-semibold text-primary">Severity Distribution</h3>
            <p className="text-xs text-secondary mt-1">{chartFilter === 'all' ? 'Your tickets by priority level' : `Filtered: ${chartFilter} tickets`}</p>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="priority" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--card-bg-solid)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="count" name="Tickets" radius={[4, 4, 0, 0]}>
                    {severityData.map(item => <Cell key={item.priority} fill={item.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div id="employee-tickets" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List with Search & Filters */}
        <div className="lg:col-span-2 bg-card border border-token p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold text-primary">Your Tickets</h3>
              <p className="text-[10px] text-tertiary">Showing {filteredTickets.length} of {myTickets.length} total tickets</p>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3 h-3 text-tertiary" />
              <input 
                id="employee-ticket-search"
                name="ticketSearch"
                type="text" 
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-input border border-token focus:border-[color:var(--accent-primary)] rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-primary placeholder-zinc-500 outline-none transition-all"
              />
            </div>

            <div className="flex items-center space-x-1.5 bg-input border border-token rounded-lg px-2 py-1">
              <span className="text-[8px] font-mono uppercase text-tertiary shrink-0">Status</span>
              <select 
                id="employee-status-filter"
                name="ticketStatus"
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-transparent border-none text-[10px] text-secondary focus:ring-0 outline-none py-0.5 cursor-pointer"
              >
    <option value="all">All</option>
    <option value="open">Open</option>
    <option value="in_progress">In Progress</option>
    <option value="waiting_for_user_response">Awaiting User Response</option>
    <option value="resolved">Resolved</option>
    <option value="closed">Closed</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5 bg-input border border-token rounded-lg px-2 py-1">
              <span className="text-[8px] font-mono uppercase text-tertiary shrink-0">Priority</span>
              <select 
                id="employee-priority-filter"
                name="ticketPriority"
                value={priorityFilter} 
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full bg-transparent border-none text-[10px] text-secondary focus:ring-0 outline-none py-0.5 cursor-pointer"
              >
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5 bg-input border border-token rounded-lg px-2 py-1">
              <span className="text-[8px] font-mono uppercase text-tertiary shrink-0">Category</span>
              <select 
                id="employee-category-filter"
                name="ticketCategory"
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-transparent border-none text-[10px] text-secondary focus:ring-0 outline-none py-0.5 cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="p-8 border border-dashed border-token rounded-xl text-center">
              <AlertCircle className="w-8 h-8 text-tertiary mx-auto mb-2" />
              <h4 className="text-xs font-semibold text-secondary">No Tickets Found</h4>
              <p className="text-[10px] text-tertiary max-w-sm mx-auto mt-1">
                {search || statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all'
                  ? 'No tickets match your search or filter criteria. Try adjusting the filters.'
                  : 'You haven\'t raised any tickets yet. Click "Create New Ticket" to get started.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map(ticket => (
                <div 
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className="p-4 bg-card hover-elev border border-token hover-border rounded-xl transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center space-x-2.5 mb-1.5 flex-wrap gap-y-1">
                        <span className="text-[10px] font-mono text-tertiary font-semibold">{ticket.ticketNumber || ticket.id}</span>
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${getPriorityBadgeColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${getStatusBadgeColor(ticket.status)}`}>
                          {ticket.status === 'in_progress' ? 'In Progress' : ticket.status === 'waiting_for_user_response' ? 'Awaiting User Response' : ticket.status}
                        </span>
                        {ticket.category && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-card-solid text-secondary border border-token">
                            {ticket.category}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-primary truncate transition-colors">
                        {ticket.title}
                      </h4>
                      <p className="text-[10px] text-tertiary truncate mt-1">
                        Created {new Date(ticket.createdAt).toLocaleDateString()} · Updated {new Date(ticket.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      {/* View Resolution History button for resolved/closed tickets */}
                      {(ticket.status === 'resolved' || ticket.status === 'closed') && ticket.resolution && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setResolutionModal({ title: ticket.title, resolution: ticket.resolution! });
                          }}
                          className="p-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-lg text-sky-400 transition-all"
                          title="View Resolution History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-tertiary transition-colors shrink-0" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar: Quick Actions */}
        <div className="space-y-6">
          {/* AI Copilot Assistant */}
          <div className="bg-gradient-to-br from-indigo-950/40 to-zinc-900/40 border border-indigo-500/10 p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center space-x-2.5 mb-3 text-accent">
              <Sparkles className="w-4.5 h-4.5" />
              <h4 className="text-xs font-semibold">AI Helpdesk Copilot</h4>
            </div>
            <p className="text-[10px] text-secondary leading-relaxed mb-4">
              Need immediate help? Ask the AI Copilot to guide you through troubleshooting steps.
            </p>
            <div className="space-y-2">
              <button 
                onClick={() => navigate('/chat', { state: { initialPrompt: "How do I reset my corporate Okta password if my account gets locked out?" } })}
                className="w-full text-left p-2.5 bg-input hover-elev border border-token rounded-lg text-[10px] text-secondary hover-text transition-all cursor-pointer flex items-center justify-between"
              >
                <span>"Reset Okta Corporate Password"</span>
                <ArrowUpRight className="w-3 h-3 text-tertiary shrink-0" />
              </button>
              <button 
                onClick={() => navigate('/chat', { state: { initialPrompt: "What is the secure SSID and root certificate details for office Wi-Fi?" } })}
                className="w-full text-left p-2.5 bg-input hover-elev border border-token rounded-lg text-[10px] text-secondary hover-text transition-all cursor-pointer flex items-center justify-between"
              >
                <span>"Setup Enterprise Wi-Fi settings"</span>
                <ArrowUpRight className="w-3 h-3 text-tertiary shrink-0" />
              </button>
            </div>
          </div>

          {/* Track Ticket Status */}
          <div className="bg-card border border-token p-5 rounded-2xl">
            <div className="flex items-center space-x-2.5 mb-3 text-secondary">
              <Eye className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-semibold">Track Ticket Status</h4>
            </div>
            <p className="text-[10px] text-tertiary leading-relaxed mb-4">
              Monitor the progress of your open tickets and stay updated on resolution status.
            </p>
            <div className="space-y-2">
              <div 
                onClick={() => {
                  setStatusFilter('open');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-2.5 bg-card hover-elev rounded-lg border border-token flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-secondary">View Open Tickets</span>
                </div>
                <ChevronRight className="w-3 h-3 text-tertiary" />
              </div>
              <div 
                onClick={() => {
                  setStatusFilter('in_progress');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-2.5 bg-card hover-elev rounded-lg border border-token flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="text-[10px] text-secondary">View In Progress Tickets</span>
                </div>
                <ChevronRight className="w-3 h-3 text-tertiary" />
              </div>
            </div>
          </div>

          {/* View Resolution History */}
          <div className="bg-card border border-token p-5 rounded-2xl">
            <div className="flex items-center space-x-2.5 mb-3 text-secondary">
              <History className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-semibold">Resolution History</h4>
            </div>
            <p className="text-[10px] text-tertiary leading-relaxed mb-4">
              Review how your past tickets were resolved. Click on any resolved ticket to view its resolution details.
            </p>
            <div className="space-y-2">
              {myTickets.filter(t => (t.status === 'resolved' || t.status === 'closed') && t.resolution).slice(0, 3).map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => {
                    navigate(`/tickets/${ticket.id}`);
                  }}
                  className="w-full p-2.5 bg-card hover-elev rounded-lg border border-token text-left flex items-center justify-between group cursor-pointer"
                >
                  <div className="min-w-0 pr-3">
                    <h5 className="text-[10px] font-semibold text-secondary truncate">{ticket.title}</h5>
                    <span className="text-[8px] font-mono text-tertiary">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-tertiary shrink-0" />
                </button>
              ))}
              {myTickets.filter(t => (t.status === 'resolved' || t.status === 'closed') && t.resolution).length === 0 && (
                <p className="text-[10px] text-tertiary text-center py-3">No resolved tickets with resolution notes yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resolution History Modal */}
      {resolutionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card-solid border border-token rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <History className="w-4 h-4 text-sky-400" />
                Resolution History
              </h3>
              <button
                onClick={() => setResolutionModal(null)}
                className="p-1.5 text-secondary hover-text hover-elev rounded-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <h4 className="text-xs font-semibold text-primary mb-3">{resolutionModal.title}</h4>
            <div className="bg-input border border-token rounded-xl p-4">
              <p className="text-xs text-secondary leading-relaxed whitespace-pre-line">{resolutionModal.resolution}</p>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setResolutionModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-card-solid hover-surface text-secondary transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card-solid border border-token rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
              <Plus className="w-4.5 h-4.5 text-accent" />
              Create New Ticket
            </h3>
            <p className="text-[11px] text-secondary mb-6">File a support ticket to get help from our IT service desk.</p>
            
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-tertiary mb-1">Title</label>
                <input 
                  id="employee-new-ticket-title"
                  name="title"
                  type="text" 
                  placeholder="e.g., Cannot authenticate via Okta on Macbook"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-input border border-token focus:border-[color:var(--accent-primary)] rounded-lg px-3 py-2 text-xs text-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-tertiary mb-1">Description</label>
                <textarea 
                  id="employee-new-ticket-description"
                  name="description"
                  placeholder="Explain what happened, what device you are using, and what steps you have tried..."
                  rows={4}
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-input border border-token focus:border-[color:var(--accent-primary)] rounded-lg px-3 py-2 text-xs text-primary outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-tertiary mb-1">Priority</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map(prio => (
                    <button
                      key={prio}
                      type="button"
                      onClick={() => setNewPriority(prio)}
                      className={`py-2 text-[10px] font-medium rounded-lg capitalize border transition-all ${
                        newPriority === prio
                          ? 'bg-accent-soft text-accent border-[color:var(--accent-primary)]'
                          : 'bg-input text-tertiary border-token hover-text'
                      }`}
                    >
                      {prio}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-token">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-secondary hover-text bg-card-solid border border-token cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold accent-btn cursor-pointer shadow-md"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
