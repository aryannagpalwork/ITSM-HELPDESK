import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Maximize2, MoreVertical, RotateCcw, X } from 'lucide-react';
import { useTheme } from '../../../../shared/ThemeContext';
import { TicketLifecycleTimeline } from '../../../../shared/types';

interface Props {
  data: TicketLifecycleTimeline | null;
}

interface LifecyclePoint {
  label: string;
  created: number;
  inProgress: number;
  aiResolved: number;
  agentResolved: number;
}

type SeriesKey = keyof Omit<LifecyclePoint, 'label'>;
interface SelectedPoint {
  label: string;
  key: SeriesKey;
  value: number;
}

const SERIES: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: 'created', label: 'Created Tickets', color: '#3b82f6' },
  { key: 'inProgress', label: 'In Progress', color: '#a855f7' },
  { key: 'aiResolved', label: 'Resolved by AI', color: '#22c55e' },
  { key: 'agentResolved', label: 'Resolved by Agent', color: '#ec4899' },
];

const emptyPoint = (label: string): LifecyclePoint => ({ label, created: 0, inProgress: 0, aiResolved: 0, agentResolved: 0 });

const formatDate = (label: string) => {
  const date = new Date(`${label}T00:00:00`);
  return Number.isNaN(date.getTime()) ? label : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
};

const TooltipContent: React.FC<{ active?: boolean; payload?: Array<{ dataKey?: string; value?: number; color?: string }>; label?: string }> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-token bg-card-solid px-3 py-2.5 text-[10px] shadow-xl">
      <p className="mb-2 font-semibold text-primary">{label ? `Date: ${formatDate(label)}` : 'Selected date'}</p>
      {SERIES.map(series => {
        const item = payload.find(entry => entry.dataKey === series.key);
        return (
          <div key={series.key} className="flex items-center justify-between gap-5 py-0.5 text-secondary">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />{series.label}</span>
            <span className="font-mono font-semibold text-primary">{item?.value ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
};

const TicketLifecycleDetailChart: React.FC<Props> = ({ data }) => {
  const { chart } = useTheme();
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({ created: true, inProgress: true, aiResolved: true, agentResolved: true });
  const [selected, setSelected] = useState<SelectedPoint | null>(null);
  const [isFullView, setIsFullView] = useState(false);

  const points = useMemo<LifecyclePoint[]>(() => {
    if (!data) return [];
    const map = new Map<string, LifecyclePoint>();
    const add = (source: TicketLifecycleTimeline['created'] | undefined, key: SeriesKey) => {
      (source || []).forEach(point => {
        const current = map.get(point.label) || emptyPoint(point.label);
        current[key] = Number(point.value) || 0;
        map.set(point.label, current);
      });
    };
    add(data.created, 'created');
    add(data.inProgress, 'inProgress');
    add(data.aiResolved, 'aiResolved');
    add(data.agentResolved, 'agentResolved');
    const labels = Array.from(map.keys()).sort();
    if (labels.length === 0) return [];

    return labels.map(label => map.get(label) || emptyPoint(label));
  }, [data]);

  const hasData = points.some(point => SERIES.some(series => point[series.key] > 0));
  const maxValue = Math.max(...points.flatMap(point => SERIES.map(series => point[series.key])), 1);

  const toggleSeries = (key: SeriesKey) => {
    setVisible(current => ({ ...current, [key]: !current[key] }));
    if (selected?.key === key) setSelected(null);
  };

  return (
    <div className="h-full min-h-0 flex flex-col" aria-label="Selectable ticket lifecycle detail chart">
      <div className="flex min-h-[38px] items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-primary">Lifecycle Detail</h3>
          <p className="mt-1 text-[10px] text-tertiary">Daily ticket movement</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="group relative">
            <button type="button" onClick={() => setIsFullView(true)} className="rounded-lg border border-token p-1.5 text-tertiary hover-text" aria-label="Open full lifecycle graph" title="View full month graph">
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden whitespace-nowrap rounded-md border border-token bg-card-solid px-2 py-1 text-[9px] text-secondary shadow-lg group-hover:block">Open full view</span>
          </div>
        </div>
      </div>

      <div className="min-h-[180px] flex-1 shrink-0 pt-5">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 14, right: 10, left: 8, bottom: 30 }}>
              <defs>
                {SERIES.map(s => (
                  <linearGradient key={s.key} id={`lifecycle-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.25} vertical={false} />
              <XAxis dataKey="label" stroke={chart.stroke} fontSize={9} tickLine={false} minTickGap={16} tickFormatter={formatDate}>
                <Label value="Date" position="bottom" offset={12} fill={chart.stroke} fontSize={10} />
              </XAxis>
              <YAxis domain={[0, maxValue]} stroke={chart.stroke} fontSize={9} tickLine={false} allowDecimals={false} width={34}>
                <Label value="Number of Tickets" angle={-90} position="insideLeft" offset={8} fill={chart.stroke} fontSize={10} />
              </YAxis>
              <Tooltip
                cursor={{ stroke: chart.stroke, strokeDasharray: '4 4', strokeOpacity: 0.7 }}
                content={<TooltipContent />}
              />
              {SERIES.map(series => visible[series.key] && (
                <Area
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2.25}
                  fill={`url(#lifecycle-${series.key})`}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 5, strokeWidth: 2, stroke: chart.tooltipBg }}
                  isAnimationActive
                  animationDuration={700}
                  onClick={(entry: unknown) => {
                    const clicked = entry as { payload?: LifecyclePoint; value?: number };
                    const point = clicked?.payload;
                    if (point) setSelected({ label: point.label, key: series.key, value: Number(clicked.value ?? point[series.key]) || 0 });
                  }}
                />
              ))}
              {selected && visible[selected.key] && (
                <ReferenceDot x={selected.label} y={selected.value} r={5} fill={SERIES.find(series => series.key === selected.key)?.color} stroke={chart.tooltipBg} strokeWidth={2} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-[10px] text-tertiary">No lifecycle data available for the selected period.</div>
        )}
      </div>

      <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 border-t border-token pt-3" aria-label="Lifecycle chart legend">
        <div className="flex flex-wrap items-center gap-1.5">
          {SERIES.map(series => (
            <button
              key={series.key}
              type="button"
              onClick={() => toggleSeries(series.key)}
              aria-pressed={visible[series.key]}
              className={`inline-flex items-center gap-1.5 rounded-md border border-token bg-app px-2 py-1 text-[10px] font-medium transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${visible[series.key] ? 'text-secondary' : 'text-tertiary opacity-45'}`}
              title={`${visible[series.key] ? 'Hide' : 'Show'} ${series.label}`}
            >
              <span className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: series.color }} />
              {series.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setVisible({ created: true, inProgress: true, aiResolved: true, agentResolved: true })} className="inline-flex items-center gap-1 rounded-md border border-token px-2 py-1 text-[10px] font-medium text-tertiary hover-text" aria-label="Reset lifecycle legend">
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {selected && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-token bg-app px-2.5 py-1.5 text-[9px]" aria-live="polite">
          <span className="text-tertiary">Selected {formatDate(selected.label)} · <span className="text-secondary">{SERIES.find(series => series.key === selected.key)?.label}: {selected.value}</span></span>
          <button type="button" onClick={() => setSelected(null)} className="text-tertiary hover-text" aria-label="Clear selected point">×</button>
        </div>
      )}

      {isFullView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="lifecycle-full-view-title">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-token bg-card-solid shadow-2xl">
            <div className="flex items-center justify-between border-b border-token px-5 py-4">
              <div>
                <h2 id="lifecycle-full-view-title" className="text-sm font-semibold text-primary">Full Month Lifecycle Details</h2>
                <p className="mt-1 text-[10px] text-tertiary">Daily ticket activity from the selected analytics period</p>
              </div>
              <button type="button" onClick={() => setIsFullView(false)} className="rounded-lg border border-token p-2 text-tertiary hover-text" aria-label="Close full lifecycle details">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-auto p-5">
              <div className="mb-4 flex items-center gap-2 text-[10px] text-secondary">
                <Maximize2 className="h-3.5 w-3.5 text-accent" />
                <span>{points.length} calendar days displayed</span>
              </div>
              {hasData && (
                <div className="mb-5 h-[320px] rounded-xl border border-token bg-app p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={points} margin={{ top: 16, right: 18, left: 8, bottom: 28 }}>
                      <defs>
                        {SERIES.map(s => (
                          <linearGradient key={s.key} id={`lifecycle-full-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.25} vertical={false} />
                      <XAxis dataKey="label" stroke={chart.stroke} fontSize={10} tickLine={false} minTickGap={18} tickFormatter={formatDate}>
                        <Label value="Date" position="bottom" offset={10} fill={chart.stroke} fontSize={10} />
                      </XAxis>
                      <YAxis domain={[0, maxValue]} stroke={chart.stroke} fontSize={10} tickLine={false} allowDecimals={false} width={38}>
                        <Label value="Number of Tickets" angle={-90} position="insideLeft" offset={8} fill={chart.stroke} fontSize={10} />
                      </YAxis>
                      <Tooltip cursor={{ stroke: chart.stroke, strokeDasharray: '4 4', strokeOpacity: 0.7 }} content={<TooltipContent />} />
                      {SERIES.map(series => visible[series.key] && (
                        <Area key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={series.color} strokeWidth={2.5} fill={`url(#lifecycle-full-${series.key})`} dot={false} connectNulls isAnimationActive animationDuration={700} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-token">
                <table className="w-full min-w-[620px] border-collapse text-left">
                  <thead className="bg-app text-[9px] font-mono uppercase tracking-wide text-tertiary">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Created Tickets</th>
                      <th className="px-4 py-3 text-right">In Progress</th>
                      <th className="px-4 py-3 text-right">Resolved by AI</th>
                      <th className="px-4 py-3 text-right">Resolved by Agent</th>
                      <th className="px-4 py-3 text-right">Daily Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-token text-[11px] text-secondary">
                    {points.map(point => {
                      const total = point.created + point.inProgress + point.aiResolved + point.agentResolved;
                      return (
                        <tr key={point.label} className="transition-colors hover:bg-app">
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-primary">{formatDate(point.label)}</td>
                          <td className="px-4 py-3 text-right font-mono text-sky-400">{point.created}</td>
                          <td className="px-4 py-3 text-right font-mono text-purple-400">{point.inProgress}</td>
                          <td className="px-4 py-3 text-right font-mono text-green-400">{point.aiResolved}</td>
                          <td className="px-4 py-3 text-right font-mono text-pink-400">{point.agentResolved}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-primary">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {points.length === 0 && <p className="py-10 text-center text-xs text-tertiary">No lifecycle data available for the selected period.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketLifecycleDetailChart;
