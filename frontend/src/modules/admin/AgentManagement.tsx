import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertCircle, ChevronLeft, ChevronRight, CircleUserRound,
  Clock3, Edit3, Mail, Search, SlidersHorizontal, Users, X,
} from 'lucide-react';
import {
  AdminAgent, AdminAgentTicket, getAdminAgent, listAdminAgentTickets, listAdminAgents, updateUser,
} from '../../shared/api';
import { useApp } from '../../shared/AppContext';

const PAGE_SIZE = 10;
const TICKET_PAGE_SIZE = 8;

const skills = (value?: string | string[]) => Array.isArray(value) ? value : value ? [value] : [];

const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : '—';

const statusClass = (status?: string) => {
  switch (status) {
    case 'Open': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'In Progress': return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    case 'Resolved': return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
    case 'Closed': return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    default: return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  }
};

const StatCard: React.FC<{ label: string; value: number; tone?: string }> = ({ label, value, tone = 'text-primary' }) => (
  <div className="bg-card border border-token rounded-xl p-3 shadow-sm" style={{ backgroundColor: 'var(--card-bg)', opacity: 1 }}>
    <p className="text-[8px] text-tertiary font-mono uppercase tracking-wider whitespace-nowrap">{label}</p>
    <p className={`text-lg font-bold mt-1 ${tone}`}>{value}</p>
  </div>
);

export const AgentManagement: React.FC = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const isAdmin = currentUser.role === 'Administrator';
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [totalAgents, setTotalAgents] = useState(0);
  const [agentPage, setAgentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [availability, setAvailability] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ available: 0, onLeave: 0, activeTickets: 0, resolved: 0 });

  const [selectedAgent, setSelectedAgent] = useState<AdminAgent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<AdminAgentTicket[]>([]);
  const [ticketSummary, setTicketSummary] = useState<Record<string, number>>({});
  const [ticketTotal, setTicketTotal] = useState(0);
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketSort, setTicketSort] = useState('created_at');
  const [ticketSortOrder, setTicketSortOrder] = useState<'asc' | 'desc'>('desc');

  const [editModal, setEditModal] = useState<AdminAgent | null>(null);
  const [editDepartment, setEditDepartment] = useState('');
  const [editSpecializations, setEditSpecializations] = useState<string[]>([]);
  const [editSpecInput, setEditSpecInput] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminAgents({ page: agentPage, pageSize: PAGE_SIZE, search, department, specialization, availability });
      setAgents(result.items);
      setTotalAgents(result.total);
      setSummary({
        available: result.available_count,
        onLeave: result.on_leave_count,
        activeTickets: result.active_ticket_count,
        resolved: result.total_resolved,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load agents.');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [agentPage, availability, department, search, specialization]);

  useEffect(() => {
    if (isAdmin) loadAgents();
  }, [isAdmin, loadAgents]);

  useEffect(() => {
    if (!isAdmin) return;
    const refresh = () => { void loadAgents(); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [isAdmin, loadAgents]);

  useEffect(() => {
    if (!selectedAgent || !isAdmin) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    getAdminAgent(selectedAgent.id).then(agent => {
      if (!cancelled) setSelectedAgent(agent);
    }).catch(err => {
      if (!cancelled) setDetailError(err instanceof Error ? err.message : 'Unable to load agent details.');
    });
    listAdminAgentTickets(selectedAgent.id, {
      page: ticketPage, pageSize: TICKET_PAGE_SIZE, search: ticketSearch,
      sortBy: ticketSort, sortOrder: ticketSortOrder,
    }).then(result => {
      if (!cancelled) {
        setTickets(result.items);
        setTicketTotal(result.total);
        setTicketSummary(result.summary);
      }
    }).catch(err => {
      if (!cancelled) setDetailError(err instanceof Error ? err.message : 'Unable to load assigned tickets.');
    }).finally(() => {
      if (!cancelled) setDetailLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedAgent?.id, isAdmin, ticketPage, ticketSearch, ticketSort, ticketSortOrder]);

  const departments = useMemo(() => Array.from(new Set(agents.map(agent => agent.department).filter(Boolean) as string[])).sort(), [agents]);
  const specializations = useMemo(() => Array.from(new Set(agents.flatMap(agent => skills(agent.specialization)))).sort(), [agents]);
  const agentPages = Math.ceil(totalAgents / PAGE_SIZE);
  const ticketPages = Math.ceil(ticketTotal / TICKET_PAGE_SIZE);

  const openAgent = (agent: AdminAgent) => {
    setSelectedAgent(agent);
    setTickets([]);
    setTicketSummary({});
    setTicketPage(1);
    setTicketSearch('');
    setDetailError(null);
  };

  const openEditModal = (agent: AdminAgent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditModal(agent);
    setEditDepartment(agent.department || '');
    const spec = agent.specialization;
    if (Array.isArray(spec)) setEditSpecializations(spec);
    else if (typeof spec === 'string' && spec) setEditSpecializations([spec]);
    else setEditSpecializations([]);
    setEditSpecInput('');
    setEditError('');
  };

  const handleEditSubmit = async () => {
    if (!editModal) return;
    setEditLoading(true);
    setEditError('');
    try {
      await updateUser(
        editModal.id,
        undefined,
        editDepartment.trim() || undefined,
        undefined,
        editSpecializations
      );
      setEditModal(null);
      await loadAgents();
      if (selectedAgent?.id === editModal.id) {
        const refreshed = await getAdminAgent(editModal.id);
        setSelectedAgent(refreshed);
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update agent.');
    } finally {
      setEditLoading(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="flex-1 bg-app p-6 md:p-8 overflow-y-auto h-full font-sans">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-tertiary">Operations Directory</span>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Agent Management</h1>
          <p className="text-xs text-secondary mt-1">Monitor IT agent profiles, capacity, and assigned work.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-tertiary font-mono">
          <Activity className="w-3.5 h-3.5 text-accent" /> Read-only administration view
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Agents" value={totalAgents} />
        <StatCard label="Available Agents" value={summary.available} tone="text-emerald-400" />
        <StatCard label="On Approved Leave" value={summary.onLeave} tone="text-amber-400" />
        <StatCard label="Active Tickets" value={summary.activeTickets} tone="text-indigo-400" />
        <StatCard label="Total Resolved" value={summary.resolved} tone="text-sky-400" />
      </div>

      <div className="bg-card border border-token rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-wider text-secondary">
          <SlidersHorizontal className="w-3.5 h-3.5 text-accent" /> Agent Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="relative block">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-tertiary" />
            <input value={search} onChange={event => { setSearch(event.target.value); setAgentPage(1); }} placeholder="Search name or email" className="w-full input-token rounded-lg pl-9 pr-3 py-2 text-xs outline-none" />
          </label>
          <select value={department} onChange={event => { setDepartment(event.target.value); setAgentPage(1); }} className="input-token rounded-lg px-3 py-2 text-xs outline-none">
            <option value="">All departments</option>
            {departments.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={specialization} onChange={event => { setSpecialization(event.target.value); setAgentPage(1); }} className="input-token rounded-lg px-3 py-2 text-xs outline-none">
            <option value="">All specializations</option>
            {specializations.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={availability} onChange={event => { setAvailability(event.target.value); setAgentPage(1); }} className="input-token rounded-lg px-3 py-2 text-xs outline-none">
            <option value="">All availability</option>
            <option value="Available">Available</option>
            <option value="On Leave">On Leave</option>
            <option value="Offline">Offline</option>
            <option value="Busy">Busy</option>
          </select>
        </div>
      </div>

      {error && <div className="mb-5 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      <div className="bg-card border border-token rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-token flex items-center justify-between">
          <div><h2 className="text-sm font-semibold text-primary">IT Agents</h2><p className="text-[10px] text-tertiary mt-1">Select an agent to inspect assigned tickets and capacity.</p></div>
          <Users className="w-4 h-4 text-accent" />
        </div>
        {loading ? <div className="p-14 text-center text-xs text-tertiary">Loading agents…</div> : agents.length === 0 ? (
          <div className="p-14 text-center"><CircleUserRound className="w-9 h-9 text-tertiary mx-auto mb-3" /><p className="text-xs text-secondary">No agents match the current filters.</p></div>
        ) : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-token text-[9px] font-mono uppercase tracking-wider text-tertiary"><th className="p-4">Agent</th><th className="p-4">Department</th><th className="p-4">Specialization</th><th className="p-4">Availability</th><th className="p-4">Capacity</th><th className="p-4">Assigned</th><th className="p-4">Resolved</th></tr></thead><tbody>
          {agents.map(agent => <tr key={agent.id} onClick={() => openAgent(agent)} className="border-b border-token last:border-0 hover-surface cursor-pointer"><td className="p-4"><p className="text-xs font-semibold text-primary">{agent.full_name}</p><p className="text-[10px] text-tertiary">{agent.email}</p></td><td className="p-4 text-xs text-secondary">{agent.department || '—'}</td><td className="p-4"><div className="flex flex-wrap gap-1">{skills(agent.specialization).length ? skills(agent.specialization).map(skill => <span key={skill} className="text-[9px] px-2 py-1 rounded-full bg-accent-soft text-accent border border-token">{skill}</span>) : <span className="text-xs text-tertiary">General</span>}</div></td><td className="p-4"><span className="text-[10px] text-secondary">{agent.availability || 'Available'}</span></td><td className="p-4 text-xs text-secondary">{agent.active_ticket_count} / {agent.max_capacity}</td><td className="p-4 text-xs text-secondary">{agent.total_assigned}</td><td className="p-4 text-xs text-secondary">{agent.total_resolved}</td></tr>)}
        </tbody></table></div>}
        <Pagination page={agentPage} pages={agentPages} onChange={setAgentPage} label={`${totalAgents} agents`} />
      </div>

      {selectedAgent && <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedAgent(null); }}>

        <div className="bg-card-solid border border-token rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--card-bg-solid)', color: 'var(--text-primary)', opacity: 1 }}>
          <div className="p-5 border-b border-token flex items-start justify-between"><div><span className="text-[10px] text-tertiary font-mono uppercase tracking-widest">Agent Profile</span><h2 className="text-lg font-bold text-primary mt-1">{selectedAgent.full_name}</h2><p className="text-xs text-secondary mt-1 flex items-center gap-1"><Mail className="w-3 h-3" />{selectedAgent.email}</p></div><div className="flex items-center gap-2"><button onClick={() => openEditModal(selectedAgent)} className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all" title="Edit department & specialization"><Edit3 className="w-3 h-3" /><span>Edit</span></button><button onClick={() => setSelectedAgent(null)} className="p-2 rounded-lg hover-surface"><X className="w-4 h-4 text-secondary" /></button></div></div>
          {detailError && <div className="m-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{detailError}</div>}
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3"><StatCard label="Active Tickets" value={selectedAgent.active_ticket_count} tone="text-indigo-400" /><StatCard label="Maximum Capacity" value={selectedAgent.max_capacity} /><StatCard label="Total Assigned" value={ticketSummary.total_assigned ?? selectedAgent.total_assigned} /><StatCard label="Total Resolved" value={ticketSummary.resolved ?? selectedAgent.total_resolved} tone="text-sky-400" /></div>
          <div className="mx-5 mb-5 p-4 rounded-xl bg-input border border-token grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"><div><span className="block text-[9px] uppercase font-mono text-tertiary">Department</span><span className="text-secondary">{selectedAgent.department || '—'}</span></div><div><span className="block text-[9px] uppercase font-mono text-tertiary">Availability</span><span className="text-secondary">{selectedAgent.availability || 'Available'}</span></div><div><span className="block text-[9px] uppercase font-mono text-tertiary">Last Assigned</span><span className="text-secondary">{formatDate(selectedAgent.last_assigned_at)}</span></div></div>
          <div className="px-5 pb-5"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3"><div><h3 className="text-sm font-semibold text-primary">Assigned Tickets</h3><p className="text-[10px] text-tertiary mt-1">Current and historical tickets assigned to this agent.</p></div><div className="relative"><Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-tertiary" /><input value={ticketSearch} onChange={event => { setTicketSearch(event.target.value); setTicketPage(1); }} placeholder="Search tickets" className="input-token rounded-lg pl-9 pr-3 py-2 text-xs outline-none" /></div></div>
            {detailLoading ? <div className="p-10 text-center text-xs text-tertiary"><Clock3 className="w-5 h-5 mx-auto mb-2 animate-pulse" />Loading assigned tickets…</div> : tickets.length === 0 ? <div className="p-10 text-center border border-dashed border-token rounded-xl text-xs text-tertiary">No assigned tickets found.</div> : <div className="overflow-x-auto border border-token rounded-xl"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-token text-[9px] font-mono uppercase tracking-wider text-tertiary"><th className="p-3">Ticket</th><th className="p-3">Title</th><th className="p-3">Category</th><th className="p-3">Priority</th><th className="p-3">Status</th><th className="p-3">Employee</th><th className="p-3">Created</th><th className="p-3">Updated</th></tr></thead><tbody>{tickets.map(ticket => <tr key={ticket.id} onClick={() => navigate(`/admin/tickets/${ticket.id}`)} title="Open ticket details" className="border-b border-token last:border-0 hover-surface cursor-pointer"><td className="p-3 text-[10px] text-accent font-mono">{ticket.ticket_number}</td><td className="p-3 text-xs text-primary max-w-[220px] truncate">{ticket.title}</td><td className="p-3 text-xs text-secondary">{ticket.category}</td><td className="p-3 text-xs text-secondary">{ticket.priority}</td><td className="p-3"><span className={`text-[9px] px-2 py-1 rounded-full border ${statusClass(ticket.status)}`}>{ticket.status}</span></td><td className="p-3 text-xs text-secondary">{ticket.employee_name || '—'}</td><td className="p-3 text-[10px] text-tertiary whitespace-nowrap">{formatDate(ticket.created_at)}</td><td className="p-3 text-[10px] text-tertiary whitespace-nowrap">{formatDate(ticket.updated_at)}</td></tr>)}</tbody></table></div>}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4"><select value={ticketSort} onChange={event => { setTicketSort(event.target.value); setTicketPage(1); }} className="input-token rounded-lg px-3 py-2 text-[10px] outline-none"><option value="created_at">Sort by created date</option><option value="updated_at">Sort by updated date</option><option value="title">Sort by title</option><option value="status">Sort by status</option></select><Pagination page={ticketPage} pages={ticketPages} onChange={setTicketPage} label={`${ticketTotal} tickets`} /></div>
          </div>
        </div>
      </div>}

      {editModal && (
        <div className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-4" onMouseDown={event => { if (event.target === event.currentTarget) setEditModal(null); }}>
          <div className="bg-card-solid border border-token rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-token flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-primary">Edit Agent Details</h3>
                  <p className="text-[10px] text-tertiary mt-0.5">{editModal.full_name}</p>
                </div>
              </div>
              <button onClick={() => setEditModal(null)} className="p-1.5 rounded-lg hover-surface"><X className="w-4 h-4 text-secondary" /></button>
            </div>
            {editError && <div className="mx-5 mt-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400">{editError}</div>}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Department</label>
                <input
                  type="text"
                  value={editDepartment}
                  onChange={e => setEditDepartment(e.target.value)}
                  className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                  placeholder="e.g. Information Technology"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Specialization</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editSpecInput}
                    onChange={e => setEditSpecInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = editSpecInput.trim(); if (v && !editSpecializations.includes(v)) setEditSpecializations([...editSpecializations, v]); setEditSpecInput(''); } }}
                    className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                    placeholder="e.g. Network, Hardware"
                  />
                  <button
                    type="button"
                    onClick={() => { const v = editSpecInput.trim(); if (v && !editSpecializations.includes(v)) setEditSpecializations([...editSpecializations, v]); setEditSpecInput(''); }}
                    className="px-3 py-2 bg-accent/10 border border-accent/30 text-accent rounded-lg text-[10px] font-semibold hover:bg-accent/20 transition-all"
                  >
                    Add
                  </button>
                </div>
                {editSpecializations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {editSpecializations.map(spec => (
                      <span key={spec} className="inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-full bg-accent-soft text-accent border border-token font-medium">
                        {spec}
                        <button type="button" onClick={() => setEditSpecializations(editSpecializations.filter(s => s !== spec))} className="hover:opacity-70">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-token flex justify-end gap-2">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 bg-card hover-elev text-secondary rounded-lg text-[10px] font-semibold transition-all">Cancel</button>
              <button
                onClick={handleEditSubmit}
                disabled={editLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-semibold transition-all"
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Pagination: React.FC<{ page: number; pages: number; onChange: (page: number) => void; label: string }> = ({ page, pages, onChange, label }) => (
  <div className="flex items-center justify-between gap-3 p-4 text-[10px] text-tertiary"><span>{label}</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => onChange(page - 1)} className="p-1.5 rounded border border-token disabled:opacity-40 hover-surface"><ChevronLeft className="w-3.5 h-3.5" /></button><span className="font-mono">{pages ? `${page} / ${pages}` : '0 / 0'}</span><button disabled={!pages || page >= pages} onClick={() => onChange(page + 1)} className="p-1.5 rounded border border-token disabled:opacity-40 hover-surface"><ChevronRight className="w-3.5 h-3.5" /></button></div></div>
);
