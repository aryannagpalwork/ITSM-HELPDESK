import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Megaphone,
  Send,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Filter,
  ShieldAlert,
  Ticket,
  ExternalLink,
} from 'lucide-react';
import { SystemAlert } from '../shared/types';
import { getAllAlerts, createAlert, resolveAlert, clearAlertHistory } from '../shared/api';

export const AdminAlertManagement: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Tab & Status Filter state
  const [activeTab, setActiveTab] = useState<'manual' | 'auto_detected'>('manual');
  const [manualStatusFilter, setManualStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [autoStatusFilter, setAutoStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');

  // Confirmation modal state for Clear History
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await getAllAlerts();
      setAlerts(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFormError('Title and message are required.');
      return;
    }
    setCreating(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const created = await createAlert({
        title: title.trim(),
        message: message.trim(),
        category: category.trim() || undefined,
      });
      setTitle('');
      setCategory('');
      setMessage('');
      setFormSuccess(
        created.recommendation
          ? 'Alert created with KB recommendation automatically attached!'
          : 'Alert created successfully!'
      );
      fetchAlerts();
      setTimeout(() => setFormSuccess(null), 4000);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to publish alert.');
    } finally {
      setCreating(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await resolveAlert(alertId);
      fetchAlerts();
    } catch (err: any) {
      alert(err?.message || 'Failed to resolve alert.');
    }
  };

  const handleClearHistory = async () => {
    setClearing(true);
    setClearResult(null);
    try {
      const deletedCount = await clearAlertHistory();
      setShowClearConfirm(false);
      setClearResult(`Successfully cleared ${deletedCount} resolved alert records.`);
      fetchAlerts();
      setTimeout(() => setClearResult(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to clear resolved history.');
    } finally {
      setClearing(false);
    }
  };

  // Filter alerts by active tab and status filter
  const currentStatusFilter = activeTab === 'manual' ? manualStatusFilter : autoStatusFilter;
  const filteredAlerts = alerts.filter((item) => {
    if (item.source !== activeTab) return false;
    if (currentStatusFilter !== 'all' && item.status !== currentStatusFilter) return false;
    return true;
  });

  const manualAlertsCount = alerts.filter((a) => a.source === 'manual').length;
  const autoAlertsCount = alerts.filter((a) => a.source === 'auto_detected').length;
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;

  const handleViewRelatedTickets = (item: SystemAlert) => {
    if (item.category) {
      navigate(`/admin/tickets?category=${encodeURIComponent(item.category)}`);
    } else {
      navigate('/admin/tickets');
    }
  };

  return (
    <div className="flex-1 bg-app p-6 sm:p-8 overflow-y-auto h-full font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-tertiary flex items-center gap-1.5 font-semibold">
            <Megaphone className="w-3.5 h-3.5 text-accent" />
            <span>Incident Operations</span>
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Alert Management</h1>
          <p className="text-xs text-secondary mt-0.5">
            Broadcast system incident alerts, view auto-detected anomalies, and resolve active incidents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchAlerts()}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-card border border-border text-primary hover:bg-hover transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {resolvedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History ({resolvedCount})</span>
            </button>
          )}
        </div>
      </div>

      {clearResult && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{clearResult}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Alert Form Section */}
        <div className="p-6 rounded-2xl bg-card border border-border text-primary space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <div className="p-2 rounded-xl bg-accent-primary-bg text-accent border border-border-strong">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary">Broadcast New Alert</h3>
              <p className="text-[11px] text-secondary">Target system incidents with KB recommendations</p>
            </div>
          </div>

          <form onSubmit={handleCreateAlert} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">
                Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Email Gateway Connection Issues"
                className="w-full px-3 py-2 rounded-xl bg-app border border-border text-xs text-primary placeholder-tertiary focus:outline-none focus:border-accent"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">Category (Optional)</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Email, Network, MFA"
                className="w-full px-3 py-2 rounded-xl bg-app border border-border text-xs text-primary placeholder-tertiary focus:outline-none focus:border-accent"
              />
              <span className="text-[10px] text-tertiary block mt-1">
                Category is used for KB recommendation lookup
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">
                Message / Description <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the issue, workarounds, or estimated resolution time..."
                className="w-full px-3 py-2 rounded-xl bg-app border border-border text-xs text-primary placeholder-tertiary focus:outline-none focus:border-accent resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{creating ? 'Publishing...' : 'Publish System Alert'}</span>
            </button>
          </form>
        </div>

        {/* Alerts List & Management Section */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-card border border-border text-primary space-y-4">
          {/* Tabs header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'manual'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-secondary hover:text-primary hover:bg-hover'
                }`}
              >
                <span>Manual Alerts</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-accent-soft text-primary">
                  {manualAlertsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('auto_detected')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'auto_detected'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-secondary hover:text-primary hover:bg-hover'
                }`}
              >
                <span>Automatic Alerts</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-accent-soft text-primary">
                  {autoAlertsCount}
                </span>
              </button>
            </div>

            {/* Status Filter for current Tab */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-secondary font-mono">
                <Filter className="w-3.5 h-3.5 text-tertiary" />
                <span>Status:</span>
              </div>
              <select
                value={currentStatusFilter}
                onChange={(e) => {
                  const val = e.target.value as any;
                  if (activeTab === 'manual') setManualStatusFilter(val);
                  else setAutoStatusFilter(val);
                }}
                className="px-2.5 py-1 rounded-lg bg-app border border-border text-xs text-primary focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="resolved">Resolved Only</option>
              </select>
            </div>
          </div>

          {/* List */}
          {filteredAlerts.length === 0 ? (
            <div className="py-16 text-center text-xs text-tertiary">
              No {activeTab === 'manual' ? 'manual' : 'automatic'} alerts match the selected status filter.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
              {filteredAlerts.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-app border border-border flex items-start justify-between gap-4 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xs font-bold text-primary">{item.title}</span>
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                          item.status === 'active'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.category && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent-soft text-primary">
                          {item.category}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-secondary leading-relaxed">{item.message}</p>

                    {item.recommendation && (
                      <div className="mt-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-200 text-xs">
                        <div className="flex items-center gap-1 font-bold text-amber-400 text-[10px] uppercase tracking-wider mb-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>KB Recommended Resolution</span>
                        </div>
                        {item.recommendation}
                      </div>
                    )}

                    {/* Auto-detected Alert details: Ticket count + view link */}
                    {item.source === 'auto_detected' && (
                      <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-end flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleViewRelatedTickets(item)}
                          className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                        >
                          <span>View related tickets</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="mt-2 text-[10px] text-tertiary">
                      Created at {new Date(item.createdAt).toLocaleString()}
                      {item.resolvedAt && ` · Resolved at ${new Date(item.resolvedAt).toLocaleString()}`}
                    </div>
                  </div>

                  {item.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleResolveAlert(item.id)}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Clear History */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 text-primary shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-primary">Clear Resolved Alert History?</h3>
                <p className="text-xs text-secondary mt-0.5">
                  This action will permanently delete all {resolvedCount} resolved alert records. Active alerts will not be affected.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-secondary hover:bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={clearing}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {clearing ? 'Clearing...' : 'Yes, Delete Resolved Alerts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
