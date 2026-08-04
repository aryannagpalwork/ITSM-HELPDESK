import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../shared/AppContext';
import { getAdminTicketTimeline, getAdminAICopilotTimeline, getAgentsAvailability } from '../../shared/api';
import { getAdminAnalytics } from '../../shared/api';
import {
  AgentAvailability,
  Ticket,
  AdminAnalytics,
} from '../../shared/types';

/**
 * Active card filter applied across every dashboard graph.
 * `status`/`statuses` and `priority` narrow the ticket-derived charts;
 * `label` identifies which KPI card is currently active (for toggling).
 */
export interface AdminCardFilter {
  label: string;
  status?: string;
  statuses?: string[];
  priority?: string;
}

export interface DistributionDatum {
  name: string;
  key: string;
  value: number;
}

export interface RecentActivityItem {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  type: 'create' | 'update' | 'publish' | 'ai';
}

export interface IncidentQueueItem {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  requester: string;
  updatedLabel: string;
}

const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const STATUS_META: { key: string; name: string }[] = [
  { key: 'open', name: 'Open' },
  { key: 'in_progress', name: 'In Progress' },
  { key: 'resolved', name: 'Resolved' },
  { key: 'closed', name: 'Closed' },
];

const PRIORITY_META: { key: string; name: string }[] = [
  { key: 'low', name: 'Low' },
  { key: 'medium', name: 'Medium' },
  { key: 'high', name: 'High' },
  { key: 'critical', name: 'Critical' },
];

function matchesFilter(ticket: Ticket, filter: AdminCardFilter | null): boolean {
  if (!filter) return true;
  if (filter.statuses && !filter.statuses.includes(ticket.status)) return false;
  if (filter.status && ticket.status !== filter.status) return false;
  if (filter.priority && ticket.priority !== filter.priority) return false;
  return true;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} d ago`;
}

function statusToActivityType(status: string): RecentActivityItem['type'] {
  if (status === 'open') return 'create';
  if (status === 'resolved' || status === 'closed') return 'publish';
  return 'update';
}

/**
 * Centralized state for the Admin Dashboard: date range, active card filter,
 * timeline fetches (with ~30s polling + focus refresh), and memoized chart
 * datasets derived from the live ticket list. Keeping this in one hook avoids
 * duplicating fetch/filter logic across cards and charts.
 */
export function useAdminDashboard(enabled: boolean) {
  const { adminKPIs, kpisLoading, kpisError, loadAdminKPIs, tickets } = useApp();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [activeFilter, setActiveFilter] = useState<AdminCardFilter | null>(null);

  const [ticketTimeline, setTicketTimeline] = useState<TicketLifecycleTimeline | null>(null);
  const [aiTimeline, setAiTimeline] = useState<AICopilotTimeline | null>(null);
  const [agentsAvailability, setAgentsAvailability] = useState<AgentAvailability[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [timelinesLoading, setTimelinesLoading] = useState(false);
  const [timelinesError, setTimelinesError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (selectedMonth: number, selectedYear: number) => {
    try {
      setTimelinesLoading(true);
      setTimelinesError(null);
      setAnalytics(await getAdminAnalytics(selectedMonth, selectedYear));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load timeline data';
      console.warn(msg, error);
      setTimelinesError(msg);
    } finally {
      setTimelinesLoading(false);
    }
  }, []);

  const fetchAvailability = useCallback(async () => {
    try {
      const availability = await getAgentsAvailability();
      setAgentsAvailability(availability);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load agents availability';
      console.warn(msg, error);
    }
  }, []);

  // Fetch all period-sensitive dashboard analytics with one request.
  useEffect(() => {
    if (enabled) {
      fetchAnalytics(month, year);
    }
  }, [enabled, month, year, fetchAnalytics]);

  useEffect(() => {
    if (enabled) {
      fetchAvailability();
    }
  }, [enabled, fetchAvailability]);

  // Load KPIs on mount when enabled.
  useEffect(() => {
    if (enabled) {
      loadAdminKPIs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const refreshAll = useCallback(() => {
    loadAdminKPIs();
    fetchTimelines(range);
    fetchAvailability();
  }, [loadAdminKPIs, fetchTimelines, fetchAvailability, range]);
    fetchAnalytics(month, year);
  }, [loadAdminKPIs, fetchAnalytics, month, year]);

  // Keep a stable reference to the latest refresh logic so the polling
  // interval is created once and always sees the current range.
  const savedRefresh = useRef<() => void>(() => {});
  useEffect(() => {
    savedRefresh.current = () => {
      loadAdminKPIs();
      fetchTimelines(range);
      fetchAvailability();
      fetchAnalytics(month, year);
    };
  }, [loadAdminKPIs, fetchTimelines, fetchAvailability, range]);
  }, [loadAdminKPIs, fetchAnalytics, month, year]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => savedRefresh.current();
    const id = window.setInterval(tick, 30000);
    const onFocus = () => tick();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  const toggleFilter = useCallback((filter: AdminCardFilter) => {
    setActiveFilter(prev => (prev && prev.label === filter.label ? null : filter));
  }, []);

  const clearFilter = useCallback(() => setActiveFilter(null), []);

  // Tickets within the active month/year (used only for existing local cards).
  const ticketsInRange = useMemo(() => {
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 1).getTime();
    return tickets.filter(t => {
      const created = new Date(t.createdAt).getTime();
      return !Number.isNaN(created) && created >= start && created < end;
    });
  }, [tickets, month, year]);

  // Tickets matching the active card filter (drives every derived chart).
  const filteredTickets = useMemo(
    () => ticketsInRange.filter(t => matchesFilter(t, activeFilter)),
    [ticketsInRange, activeFilter],
  );

  const statusData = useMemo<DistributionDatum[]>(() => {
    return STATUS_META.map(s => ({
      key: s.key,
      name: s.name,
      value: filteredTickets.filter(t => t.status === s.key).length,
    }));
  }, [filteredTickets]);

  const priorityData = useMemo<DistributionDatum[]>(() => {
    return PRIORITY_META.map(p => ({
      key: p.key,
      name: p.name,
      value: filteredTickets.filter(t => t.priority === p.key).length,
    }));
  }, [filteredTickets]);

  // Live incident queue: unresolved tickets ordered by severity then recency.
  const incidentQueue = useMemo<IncidentQueueItem[]>(() => {
    return tickets
      .filter(t => t.status === 'open' || t.status === 'in_progress')
      .sort((a, b) => {
        const pw = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        if (pw !== 0) return pw;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, 6)
      .map(t => ({
        id: t.id,
        ticketNumber: t.ticketNumber || t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        requester: t.userName || 'Unknown',
        updatedLabel: relativeTime(t.updatedAt),
      }));
  }, [tickets]);

  const recentActivity = useMemo<RecentActivityItem[]>(() => {
    return [...tickets]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        actor: t.userName || 'System',
        action: `${t.ticketNumber || t.id} — ${t.title}`,
        timestamp: relativeTime(t.updatedAt),
        type: statusToActivityType(t.status),
      }));
  }, [tickets]);

  const agentsOnLeaveToday = useMemo(
    () => agentsAvailability.filter(agent => agent.onLeaveToday).length,
    [agentsAvailability],
  );

  return {
    month,
    year,
    setMonth,
    setYear,
    activeFilter,
    setActiveFilter,
    toggleFilter,
    clearFilter,
    analytics,
    ticketTimeline: analytics?.ticketLifecycle || null,
    aiTimeline: analytics?.aiCopilot || null,
    timelinesLoading,
    timelinesError,
    statusData,
    priorityData,
    filteredTicketCount: filteredTickets.length,
    incidentQueue,
    recentActivity,
    agentsAvailability,
    agentsOnLeaveToday,
    adminKPIs,
    kpisLoading,
    kpisError,
    refresh: refreshAll,
  };
}
