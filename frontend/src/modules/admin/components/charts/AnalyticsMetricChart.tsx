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
  Legend,
  LabelList,
} from 'recharts';
import { useTheme } from '../../../../shared/ThemeContext';
import { AnalyticsMetric } from '../../../../shared/types';

interface Props {
  data: AnalyticsMetric[];
  colors?: string[];
}

const AnalyticsMetricChart: React.FC<Props> = ({ data, colors = ['#10b981', '#f43f5e'] }) => {
  const { chart } = useTheme();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
        <XAxis dataKey="name" stroke={chart.stroke} fontSize={10} tickLine={false} />
        <YAxis stroke={chart.stroke} fontSize={10} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: '8px' }}
          labelStyle={{ color: chart.tooltipLabel, fontSize: '10px' }}
          itemStyle={{ color: chart.tooltipText, fontSize: '11px' }}
        />
        <Legend wrapperStyle={{ fontSize: '10px' }} />
        <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="value" position="top" fill={chart.stroke} fontSize={10} />
          {data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default AnalyticsMetricChart;
