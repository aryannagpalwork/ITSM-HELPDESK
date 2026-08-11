import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../shared/AppContext';
import { useTheme } from '../../shared/ThemeContext';
import { 
  Sparkles, 
  Plus, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Activity,
  AlertCircle,
  ChevronRight,
  Search,
  UserCircle2,
  Target,
  Timer,
  Loader2,
  Inbox,
  Briefcase,
  AlertTriangle,
  CheckCheck,
  RefreshCcw,
  TrendingUp,
  X,
  ArrowUpRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TicketPriority, TicketStatus, AgentMetrics, TimelineRange, TicketLifecycleTimeline } from '../../shared/types';
import { getAgentTicketTimeline } from '../../shared/api';
import { RangeToggle } from '../admin/components/RangeToggle';
import TicketLifecycleDetailChart from '../admin/components/charts/TicketLifecycleDetailChart';
import { UpcomingActionsStepper } from '../../components/UpcomingActionsStepper';

const getPriorityBadgeStyle = (prio: TicketPriority, tokens: any) => {
  switch (prio) {
    case 'low': return { backgroundColor: tokens.statusInfoBg, color: tokens.statusInfo, border: `1px solid ${tokens.statusInfo}33` };
    case 'medium': return { backgroundColor: tokens.statusWarningBg, color: tokens.statusWarning, border: `1px solid ${tokens.statusWarning}33` };
    case 'high': return { backgroundColor: tokens.statusWarningBg, color: tokens.statusWarning, border: `1px solid ${tokens.statusWarning}33` };
    case 'critical': return { backgroundColor: tokens.statusErrorBg, color: tokens.statusError, border: `1px solid ${tokens.statusError}33` };
  }
};

const getStatusBadgeStyle = (status: TicketStatus, tokens: any) => {
  switch (status) {
    case 'open': return { backgroundColor: tokens.statusSuccessBg, color: tokens.statusSuccess, border: `1px solid ${tokens.statusSuccess}33` };
    case 'in_progress': return { backgroundColor: tokens.accentPrimaryBg, color: tokens.accentPrimary, border: `1px solid ${tokens.accentPrimary}33` };
    case 'resolved': return { backgroundColor: tokens.statusInfoBg, color: tokens.statusInfo, border: `1px solid ${tokens.statusInfo}33` };
    case 'closed': return { backgroundColor: tokens.hover, color: tokens.textTertiary, border: `1px solid ${tokens.border}` };
  }
};

const getProgressForStatus = (status: TicketStatus): number => {
  switch (status) {
    case 'open': return 10;
    case 'in_progress': return 45;
    case 'resolved': return 85;
    case 'closed': return 100;
  }
};

const getResolutionStage = (status: TicketStatus): string => {
  switch (status) {
    case 'open': return 'Initial Assessment';
    case 'in_progress': return 'Active Investigation';
    case 'resolved': return 'Resolution Verified';
    case 'closed': return 'Case Closed';
  }
};

const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };

/** Card-driven filter applied to the dashboard charts (mirrors the admin dashboard). */
interface AgentCardFilter {
  label: string;
  statuses?: string[];
  assignment?: 'assigned';
}

function rangeCutoff(range: TimelineRange): number {
  const now = new Date();
  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  const days = range === '30d' ? 30 : 7;
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

const KpiCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  accent?: boolean;
  tokens: any;
  isActive?: boolean;
  onClick?: () => void;
  onOpen?: () => void;
  openLabel?: string;
}> = ({ label, value, icon, color, subtitle, accent, tokens, isActive, onClick, onOpen, openLabel = 'Open filtered tickets' }) => {
  const restingBorder = isActive
    ? tokens.accentPrimary
    : accent ? `${tokens.accentPrimary}33` : tokens.border;
  return (
  <div 
    className={`group relative p-4 rounded-xl transition-all ${onClick ? 'cursor-pointer' : ''}`}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    aria-pressed={onClick ? isActive : undefined}
    onClick={onClick}
    onKeyDown={onClick ? (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    } : undefined}
    onMouseEnter={onClick ? (e) => { e.currentTarget.style.borderColor = tokens.accentPrimary; } : undefined}
    onMouseLeave={onClick ? (e) => { e.currentTarget.style.borderColor = restingBorder; } : undefined}
    style={{ 
      backgroundColor: tokens.cardBg, 
      border: `1px solid ${restingBorder}`,
      boxShadow: isActive ? `0 0 0 1px ${tokens.accentPrimary}66` : undefined,
    }}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: tokens.textSecondary }}>{label}</span>
      <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
    </div>
    <h2 className="text-xl font-bold mt-1" style={{ color: tokens.textPrimary }}>{value}</h2>
    {subtitle && <p className="text-[9px] mt-1" style={{ color: tokens.textTertiary }}>{subtitle}</p>}
    {onOpen && (
      <button
        type="button"
        aria-label={openLabel}
        title={openLabel}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="absolute bottom-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
        style={{ color: tokens.textTertiary }}
        onMouseEnter={(e) => { e.currentTarget.style.color = tokens.textPrimary; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textTertiary; }}
      >
        <ArrowUpRight className="w-3 h-3" />
      </button>
    )}
  </div>
  );
};

export const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, tickets, createTicket, agentMetrics, loadAgentMetrics, loadTickets, roleAgentKPIs, loadRoleAgentKPIs, kpisLoading, kpisError } = useApp();
  const { tokens, chart } = useTheme();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('priority');

  // Chart controls: date range + card-driven filter (mirrors the admin dashboard).
  const [range, setRange] = useState<TimelineRange>('7d');
  const [cardFilter, setCardFilter] = useState<AgentCardFilter | null>(null);
  const [ticketLifecycle, setTicketLifecycle] = useState<TicketLifecycleTimeline | null>(null);

  useEffect(() => {
    if (currentUser.role === 'Agent' || currentUser.role === 'Administrator') {
      loadAgentMetrics();
      loadRoleAgentKPIs();
      loadTickets({ assignment: 'all' });
    }
  }, []);

  useEffect(() => {
    let active = true;
    getAgentTicketTimeline(range).then(data => {
      if (active) setTicketLifecycle(data);
    }).catch(() => {
      if (active) setTicketLifecycle(null);
    });
    return () => { active = false; };
  }, [range]);

  // Keep KPI cards live: poll periodically and refresh on window focus so the
  // snapshot stays current without a manual reload.
  useEffect(() => {
    if (currentUser.role !== 'Agent' && currentUser.role !== 'Administrator') return;
    const refreshLive = () => {
      loadRoleAgentKPIs();
      loadTickets({ assignment: 'all' });
    };
    const interval = setInterval(refreshLive, 30000);
    window.addEventListener('focus', refreshLive);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshLive);
    };
  }, []);

  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    if (assignmentFilter === 'assigned') {
      result = result.filter(t => t.agentId === currentUser.id);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        (t.ticketNumber || t.id).toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.userName || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return priorityWeight[b.priority] - priorityWeight[a.priority];
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'due':
          return (priorityWeight[b.priority] - priorityWeight[a.priority]);
        default:
          return 0;
      }
    });

    return result;
  }, [tickets, search, statusFilter, priorityFilter, assignmentFilter, sortBy, currentUser.id]);

  const legacy = agentMetrics || {
    assignedTickets: 0,
    openTickets: 0,
    inProgress: 0,
    waiting: 0,
    resolvedToday: 0,
    overdueTickets: 0,
    avgResolutionTime: 0,
    activeSlaBreaches: 0,
    agentWorkload: 0,
    ticketsResolved: 0,
    avgResolutionTimeHours: 0,
    firstResponseTime: 0,
    slaCompliance: 0,
    resolutionRate: 0,
    reopenRate: 0,
  };

  const m: AgentMetrics & { userSatisfaction: number | null; agentFcrRate: number | null } = {
    assignedTickets: roleAgentKPIs?.assignedTickets ?? legacy.assignedTickets,
    openTickets: roleAgentKPIs?.openTickets ?? legacy.openTickets,
    inProgress: roleAgentKPIs?.inProgress ?? legacy.inProgress,
    waiting: roleAgentKPIs?.waiting ?? legacy.waiting,
    resolvedToday: roleAgentKPIs?.resolvedToday ?? legacy.resolvedToday,
    overdueTickets: roleAgentKPIs?.overdueTickets ?? legacy.overdueTickets,
    ticketsResolved: roleAgentKPIs?.resolvedTickets ?? legacy.ticketsResolved,
    avgResolutionTimeHours: roleAgentKPIs?.mttrHours ?? legacy.avgResolutionTimeHours,
    firstResponseTime: roleAgentKPIs?.avgFirstResponseHours ?? legacy.firstResponseTime,
    slaCompliance: roleAgentKPIs?.slaCompliance ?? legacy.slaCompliance,
    resolutionRate: roleAgentKPIs?.resolutionRate ?? legacy.resolutionRate,
    reopenRate: roleAgentKPIs?.reopenRate ?? legacy.reopenRate,
    agentFcrRate: roleAgentKPIs?.agentFcrRate ?? null,
    userSatisfaction: roleAgentKPIs?.userSatisfaction ?? null,
    avgResolutionTime: legacy.avgResolutionTime,
    activeSlaBreaches: legacy.activeSlaBreaches,
    agentWorkload: legacy.agentWorkload,
  };

  const metricsAvailable = roleAgentKPIs !== null || agentMetrics !== null;
  const richKpisAvailable = roleAgentKPIs !== null;

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    await createTicket({
      title: newTitle,
      description: newDesc,
      priority: newPriority,
      aiSummary: `AI Summary: Support incident created by agent. Title: "${newTitle}".`,
      suggestedResolution: `Recommended Resolution Steps: 1. Review standard procedures. 2. Verify active directories. 3. Coordinate diagnostic tasks.`
    });

    setNewTitle('');
    setNewDesc('');
    setNewPriority('medium');
    setIsCreateOpen(false);
  };

  const areaData = useMemo(() => {
    const cutoff = rangeCutoff(range);
    type Point = { date: string; created: number; resolved: number };
    const points: Point[] = [];
    const index = new Map<string, Point>();
    if (range === 'today') {
      // 3-hour buckets across the current day.
      for (let h = 0; h < 24; h += 3) {
        const p: Point = { date: `${String(h).padStart(2, '0')}:00`, created: 0, resolved: 0 };
        points.push(p);
        index.set(String(h / 3), p);
      }
    } else {
      const days = range === '30d' ? 30 : 7;
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const p: Point = { date: `${d.getMonth() + 1}/${d.getDate()}`, created: 0, resolved: 0 };
        points.push(p);
        index.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, p);
      }
    }
    const bucketKey = (dt: Date) =>
      range === 'today'
        ? String(Math.floor(dt.getHours() / 3))
        : `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
    for (const t of tickets) {
      if (cardFilter?.assignment === 'assigned' && t.agentId !== currentUser.id) continue;
      if (cardFilter?.statuses && !cardFilter.statuses.includes(t.status)) continue;
      const created = new Date(t.createdAt);
      if (!Number.isNaN(created.getTime()) && created.getTime() >= cutoff) {
        const p = index.get(bucketKey(created));
        if (p) p.created += 1;
      }
      if (t.status === 'resolved' || t.status === 'closed') {
        const resolved = new Date(t.updatedAt);
        if (!Number.isNaN(resolved.getTime()) && resolved.getTime() >= cutoff) {
          const p = index.get(bucketKey(resolved));
          if (p) p.resolved += 1;
        }
      }
    }
    return points;
  }, [tickets, range, cardFilter, currentUser.id]);

  const priorityDistributionData = useMemo(() => {
    const cutoff = rangeCutoff(range);
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const t of tickets) {
      if (cardFilter?.assignment === 'assigned' && t.agentId !== currentUser.id) continue;
      if (cardFilter?.statuses && !cardFilter.statuses.includes(t.status)) continue;
      const created = new Date(t.createdAt).getTime();
      const updated = new Date(t.updatedAt).getTime();
      if (Math.max(created || 0, updated || 0) < cutoff) continue;
      counts[t.priority] = (counts[t.priority] || 0) + 1;
    }
    return [
      { name: 'Low', count: counts.low, color: chart.palette[0] || tokens.statusInfo },
      { name: 'Medium', count: counts.medium, color: chart.palette[1] || tokens.statusWarning },
      { name: 'High', count: counts.high, color: chart.palette[2] || tokens.statusWarning },
      { name: 'Critical', count: counts.critical, color: chart.palette[3] || tokens.statusError },
    ];
  }, [tickets, range, cardFilter, currentUser.id, chart.palette, tokens]);

  const toggleCardFilter = (filter: AgentCardFilter) => {
    setCardFilter(prev => (prev?.label === filter.label ? null : filter));
  };

  return (
    <div 
      className="flex-1 p-6 overflow-y-auto h-full font-sans"
      style={{ backgroundColor: tokens.appBg, color: tokens.textPrimary }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2 text-[10px] uppercase font-mono tracking-wider font-semibold mb-1" style={{ color: tokens.accentPrimary }}>
            <Activity className="w-3.5 h-3.5" />
            <span>Agent Command Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>
            Welcome, {currentUser.name}
          </h1>
          <p className="text-xs" style={{ color: tokens.textSecondary }}>
            Smart ticket assignment, workload metrics, and performance analytics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/agent/chat')}
            className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer"
            style={{ backgroundColor: tokens.cardBgSolid, border: `1px solid ${tokens.border}`, color: tokens.accentPrimary }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tokens.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tokens.cardBgSolid; }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Copilot</span>
          </button>
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-lg cursor-pointer"
            style={{ backgroundColor: tokens.accentPrimary, color: 'var(--accent-primary-contrast)', boxShadow: `0 10px 15px -3px ${tokens.accentPrimary}10` }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tokens.accentPrimary + 'cc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tokens.accentPrimary; }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Target className="w-3.5 h-3.5" style={{ color: tokens.accentPrimary }} />
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold" style={{ color: tokens.textSecondary }}>Performance Snapshot</span>
          </div>
          {kpisLoading && (
            <span className="text-[9px] flex items-center gap-1" style={{ color: tokens.textTertiary }}>
              <Loader2 className="w-3 h-3 animate-spin" /> Refreshing
            </span>
          )}
          {!kpisLoading && roleAgentKPIs && (
            <button
              onClick={loadRoleAgentKPIs}
              className="text-[9px] flex items-center gap-1 transition-colors"
              style={{ color: tokens.textTertiary }}
              onMouseEnter={(e) => { e.currentTarget.style.color = tokens.textSecondary; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textTertiary; }}
            >
              <RefreshCcw className="w-3 h-3" /> Refresh
            </button>
          )}
        </div>
        {kpisError && (
          <div 
            className="mb-3 p-3 rounded-lg flex items-center gap-2 text-[10px]"
            style={{ backgroundColor: tokens.statusErrorBg, border: `1px solid ${tokens.statusError}33`, color: tokens.statusError }}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Live KPI refresh issue — using cached metrics. {kpisError}</span>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard tokens={tokens} label="Assigned" value={m.assignedTickets} icon={<Inbox className="w-3 h-3" style={{ color: tokens.accentPrimary }} />} color="" subtitle={metricsAvailable ? 'Open assigned ticket queue' : 'Loading...'} isActive={cardFilter?.label === 'Assigned'} onClick={() => navigate('/agent/tickets')} onOpen={() => navigate('/agent/tickets')} openLabel="Open full ticket queue" />
          <KpiCard tokens={tokens} label="Resolved Today" value={m.resolvedToday} icon={<CheckCircle2 className="w-3 h-3" style={{ color: tokens.statusInfo }} />} color="" subtitle={metricsAvailable ? 'Open resolved tickets' : 'Loading...'} isActive={cardFilter?.label === 'Resolved Today'} onClick={() => navigate('/agent/tickets?status=resolved')} onOpen={() => navigate('/agent/tickets?status=resolved')} openLabel="Open resolved tickets" />
          <KpiCard tokens={tokens} label="Mean Time To Resolution" value={metricsAvailable ? `${m.avgResolutionTimeHours}h` : 'N/A'} icon={<Timer className="w-3 h-3" style={{ color: tokens.statusInfo }} />} color="" subtitle="Open resolved tickets" isActive={cardFilter?.label === 'Mean Time To Resolution'} onClick={() => navigate('/agent/tickets?status=resolved')} onOpen={() => navigate('/agent/tickets?status=resolved')} openLabel="Open resolved tickets" />
          <KpiCard tokens={tokens} label="User Satisfaction" value={richKpisAvailable && m.userSatisfaction !== null ? `${m.userSatisfaction}%` : '—'} icon={<Sparkles className="w-3 h-3" style={{ color: tokens.statusInfo }} />} color="" subtitle="Tickets resolved by AI" accent={richKpisAvailable} isActive={cardFilter?.label === 'User Satisfaction'} onClick={() => navigate('/agent/tickets?status=resolved')} onOpen={() => navigate('/agent/tickets?status=resolved')} openLabel="Open resolved tickets" />
          <KpiCard tokens={tokens} label="Agent First Contact Resolution" value={richKpisAvailable && m.agentFcrRate !== null ? `${m.agentFcrRate}%` : '—'} icon={<UserCircle2 className="w-3 h-3" style={{ color: tokens.accentPrimary }} />} color="" subtitle="First-contact agent resolutions" accent={richKpisAvailable} isActive={cardFilter?.label === 'Agent First Contact Resolution'} onClick={() => navigate('/agent/tickets?status=resolved')} onOpen={() => navigate('/agent/tickets?status=resolved')} openLabel="Open resolved tickets" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: tokens.accentPrimary }} />
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold" style={{ color: tokens.textSecondary }}>Analytics & Trends</span>
        </div>
        <div className="flex items-center gap-2">
          {cardFilter && (
            <button
              type="button"
              onClick={() => setCardFilter(null)}
              title="Clear chart filter"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer"
              style={{ backgroundColor: tokens.accentPrimary + '15', border: `1px solid ${tokens.accentPrimary}40`, color: tokens.accentPrimary }}
            >
              <span>Viewing: {cardFilter.label}</span>
              <X className="w-3 h-3" />
            </button>
          )}
          <RangeToggle value={range} onChange={setRange} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 h-[420px] rounded-2xl p-4" style={{ backgroundColor: tokens.cardBg, border: `1px solid ${tokens.border}` }}>
          <TicketLifecycleDetailChart data={ticketLifecycle} />
        </div>
        {false && (
        <div 
          className="lg:col-span-2 rounded-2xl p-4"
          style={{ backgroundColor: tokens.cardBg, border: `1px solid ${tokens.border}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold" style={{ color: tokens.textPrimary }}>Ticket Volume Lifecycle</h3>
              <p className="text-[9px]" style={{ color: tokens.textTertiary }}>Created vs resolved incidents across the selected range</p>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chart.palette[0] || tokens.accentPrimary} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={chart.palette[0] || tokens.accentPrimary} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chart.palette[1] || tokens.statusSuccess} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={chart.palette[1] || tokens.statusSuccess} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke={chart.stroke} fontSize={10} tickLine={false} />
                <YAxis stroke={chart.stroke} fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: '8px' }}
                  labelStyle={{ color: chart.tooltipLabel, fontSize: '10px' }}
                  itemStyle={{ color: chart.tooltipText, fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="created" stroke={chart.palette[0] || tokens.accentPrimary} strokeWidth={2} fillOpacity={1} fill="url(#colorCreated)" />
                <Area type="monotone" dataKey="resolved" stroke={chart.palette[1] || tokens.statusSuccess} strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        <div 
          className="rounded-2xl p-4 flex flex-col justify-between"
          style={{ backgroundColor: tokens.cardBg, border: `1px solid ${tokens.border}` }}
        >
          <UpcomingActionsStepper tickets={tickets.filter(ticket => ticket.agentId === currentUser.id)} />
          {false && (
          <>
          <div>
            <h3 className="text-xs font-semibold" style={{ color: tokens.textPrimary }}>Severity Distribution</h3>
            <p className="text-[9px] mb-4" style={{ color: tokens.textTertiary }}>{cardFilter ? `Filtered: ${cardFilter.label}` : 'Tickets by priority level'}</p>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityDistributionData}>
                <XAxis dataKey="name" stroke={chart.stroke} fontSize={9} tickLine={false} />
                <YAxis stroke={chart.stroke} fontSize={9} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: '8px' }}
                  itemStyle={{ color: chart.tooltipText, fontSize: '11px' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {priorityDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-1 mt-3 text-center">
            {priorityDistributionData.map((d, i) => (
              <div 
                key={i} 
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: tokens.cardBg + '80', border: `1px solid ${tokens.border}66` }}
              >
                <div className="text-[10px] font-semibold" style={{ color: tokens.textPrimary }}>{d.count}</div>
                <div className="text-[7px] font-mono uppercase mt-0.5" style={{ color: tokens.textTertiary }}>{d.name}</div>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </div>

      <div 
        className="rounded-2xl p-4 mb-6"
        style={{ backgroundColor: tokens.cardBg, border: `1px solid ${tokens.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold flex items-center gap-2" style={{ color: tokens.textPrimary }}>
              <Inbox className="w-3.5 h-3.5" style={{ color: tokens.accentPrimary }} />
              Smart Ticket Queue
            </h3>
            <p className="text-[9px]" style={{ color: tokens.textTertiary }}>
              Showing {filteredTickets.length} tickets you can work on
            </p>
          </div>
          <button 
            onClick={() => navigate('/agent/tickets')}
            className="text-[10px] font-medium flex items-center space-x-1"
            style={{ color: tokens.accentPrimary }}
            onMouseEnter={(e) => { e.currentTarget.style.color = tokens.accentPrimary + 'cc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = tokens.accentPrimary; }}
          >
            <span>Full Queue</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
          <div className="relative flex items-center lg:col-span-2">
            <input 
              id="agent-ticket-search"
              name="ticketSearch"
              type="text" 
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg pl-8 pr-3 py-1.5 text-[10px] outline-none transition-all"
              style={{ 
                backgroundColor: tokens.inputBg, 
                border: `1px solid ${tokens.border}`, 
                color: tokens.textPrimary,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = tokens.accentPrimary; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = tokens.border; }}
            />
            <Search className="absolute left-2.5 w-3 h-3" style={{ color: tokens.textTertiary }} />
          </div>

          <div 
            className="flex items-center space-x-1.5 rounded-lg px-2 py-1"
            style={{ backgroundColor: tokens.inputBg, border: `1px solid ${tokens.border}` }}
          >
            <span className="text-[8px] font-mono uppercase shrink-0" style={{ color: tokens.textTertiary }}>Status</span>
            <select id="agent-status-filter" name="ticketStatus" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-transparent border-none text-[10px] focus:ring-0 outline-none py-0.5 cursor-pointer"
              style={{ color: tokens.textSecondary }}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div 
            className="flex items-center space-x-1.5 rounded-lg px-2 py-1"
            style={{ backgroundColor: tokens.inputBg, border: `1px solid ${tokens.border}` }}
          >
            <span className="text-[8px] font-mono uppercase shrink-0" style={{ color: tokens.textTertiary }}>Priority</span>
            <select id="agent-priority-filter" name="ticketPriority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-transparent border-none text-[10px] focus:ring-0 outline-none py-0.5 cursor-pointer"
              style={{ color: tokens.textSecondary }}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div 
            className="flex items-center space-x-1.5 rounded-lg px-2 py-1"
            style={{ backgroundColor: tokens.inputBg, border: `1px solid ${tokens.border}` }}
          >
            <span className="text-[8px] font-mono uppercase shrink-0" style={{ color: tokens.textTertiary }}>Assignment</span>
            <select id="agent-assignment-filter" name="assignment" value={assignmentFilter} onChange={(e) => setAssignmentFilter(e.target.value)}
              className="w-full bg-transparent border-none text-[10px] focus:ring-0 outline-none py-0.5 cursor-pointer"
              style={{ color: tokens.textSecondary }}
            >
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
            </select>
          </div>

          <div 
            className="flex items-center space-x-1.5 rounded-lg px-2 py-1"
            style={{ backgroundColor: tokens.inputBg, border: `1px solid ${tokens.border}` }}
          >
            <span className="text-[8px] font-mono uppercase shrink-0" style={{ color: tokens.textTertiary }}>Sort</span>
            <select id="agent-sort-order" name="ticketSort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-transparent border-none text-[10px] focus:ring-0 outline-none py-0.5 cursor-pointer"
              style={{ color: tokens.textSecondary }}
            >
              <option value="priority">Priority</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
            </select>
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <div 
            className="p-8 rounded-xl text-center"
            style={{ border: `1px dashed ${tokens.border}` }}
          >
            <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: tokens.textTertiary }} />
            <h4 className="text-xs font-semibold" style={{ color: tokens.textSecondary }}>No Tickets Found</h4>
            <p className="text-[10px] max-w-sm mx-auto mt-1" style={{ color: tokens.textTertiary }}>No tickets match the current filters or are available for your specialization.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTickets.slice(0, 10).map(ticket => (
              <div 
                key={ticket.id}
                onClick={() => navigate(`/agent/tickets/${ticket.id}`)}
                className="p-3 rounded-xl transition-all group cursor-pointer"
                style={{ 
                  backgroundColor: tokens.cardBgSolid + '99', 
                  border: `1px solid ${tokens.border}cc` 
                }}
                onMouseEnter={(e) => { 
                  e.currentTarget.style.backgroundColor = tokens.cardBgSolid; 
                  e.currentTarget.style.borderColor = tokens.borderStrong; 
                }}
                onMouseLeave={(e) => { 
                  e.currentTarget.style.backgroundColor = tokens.cardBgSolid + '99'; 
                  e.currentTarget.style.borderColor = `${tokens.border}cc`; 
                }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5 mb-1.5 flex-wrap gap-y-0.5">
                      <span className="text-[9px] font-mono font-semibold" style={{ color: tokens.textTertiary }}>{ticket.ticketNumber || ticket.id}</span>
                      <span 
                        className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-full font-semibold"
                        style={getPriorityBadgeStyle(ticket.priority, tokens)}
                      >
                        {ticket.priority}
                      </span>
                      <span 
                        className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-full font-semibold"
                        style={getStatusBadgeStyle(ticket.status, tokens)}
                      >
                        {ticket.status.replace('_', ' ')}
                      </span>
                      {ticket.aiAnalysisEstimatedSla && (
                        <span 
                          className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: tokens.statusSuccessBg, color: tokens.statusSuccess, border: `1px solid ${tokens.statusSuccess}33` }}
                        >
                          SLA: {ticket.aiAnalysisEstimatedSla}
                        </span>
                      )}
                    </div>
                    <h4 
                      className="text-xs font-semibold truncate transition-colors"
                      style={{ color: tokens.textSecondary }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = tokens.textPrimary; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textSecondary; }}
                    >
                      {ticket.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-[9px]" style={{ color: tokens.textTertiary }}>
                      <span className="flex items-center gap-1">
                        <UserCircle2 className="w-2.5 h-2.5" />
                        {ticket.userName || 'Unassigned'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(ticket.updatedAt).toLocaleDateString()}
                      </span>
                      {ticket.agentName && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-2.5 h-2.5" />
                          {ticket.agentName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:block w-24">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[7px] font-mono uppercase" style={{ color: tokens.textTertiary }}>Progress</span>
                        <span className="text-[7px] font-mono" style={{ color: tokens.textSecondary }}>{getProgressForStatus(ticket.status)}%</span>
                      </div>
                      <div 
                        className="w-full h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: tokens.cardBgSolid }}
                      >
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${getProgressForStatus(ticket.status)}%`,
                            background: `linear-gradient(to right, ${tokens.accentPrimary}, ${tokens.accentPrimary}cc)`
                          }}
                        />
                      </div>
                      <span className="text-[7px] mt-0.5 block" style={{ color: tokens.textTertiary }}>{getResolutionStage(ticket.status)}</span>
                    </div>
                    <ChevronRight 
                      className="w-4 h-4 transition-colors shrink-0" 
                      style={{ color: tokens.textTertiary }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = tokens.textSecondary; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textTertiary; }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div 
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl relative"
            style={{ backgroundColor: tokens.cardBgSolid, border: `1px solid ${tokens.border}` }}
          >
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: tokens.textPrimary }}>
              <Plus className="w-4.5 h-4.5" style={{ color: tokens.accentPrimary }} />
              Create IT Incident Record
            </h3>
            <p className="text-[11px] mb-6" style={{ color: tokens.textSecondary }}>File a ticket into our service desk.</p>
            
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: tokens.textTertiary }}>Incident Headline</label>
                <input 
                  id="agent-new-ticket-title"
                  name="title"
                  type="text" 
                  placeholder="e.g., Cannot authenticate via Okta on Macbook"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: tokens.inputBg, border: `1px solid ${tokens.border}`, color: tokens.textPrimary }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = tokens.accentPrimary; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = tokens.border; }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: tokens.textTertiary }}>Full Description</label>
                <textarea 
                  id="agent-new-ticket-description"
                  name="description"
                  placeholder="Explain what happened..."
                  rows={4}
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none"
                  style={{ backgroundColor: tokens.inputBg, border: `1px solid ${tokens.border}`, color: tokens.textPrimary }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = tokens.accentPrimary; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = tokens.border; }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: tokens.textTertiary }}>Priority</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map(prio => (
                    <button
                      key={prio}
                      type="button"
                      onClick={() => setNewPriority(prio)}
                      className="py-2 text-[10px] font-medium rounded-lg border transition-all capitalize"
                      style={newPriority === prio 
                        ? { backgroundColor: tokens.accentPrimary + '20', color: tokens.accentPrimary, border: `1px solid ${tokens.accentPrimary}` }
                        : { backgroundColor: tokens.inputBg, color: tokens.textTertiary, border: `1px solid ${tokens.border}cc` }
                      }
                      onMouseEnter={(e) => { 
                        if (newPriority !== prio) e.currentTarget.style.color = tokens.textSecondary; 
                      }}
                      onMouseLeave={(e) => { 
                        if (newPriority !== prio) e.currentTarget.style.color = tokens.textTertiary; 
                      }}
                    >
                      {prio}
                    </button>
                  ))}
                </div>
              </div>
              <div 
                className="flex items-center justify-end space-x-3 pt-4"
                style={{ borderTop: `1px solid ${tokens.border}cc` }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{ backgroundColor: tokens.cardBgSolid, border: `1px solid ${tokens.border}`, color: tokens.textSecondary }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = tokens.textPrimary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textSecondary; }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer shadow-md"
                  style={{ backgroundColor: tokens.accentPrimary, color: 'var(--accent-primary-contrast)', boxShadow: `0 4px 6px -1px ${tokens.accentPrimary}10` }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tokens.accentPrimary + 'cc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tokens.accentPrimary; }}
                >
                  Submit Incident Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;
