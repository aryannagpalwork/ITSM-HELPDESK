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
}

/** Distribution of the currently filtered tickets by status. */
const StatusDistributionChart: React.FC<Props> = ({ data }) => {
  const { chart } = useTheme();
  const fallback = ['#6366f1', '#10b981', '#38bdf8', '#f59e0b', '#f43f5e', '#a855f7'];

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
        <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Tickets">
          {data.map((entry, index) => (
            <Cell key={entry.key} fill={chart.palette[index] || fallback[index % fallback.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default StatusDistributionChart;
