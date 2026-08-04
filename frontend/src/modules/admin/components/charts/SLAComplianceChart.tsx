import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Maximize2, X } from 'lucide-react';
import { useTheme } from '../../../../shared/ThemeContext';
import { SLAAnalytics } from '../../../../shared/types';

interface Props {
  data: SLAAnalytics[];
}

const PRIORITY_ORDER = ['high', 'medium', 'low', 'critical'];

const formatTarget = (hours: number | null) => {
  if (hours === null) return 'Configured per ticket';
  if (hours < 1) return `${Math.round(hours * 60)} Minutes`;
  return `${hours} Hours`;
};

const SLAComplianceChart: React.FC<Props> = ({ data }) => {
  const { chart } = useTheme();
  const [isFullView, setIsFullView] = useState(false);
  const rows = useMemo(() => (
    [...data]
      .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority.toLowerCase()) - PRIORITY_ORDER.indexOf(b.priority.toLowerCase()))
      .map(item => ({
        ...item,
        priority: item.priority.charAt(0).toUpperCase() + item.priority.slice(1).toLowerCase(),
      }))
  ), [data]);

  return (
    <div className="h-full flex flex-col relative">
      <button
        type="button"
        onClick={() => setIsFullView(true)}
        className="absolute right-1 top-1 z-10 rounded-lg border border-token p-1.5 text-tertiary hover-text"
        aria-label="Open full SLA compliance view"
        title="View full SLA details"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 24, right: 12, left: 4, bottom: 30 }} barGap={6}>
        <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="priority" stroke={chart.stroke} fontSize={10} tickLine={false} axisLine={{ stroke: chart.stroke }}>
          <Label value="Priority" position="bottom" offset={12} fill={chart.stroke} fontSize={10} />
        </XAxis>
        <YAxis stroke={chart.stroke} fontSize={10} tickLine={false} allowDecimals={false} width={32}>
          <Label value="Resolved tickets" angle={-90} position="insideLeft" fill={chart.stroke} fontSize={10} />
        </YAxis>
        <Tooltip
          cursor={{ fill: chart.grid, opacity: 0.12 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0].payload as SLAAnalytics;
            return (
              <div style={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, padding: 10, color: chart.tooltipText, fontSize: 11 }}>
                <div style={{ color: chart.tooltipLabel, marginBottom: 5 }}>Priority: {label}</div>
                <div>SLA Target: {formatTarget(item.slaTargetHours)}</div>
                <div>Resolved Within SLA: {item.withinSla}</div>
                <div>Resolved After SLA Breach: {item.breached}</div>
                <div>Active SLA Tickets: {item.active}</div>
                <div>Compliance: {item.compliance}%</div>
              </div>
            );
          }}
        />
        <Bar dataKey="withinSla" name="Resolved Within SLA" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700}>
          <LabelList dataKey="withinSla" position="top" fill={chart.stroke} fontSize={9} formatter={(value: number) => value > 0 ? value : ''} />
        </Bar>
        <Bar dataKey="breached" name="Resolved After SLA Breach" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700}>
          <LabelList dataKey="breached" position="top" fill={chart.stroke} fontSize={9} formatter={(value: number) => value > 0 ? value : ''} />
        </Bar>
        <Bar dataKey="active" name="Not Resolved" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700}>
          <LabelList dataKey="active" position="top" fill={chart.stroke} fontSize={9} formatter={(value: number) => value > 0 ? value : ''} />
        </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex h-8 shrink-0 items-end justify-center gap-5 pb-1 text-[10px] text-secondary" aria-label="SLA legend">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />Resolved Within SLA</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />Resolved After SLA Breach</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />Not Resolved</span>
      </div>

      {isFullView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="sla-full-view-title">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-token bg-card-solid shadow-2xl">
            <div className="flex items-center justify-between border-b border-token px-5 py-4">
              <div>
                <h2 id="sla-full-view-title" className="text-sm font-semibold text-primary">Full SLA Compliance Details</h2>
                <p className="mt-1 text-[10px] text-tertiary">Priority-wise ticket resolution and SLA classification</p>
              </div>
              <button type="button" onClick={() => setIsFullView(false)} className="rounded-lg border border-token p-2 text-tertiary hover-text" aria-label="Close full SLA view">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-auto p-5">
              <div className="mb-5 h-[360px] rounded-xl border border-token bg-app p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} margin={{ top: 24, right: 18, left: 8, bottom: 34 }} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.25} vertical={false} />
                    <XAxis dataKey="priority" stroke={chart.stroke} fontSize={10} tickLine={false}>
                      <Label value="Priority" position="bottom" offset={12} fill={chart.stroke} fontSize={10} />
                    </XAxis>
                    <YAxis stroke={chart.stroke} fontSize={10} tickLine={false} allowDecimals={false} width={38}>
                      <Label value="Tickets" angle={-90} position="insideLeft" fill={chart.stroke} fontSize={10} />
                    </YAxis>
                    <Tooltip
                      cursor={{ fill: chart.grid, opacity: 0.12 }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload as SLAAnalytics;
                        return (
                          <div style={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, padding: 10, color: chart.tooltipText, fontSize: 11 }}>
                            <div style={{ color: chart.tooltipLabel, marginBottom: 5 }}>Priority: {label}</div>
                            <div>Total: {item.withinSla + item.breached + item.active + item.nearBreach}</div>
                            <div>Resolved Within SLA: {item.withinSla}</div>
                            <div>Resolved After SLA Breach: {item.breached}</div>
                            <div>Not Resolved: {item.active + item.nearBreach}</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="withinSla" name="Resolved Within SLA" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="breached" name="Resolved After SLA Breach" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="active" name="Not Resolved" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto rounded-xl border border-token">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead className="bg-app text-[9px] font-mono uppercase tracking-wide text-tertiary">
                    <tr>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3 text-right">Total Tickets</th>
                      <th className="px-4 py-3 text-right">Resolved</th>
                      <th className="px-4 py-3 text-right">Not Resolved</th>
                      <th className="px-4 py-3 text-right">Within SLA</th>
                      <th className="px-4 py-3 text-right">SLA Breached</th>
                      <th className="px-4 py-3 text-right">Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-token text-[11px] text-secondary">
                    {rows.map(item => {
                      const notResolved = item.active + item.nearBreach;
                      const resolved = item.withinSla + item.breached;
                      return (
                        <tr key={item.priority} className="transition-colors hover:bg-app">
                          <td className="px-4 py-3 font-semibold text-primary">{item.priority}</td>
                          <td className="px-4 py-3 text-right font-mono text-primary">{resolved + notResolved}</td>
                          <td className="px-4 py-3 text-right font-mono text-sky-400">{resolved}</td>
                          <td className="px-4 py-3 text-right font-mono text-amber-400">{notResolved}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400">{item.withinSla}</td>
                          <td className="px-4 py-3 text-right font-mono text-rose-400">{item.breached}</td>
                          <td className="px-4 py-3 text-right font-mono text-primary">{item.compliance}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && <p className="py-10 text-center text-xs text-tertiary">No SLA ticket data available.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SLAComplianceChart;
