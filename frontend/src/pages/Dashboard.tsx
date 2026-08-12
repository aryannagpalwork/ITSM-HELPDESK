import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../shared/AppContext';
import { 
  Sparkles, 
  Plus, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  ChevronRight, 
  BookOpen, 
  Search,
  Check,
  User,
  Activity,
  ArrowUpRight,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TicketPriority, TicketStatus } from '../shared/types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, tickets, createTicket, stats, loadTickets } = useApp();

  // Auto-refresh tickets every 30 seconds so resolved tickets are reflected
  // without requiring a manual page reload (e.g. when an agent resolves a ticket).
  useEffect(() => {
    const interval = setInterval(() => {
      loadTickets();
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Create Ticket State (Modal form)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium');

  const filteredUserTickets = currentUser.role === 'Employee'
    ? tickets.filter(t => t.userId === currentUser.id)
    : tickets;

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    await createTicket({
      title: newTitle,
      description: newDesc,
      priority: newPriority,
      aiSummary: `AI Summary: Corporate employee requested assistance for: ${newTitle}. Suggested Priority: ${newPriority}. Escalated to level 1 engineering queue.`,
      suggestedResolution: `Recommended Resolution Steps: 1. Review standard procedures for similar incidents. 2. Verify active directories. 3. Reach out to department lead to coordinate diagnostic tasks.`
    });

    setNewTitle('');
    setNewDesc('');
    setNewPriority('medium');
    setIsCreateOpen(false);
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

  const areaData = stats.dailyTicketVolume;

  const priorityDistributionData = [
    { name: 'Low', count: stats.ticketsByPriority.low, color: '#3b82f6' },
    { name: 'Medium', count: stats.ticketsByPriority.medium, color: '#f59e0b' },
    { name: 'High', count: stats.ticketsByPriority.high, color: '#f97316' },
    { name: 'Critical', count: stats.ticketsByPriority.critical, color: '#f43f5e' },
  ];

  return (
    <div id="dashboard-container" className="flex-1 bg-zinc-950 p-8 overflow-y-auto h-screen font-sans">
      
      {/* Title & Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center space-x-2 text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-semibold mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span>Workspace Overview</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {currentUser.role === 'Employee' ? 'Employee Portal' : 'Service Desk Command'}
          </h1>
          <p className="text-xs text-zinc-400">
            {currentUser.role === 'Employee' 
              ? `Welcome back, ${currentUser.name}. Track your corporate tickets or consult our AI helpdesk.` 
              : `Operational snapshot for ${currentUser.name} as IT Service ${currentUser.role}.`
            }
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/chat')}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-indigo-400 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chat with AI Copilot</span>
          </button>
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/10 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New IT Request</span>
          </button>
        </div>
      </div>

      {/* Stats Cards (Interactive Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {currentUser.role === 'Employee' ? (
          <>
            <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-zinc-500">Your Tickets</span>
              <h2 className="text-2xl font-bold text-white mt-1.5">{filteredUserTickets.length}</h2>
              <div className="flex items-center space-x-2 text-[10px] text-zinc-400 mt-2">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>Active request history</span>
              </div>
            </div>
            <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-zinc-500">Open Audits</span>
              <h2 className="text-2xl font-bold text-emerald-400 mt-1.5">
                {filteredUserTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length}
              </h2>
              <div className="flex items-center space-x-2 text-[10px] text-zinc-400 mt-2">
                <AlertCircle className="w-3 h-3 text-emerald-500" />
                <span>Awaiting resolution support</span>
              </div>
            </div>
            <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-zinc-500">Resolved Requests</span>
              <h2 className="text-2xl font-bold text-sky-400 mt-1.5">
                {filteredUserTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}
              </h2>
              <div className="flex items-center space-x-2 text-[10px] text-zinc-400 mt-2">
                <CheckCircle2 className="w-3 h-3 text-sky-500" />
                <span>Completed by service agent</span>
              </div>
            </div>
            <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-500">Knowledge Search</span>
                <p className="text-xs text-zinc-400 mt-1.5">Looking for instant solutions?</p>
              </div>
              <button 
                onClick={() => navigate('/kb')}
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 mt-3 text-left"
              >
                <span>Browse IT Library</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-zinc-400">Total Incidents</span>
              <h2 className="text-2xl font-bold text-white mt-1">{stats.totalTickets}</h2>
              <p className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">+12%</span> volume this week
              </p>
            </div>
            <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-zinc-400">Awaiting Support</span>
              <h2 className="text-2xl font-bold text-amber-500 mt-1">{stats.openTickets + stats.ticketsByStatus.in_progress}</h2>
              <p className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>Avg. response time: 2.1m</span>
              </p>
            </div>
            <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-zinc-400">Mean Time to Resolve</span>
              <h2 className="text-2xl font-bold text-sky-400 mt-1">14.5 hr</h2>
              <p className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1">
                <Check className="w-3 h-3 text-sky-400" />
                <span>94.2% SLA compliance</span>
              </p>
            </div>
            <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-zinc-400">AI Copilot Utility</span>
              <h2 className="text-2xl font-bold text-indigo-400 mt-1">{stats.aiAccuracyRate}%</h2>
              <p className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>{stats.kbUsageCount} KB articles retrieved</span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Analytics Charts section (Only shown to Agent/Admin for high-fidelity dashboards) */}
      {currentUser.role !== 'Employee' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Ticket Volume Over Time */}
          <div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-semibold text-white">Ticket Volume Lifecycle</h3>
                <p className="text-[10px] text-zinc-500">Weekly ticket logs and resolution statistics</p>
              </div>
              <div className="flex items-center space-x-3 text-[10px] font-mono">
                <div className="flex items-center space-x-1">
                  <div className="w-2.5 h-2.5 rounded bg-indigo-500" />
                  <span className="text-zinc-400">Created</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
                  <span className="text-zinc-400">Resolved</span>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    labelStyle={{ color: '#a1a1aa', fontSize: '10px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="created" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCreated)" />
                  <Area type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Priority Distribution Bar Chart */}
          <div className="bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-semibold text-white">Incident Severity Distribution</h3>
              <p className="text-[10px] text-zinc-500 mb-6">Distribution of tickets across standard priorities</p>
            </div>
            <div className="h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityDistributionData}>
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {priorityDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-4 text-center">
              {priorityDistributionData.map((d, i) => (
                <div key={i} className="p-2 bg-zinc-900/40 border border-zinc-800/40 rounded-lg">
                  <div className="text-[10px] font-semibold text-white">{d.count}</div>
                  <div className="text-[8px] font-mono uppercase text-zinc-500 mt-0.5">{d.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Layout Block: Ticket List & Guidelines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ticket List Queue */}
        <div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold text-white">
                {currentUser.role === 'Employee' ? 'Your Ticket Activity Log' : 'Incident Service Queue'}
              </h3>
              <p className="text-[10px] text-zinc-500">Showing {filteredUserTickets.length} support records</p>
            </div>
            <button 
              onClick={() => navigate('/tickets')}
              className="text-[10px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
            >
              <span>View Full Queue</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {filteredUserTickets.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-800 rounded-xl text-center">
              <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <h4 className="text-xs font-semibold text-zinc-300">No Incidents Filed</h4>
              <p className="text-[10px] text-zinc-500 max-w-sm mx-auto mt-1">Everything is running smoothly! If you require any IT help, click on 'New IT Request' above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUserTickets.slice(0, 4).map(ticket => (
                <div 
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className="p-4 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl flex items-center justify-between transition-all group cursor-pointer"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="flex items-center space-x-2.5 mb-1.5 flex-wrap gap-y-1">
                      <span className="text-[10px] font-mono text-zinc-500 font-semibold">{ticket.ticketNumber || ticket.id}</span>
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${getPriorityBadgeColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${getStatusBadgeColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      {ticket.assignedTeam && (
                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {ticket.assignedTeam}
                        </span>
                      )}
                      {ticket.aiAnalysisPriority && (
                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          AI: {ticket.aiAnalysisPriority}
                        </span>
                      )}
                      {ticket.aiAnalysisEstimatedSla && (
                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-green-500/10 text-green-300 border border-green-500/20">
                          SLA: {ticket.aiAnalysisEstimatedSla}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate transition-colors">
                      {ticket.title}
                    </h4>
                    <p className="text-[10px] text-zinc-500 truncate mt-1">
                      Requested by {ticket.userName} • Updated {new Date(ticket.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar: Quick Actions & Copilot Recommendations */}
        <div className="space-y-6">
          {/* Quick AI Prompts Card */}
          <div className="bg-gradient-to-br from-indigo-950/40 to-zinc-900/40 border border-indigo-500/10 p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center space-x-2.5 mb-3 text-indigo-400">
              <Sparkles className="w-4.5 h-4.5" />
              <h4 className="text-xs font-semibold">ITSM Copilot Assistant</h4>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed mb-4">
              Need immediate help resolving connection, credential, or network hardware issues? Ask the AI Copilot to guide you or draft solutions.
            </p>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  navigate('/chat', { state: { initialPrompt: "How do I reset my corporate Okta password if my account gets locked out?" } });
                }}
                className="w-full text-left p-2.5 bg-zinc-950/60 hover:bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center justify-between"
              >
                <span>"Reset Okta Corporate Password"</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-500 shrink-0" />
              </button>
              <button 
                onClick={() => {
                  navigate('/chat', { state: { initialPrompt: "What is the secure SSID and root certificate details for office Wi-Fi?" } });
                }}
                className="w-full text-left p-2.5 bg-zinc-950/60 hover:bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center justify-between"
              >
                <span>"Setup Enterprise Wi-Fi settings"</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-500 shrink-0" />
              </button>
            </div>
          </div>

          {/* Quick KB Library Links */}
          <div className="bg-zinc-900/30 border border-zinc-900 p-5 rounded-2xl">
            <div className="flex items-center space-x-2.5 mb-3 text-zinc-400">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-semibold">Featured IT Articles</h4>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed mb-4">
              Browse pre-approved systems articles, compliance handbooks, and upgrade guidelines.
            </p>
            <div className="space-y-2">
              <div 
                onClick={() => navigate('/kb')}
                className="p-2.5 bg-zinc-900/60 hover:bg-zinc-900 rounded-lg border border-zinc-800/60 flex items-center justify-between cursor-pointer group"
              >
                <div className="min-w-0 pr-3">
                  <h5 className="text-[10px] font-semibold text-zinc-300 group-hover:text-white truncate">Palo Alto VPN Configuration</h5>
                  <span className="text-[8px] font-mono text-zinc-500">Category: Network</span>
                </div>
                <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
              </div>
              <div 
                onClick={() => navigate('/kb')}
                className="p-2.5 bg-zinc-900/60 hover:bg-zinc-900 rounded-lg border border-zinc-800/60 flex items-center justify-between cursor-pointer group"
              >
                <div className="min-w-0 pr-3">
                  <h5 className="text-[10px] font-semibold text-zinc-300 group-hover:text-white truncate">Mobile Outlook Intune MDM</h5>
                  <span className="text-[8px] font-mono text-zinc-500">Category: Software</span>
                </div>
                <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* New Request Modal (Popup Wizard) */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Plus className="w-4.5 h-4.5 text-indigo-400" />
              Create IT Incident Record
            </h3>
            <p className="text-[11px] text-zinc-400 mb-6">File a ticket into our service desk. An AI specialist will analyze severity, tag tags, and formulate draft summaries immediately.</p>
            
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Incident Headline / Summary</label>
                <input 
                  type="text" 
                  placeholder="e.g., Cannot authenticate via Okta on Macbook laptop"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Full Technical Description</label>
                <textarea 
                  placeholder="Explain what happened, what device you are running, and what debugging steps you have tried..."
                  rows={4}
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Estimated Business Impact</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map(prio => (
                    <button
                      key={prio}
                      type="button"
                      onClick={() => setNewPriority(prio)}
                      className={`py-2 text-[10px] font-medium rounded-lg capitalize border transition-all ${
                        newPriority === prio
                          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500'
                          : 'bg-zinc-950 text-zinc-500 border-zinc-800/80 hover:text-zinc-300'
                      }`}
                    >
                      {prio}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-md shadow-indigo-600/10"
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
