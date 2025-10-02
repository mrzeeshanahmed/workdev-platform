import React from 'react';
import { Box, Typography } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { BudgetBreakdownChartProps } from '../types';

const COLORS = ['#2196F3', '#4CAF50', '#FFC107', '#FF9800', '#9C27B0'];

const PHASE_LABELS: Record<string, string> = {
  planning_and_design: 'Planning & Design',
  development: 'Development',
  testing_and_qa: 'Testing & QA',
  deployment_and_launch: 'Deployment',
  buffer_contingency: 'Buffer / Contingency',
};

export const BudgetBreakdownChart: React.FC<BudgetBreakdownChartProps> = ({ breakdown }) => {
  const chartData = Object.entries(breakdown).map(([key, value]) => ({
    name: PHASE_LABELS[key] || key,
    value: value,
    percentage: 0, // Will be calculated
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  chartData.forEach((item) => {
    item.percentage = (item.value / total) * 100;
  });

  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
    const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: { percentage: number } }>;
  }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: 'background.paper',
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: 2,
          }}
        >
          <Typography variant="body2" fontWeight="bold">
            {payload[0].name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ${payload[0].value.toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {payload[0].payload.percentage.toFixed(1)}% of total
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>

      <Box sx={{ mt: 2 }}>
        {chartData.map((item, index) => (
          <Box
            key={item.name}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: COLORS[index % COLORS.length],
                  mr: 1,
                }}
              />
              <Typography variant="body2">{item.name}</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" fontWeight="bold">
                ${item.value.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.percentage.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
