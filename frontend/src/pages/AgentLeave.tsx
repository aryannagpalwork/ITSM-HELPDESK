import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, Trash2, AlertTriangle, Send } from 'lucide-react';
import { useApp } from '../shared/AppContext';
import { createLeaveRequest, deleteLeaveRequest, extractApiError, listLeaveRequests } from '../shared/api';
import { LeaveRequest } from '../shared/types';

const STATUS_STYLES: Record<LeaveRequest['status'], string> = {
  pending: 'bg-zinc-500/10 text-zinc-300 border border-zinc-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  rejected: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
};

/** Date inputs use calendar dates, so derive today in the user's local time. */
const getTodayDateInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AgentLeave: React.FC = () => {
  const { currentUser } = useApp();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  });
  const today = getTodayDateInputValue();

  const loadLeaveRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const requests = await listLeaveRequests();
      setLeaveRequests(requests);
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaveRequests();
  }, [loadLeaveRequests]);

  const pendingCount = useMemo(
    () => leaveRequests.filter(request => request.status === 'pending').length,
    [leaveRequests],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.startDate < today || form.endDate < today) {
      setError('Start Date and End Date must be today or a future date.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await createLeaveRequest(form.startDate, form.endDate, form.reason.trim());
      setForm({ startDate: '', endDate: '', reason: '' });
      await loadLeaveRequests();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (leaveRequestId: string) => {
    try {
      setError(null);
      await deleteLeaveRequest(leaveRequestId);
      await loadLeaveRequests();
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  };

  if (currentUser.role !== 'Agent') {
    return (
      <div className="flex-1 bg-app p-8 flex flex-col items-center justify-center h-full font-sans">
        <AlertTriangle className="w-10 h-10 text-rose-500 mb-3" />
        <h2 className="text-sm font-bold text-primary">Agent Access Required</h2>
        <p className="text-xs text-tertiary mt-1 max-w-sm text-center">
          Leave requests can only be created and managed from an agent account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-app p-8 overflow-y-auto h-full font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-tertiary flex items-center gap-1.5 font-semibold">
            <CalendarDays className="w-3.5 h-3.5 text-accent" />
            <span>Leave Planner</span>
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Agent Leave Requests</h1>
          <p className="text-xs text-secondary">
            Submit full-day leave ranges and track review status from the admin team.
          </p>
        </div>
        <div className="p-3 bg-card border border-token rounded-xl">
          <p className="text-[10px] font-mono uppercase text-tertiary">Pending Requests</p>
          <p className="text-lg font-bold text-primary mt-1">{pendingCount}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-6">
        <div className="bg-card border border-token rounded-2xl p-6">
          <h2 className="text-sm font-bold text-primary mb-1">Request Leave</h2>
          <p className="text-xs text-tertiary mb-5">Leave is submitted as full-day date ranges only.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Start Date</label>
              <input
                type="date"
                required
                min={today}
                value={form.startDate}
                onChange={(event) => setForm(prev => ({ ...prev, startDate: event.target.value }))}
                className="w-full input-token rounded-lg px-3 py-2.5 text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">End Date</label>
              <input
                type="date"
                required
                min={form.startDate && form.startDate > today ? form.startDate : today}
                value={form.endDate}
                onChange={(event) => setForm(prev => ({ ...prev, endDate: event.target.value }))}
                className="w-full input-token rounded-lg px-3 py-2.5 text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Reason</label>
              <textarea
                required
                rows={5}
                value={form.reason}
                onChange={(event) => setForm(prev => ({ ...prev, reason: event.target.value }))}
                placeholder="Share the business context for this leave request."
                className="w-full input-token rounded-lg px-3 py-2.5 text-xs outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full accent-btn rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
            </button>
          </form>
        </div>

        <div className="bg-card border border-token rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-primary">Your Leave History</h2>
              <p className="text-xs text-tertiary">Past, pending, approved, and rejected requests.</p>
            </div>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-tertiary" />}
          </div>

          {!loading && leaveRequests.length === 0 ? (
            <div className="p-10 border border-dashed border-token rounded-xl text-center">
              <CalendarDays className="w-8 h-8 text-tertiary mx-auto mb-3" />
              <p className="text-sm font-semibold text-primary">No leave requests yet</p>
              <p className="text-xs text-tertiary mt-1">Your submitted requests will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaveRequests.map((request) => (
                <div key={request.id} className="p-4 bg-card-solid border border-token rounded-xl">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[request.status]}`}>
                          {request.status}
                        </span>
                        <span className="text-[10px] text-tertiary font-mono">
                          {request.startDate} to {request.endDate}
                        </span>
                      </div>
                      <p className="text-xs text-primary mt-2 leading-relaxed whitespace-pre-line">{request.reason}</p>
                      <p className="text-[10px] text-tertiary mt-2">
                        Requested {new Date(request.requestedAt).toLocaleString()}
                      </p>
                      {request.rejectionReason && (
                        <p className="text-[10px] text-rose-300 mt-2">
                          Rejection reason: {request.rejectionReason}
                        </p>
                      )}
                    </div>

                    {request.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(request.id)}
                        className="px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
