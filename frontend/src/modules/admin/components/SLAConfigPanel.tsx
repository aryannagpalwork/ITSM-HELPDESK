import React, { useEffect, useState } from 'react';
import { Settings, Save, Loader2, Check, RotateCcw, X } from 'lucide-react';
import { getSLAConfig, updateSLAConfig, SLAConfig } from '../../../shared/api';

const PRIORITYMeta: Record<string, { label: string; color: string; borderColor: string }> = {
  critical: { label: 'Critical', color: 'text-rose-400', borderColor: 'border-rose-500/30' },
  high: { label: 'High', color: 'text-amber-400', borderColor: 'border-amber-500/30' },
  medium: { label: 'Medium', color: 'text-sky-400', borderColor: 'border-sky-500/30' },
  low: { label: 'Low', color: 'text-emerald-400', borderColor: 'border-emerald-500/30' },
};

function fmtH(h: number) { return h < 1 ? `${Math.round(h * 60)}m` : h === Math.floor(h) ? `${h}h` : `${h}h`; }
function fmtM(m: number) { return m < 60 ? `${Math.round(m)}m` : `${Math.floor(m / 60)}h${Math.round(m % 60) > 0 ? ` ${Math.round(m % 60)}m` : ''}`; }

interface SLAConfigInlineProps {
  open: boolean;
  onClose: () => void;
}

export const SLAConfigInline: React.FC<SLAConfigInlineProps> = ({ open, onClose }) => {
  const [config, setConfig] = useState<SLAConfig | null>(null);
  const [edit, setEdit] = useState<SLAConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getSLAConfig()
      .then((c) => { setConfig(c); setEdit(c); })
      .catch(() => setError('Failed to load configuration'))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const handleChange = (priority: string, field: 'sla_target_hours' | 'first_response_minutes', value: string) => {
    if (!edit) return;
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    setEdit({ ...edit, [priority]: { ...edit[priority as keyof Pick<SLAConfig, 'critical' | 'high' | 'medium' | 'low'>], [field]: num } });
  };

  const handleNearBreachChange = (value: string) => {
    if (!edit) return;
    const num = parseFloat(value);
    if (isNaN(num) || num < 1 || num > 100) return;
    setEdit({ ...edit, near_breach_percent: num });
  };

  const handleSave = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const updated = await updateSLAConfig(edit);
      setConfig(updated);
      setEdit(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(edit) !== JSON.stringify(config);

  return (
    <div className="mt-3 mb-4 rounded-xl border border-purple-500/20 bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">Configure SLA Targets</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasChanges && (
            <button onClick={() => config && setEdit(config)} className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-zinc-400 hover:text-white border border-zinc-700/50 transition-colors">
              <RotateCcw className="w-2.5 h-2.5" /> Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : saved ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Save className="w-2.5 h-2.5" />}
            {saved ? 'Saved' : 'Save'}
          </button>
          <button onClick={onClose} className="p-1 rounded text-zinc-500 hover:text-white transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {error && <div className="mb-2 px-2 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-[9px]">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-4 text-tertiary text-[10px]">
          <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> Loading...
        </div>
      ) : edit ? (
        <>
          {/* Near-Breach */}
          <div className="mb-2 px-2.5 py-2 rounded-lg border border-zinc-700/40 bg-zinc-800/30 flex items-center gap-2">
            <label className="text-[8px] font-mono uppercase text-tertiary whitespace-nowrap">Near-Breach %</label>
            <input type="number" min={1} max={100} step={5} value={edit.near_breach_percent}
              onChange={(e) => handleNearBreachChange(e.target.value)}
              className="w-16 bg-zinc-800 border border-zinc-700/50 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-purple-500/50" />
            <span className="text-[8px] text-tertiary">of target elapsed</span>
          </div>
          {/* Per-priority grid */}
          <div className="grid grid-cols-4 gap-2">
            {(['critical', 'high', 'medium', 'low'] as const).map((p) => {
              const meta = PRIORITYMeta[p];
              const pCfg = edit[p];
              return (
                <div key={p} className={`rounded-lg border ${meta.borderColor} bg-zinc-800/30 px-2 py-2`}>
                  <span className={`block text-[9px] font-semibold ${meta.color} mb-1.5`}>{meta.label}</span>
                  <div className="space-y-1.5">
                    <div>
                      <label className="block text-[7px] font-mono uppercase text-tertiary">Resolution</label>
                      <input type="number" min={0.1} step={0.5} value={pCfg.sla_target_hours}
                        onChange={(e) => handleChange(p, 'sla_target_hours', e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700/50 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-purple-500/50" />
                      <span className="block text-[7px] text-tertiary">{fmtH(pCfg.sla_target_hours)}</span>
                    </div>
                    <div>
                      <label className="block text-[7px] font-mono uppercase text-tertiary">1st Response</label>
                      <input type="number" min={0} step={5} value={pCfg.first_response_minutes}
                        onChange={(e) => handleChange(p, 'first_response_minutes', e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700/50 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-purple-500/50" />
                      <span className="block text-[7px] text-tertiary">{fmtM(pCfg.first_response_minutes)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
};
