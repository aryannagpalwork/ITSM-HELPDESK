import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { SystemAlert } from '../shared/types';
import { getActiveAlerts } from '../shared/api';

export const AgentAlertManagement: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto_detected'>('manual');

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await getActiveAlerts();
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

  const manualAlerts = alerts.filter((alert) => alert.source === 'manual');
  const autoAlerts = alerts.filter((alert) => alert.source === 'auto_detected');
  const filteredAlerts = activeTab === 'manual' ? manualAlerts : autoAlerts;

  const handleViewRelatedTickets = (item: SystemAlert) => {
    if (item.category) {
      navigate(`/agent/tickets?category=${encodeURIComponent(item.category)}`);
    } else {
      navigate('/agent/tickets');
    }
  };

  return (
    <div className="flex-1 bg-app p-6 sm:p-8 overflow-y-auto h-full font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-tertiary flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-accent" />
            <span>Agent Alerts</span>
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Alert Center</h1>
          <p className="text-xs text-secondary mt-0.5">
            View active manual and auto-detected system alerts in a single agent-facing workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchAlerts()}
          className="px-3 py-2 text-xs font-semibold rounded-xl bg-card border border-border text-primary hover:bg-zinc-800 transition-all flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Alerts</span>
        </button>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border text-primary space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'manual'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-secondary hover:text-primary hover:bg-zinc-800'
              }`}
            >
              <span>Manual Alerts</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 !text-white">
                {manualAlerts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('auto_detected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'auto_detected'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-secondary hover:text-primary hover:bg-zinc-800'
              }`}
            >
              <span>Automatic Alerts</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 !text-white">
                {autoAlerts.length}
              </span>
            </button>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="py-16 text-center text-xs text-tertiary">
            No {activeTab === 'manual' ? 'manual' : 'automatic'} alerts are currently active.
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[650px] overflow-y-auto pr-1">
            {filteredAlerts.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-app border border-border flex flex-col gap-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-primary">{item.title}</span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-zinc-800 !text-white">
                        {item.source === 'auto_detected' ? 'Auto-Detected' : 'Manual'}
                      </span>
                      {item.category && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 !text-white">
                          {item.category}
                        </span>
                      )}
                      <span className="text-[10px] text-secondary">
                        Detected at {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">{item.message}</p>
                  </div>
                  {item.source === 'auto_detected' && (
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewRelatedTickets(item)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20 transition-all flex items-center gap-1"
                      >
                        <span>View tickets</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {item.recommendation && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span className="font-semibold uppercase tracking-wider text-amber-300 text-[10px]">
                        KB Recommended Resolution
                      </span>
                    </div>
                    {item.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
