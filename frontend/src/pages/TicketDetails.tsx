
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../shared/AppContext';
import { TicketPriority, TicketStatus } from '../shared/types';
import {
  Sparkles,
  ArrowLeft,
  Clock,
  Send,
  Lock,
  UserCircle2,
  Activity,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  UserCheck,
  Tag,
  ArrowUp,
  XCircle,
  RotateCcw,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import { AuditLog } from '../shared/api';

export const TicketDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    tickets,
    comments,
    currentUser,
    updateTicket,
    deleteTicket,
    addComment,
    loadTicketAuditLogs,
    reassignTicket,
    listAgents,
    loadAgentMetrics,
    loadTickets,
    escalateTicket,
    resolveTicket,
    closeTicket,
    reopenTicket,
  } = useApp();

  const [commentInput, setCommentInput] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<{
    action: 'escalate' | 'resolve' | 'close' | 'reopen' | 'reassign';
    isOpen: boolean;
  } | null>(null);
  const [modalData, setModalData] = useState<{
    reason: string;
    resolution: string;
    assignedTo: string | null;
  }>({
    reason: '',
    resolution: '',
    assignedTo: null,
  });
  const [agents, setAgents] = useState<{ id: string; name: string; email: string; department?: string; specialization?: string; status: string; activeTicketCount: number; available: boolean }[]>([]);

  const ticket = tickets.find((t) => t.id === id);

  useEffect(() => {
    if (ticket) {
      loadTicketAuditLogs(ticket.id).then(setAuditLogs);
    }
  }, [ticket?.id]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!ticket) {
    return (
      <div className="flex-1 bg-app p-8 flex flex-col items-center justify-center h-full font-sans">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-sm font-bold text-primary">Incident Record Not Found</h2>
        <p className="text-xs text-tertiary mt-1 max-w-sm text-center">
          The incident ticket you are trying to access does not exist or has been removed from the database.
        </p>
        <button
          onClick={() => navigate('/tickets')}
          className="mt-6 px-4 py-2 bg-card-solid border border-token rounded-lg text-xs font-semibold text-secondary hover-text transition-all cursor-pointer"
        >
          Return to Queue
        </button>
      </div>
    );
  }

  // Filter Comments: Normal users cannot see internal notes!
  const filteredComments = comments
    .filter((c) => c.ticketId === ticket.id)
    .filter((c) => currentUser.role !== 'Employee' || !c.isInternal);

  const handleStatusChange = (status: TicketStatus) => {
    updateTicket(ticket.id, { status });
  };

  const handlePriorityChange = (priority: TicketPriority) => {
    updateTicket(ticket.id, { priority });
  };

  const handleReassign = async () => {
    setModal({ action: 'reassign', isOpen: true });
    setModalData({ reason: '', resolution: '', assignedTo: null });
    try {
      const agentsList = await listAgents();
      console.log('[Reassign] API response - agentsList:', agentsList);
      // Only exclude the current assignee; the current user may not be the assignee
      const filtered = agentsList.filter(a => a.id !== ticket?.agentId);
      console.log('[Reassign] Filtered agents (excluded current assignee):', filtered);
      setAgents(filtered);
    } catch (err) {
      console.error('[Reassign] Error fetching agents:', err);
      setAgents([]);
    }
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    addComment(ticket.id, commentInput, isInternalComment);
    setCommentInput('');
    setIsInternalComment(false);
  };

  const handleDelete = () => {
    if (confirm('Are you absolutely sure you want to permanently delete this support incident?')) {
      deleteTicket(ticket.id);
      navigate('/tickets');
    }
  };

  const handleModalSubmit = async () => {
    if (!modal || !ticket) return;
    setLoading(modal.action);
    try {
      switch (modal.action) {
        case 'reassign':
          if (!modalData.assignedTo) {
            setToast({ message: 'Please select a target agent.', type: 'error' });
            return;
          }
          await reassignTicket(ticket.id, modalData.assignedTo, modalData.reason || undefined);
          setToast({ message: 'Ticket reassigned successfully!', type: 'success' });
          break;
        case 'escalate':
          const priorityOrder: TicketPriority[] = ['low', 'medium', 'high', 'critical'];
          const currentIndex = priorityOrder.indexOf(ticket.priority);
          if (currentIndex < priorityOrder.length - 1) {
            await escalateTicket(ticket.id, priorityOrder[currentIndex + 1], modalData.reason);
          }
          setToast({ message: 'Ticket escalated successfully!', type: 'success' });
          break;
        case 'resolve':
          await resolveTicket(ticket.id, modalData.resolution || undefined, modalData.reason);
          setToast({ message: 'Ticket resolved successfully!', type: 'success' });
          break;
        case 'close':
          await closeTicket(ticket.id, modalData.reason);
          setToast({ message: 'Ticket closed successfully!', type: 'success' });
          break;
        case 'reopen':
          await reopenTicket(ticket.id, modalData.reason);
          setToast({ message: 'Ticket reopened successfully!', type: 'success' });
          break;
      }
      // Refresh audit logs after action
      const updatedAuditLogs = await loadTicketAuditLogs(ticket.id);
      setAuditLogs(updatedAuditLogs);
      setModal(null);
      setModalData({ reason: '', resolution: '', assignedTo: null });
    } catch (error) {
      console.error(error);
      setToast({ message: 'An error occurred. Please try again.', type: 'error' });
    } finally {
      setLoading(null);
    }
  };

  const isReasonRequired = (action: string) => {
    return ['escalate', 'resolve', 'close', 'reopen'].includes(action);
  };

  const isSubmitDisabled = () => {
    if (!modal) return true;
    if (isReasonRequired(modal.action) && !modalData.reason.trim()) return true;
    return false;
  };

  const getPriorityStyle = (prio: TicketPriority) => {
    switch (prio) {
      case 'low':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      case 'critical':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    }
  };

  const getStatusStyle = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'in_progress':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'resolved':
        return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
      case 'closed':
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'ticket.created':
        return <Sparkles className="w-3 h-3" />;
      case 'ticket.updated':
        return <Activity className="w-3 h-3" />;
      case 'ticket.assigned':
        return <UserCheck className="w-3 h-3" />;
      case 'ticket.reassigned':
        return <UserCircle2 className="w-3 h-3" />;
      case 'ticket.unassigned':
        return <UserCircle2 className="w-3 h-3" />;
      case 'ticket.escalated':
        return <ArrowUp className="w-3 h-3" />;
      case 'ticket.resolved':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'ticket.closed':
        return <XCircle className="w-3 h-3" />;
      case 'ticket.reopened':
        return <RotateCcw className="w-3 h-3" />;
      case 'ticket.deleted':
        return <Trash2 className="w-3 h-3" />;
      default:
        return <Activity className="w-3 h-3" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'ticket.created':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'ticket.updated':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'ticket.assigned':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'ticket.reassigned':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'ticket.unassigned':
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
      case 'ticket.escalated':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'ticket.resolved':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'ticket.closed':
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
      case 'ticket.reopened':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'ticket.deleted':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const canEditMetadata = currentUser.role !== 'Employee';

  return (
    <div
      id="ticket-workspace-details"
      className="flex-1 bg-app p-8 overflow-y-auto h-full font-sans flex flex-col justify-between relative"
    >
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card-solid border border-token rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-primary capitalize">
                {modal.action} Ticket
              </h3>
              <button
                onClick={() => setModal(null)}
                className="p-1.5 hover-elev rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-secondary" />
              </button>
            </div>

            <div className="space-y-4">
              {modal.action === 'resolve' && (
                <div>
                  <label className="block text-xs font-mono text-secondary uppercase tracking-wider mb-1.5">
                    Resolution Note (optional)
                  </label>
                  <textarea
                    value={modalData.resolution}
                    onChange={(e) => setModalData({ ...modalData, resolution: e.target.value })}
                    placeholder="Describe how the issue was resolved..."
                    className="w-full input-token rounded-lg p-3 text-xs outline-none transition-colors resize-none h-24"
                  />
                </div>
              )}

              {modal.action === 'reassign' && (
                <div>
                  <label className="block text-xs font-mono text-secondary uppercase tracking-wider mb-1.5">
                    Select Target Agent
                  </label>
                  {agents.length === 0 ? (
                    <div className="p-3 bg-input border border-dashed border-token rounded-lg text-center">
                      <p className="text-[10px] text-tertiary">No other eligible agents found.</p>
                    </div>
                  ) : (
                    <select
                      value={modalData.assignedTo || ''}
                      onChange={(e) => setModalData({ ...modalData, assignedTo: e.target.value || null })}
                      className="w-full input-token rounded-lg p-2.5 text-xs outline-none cursor-pointer"
                    >
                      <option value="">-- Select an agent --</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} {agent.specialization ? `(${agent.specialization})` : ''} - {agent.activeTicketCount} active tickets
                        </option>
                      ))}
                    </select>
                  )}
                  {modalData.assignedTo && agents.find(a => a.id === modalData.assignedTo) && (
                    <div className="mt-2 p-2 bg-input border border-token rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-secondary font-semibold">
                            {agents.find(a => a.id === modalData.assignedTo)?.name}
                          </p>
                          <p className="text-[9px] text-tertiary">
                            {agents.find(a => a.id === modalData.assignedTo)?.specialization || 'General'} 
                            {' · '}
                            {agents.find(a => a.id === modalData.assignedTo)?.activeTicketCount} active tickets
                            {' · '}
                            <span className={agents.find(a => a.id === modalData.assignedTo)?.available ? 'text-emerald-400' : 'text-amber-400'}>
                              {agents.find(a => a.id === modalData.assignedTo)?.available ? 'Available' : 'Busy'}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-secondary uppercase tracking-wider mb-1.5">
                  Reason {isReasonRequired(modal.action) ? '(required)' : '(optional)'}
                </label>
                <textarea
                  value={modalData.reason}
                  onChange={(e) => setModalData({ ...modalData, reason: e.target.value })}
                  placeholder={`Enter reason for ${modal.action}...`}
                  className="w-full input-token rounded-lg p-3 text-xs outline-none transition-colors resize-none h-24"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setModal(null)}
                disabled={loading === modal.action}
                className="px-4 py-2 bg-card-solid hover-elev text-secondary border border-token rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                disabled={isSubmitDisabled() || loading === modal.action}
                className="px-4 py-2 accent-btn rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading === modal.action ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        {/* Top Back Link & Delete Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/tickets')}
            className="text-xs font-semibold text-secondary hover-text flex items-center space-x-2.5 transition-all cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Queue</span>
          </button>

          {currentUser.role === 'Administrator' && (
            <button
              onClick={handleDelete}
              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 rounded-lg text-rose-400 hover:text-rose-300 transition-all text-xs font-semibold flex items-center space-x-2 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete Record</span>
            </button>
          )}
        </div>

        {/* Title Heading Block */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-[10px] font-mono font-semibold text-tertiary uppercase mb-2">
            <span>Ticket Record</span>
            <span>/</span>
            <span>{ticket.ticketNumber || ticket.id}</span>
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-tight leading-snug">{ticket.title}</h1>
          <p className="text-xs text-secondary mt-2">
            Logged by <strong className="text-primary">{ticket.userName}</strong> on{' '}
            {new Date(ticket.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Layout Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content col: Description, AI Copilot Summary, and comments */}
          <div className="lg:col-span-2 space-y-6">
            {/* Incident Description */}
            <div className="bg-card border border-token p-6 rounded-2xl">
              <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider font-mono mb-3">
                Incident Technical Description
              </h3>
              <p className="text-xs text-primary leading-relaxed whitespace-pre-line font-sans">
                {ticket.description}
              </p>
            </div>

            {/* AI Summary and resolution SOP */}
            {(ticket.aiSummary || ticket.suggestedResolution || ticket.aiAnalysisCategory || ticket.aiAnalysisPriority || ticket.aiAnalysisEstimatedSla || ticket.aiAnalysisPossibleRootCause || ticket.aiAnalysisTags) && (
              <div className="bg-accent-soft border border-token p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <Sparkles className="w-4.5 h-4.5 text-accent animate-pulse" />
                </div>

                <h3 className="text-xs font-semibold text-accent flex items-center space-x-2 mb-4 font-mono uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>AI Copilot Diagnostics</span>
                </h3>

                <div className="space-y-4">
                  {/* AI Analysis Fields */}
                  {(ticket.aiAnalysisCategory || ticket.aiAnalysisPriority || ticket.aiAnalysisEstimatedSla || ticket.aiAnalysisTags || ticket.assignedTeam) && (
                    <div className="grid grid-cols-2 gap-3">
                      {ticket.aiAnalysisCategory && (
                        <div className="bg-card-solid p-3 rounded-lg border border-token">
                          <h5 className="text-[10px] font-mono uppercase text-tertiary mb-1">AI Category</h5>
                          <p className="text-xs text-primary font-semibold">{ticket.aiAnalysisCategory}</p>
                        </div>
                      )}
                      {ticket.aiAnalysisPriority && (
                        <div className="bg-card-solid p-3 rounded-lg border border-token">
                          <h5 className="text-[10px] font-mono uppercase text-tertiary mb-1">AI Priority</h5>
                          <p className="text-xs text-primary font-semibold">{ticket.aiAnalysisPriority}</p>
                        </div>
                      )}
                      {ticket.aiAnalysisEstimatedSla && (
                        <div className="bg-card-solid p-3 rounded-lg border border-token">
                          <h5 className="text-[10px] font-mono uppercase text-tertiary mb-1">Estimated SLA</h5>
                          <p className="text-xs text-primary font-semibold">{ticket.aiAnalysisEstimatedSla}</p>
                        </div>
                      )}
                      {ticket.assignedTeam && (
                        <div className="bg-card-solid p-3 rounded-lg border border-token">
                          <h5 className="text-[10px] font-mono uppercase text-tertiary mb-1">Assigned Team</h5>
                          <p className="text-xs text-primary font-semibold">{ticket.assignedTeam}</p>
                        </div>
                      )}
                      {ticket.aiAnalysisTags && ticket.aiAnalysisTags.length > 0 && (
                        <div className="bg-card-solid p-3 rounded-lg border border-token col-span-2">
                          <h5 className="text-[10px] font-mono uppercase text-tertiary mb-1">AI Tags</h5>
                          <div className="flex flex-wrap gap-1.5">
                            {ticket.aiAnalysisTags.map((tag, idx) => (
                              <span key={idx} className="text-[9px] px-2 py-0.5 bg-card-solid border border-token text-secondary rounded-full">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {ticket.aiSummary && (
                    <div className={ticket.aiAnalysisCategory ? "pt-3 border-t border-token" : ""}>
                      <h4 className="text-[11px] font-semibold text-primary">Automated Incident Summary</h4>
                      <p className="text-xs text-secondary mt-1.5 leading-relaxed font-sans">{ticket.aiSummary}</p>
                    </div>
                  )}

                  {ticket.aiAnalysisPossibleRootCause && (
                    <div className="pt-3 border-t border-token">
                      <h4 className="text-[11px] font-semibold text-primary">Possible Root Cause</h4>
                      <p className="text-xs text-secondary mt-1.5 leading-relaxed font-sans">
                        {ticket.aiAnalysisPossibleRootCause}
                      </p>
                    </div>
                  )}

                  {ticket.suggestedResolution && (
                    <div className="pt-3 border-t border-token">
                      <h4 className="text-[11px] font-semibold text-primary">Recommended Resolution SOP</h4>
                      <p className="text-xs text-secondary mt-1.5 leading-relaxed font-sans">
                        {ticket.suggestedResolution}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline & Comments Feed */}
            <div className="bg-card border border-token p-6 rounded-2xl">
              <h3 className="text-xs font-semibold text-primary mb-6 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-tertiary" />
                <span>Lifecycle Timeline & Activity History</span>
              </h3>

              <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border)]">
                  {/* Audit Logs */}
                {auditLogs
                  .slice()
                  .reverse()
                  .map((log) => (
                    <div key={log.id} className="relative pl-8">
                      <div
                        className={`absolute left-[13px] top-1.5 w-[8px] h-[8px] rounded-full border-2 border-[var(--app-bg)] ${
                          log.action.includes('escalated')
                            ? 'bg-orange-500'
                            : log.action.includes('resolved')
                            ? 'bg-sky-500'
                            : log.action.includes('closed')
                            ? 'bg-zinc-500'
                            : log.action.includes('reopened') || log.action.includes('reassigned')
                            ? 'bg-amber-500'
                            : 'bg-indigo-500'
                        }`}
                      />

                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold border ${getActionColor(
                            log.action
                          )} flex items-center gap-1`}
                        >
                          {getActionIcon(log.action)}
                          {log.action.split('.')[1].toUpperCase()}
                        </span>
                        {log.user_name && (
                          <span className="text-[11px] font-semibold text-primary">{log.user_name}</span>
                        )}
                        <span className="text-[9px] text-tertiary font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-xs text-secondary">
                        {log.metadata?.field && (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-secondary">{log.metadata.field}:</span>
                            <span className="line-through text-tertiary">
                              {log.metadata.old_value || '(empty)'}
                            </span>
                            <span className="text-secondary">→</span>
                            <span className="font-semibold text-accent">
                              {log.metadata.new_value || '(empty)'}
                            </span>
                          </div>
                        )}
                        {log.metadata?.changes && (
                          <div className="space-y-1">
                            {log.metadata.changes.map((change, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <span className="font-semibold text-secondary">{change.field}:</span>
                                <span className="line-through text-tertiary">
                                  {change.old_value || '(empty)'}
                                </span>
                                <span className="text-secondary">→</span>
                                <span className="font-semibold text-accent">
                                  {change.new_value || '(empty)'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {log.reason && (
                          <div className="mt-1.5 text-xs text-tertiary italic">
                            Reason: {log.reason}
                          </div>
                        )}
                        {!log.metadata?.field && !log.metadata?.changes && !log.reason && (
                          <span>Action recorded</span>
                        )}
                      </div>
                    </div>
                  ))}

                {/* Comments */}
                {filteredComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`relative pl-8 flex items-start gap-4 ${
                      comment.isInternal
                        ? 'border border-dashed border-amber-500/10 bg-amber-500/[0.01] p-3 rounded-xl'
                        : ''
                    }`}
                  >
                    {/* Left Dot Indicator */}
                    <div
                      className={`absolute left-[13px] top-1.5 w-[8px] h-[8px] rounded-full border-2 border-[var(--app-bg)] ${
                        comment.isInternal ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}
                    />

                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-lg bg-card-solid border border-token flex items-center justify-center text-[10px] text-secondary font-semibold uppercase shrink-0">
                      {comment.commenterName?.split(' ').map((n) => n[0]).join('') || 'U'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <h5 className="text-[11px] font-semibold text-primary">{comment.commenterName}</h5>
                        <span
                          className={`text-[8px] font-mono uppercase px-1.5 py-0.5 bg-card-solid border border-token rounded font-semibold text-secondary`}
                        >
                          {comment.commenterRole === 'end_user' ? 'Employee' : comment.commenterRole}
                        </span>
                        {comment.isInternal && (
                          <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-semibold flex items-center gap-1.5">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Internal Note</span>
                          </span>
                        )}
                        <span className="text-[9px] text-tertiary font-mono">
                          {new Date(comment.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-secondary mt-1.5 leading-relaxed font-sans whitespace-pre-line">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar: Ticket Metadata Control Center */}
          <div className="space-y-6">
            {/* Status, Priority controls */}
            <div className="bg-card border border-token p-5 rounded-2xl">
              <h3 className="text-xs font-semibold text-primary mb-4 flex items-center gap-2 pb-3 border-b border-token font-mono uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5 text-accent" />
                <span>Lifecycle Control</span>
              </h3>

              <div className="space-y-4">
                {/* Status selector */}
                <div>
                  <span className="block text-[10px] font-mono text-tertiary uppercase mb-1.5">Current Status</span>
                  {canEditMetadata ? (
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                      className="w-full input-token rounded-lg p-2.5 text-xs outline-none cursor-pointer"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md uppercase font-mono ${getStatusStyle(
                          ticket.status
                        )}`}
                      >
                        {ticket.status}
                      </span>
                      {ticket.status === 'resolved' && (
                        <button
                          onClick={() => {
                            setModal({ action: 'reopen', isOpen: true });
                            setModalData({ reason: '', resolution: '', assignedTo: null });
                          }}
                          className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 border border-amber-500/20 bg-amber-500/5 px-2 py-1 rounded-lg flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reopen
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Priority Selector */}
                <div>
                  <span className="block text-[10px] font-mono text-tertiary uppercase mb-1.5">SLA Severity</span>
                  {canEditMetadata ? (
                    <select
                      value={ticket.priority}
                      onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                      className="w-full input-token rounded-lg p-2.5 text-xs outline-none cursor-pointer"
                    >
                      <option value="low">Low (P4)</option>
                      <option value="medium">Medium (P3)</option>
                      <option value="high">High (P2)</option>
                      <option value="critical">Critical (P1)</option>
                    </select>
                  ) : (
                    <span
                      className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-md uppercase font-mono ${getPriorityStyle(
                        ticket.priority
                      )}`}
                    >
                      {ticket.priority}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                {canEditMetadata && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-token">
                    {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                      <button
                        onClick={() => {
                          setModal({ action: 'escalate', isOpen: true });
                          setModalData({ reason: '', resolution: '', assignedTo: null });
                        }}
                        disabled={loading === 'escalate'}
                        className="py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 border border-orange-500/20 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading === 'escalate' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ArrowUp className="w-3 h-3" />
                        )}
                        Escalate
                      </button>
                    )}

                    {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                      <button
                        onClick={() => {
                          setModal({ action: 'resolve', isOpen: true });
                          setModalData({ reason: '', resolution: '', assignedTo: null });
                        }}
                        disabled={loading === 'resolve'}
                        className="py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/20 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading === 'resolve' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Resolve
                      </button>
                    )}

                    {ticket.status === 'resolved' && (
                      <button
                        onClick={() => {
                          setModal({ action: 'close', isOpen: true });
                          setModalData({ reason: '', resolution: '', assignedTo: null });
                        }}
                        disabled={loading === 'close'}
                        className="py-2 bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-300 hover:text-white border border-zinc-500/20 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading === 'close' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        Close Ticket
                      </button>
                    )}

                    {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                      <button
                        onClick={() => {
                          setModal({ action: 'reopen', isOpen: true });
                          setModalData({ reason: '', resolution: '', assignedTo: null });
                        }}
                        disabled={loading === 'reopen'}
                        className="py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/20 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading === 'reopen' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Reopen
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Agent Assignment Card */}
            <div className="bg-card border border-token p-5 rounded-2xl">
              <h3 className="text-xs font-semibold text-primary mb-4 flex items-center gap-2 pb-3 border-b border-token font-mono uppercase tracking-wider">
                <UserCircle2 className="w-3.5 h-3.5 text-accent" />
                <span>Support Assignment</span>
              </h3>

              {ticket.agentId ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-accent-soft border border-token-strong flex items-center justify-center text-[10px] font-bold text-accent">
                      {ticket.agentName?.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <h5 className="text-[11px] font-semibold text-primary">{ticket.agentName}</h5>
                      <p className="text-[9px] text-tertiary font-mono">
                        {ticket.assignmentType || 'Automatic'} assignment
                        {ticket.matchedSpecialization ? ` · ${ticket.matchedSpecialization}` : ''}
                      </p>
                      {ticket.assignedAt && (
                        <p className="text-[9px] text-tertiary mt-0.5">
                          {new Date(ticket.assignedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {currentUser.role !== 'Employee' && (
                    <button
                      onClick={handleReassign}
                      disabled={loading === 'reassign'}
                      className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 rounded-lg text-[10px] font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading === 'reassign' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Reassign</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-input border border-dashed border-token rounded-lg text-center">
                    <UserCircle2 className="w-6 h-6 text-tertiary mx-auto mb-1" />
                    <p className="text-[10px] text-tertiary">Currently Unassigned</p>
                  </div>
                  <p className="text-[10px] text-tertiary">The assignment engine will retry when an eligible agent is available.</p>
                </div>
              )}
            </div>

            {/* Resolution Note */}
            {ticket.resolution && (
              <div className="bg-sky-500/5 border border-sky-500/20 p-5 rounded-2xl">
                <h3 className="text-xs font-semibold text-sky-400 mb-2 font-mono uppercase tracking-wider">
                  Resolution Note
                </h3>
                <p className="text-xs text-secondary leading-relaxed font-sans">{ticket.resolution}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reply input field (bottom layout stick) */}
      <div className="mt-8 border-t border-token pt-6">
        <form onSubmit={handleSubmitComment} className="space-y-3 max-w-4xl">
          <div className="bg-card border border-token rounded-2xl p-1.5 flex items-center focus-within:border-[var(--accent-primary)] transition-colors">
            <input
              type="text"
              placeholder={isInternalComment ? "Add a private internal technician note..." : "Post a response to the requester..."}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-xs text-primary px-3.5 py-3"
            />
            <button
              type="submit"
              className="p-3 accent-btn rounded-xl transition-all cursor-pointer shadow-md shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Internal Comment Toggle (Only Agents/Admins can see) */}
          {currentUser.role !== 'Employee' && (
            <div className="flex items-center space-x-2 px-2">
              <input
                type="checkbox"
                id="internal-chk"
                checked={isInternalComment}
                onChange={(e) => setIsInternalComment(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-token bg-input accent-indigo-600 focus:ring-0 cursor-pointer"
              />
              <label
                htmlFor="internal-chk"
                className="text-[10px] font-mono text-secondary select-none cursor-pointer hover-text flex items-center gap-1.5"
              >
                <Lock className="w-3 h-3 text-amber-500" />
                <span>Mark as Private Internal Note (Visible to Agents & Admins only)</span>
              </label>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
