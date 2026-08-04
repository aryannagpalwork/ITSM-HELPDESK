import React, { lazy, Suspense, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../shared/AppContext';
import { useAdminDashboard } from './useAdminDashboard';
import { KpiCard } from './components/KpiCard';
import { ChartPanel } from './components/ChartPanel';
import {
  Activity,
  AlertOctagon,
  AlertCircle,
  TrendingUp,
  RefreshCcw,
  Sparkles,
  Timer,
  Target,
  Smile,
  Inbox,
  ChevronRight,
  AlertTriangle,
  Loader2,
  X,
  Ticket,
  Bot,
  UserCheck,
} from 'lucide-react';

const TicketLifecycleDetailChart = lazy(() => import('./components/charts/TicketLifecycleDetailChart'));
const SLAComplianceChart = lazy(() => import('./components/charts/SLAComplianceChart'));

const ChartFallback: React.FC = () => (
  <div className="h-full flex items-center justify-center text-tertiary">
    <Loader2 className="w-5 h-5 animate-spin text-accent" />
  </div>
);

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
  high: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  medium: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  low: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
};

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();

  const isAdmin = currentUser.role === 'Administrator';
  const isAuthorized = isAdmin || currentUser.role === 'Agent';

  const {
    month,
    year,
    setMonth,
    setYear,
    activeFilter,
    clearFilter,
    ticketTimeline,
    analytics,
    timelinesLoading,
    timelinesError,
    incidentQueue,
    recentActivity,
    adminKPIs,
    kpisLoading,
    kpisError,
    refresh,
  } = useAdminDashboard(isAdmin);

  const goToTickets = useCallback((qs: string) => navigate(`/admin/tickets${qs}`), [navigate]);
  const goToSlaTickets = useCallback((filter: string) => goToTickets(`?sla=${filter}`), [goToTickets]);
  const filterActive = (label: string) => activeFilter?.label === label;

  if (!isAuthorized) {
    return (
      <div className="flex-1 bg-app p-8 flex flex-col items-center justify-center h-full font-sans">
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-4">
          <AlertOctagon className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-sm font-bold text-primary">Administrative Security Shield</h2>
        <p className="text-xs text-tertiary mt-2 max-w-sm text-center leading-relaxed">
          Access denied. This console requires Administrator authorization credentials.
        </p>
      </div>
    );
  }

  // Derived merged values (prefer backend adminKPIs where available).
  const validKpiValue = (value: number | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  const orgMTTR = validKpiValue(adminKPIs?.orgMttrHours);
  const orgFCR = validKpiValue(adminKPIs?.orgFcrRate);
  const orgCSAT = validKpiValue(adminKPIs?.orgCsatScore);
  const richKpisAvailable = adminKPIs !== null && isAdmin;
  const kpiLoading = isAdmin && kpisLoading && !adminKPIs;

  const trendEmpty = !ticketTimeline || (ticketTimeline.created.every(p => p.value === 0) && ticketTimeline.resolved.every(p => p.value === 0));
  const totalFor = (key: string) => analytics?.totals[key] ?? 0;
  const resolvedTotal = totalFor('resolved') + totalFor('closed');
  const hasResolvedTickets = resolvedTotal > 0;
  const selectedMonthLabel = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });
  const slaItems = analytics?.slaByPriority || [];
  const slaWithin = slaItems.reduce((sum, item) => sum + item.withinSla, 0);
  const slaBreached = slaItems.reduce((sum, item) => sum + item.breached, 0);
  const slaActive = slaItems.reduce((sum, item) => sum + item.active, 0);
  const slaResolved = slaWithin + slaBreached;
  const slaCompliance = slaResolved ? Math.round((slaWithin / slaResolved) * 100) : 0;

  return (
    <div id="admin-command-center" className="flex-1 bg-app p-8 overflow-y-auto h-full font-sans">

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-tertiary flex items-center gap-1.5 font-semibold">
            <Activity className="w-3.5 h-3.5 text-rose-500" />
            <span>Executive Command Center</span>
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight">System Administration</h1>
          <p className="text-xs text-secondary">
            Monitor organizational resolution quality, satisfaction, and the live incident queue.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="p-2 bg-card-solid border border-token rounded-lg text-secondary font-mono flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Sys Uptime: 99.98%</span>
          </div>
        </div>
      </div>

      {/* Organizational Overview KPI Row */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-semibold">Organizational Overview</span>
          </div>
          {isAdmin && kpisLoading && (
            <span className="text-[9px] text-tertiary flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Refreshing
            </span>
          )}
          {!kpisLoading && adminKPIs && isAdmin && (
            <button
              onClick={refresh}
              className="text-[9px] text-tertiary hover-text flex items-center gap-1 transition-colors"
            >
              <RefreshCcw className="w-3 h-3" /> Refresh
            </button>
          )}
        </div>
        {kpisError && (
          <div className="mb-3 p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg flex items-center gap-2 text-[10px] text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Unable to refresh live org metrics — showing available data. {kpisError}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard
            label="Mean Time To Resolve"
            icon={<Timer className="w-3.5 h-3.5 text-sky-400" />}
            value={orgMTTR !== null ? `${orgMTTR} hr` : '—'}
            valueClass="text-sky-400"
            sublabel={richKpisAvailable ? 'Org-wide average resolution time' : 'Calculating…'}
            loading={kpiLoading}
            isActive={filterActive('Mean Time To Resolve')}
            onClick={() => goToTickets('?status=resolved')}
            onOpen={() => goToTickets('?status=resolved')}
          />
          <KpiCard
            label="First Contact Resolution"
            icon={<Target className="w-3.5 h-3.5 text-green-400" />}
            value={orgFCR !== null ? `${orgFCR}%` : '--'}
            valueClass="text-green-400"
            sublabel={richKpisAvailable ? 'Resolved on first contact' : 'Pending data'}
            loading={kpiLoading}
            isActive={filterActive('First Contact Resolution')}
            onClick={() => goToTickets('?status=resolved')}
            onOpen={() => goToTickets('?status=resolved')}
          />
          <KpiCard
            label="User Satisfaction (CSAT)"
            icon={<Smile className="w-3.5 h-3.5 text-emerald-400" />}
            value={orgCSAT !== null ? `${orgCSAT}%` : '--'}
            valueClass="text-emerald-400"
            sublabel={richKpisAvailable ? 'Derived satisfaction index' : 'Pending data'}
            loading={kpiLoading}
            isActive={filterActive('User Satisfaction (CSAT)')}
            onClick={() => goToTickets('?status=resolved')}
            onOpen={() => goToTickets('?status=resolved')}
          />
        </div>
      </div>

      {/* Analytics & Trends */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-3.5 h-3.5 text-accent" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-semibold">Analytics &amp; Trends</span>
        </div>
        <div className="flex items-center gap-3">
          {activeFilter && (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-accent-soft border border-token rounded-lg">
              <span className="text-[9px] font-mono uppercase text-accent">Viewing: {activeFilter.label}</span>
              <button
                onClick={clearFilter}
                aria-label="Clear filter"
                className="text-accent hover-text transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <label className="flex items-center gap-2 text-[9px] font-mono uppercase text-tertiary">
            Month
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="bg-input border border-token rounded-lg px-2 py-1.5 text-[10px] text-secondary outline-none"
              aria-label="Analytics month"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map(value => (
                <option key={value} value={value}>{new Date(2000, value - 1, 1).toLocaleString('en-US', { month: 'short' })}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[9px] font-mono uppercase text-tertiary">
            Year
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="bg-input border border-token rounded-lg px-2 py-1.5 text-[10px] text-secondary outline-none"
              aria-label="Analytics year"
            >
              {Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - 2 + index).map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={refresh}
            disabled={timelinesLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-token bg-card-solid px-2.5 py-1.5 text-[10px] font-medium text-secondary transition-all hover-elev hover-text disabled:opacity-50"
            aria-label="Refresh analytics"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${timelinesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-4 mb-8">
        <ChartPanel
          className="h-full rounded-2xl p-4 shadow-lg transition-shadow hover:shadow-xl flex flex-col"
          title="Ticket Volume Lifecycle"
          description={`Created, resolved, and in-progress tickets during ${selectedMonthLabel} ${year}`}
          loading={timelinesLoading && !ticketTimeline}
          error={timelinesError}
          empty={!timelinesLoading && trendEmpty}
          contentClassName="mt-4 flex-1 min-h-0 flex flex-col"
        >
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {[
              { label: 'Created Tickets', key: 'totalCreated', icon: <Ticket className="w-4 h-4" />, color: 'text-sky-400', border: 'border-sky-400/25' },
              { label: 'Resolved by AI Copilot', key: 'aiResolved', icon: <Bot className="w-4 h-4" />, color: 'text-violet-400', border: 'border-violet-400/25' },
              { label: 'Resolved by IT Agents', key: 'agentResolved', icon: <UserCheck className="w-4 h-4" />, color: 'text-cyan-400', border: 'border-cyan-400/25' },
              { label: 'Currently In Progress', key: 'inProgress', icon: <Activity className="w-4 h-4" />, color: 'text-amber-400', border: 'border-amber-400/25' },
            ].map(metric => (
              <button
                key={metric.key}
                type="button"
                onClick={() => goToTickets(
                  metric.key === 'inProgress'
                    ? '?status=in_progress'
                    : metric.key === 'totalCreated' ? '' : '?status=resolved'
                )}
                className={`text-left bg-card-solid border ${metric.border} rounded-2xl p-3 transition-transform hover:-translate-y-0.5 hover:shadow-lg cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50`}
                title={`Open ${metric.label.toLowerCase()}`}
              >
                <div className={`flex items-center gap-2 ${metric.color}`}>
                  {metric.icon}
                  <span className="text-[9px] font-mono uppercase tracking-wide text-tertiary">{metric.label}</span>
                </div>
                <div className={`text-[28px] leading-none font-bold mt-2 ${metric.color}`}>
                  {timelinesLoading && !analytics ? '—' : totalFor(metric.key)}
                </div>
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            <Suspense fallback={<ChartFallback />}>
              <TicketLifecycleDetailChart data={ticketTimeline} />
            </Suspense>
          </div>
        </ChartPanel>

        <ChartPanel
          className="rounded-2xl p-4 shadow-lg transition-shadow hover:shadow-xl"
          title="SLA Compliance"
          description="Resolved tickets compared with configured service targets"
          loading={timelinesLoading && !analytics}
          error={timelinesError}
          empty={!timelinesLoading && !hasResolvedTickets}
          emptyMessage="No resolved tickets found for the selected period."
          contentClassName="mt-4"
        >
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {[
              { label: 'Overall Compliance', value: `${slaCompliance}%`, color: 'text-emerald-400', filter: 'resolved' },
              { label: 'Within SLA', value: slaWithin, color: 'text-emerald-400', filter: 'within' },
              { label: 'SLA Breached', value: slaBreached, color: 'text-rose-400', filter: 'breached' },
              { label: 'Active SLA Tickets', value: slaActive, color: 'text-amber-400', filter: 'active' },
            ].map(metric => (
              <button
                key={metric.label}
                type="button"
                onClick={() => goToSlaTickets(metric.filter)}
                className="text-left bg-card-solid border border-token rounded-2xl p-3 transition-transform hover:-translate-y-0.5 hover:shadow-lg cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
                title={`Open ${metric.label.toLowerCase()}`}
              >
                <span className="block text-[9px] font-mono uppercase tracking-wide text-tertiary">{metric.label}</span>
                <span className={`block text-xl font-bold mt-1 ${metric.color}`}>{metric.value}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4" aria-label="SLA target reference">
            {[
              { priority: 'Critical', first: '15m', resolution: '4h', color: 'text-rose-400' },
              { priority: 'High', first: '30m', resolution: '8h', color: 'text-amber-400' },
              { priority: 'Medium', first: '2h', resolution: '24h', color: 'text-sky-400' },
              { priority: 'Low', first: '4h', resolution: '72h', color: 'text-emerald-400' },
            ].map(target => (
              <div key={target.priority} className="rounded-xl border border-token bg-card-solid px-3 py-2.5">
                <span className={`block text-[10px] font-semibold ${target.color}`}>{target.priority}</span>
                <span className="mt-1 block text-[9px] text-tertiary">First response <strong className="text-secondary">{target.first}</strong></span>
                <span className="block text-[9px] text-tertiary">Resolution <strong className="text-secondary">{target.resolution}</strong></span>
              </div>
            ))}
          </div>
          <div className="h-[470px]">
            <Suspense fallback={<ChartFallback />}>
              <SLAComplianceChart data={slaItems} />
            </Suspense>
          </div>
        </ChartPanel>
      </div>

      {/* Incident Service Queue (replaces pending user requests) */}
      <div className="bg-card border border-token p-5 rounded-2xl mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-primary">Incident Service Queue</h3>
            {incidentQueue.length > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] font-mono text-amber-400 font-semibold">
                {incidentQueue.length} ACTIVE
              </span>
            )}
          </div>
          <button
            onClick={() => goToTickets('?status=open')}
            className="text-[9px] text-tertiary hover-text flex items-center gap-1 transition-colors"
          >
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {incidentQueue.length === 0 ? (
          <div className="p-6 bg-card-solid border border-token rounded-xl text-center">
            <Inbox className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-xs text-tertiary">Queue is clear. No open or in-progress incidents.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidentQueue.map(item => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/tickets/${item.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/admin/tickets/${item.id}`);
                  }
                }}
                className="p-3.5 bg-card-solid border border-token rounded-xl flex items-center justify-between gap-4 cursor-pointer hover-elev hover-border transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`px-2 py-0.5 rounded border text-[8px] font-mono uppercase font-semibold shrink-0 ${PRIORITY_BADGE[item.priority] || 'bg-card border-token text-secondary'}`}>
                    {item.priority}
                  </span>
                  <div className="min-w-0">
                    <h5 className="text-[11px] font-bold text-primary truncate">
                      <span className="font-mono text-tertiary">{item.ticketNumber}</span> · {item.title}
                    </h5>
                    <p className="text-[10px] text-tertiary truncate">Requested by {item.requester}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="block text-[9px] font-mono text-secondary">{STATUS_LABEL[item.status] || item.status}</span>
                    <span className="text-[8px] font-mono text-tertiary">{item.updatedLabel}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-tertiary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-card border border-token p-5 rounded-2xl">
          <h3 className="text-xs font-semibold text-primary mb-4">Live System Event Log</h3>
          {recentActivity.length === 0 ? (
            <div className="p-6 bg-card-solid border border-token rounded-xl text-center text-[10px] text-tertiary">
              No recent ticket activity to display.
            </div>
          ) : (
            <div className="space-y-3.5">
              {recentActivity.map(evt => (
                <div
                  key={evt.id}
                  className="p-3.5 bg-card-solid border border-token rounded-xl flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg border text-[9px] font-mono shrink-0 ${
                      evt.type === 'ai'
                        ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                        : evt.type === 'create'
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                        : evt.type === 'publish'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-card border-token text-secondary'
                    }`}>
                      {evt.type.toUpperCase()}
                    </div>
                    <div>
                      <h5 className="text-[11px] font-bold text-primary">{evt.actor}</h5>
                      <p className="text-xs text-secondary mt-0.5">{evt.action}</p>
                    </div>
                  </div>
                  <span className="text-[9px] text-tertiary font-mono shrink-0 mt-0.5">{evt.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-token p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-primary">System Integrations</h3>
            <p className="text-[10px] text-tertiary mb-6">Database, directory, and pipeline synchronization indicators</p>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-card-solid border border-token rounded-xl flex items-center justify-between">
              <div>
                <span className="block text-[10px] font-semibold text-primary">Corporate AD / Okta SSO</span>
                <span className="text-[8px] font-mono text-tertiary">Scheduled sync task</span>
              </div>
              <span className="text-[9px] font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded font-semibold">ONLINE</span>
            </div>
            <div className="p-3 bg-card-solid border border-token rounded-xl flex items-center justify-between">
              <div>
                <span className="block text-[10px] font-semibold text-primary">Local SQLite DB Replica</span>
                <span className="text-[8px] font-mono text-tertiary">Persistent storage index</span>
              </div>
              <span className="text-[9px] font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded font-semibold">SYNCHRONIZED</span>
            </div>
            <div className="p-3 bg-card-solid border border-token rounded-xl flex items-center justify-between">
              <div>
                <span className="block text-[10px] font-semibold text-primary">FAISS Search Vector Store</span>
                <span className="text-[8px] font-mono text-tertiary">RAG embedding index node</span>
              </div>
              <span className="text-[9px] font-mono text-accent bg-accent-soft px-2 py-0.5 rounded font-semibold">5 EMBEDDINGS</span>
            </div>
          </div>
          <div className="p-3 bg-accent-soft border border-token rounded-lg text-[9px] text-secondary flex items-center gap-2 mt-4">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Database instances and vectors are healthy.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
