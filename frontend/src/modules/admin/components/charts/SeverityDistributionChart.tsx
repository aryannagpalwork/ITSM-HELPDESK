import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useTheme } from '../../../../shared/ThemeContext';
import { DistributionDatum } from '../../useAdminDashboard';

interface Props {
  data: DistributionDatum[];
  activeKey?: string;
  onSelect?: (key: string) => void;
}

/** Semantic severity colors (theme-consistent) keyed by ticket priority. */
export const SEVERITY_COLORS: Record<string, string> = {
  low: '#3b82f6',
  medium: '#10b981',
  high: '#f59e0b',
  critical: '#f43f5e',
};

/** Incident severity (priority) distribution for the filtered ticket set. */
const SeverityDistributionChart: React.FC<Props> = ({ data, activeKey, onSelect }) => {
  const { chart } = useTheme();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
        <XAxis dataKey="name" stroke={chart.stroke} fontSize={10} tickLine={false} />
        <YAxis stroke={chart.stroke} fontSize={10} tickLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: chart.grid, opacity: 0.25 }}
          contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: '8px' }}
          labelStyle={{ color: chart.tooltipLabel, fontSize: '10px' }}
          itemStyle={{ color: chart.tooltipText, fontSize: '11px' }}
        />
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
          name="Incidents"
          cursor={onSelect ? 'pointer' : undefined}
          onClick={(entry: any) => onSelect?.(entry?.key)}
        >
          {data.map(entry => (
            <Cell
              key={entry.key}
              fill={SEVERITY_COLORS[entry.key] || '#6366f1'}
              fillOpacity={activeKey && activeKey !== entry.key ? 0.35 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default SeverityDistributionChart;
