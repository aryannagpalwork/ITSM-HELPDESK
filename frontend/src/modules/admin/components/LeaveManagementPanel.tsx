import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Loader2, RefreshCw, Send, UserRoundX, XCircle } from 'lucide-react';
import { approveLeaveRequest, extractApiError, getCurrentlyOnLeave, listLeaveRequests, rejectLeaveRequest } from '../../../shared/api';
import { CurrentlyOnLeave, LeaveRequest, LeaveRequestStatus } from '../../../shared/types';

const STATUS_STYLES: Record<LeaveRequestStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  rejected: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
};

const STATUS_ORDER: Record<LeaveRequestStatus, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
};

type FilterValue = 'pending' | 'approved' | 'rejected' | 'all';

type LeaveView = 'current' | 'pending' | 'approved' | 'rejected' | 'all';

interface LeaveManagementPanelProps {
  initialView?: LeaveView;
  onViewChange?: (view: LeaveView) => void;
}

export const LeaveManagementPanel: React.FC<LeaveManagementPanelProps> = ({ initialView = 'pending', onViewChange }) => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [currentlyOnLeave, setCurrentlyOnLeave] = useState<CurrentlyOnLeave[]>([]);
  const [filter, setFilter] = useState<LeaveView>(initialView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    setFilter(initialView);
  }, [initialView]);

  const loadLeaveData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (filter === 'current') {
        const activeLeaves = await getCurrentlyOnLeave();
        setCurrentlyOnLeave(activeLeaves);
        setLeaveRequests([]);
        return;
      }

      const query = filter === 'all'
        ? {}
        : { status: filter as Exclude<FilterValue, 'all'> };
      const requests = await listLeaveRequests(query);
      setLeaveRequests(requests);
      setCurrentlyOnLeave([]);
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadLeaveData();
  }, [loadLeaveData]);

  const sortedRequests = useMemo(() => {
    return [...leaveRequests].sort((a, b) => {
      const statusDelta = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDelta !== 0) return statusDelta;
      return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
    });
  }, [leaveRequests]);

  const handleApprove = async (leaveRequestId: string) => {
    try {
      setActionLoading(leaveRequestId);
      setError(null);
      await approveLeaveRequest(leaveRequestId);
      await loadLeaveData();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (leaveRequestId: string) => {
    try {
      setActionLoading(leaveRequestId);
      setError(null);
      await rejectLeaveRequest(leaveRequestId, rejectionReason.trim());
      setRejectingId(null);
      setRejectionReason('');
      await loadLeaveData();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const filterOptions: { value: LeaveView; label: string }[] = [
    { value: 'current', label: 'Currently On Leave' },
    { value: 'pending', label: 'Pending First' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All Requests' },
  ];

  const handleViewChange = (view: LeaveView) => {
    setFilter(view);
    onViewChange?.(view);
  };

  const emptyStateCopy = filter === 'current'
    ? {
        title: 'No employees are currently on leave',
        description: 'Approved leave requests that are active today will appear here.',
      }
    : {
        title: 'No leave requests found',
        description: 'Try a different filter or refresh the panel.',
      };

  return (
    <div className="bg-card border border-token p-5 rounded-2xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-semibold text-primary">Agent Leave Management</h3>
          </div>
          <p className="text-[10px] text-tertiary mt-1">
            Review leave requests, track who is unavailable today, and approve or reject submissions.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleViewChange(option.value)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                filter === option.value
                  ? 'bg-card-solid text-primary border-token-strong'
                  : 'bg-card text-tertiary border-token hover-border'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={loadLeaveData}
            className="p-2 bg-card-solid border border-token rounded-lg hover-elev transition-colors"
            title="Refresh leave requests"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-secondary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-tertiary mx-auto mb-3" />
          <p className="text-xs text-secondary">
            {filter === 'current' ? 'Loading current leave coverage...' : 'Loading leave requests...'}
          </p>
        </div>
      ) : filter === 'current' ? (
        currentlyOnLeave.length === 0 ? (
          <div className="p-10 border border-dashed border-token rounded-xl text-center">
            <UserRoundX className="w-8 h-8 text-tertiary mx-auto mb-3" />
            <p className="text-sm font-semibold text-primary">{emptyStateCopy.title}</p>
            <p className="text-xs text-tertiary mt-1">{emptyStateCopy.description}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-token">
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-tertiary">Agent</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-tertiary">Leave Window</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-tertiary">Active Tickets</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-tertiary">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {currentlyOnLeave.map((record) => (
                  <tr key={record.agentId}>
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-primary">{record.agentName}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[11px] text-secondary">
                        {record.startDate} to {record.endDate}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[11px] text-secondary">{record.openTicketCount}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        On Leave
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : sortedRequests.length === 0 ? (
        <div className="p-10 border border-dashed border-token rounded-xl text-center">
          <CalendarDays className="w-8 h-8 text-tertiary mx-auto mb-3" />
          <p className="text-sm font-semibold text-primary">{emptyStateCopy.title}</p>
          <p className="text-xs text-tertiary mt-1">{emptyStateCopy.description}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-token">
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-tertiary">Agent</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-tertiary">Dates</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-tertiary">Reason</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-tertiary">Status</th>
                <th className="text-right px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-tertiary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {sortedRequests.map((request) => (
                <tr key={request.id}>
                  <td className="px-4 py-4">
                    <div>
                      <p className="text-xs font-semibold text-primary">{request.agentName || 'Unknown Agent'}</p>
                      <p className="text-[10px] text-tertiary mt-1">
                        Requested {new Date(request.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-[11px] text-secondary">
                      {request.startDate} to {request.endDate}
                    </p>
                  </td>
                  <td className="px-4 py-4 max-w-md">
                    <p className="text-[11px] text-secondary whitespace-pre-line">{request.reason}</p>
                    {request.rejectionReason && (
                      <p className="text-[10px] text-rose-300 mt-2">Rejection reason: {request.rejectionReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[request.status]}`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {request.status === 'pending' ? (
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(request.id)}
                            disabled={actionLoading === request.id}
                            className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-1.5 disabled:opacity-60"
                          >
                            {actionLoading === request.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(request.id);
                              setRejectionReason(request.rejectionReason || '');
                            }}
                            className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20 flex items-center gap-1.5"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </div>

                        {rejectingId === request.id && (
                          <div className="w-72 p-3 bg-card-solid border border-token rounded-xl">
                            <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">
                              Rejection Reason
                            </label>
                            <textarea
                              rows={3}
                              value={rejectionReason}
                              onChange={(event) => setRejectionReason(event.target.value)}
                              className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none resize-none"
                              placeholder="Explain why this leave request is being rejected."
                            />
                            <div className="flex items-center justify-end gap-2 mt-2">
                              <button
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectionReason('');
                                }}
                                className="px-3 py-1.5 bg-card border border-token rounded-lg text-[10px] font-semibold text-secondary"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleReject(request.id)}
                                disabled={!rejectionReason.trim() || actionLoading === request.id}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 rounded-lg text-[10px] font-semibold text-white flex items-center gap-1.5 disabled:opacity-60"
                              >
                                {actionLoading === request.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                <span>Submit</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-tertiary">Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
