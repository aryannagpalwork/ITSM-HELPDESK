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
import { AICopilotTimeline } from '../../../../shared/types';

interface Props {
  data: AICopilotTimeline | null;
}

interface MergedPoint {
  label: string;
  chats: number;
  resolved: number;
  escalated: number;
}

/** AI Copilot chats / resolved / escalated trend across the selected range. */
const AICopilotTrendChart: React.FC<Props> = ({ data }) => {
  const { chart } = useTheme();

  const merged = useMemo<MergedPoint[]>(() => {
    if (!data) return [];
    const map = new Map<string, MergedPoint>();
    const ensure = (label: string) =>
      map.get(label) || { label, chats: 0, resolved: 0, escalated: 0 };
    data.chats.forEach(p => {
      const e = ensure(p.label);
      e.chats = p.value;
      map.set(p.label, e);
    });
    data.resolved.forEach(p => {
      const e = ensure(p.label);
      e.resolved = p.value;
      map.set(p.label, e);
    });
    data.escalated.forEach(p => {
      const e = ensure(p.label);
      e.escalated = p.value;
      map.set(p.label, e);
    });
    return Array.from(map.values());
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={merged} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="aiChats" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chart.palette[0] || '#6366f1'} stopOpacity={0.25} />
            <stop offset="95%" stopColor={chart.palette[0] || '#6366f1'} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="aiResolved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chart.palette[1] || '#10b981'} stopOpacity={0.25} />
            <stop offset="95%" stopColor={chart.palette[1] || '#10b981'} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="aiEscalated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chart.palette[3] || '#f59e0b'} stopOpacity={0.25} />
            <stop offset="95%" stopColor={chart.palette[3] || '#f59e0b'} stopOpacity={0} />
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
        <Area type="monotone" dataKey="chats" stroke={chart.palette[0] || '#6366f1'} strokeWidth={2} fill="url(#aiChats)" dot={false} name="Chats" />
        <Area type="monotone" dataKey="resolved" stroke={chart.palette[1] || '#10b981'} strokeWidth={2} fill="url(#aiResolved)" dot={false} name="Resolved" />
        <Area type="monotone" dataKey="escalated" stroke={chart.palette[3] || '#f59e0b'} strokeWidth={2} fill="url(#aiEscalated)" dot={false} name="Escalated" />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default AICopilotTrendChart;
