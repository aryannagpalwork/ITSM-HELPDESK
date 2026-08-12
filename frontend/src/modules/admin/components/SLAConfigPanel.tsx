import React, { useEffect, useState } from 'react';
import { Settings, Save, Loader2, Check, RotateCcw, X } from 'lucide-react';
import { getSLAConfig, updateSLAConfig, SLAConfig } from '../../../shared/api';

const PRIORITYMeta: Record<string, { label: string; color: string; borderColor: string }> = {
  critical: { label: 'Critical', color: 'text-rose-400', borderColor: 'border-rose-500/25' },
  high: { label: 'High', color: 'text-amber-400', borderColor: 'border-amber-500/25' },
  medium: { label: 'Medium', color: 'text-sky-400', borderColor: 'border-sky-500/25' },
  low: { label: 'Low', color: 'text-emerald-400', borderColor: 'border-emerald-500/25' },
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
    <div className="sla-config-inline mt-3 mb-4 rounded-2xl border border-token bg-card-solid p-4 shadow-sm shadow-black/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-token bg-accent-soft text-accent">
            <Settings className="w-4 h-4" />
          </span>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Configure SLA Targets</span>
            <p className="text-[10px] text-primary mt-0.5">Adjust targets by priority without changing workflow behavior.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasChanges && (
            <button onClick={() => config && setEdit(config)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold text-primary border border-token bg-card hover-elev transition-colors">
              <RotateCcw className="w-2.5 h-2.5" /> Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-accent hover:opacity-95 border border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            style={{ color: 'var(--accent-primary-contrast)' }}
          >
            {saving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : saved ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Save className="w-2.5 h-2.5" />}
            {saved ? 'Saved' : 'Save'}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-primary hover-elev transition-colors border border-transparent">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {error && <div className="mb-3 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-[10px] font-medium">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-primary text-[11px] font-medium">
          <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> Loading...
        </div>
      ) : edit ? (
        <>
          {/* Near-Breach */}
          <div className="mb-3 px-3 py-3 rounded-xl border border-token bg-app flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-primary whitespace-nowrap">Near-Breach %</label>
            <input type="number" min={1} max={100} step={5} value={edit.near_breach_percent}
              onChange={(e) => handleNearBreachChange(e.target.value)}
              className="w-full sm:w-20 input-token rounded-lg px-3 py-2 text-[12px] font-semibold outline-none" />
            <span className="text-[10px] text-primary">of target elapsed</span>
          </div>
          {/* Per-priority grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {(['critical', 'high', 'medium', 'low'] as const).map((p) => {
              const meta = PRIORITYMeta[p];
              const pCfg = edit[p];
              return (
                <div key={p} className={`rounded-xl border ${meta.borderColor} bg-card px-3 py-3 shadow-sm`}>
                  <span className={`inline-flex items-center rounded-full border ${meta.borderColor} bg-card-solid px-2.5 py-1 text-[10px] font-semibold ${meta.color} mb-3`}>{meta.label}</span>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">Resolution</label>
                      <input type="number" min={0.1} step={0.5} value={pCfg.sla_target_hours}
                        onChange={(e) => handleChange(p, 'sla_target_hours', e.target.value)}
                        className="w-full input-token rounded-lg px-3 py-2 text-[12px] font-semibold outline-none" />
                      <span className="block text-[10px] text-primary mt-1">{fmtH(pCfg.sla_target_hours)}</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">1st Response</label>
                      <input type="number" min={0} step={5} value={pCfg.first_response_minutes}
                        onChange={(e) => handleChange(p, 'first_response_minutes', e.target.value)}
                        className="w-full input-token rounded-lg px-3 py-2 text-[12px] font-semibold outline-none" />
                      <span className="block text-[10px] text-primary mt-1">{fmtM(pCfg.first_response_minutes)}</span>
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
