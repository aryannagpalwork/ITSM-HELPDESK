import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

const emptyPoint = (label: string): LifecyclePoint => ({
  label,
  created: 0,
  inProgress: 0,
  aiResolved: 0,
  agentResolved: 0,
});

const TicketTrendChart: React.FC<Props> = ({ data }) => {
  const { chart } = useTheme();

  const points = useMemo<LifecyclePoint[]>(() => {
    if (!data) return [];
    const map = new Map<string, LifecyclePoint>();
    const add = (source: TicketLifecycleTimeline['created'] | undefined, key: keyof Omit<LifecyclePoint, 'label'>) => {
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
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const formatDate = (label: string) => {
    const date = new Date(`${label}T00:00:00`);
    return Number.isNaN(date.getTime()) ? label : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="h-full flex flex-col" aria-label="Ticket lifecycle trend">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="trendCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trendInProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trendAiResolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trendAgentResolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} strokeOpacity={0.3} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={chart.stroke}
              fontSize={10}
              tickLine={false}
              minTickGap={18}
              tickFormatter={formatDate}
            />
            <YAxis stroke={chart.stroke} fontSize={10} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip
              cursor={{ stroke: chart.stroke, strokeDasharray: '4 4', strokeOpacity: 0.7 }}
              contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
              labelStyle={{ color: chart.tooltipLabel, fontSize: 10 }}
              itemStyle={{ color: chart.tooltipText, fontSize: 11 }}
              labelFormatter={(label: string) => `Date: ${formatDate(label)}`}
            />
            <Legend verticalAlign="top" align="right" height={26} wrapperStyle={{ fontSize: '10px', paddingBottom: '6px' }} />
            <Area type="monotone" dataKey="created" name="Created Tickets" stroke="#38bdf8" strokeWidth={2.5} fill="url(#trendCreated)" dot={{ r: 3 }} activeDot={{ r: 6, strokeWidth: 2 }} isAnimationActive animationDuration={700} />
            <Area type="monotone" dataKey="inProgress" name="In Progress" stroke="#fbbf24" strokeWidth={2.5} fill="url(#trendInProgress)" dot={{ r: 3 }} activeDot={{ r: 6, strokeWidth: 2 }} isAnimationActive animationDuration={700} />
            <Area type="monotone" dataKey="aiResolved" name="Resolved by AI" stroke="#a78bfa" strokeWidth={2.5} fill="url(#trendAiResolved)" dot={{ r: 3 }} activeDot={{ r: 6, strokeWidth: 2 }} isAnimationActive animationDuration={700} />
            <Area type="monotone" dataKey="agentResolved" name="Resolved by Agent" stroke="#22d3ee" strokeWidth={2.5} fill="url(#trendAgentResolved)" dot={{ r: 3 }} activeDot={{ r: 6, strokeWidth: 2 }} isAnimationActive animationDuration={700} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TicketTrendChart;
