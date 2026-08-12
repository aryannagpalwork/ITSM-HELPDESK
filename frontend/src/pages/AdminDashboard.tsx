import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../shared/AppContext';
import { 
  ShieldCheck, 
  Users, 
  Clock, 
  Activity, 
  AlertOctagon, 
  Cpu,
  RefreshCw,
  Sparkles,
  CheckCircle,
  XCircle,
  UserPlus,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { SystemAlert } from '../shared/types';
import { getAutoDetectedActiveAlerts } from '../shared/api';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, allUsers, pendingUsers, usersLoading, usersError, stats, approvePendingUser, rejectPendingUser, loadPendingUsers, loadAllUsers } = useApp();

  const isAuthorized = currentUser.role === 'Administrator' || currentUser.role === 'Agent';

  // Persistent Active Anomalies state & 30s polling
  const [activeAnomalies, setActiveAnomalies] = useState<SystemAlert[]>([]);
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);

  const fetchAnomalies = async () => {
    try {
      setAnomaliesLoading(true);
      const data = await getAutoDetectedActiveAlerts();
      setActiveAnomalies(data);
    } catch {
      // ignore
    } finally {
      setAnomaliesLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchAnomalies();
      const interval = setInterval(fetchAnomalies, 30000); // 30s polling
      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="flex-1 bg-zinc-950 p-8 flex flex-col items-center justify-center h-screen font-sans">
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-4">
          <AlertOctagon className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-sm font-bold text-white">Administrative Security Shield</h2>
        <p className="text-xs text-zinc-500 mt-2 max-w-sm text-center leading-relaxed">
          Access denied. This console requires **IT Service Desk Agent** or **Administrator** authorization credentials.
        </p>
      </div>
    );
  }

  // Live user stats derived from backend data
  const activeUsers = allUsers.filter(u => (u.status === 'APPROVED' || u.status === 'ACTIVE') && u.is_active);
  const inactiveUsers = allUsers.filter(u => u.status === 'INACTIVE' || u.status === 'DISABLED' || u.status === 'REJECTED' || (!u.is_active && u.status !== 'PENDING'));

  return (
    <div id="admin-command-center" className="flex-1 bg-zinc-950 p-8 overflow-y-auto h-screen font-sans">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-1.5 font-semibold">
            <Activity className="w-3.5 h-3.5 text-rose-500" />
            <span>Executive Command Center</span>
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Administration</h1>
          <p className="text-xs text-zinc-400">
            Monitor organizational SLA health, database activity, agent operations, and system events.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 font-mono flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Sys Uptime: 99.98%</span>
          </div>
        </div>
      </div>

      {/* Persistent Active Anomalies Banner */}
      <div className="mb-8 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {activeAnomalies.length > 0 ? (
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Active Category Anomalies</span>
                <span className="admin-auto-detected-badge inline-flex items-center rounded-full border border-purple-500/25 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide text-purple-200">
                  Auto-Detected ({activeAnomalies.length})
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Real-time automated ticket volume spikes requiring administrative attention. Refreshes every 30s.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchAnomalies()}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Refresh Anomalies"
            >
              <RefreshCw className={`w-4 h-4 ${anomaliesLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/alerts')}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-600/20 flex items-center gap-1.5"
            >
              <span>Manage Alerts</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {activeAnomalies.length === 0 ? (
          <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-900 text-xs text-zinc-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>System Normal: No automated ticket volume anomalies currently detected.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAnomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-purple-200">{anomaly.title}</span>
                    {anomaly.category && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold uppercase">
                        {anomaly.category}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Detected at {new Date(anomaly.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300">{anomaly.message}</p>
                  {anomaly.recommendation && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                      <span className="font-semibold text-amber-400 block text-[10px] uppercase tracking-wider mb-0.5">
                        ✨ KB Recommended Fix:
                      </span>
                      {anomaly.recommendation}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin stats widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
          <div className="flex justify-between items-start text-zinc-500">
            <span className="text-[10px] font-mono uppercase">System Users</span>
            <Users className="w-4 h-4" />
          </div>
          <h2 className="text-2xl font-bold text-white mt-1.5">{allUsers.length.toLocaleString()}</h2>
          <span className="text-[9px] font-mono text-zinc-500 block mt-1">
            {activeUsers.length} active · {inactiveUsers.length} inactive · {pendingUsers.length} pending
          </span>
        </div>

        <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
          <div className="flex justify-between items-start text-zinc-500">
            <span className="text-[10px] font-mono uppercase">Active Agents Online</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mt-1.5">{allUsers.filter(u => String(u.role).toLowerCase() === 'agent').length}</h2>
          <span className="text-[9px] font-mono text-zinc-500 block mt-1">
            IT Service Desk Team
          </span>
        </div>

        <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
          <div className="flex justify-between items-start text-zinc-500">
            <span className="text-[10px] font-mono uppercase">Pending Approval</span>
            <UserPlus className="w-4 h-4 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mt-1.5">{pendingUsers.length}</h2>
          <span className="text-[9px] font-mono text-zinc-500 block mt-1">
            Registration requests
          </span>
        </div>

        <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
          <div className="flex justify-between items-start text-zinc-500">
            <span className="text-[10px] font-mono uppercase">Total Tickets</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mt-1.5">{stats.totalTickets}</h2>
          <span className="text-[9px] font-mono text-zinc-500 block mt-1">
            {stats.openTickets} open · {stats.resolvedTickets} resolved
          </span>
        </div>
      </div>

      {/* Priority Distribution */}
      <div className="bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl">
        <h3 className="text-xs font-semibold text-white mb-4">Ticket Priority Distribution</h3>
        
        <div className="grid grid-cols-4 gap-4">
          {(['critical', 'high', 'medium', 'low'] as const).map(priority => {
            const count = stats.ticketsByPriority[priority];
            const colors: Record<string, string> = {
              critical: 'bg-red-500 text-red-100',
              high: 'bg-orange-500 text-orange-100',
              medium: 'bg-blue-500 text-blue-100',
              low: 'bg-zinc-500 text-zinc-100',
            };
            return (
              <div key={priority} className="p-4 bg-zinc-950/40 border border-zinc-900/80 rounded-xl text-center">
                <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full ${colors[priority]}`}>
                  {priority}
                </span>
                <p className="text-2xl font-bold text-white mt-2">{count}</p>
                <span className="text-[9px] text-zinc-500">tickets</span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
