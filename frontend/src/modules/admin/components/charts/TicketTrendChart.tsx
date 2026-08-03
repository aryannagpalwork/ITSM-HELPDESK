import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useTheme } from '../../../../shared/ThemeContext';
import { TicketLifecycleTimeline } from '../../../../shared/types';

interface Props {
  data: TicketLifecycleTimeline | null;
}

interface MergedPoint {
  label: string;
  created: number;
  resolved: number;
}

/** Created vs resolved ticket volume (area fill) across the selected range. */
const TicketTrendChart: React.FC<Props> = ({ data }) => {
  const { chart } = useTheme();
  const createdColor = chart.palette[0] || '#8b5cf6';
  const resolvedColor = chart.palette[1] || '#10b981';

  const merged = useMemo<MergedPoint[]>(() => {
    if (!data) return [];
    const map = new Map<string, MergedPoint>();
    data.created.forEach(p => map.set(p.label, { label: p.label, created: p.value, resolved: 0 }));
    data.resolved.forEach(p => {
      const existing = map.get(p.label) || { label: p.label, created: 0, resolved: 0 };
      existing.resolved = p.value;
      map.set(p.label, existing);
    });
    return Array.from(map.values());
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={merged} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="tt-created" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={createdColor} stopOpacity={0.35} />
            <stop offset="95%" stopColor={createdColor} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="tt-resolved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={resolvedColor} stopOpacity={0.35} />
            <stop offset="95%" stopColor={resolvedColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
        <XAxis dataKey="label" stroke={chart.stroke} fontSize={10} tickLine={false} />
        <YAxis stroke={chart.stroke} fontSize={10} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: '8px' }}
          labelStyle={{ color: chart.tooltipLabel, fontSize: '10px' }}
          itemStyle={{ color: chart.tooltipText, fontSize: '11px' }}
        />
        <Legend wrapperStyle={{ fontSize: '10px' }} />
        <Area type="monotone" dataKey="created" stroke={createdColor} strokeWidth={2} fill="url(#tt-created)" name="Created" />
        <Area type="monotone" dataKey="resolved" stroke={resolvedColor} strokeWidth={2} fill="url(#tt-resolved)" name="Resolved" />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default TicketTrendChart;
