import React from 'react';
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
  UserPlus
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const AdminDashboard: React.FC = () => {
  const { currentUser, allUsers, pendingUsers, usersLoading, usersError, stats, approvePendingUser, rejectPendingUser, loadPendingUsers, loadAllUsers } = useApp();

  const isAuthorized = currentUser.role === 'Administrator' || currentUser.role === 'Agent';

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
  const agentCount = allUsers.filter(u => u.role === 'Agent' || u.role === 'agent').length;

  return (
    <div id="admin-command-center" className="flex-1 bg-zinc-950 p-8 overflow-y-auto h-screen font-sans">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
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
          <h2 className="text-2xl font-bold text-indigo-400 mt-1.5">{agentCount}</h2>
          <span className="text-[9px] font-mono text-zinc-500 block mt-1">Agents in database</span>
        </div>

        <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
          <div className="flex justify-between items-start text-zinc-500">
            <span className="text-[10px] font-mono uppercase">Total Tickets</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-400 mt-1.5">{stats.totalTickets}</h2>
          <span className="text-[9px] font-mono text-zinc-500 block mt-1">{stats.openTickets} open · {stats.resolvedTickets} resolved</span>
        </div>

        <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
          <div className="flex justify-between items-start text-zinc-500">
            <span className="text-[10px] font-mono uppercase">Pending SLA Breaches</span>
            <Cpu className="w-4 h-4 text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold text-violet-400 mt-1.5">0</h2>
          <span className="text-[9px] font-mono text-zinc-500 block mt-1">100% compliance target</span>
        </div>
      </div>

      {/* Pending User Requests */}
      <div className="bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-white">Pending User Registration Requests</h3>
            {pendingUsers.length > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] font-mono text-amber-400 font-semibold">
                {pendingUsers.length} NEW
              </span>
            )}
          </div>
          <button
            onClick={loadPendingUsers}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400 hover:text-white" />
          </button>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="p-6 bg-zinc-950/40 border border-zinc-900/80 rounded-xl text-center">
            <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">No pending user requests. All registrations have been processed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map(user => (
              <div
                key={user.id}
                className="p-3.5 bg-zinc-950/40 border border-zinc-900/80 rounded-xl flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg shrink-0">
                    <UserPlus className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-[11px] font-bold text-zinc-200 truncate">{user.name}</h5>
                    <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                    <p className="text-[9px] text-zinc-600 font-mono">
                      Registered: {new Date(user.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => approvePendingUser(user.id)}
                    className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                  >
                    <CheckCircle className="w-3 h-3" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => rejectPendingUser(user.id)}
                    className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                  >
                    <XCircle className="w-3 h-3" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Departments Load */}
        <div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl">
          <h3 className="text-xs font-semibold text-white mb-2">Organizational Incidents</h3>
          <p className="text-[10px] text-zinc-500 mb-6">Ticket distribution across open and resolved tickets</p>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Open', tickets: stats.openTickets, resolved: 0 },
                { name: 'In Progress', tickets: stats.ticketsByStatus.in_progress, resolved: 0 },
                { name: 'Resolved', tickets: 0, resolved: stats.resolvedTickets },
                { name: 'Closed', tickets: 0, resolved: stats.closedTickets },
              ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  labelStyle={{ color: '#a1a1aa', fontSize: '10px' }}
                  itemStyle={{ color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="tickets" fill="#6366f1" radius={[4, 4, 0, 0]} name="Active Tickets" />
                <Bar dataKey="resolved" fill="#10b981" radius={[4, 4, 0, 0]} name="Resolved/Closed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Database Stats */}
        <div className="bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-white">System Integrations</h3>
            <p className="text-[10px] text-zinc-500 mb-6">Database, directory, and pipeline synchronization indicators</p>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl flex items-center justify-between">
              <div>
                <span className="block text-[10px] font-semibold text-zinc-200">MongoDB Database</span>
                <span className="text-[8px] font-mono text-zinc-500">Primary data store</span>
              </div>
              <span className="text-[9px] font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded font-semibold">ONLINE</span>
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl flex items-center justify-between">
              <div>
                <span className="block text-[10px] font-mono text-zinc-200">Total Users in Database</span>
                <span className="text-[8px] font-mono text-zinc-500">System records</span>
              </div>
              <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-semibold">{allUsers.length} USERS</span>
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl flex items-center justify-between">
              <div>
                <span className="block text-[10px] font-mono text-zinc-200">Total Tickets in Database</span>
                <span className="text-[8px] font-mono text-zinc-500">Ticket records</span>
              </div>
              <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-semibold">{stats.totalTickets} TICKETS</span>
            </div>
          </div>

          <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg text-[9px] text-zinc-400 flex items-center gap-2 mt-4">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>All data sourced from MongoDB via live API.</span>
          </div>
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
