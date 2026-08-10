import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../shared/AppContext';
import { TicketPriority, TicketStatus } from '../shared/types';
import { 
  Search, 
  Filter, 
  ChevronRight, 
  Plus, 
  AlertCircle,
  SlidersHorizontal,
  Clock,
  UserCircle2,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';

export const TicketDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tickets, currentUser, createTicket, loadTickets, ticketsLoading, ticketsError } = useApp();

  // Role-aware ticket-detail base path so each role opens the record inside its
  // own layout (matching the admin Incident Service Queue navigation) instead of
  // being redirected to the Employee area.
  const detailBasePath =
    currentUser.role === 'Administrator'
      ? '/admin/tickets'
      : currentUser.role === 'Agent'
        ? '/agent/tickets'
        : '/tickets';

  // Search & Filter State — initialized from URL params so admin KPI card
  // deep-links (e.g. /admin/tickets?status=resolved) land pre-filtered.
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') ?? 'all');
  const [priorityFilter, setPriorityFilter] = useState<string>(() => searchParams.get('priority') ?? 'all');
  const [slaFilter] = useState<string>(() => searchParams.get('sla') ?? 'all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const ticketView = searchParams.get('view') ?? 'all';

  const isSameDay = (value?: string) => {
    if (!value) return false;
    const date = new Date(value);
    const today = new Date();
    return !Number.isNaN(date.getTime()) && date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  };

  const isBreached = (ticket: typeof tickets[number]) => {
    if (ticket.slaBreached === true || ticket.slaStatus === 'Breached') return true;
    if (typeof ticket.slaRemainingHours === 'number' && ticket.slaRemainingHours <= 0) return true;
    if (!ticket.slaDueAt) return false;
    const dueAt = new Date(ticket.slaDueAt).getTime();
    return !Number.isNaN(dueAt) && dueAt <= Date.now();
  };

  // Keep the visible controls in sync when a dashboard stepper changes only
  // the URL while this queue page is already mounted.
  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setStatusFilter(searchParams.get('status') ?? 'all');
    setPriorityFilter(searchParams.get('priority') ?? 'all');
  }, [searchParams]);

  // New Request Form State (within dashboard)
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');

  useEffect(() => {
    loadTickets({
      search,
      // The completed overview includes both Resolved and Closed tickets,
      // matching the KPI cards. Load the full queue for that view so Closed
      // records are not removed by the API status filter.
      status: ticketView === 'resolved' ? 'all' : statusFilter,
      priority: priorityFilter,
      sortBy,
    });
  }, [search, statusFilter, priorityFilter, sortBy, ticketView]);

  // Filter logic
  const filteredTickets = tickets.filter(ticket => {
    // Employee ownership is enforced by the backend ticket-list endpoint.
    // Do not apply a second client-side ID comparison here: legacy AI-resolved
    // tickets may be owned through their AI conversation link instead of the
    // original created_by field.

    // Search query match
    const ticketDisplayId = ticket.ticketNumber || ticket.id;
    const matchesSearch = 
      ticketDisplayId.toLowerCase().includes(search.toLowerCase()) ||
      ticket.title.toLowerCase().includes(search.toLowerCase()) ||
      ticket.description.toLowerCase().includes(search.toLowerCase()) ||
      (ticket.userName && ticket.userName.toLowerCase().includes(search.toLowerCase()));

    // Status filter match
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'resolved_ai' ? ticket.aiResolved === true : ticket.status === statusFilter);

    // Priority filter match
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

    const ticketText = `${ticket.title} ${ticket.description} ${ticket.category || ''}`.toLowerCase();
    const awaitingResponse = ticket.awaitingCustomerResponse === true
      || /customer|response|reply|wait(?:ing|ed)|detail required|information needed|input needed/.test(ticketText);
    const matchesView = (() => {
      if (ticketView === 'awaiting-response') {
        return ticket.status === 'awaiting_user_response'
          || ((ticket.status === 'open' || ticket.status === 'in_progress') && awaitingResponse);
      }
      if (ticketView === 'submitted') {
        return ticket.status === 'open' && !awaitingResponse;
      }
      if (ticketView === 'assigned-open') {
        return ticket.status === 'open' || ticket.status === 'in_progress';
      }
      if (ticketView === 'sla-due-today') {
        return isSameDay(ticket.slaDueAt) && isBreached(ticket);
      }
      if (ticketView === 'resolved') {
        return ticket.status === 'resolved' || ticket.status === 'closed';
      }
      return true;
    })();

    const matchesSla = (() => {
      if (slaFilter === 'all') return true;
      if (slaFilter === 'resolved') return ticket.status === 'resolved' || ticket.status === 'closed';
      if (slaFilter === 'within') return ticket.slaStatus === 'Within SLA' || ticket.slaCompliant === true;
      if (slaFilter === 'breached') return ticket.slaBreached === true || ticket.slaStatus === 'Breached';
      if (slaFilter === 'active') return ticket.slaStatus === 'Active';
      if (slaFilter === 'near_breach') return ticket.slaStatus === 'Near Breach';
      return true;
    })();

    return matchesSearch && matchesStatus && matchesPriority && matchesSla && matchesView;
  });

  // Sort logic
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortBy === 'priority') {
      const weight = { critical: 4, high: 3, medium: 2, low: 1 };
      return weight[b.priority] - weight[a.priority];
    }
    return 0;
  });

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !desc.trim()) return;

    await createTicket({
      title,
      description: desc,
      priority,
      aiSummary: `AI Summary: Support incident created manually from ticket workspace. Title: "${title}". Initial Severity Level predicted: ${priority.toUpperCase()}. Escalated automatically to IT dispatch.`,
      suggestedResolution: `Predicted Resolution SOP: 1. Fetch relevant diagnostic logs. 2. Verify account status on identity controller. 3. Resolve incident using typical Level-1 support procedures.`
    });

    setTitle('');
    setDesc('');
    setPriority('medium');
    setIsOpen(false);
  };

  const getPriorityStyle = (prio: TicketPriority) => {
    switch (prio) {
      case 'low': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      case 'critical': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    }
  };

  const getStatusStyle = (status: TicketStatus) => {
    switch (status) {
      case 'open': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'in_progress': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'awaiting_user_response': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'resolved': return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
      case 'closed': return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
    }
  };

  return (
    <div id="tickets-workspace" className="flex-1 bg-app p-8 overflow-y-auto h-full font-sans">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-tertiary">Service Desk Queue</span>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Support Incidents</h1>
          <p className="text-xs text-secondary mt-1">
            {currentUser.role === 'Employee' 
              ? 'Monitor progress and diagnostic records for your filed IT issues.'
              : 'Enterprise triage workstation. Search, analyze, and dispatch active tickets.'
            }
          </p>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 accent-btn rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg cursor-pointer self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Support Ticket</span>
        </button>
      </div>

      {/* Queue Filter Panel */}
      <div className="bg-card border border-token rounded-2xl p-4 mb-6 backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Text Search */}
          <div className="relative flex items-center">
            <input 
              id="ticket-search"
              name="ticketSearch"
              type="text" 
              placeholder="Search by ID, title, requester..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full input-token rounded-lg pl-9 pr-3 py-2 text-xs outline-none transition-all"
            />
            <Search className="absolute left-3 w-3.5 h-3.5 text-tertiary" />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2 bg-input border border-token rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-mono uppercase text-tertiary shrink-0">Status:</span>
            <select
              id="ticket-status-filter"
              name="ticketStatus"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-secondary focus:ring-0 focus:outline-none outline-none py-1 cursor-pointer"
            >
    <option value="all">All statuses</option>
    <option value="open">Open</option>
    <option value="in_progress">In Progress</option>
    <option value="awaiting_user_response">Awaiting User Response</option>
    <option value="resolved">Resolved</option>
    <option value="closed">Closed</option>
              {currentUser.role === 'Administrator' && <option value="resolved_ai">Resolved by AI</option>}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center space-x-2 bg-input border border-token rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-mono uppercase text-tertiary shrink-0">Priority:</span>
            <select
              id="ticket-priority-filter"
              name="ticketPriority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-secondary focus:ring-0 focus:outline-none outline-none py-1 cursor-pointer"
            >
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Sort By Selector */}
          <div className="flex items-center space-x-2 bg-input border border-token rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-mono uppercase text-tertiary shrink-0">Order:</span>
            <select
              id="ticket-sort-order"
              name="ticketSort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-secondary focus:ring-0 focus:outline-none outline-none py-1 cursor-pointer"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="priority">Priority: High-Low</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Grid List of Tickets */}
      {ticketsLoading ? (
        <div className="border border-token rounded-2xl p-16 text-center bg-card">
          <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-token border-t-accent animate-spin" />
          <h3 className="text-sm font-bold text-secondary">Loading incidents…</h3>
          <p className="text-xs text-tertiary mt-1">Fetching the latest ticket queue.</p>
        </div>
      ) : ticketsError ? (
        <div className="border border-rose-500/20 rounded-2xl p-10 text-center bg-card">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-secondary">Tickets could not be loaded</h3>
          <p className="text-xs text-tertiary max-w-lg mx-auto mt-1.5">{ticketsError}</p>
          <button
            type="button"
            onClick={() => loadTickets({ search, status: statusFilter, priority: priorityFilter, sortBy })}
            className="mt-4 px-3 py-2 rounded-lg accent-btn text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : sortedTickets.length === 0 ? (
        <div className="border border-dashed border-token rounded-2xl p-16 text-center bg-card">
          <AlertCircle className="w-10 h-10 text-tertiary mx-auto mb-3" />
          <h3 className="text-sm font-bold text-secondary">No Incidents Found</h3>
          <p className="text-xs text-tertiary max-w-sm mx-auto mt-1.5 leading-relaxed">
            There are no support incidents matches with the active search queries or filters. Adjust your conditions or file a fresh request above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTickets.map(ticket => (
            <div
              key={ticket.id}
              onClick={() => navigate(`${detailBasePath}/${ticket.id}`)}
              className="p-5 bg-card hover-elev border border-token hover-border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all group cursor-pointer"
            >
              {/* Left Column: ID, Priority, Status, Title, Requester */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2.5 mb-2 flex-wrap gap-y-1">
                  <span className="text-[10px] font-mono text-tertiary font-semibold">{ticket.ticketNumber || ticket.id}</span>
                  <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-md font-semibold ${getPriorityStyle(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                  <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-md font-semibold ${getStatusStyle(ticket.status)}`}>
                    {ticket.status}
                  </span>
                  {ticket.aiResolved && (
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-md font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/25">
                      Resolved by AI
                    </span>
                  )}
                  {!ticket.aiResolved && (ticket.status === 'resolved' || ticket.status === 'closed') && ticket.resolvedBy && (
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-md font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/25">
                      Resolved by {ticket.resolvedBy}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-tertiary">•</span>
                  <span className="text-[10px] text-secondary font-medium">Department: {ticket.departmentName}</span>
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

                <h3 className="text-sm font-bold text-primary transition-colors truncate">
                  {ticket.title}
                </h3>
                <p className="text-xs text-secondary mt-1.5 leading-relaxed truncate max-w-3xl">
                  {ticket.description}
                </p>
              </div>

              {/* Right Column: User Metadata & Timestamp */}
              <div className="flex items-center justify-between md:justify-end md:space-x-8 shrink-0">
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-card-solid flex items-center justify-center text-[10px] font-semibold text-secondary uppercase">
                    {ticket.userName?.split(' ').map(n => n[0]).join('') || 'U'}
                  </div>
                  <div>
                    <h5 className="text-[11px] font-semibold text-secondary">{ticket.userName}</h5>
                    <p className="text-[9px] text-tertiary font-mono">Requester</p>
                  </div>
                </div>

                <div className="text-right flex items-center space-x-4">
                  <div className="hidden sm:block">
                    <span className="block text-[11px] font-semibold text-secondary">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    <span className="block text-[9px] text-tertiary font-mono">Date Logged</span>
                  </div>
                  <ChevronRight className="w-4.5 h-4.5 text-tertiary group-hover:text-secondary transition-all shrink-0" />
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* New Request Popup Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card-solid border border-token rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
              <Plus className="w-4.5 h-4.5 text-accent" />
              File Support Request
            </h3>
            <p className="text-[11px] text-secondary mb-6">Describe your operational issue to log a service incident ticket.</p>
            
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-tertiary mb-1">Issue Headline</label>
                <input 
                  id="new-ticket-title"
                  name="title"
                  type="text" 
                  placeholder="e.g. Corporate Wi-Fi connection issues on Windows laptop"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-tertiary mb-1">Full Technical Description</label>
                <textarea 
                  id="new-ticket-description"
                  name="description"
                  placeholder="Provide details about error prompts, software versions, and what troubleshooting steps you have already attempted..."
                  rows={4}
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-tertiary mb-1">Impact Level (Priority)</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map(prio => (
                    <button
                      key={prio}
                      type="button"
                      onClick={() => setPriority(prio)}
                      className={`py-2 text-[10px] font-medium rounded-lg capitalize border transition-all ${
                        priority === prio
                          ? 'bg-accent-soft text-accent border-token-strong'
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
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-secondary hover-text bg-card border border-token cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold accent-btn cursor-pointer shadow-md"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
