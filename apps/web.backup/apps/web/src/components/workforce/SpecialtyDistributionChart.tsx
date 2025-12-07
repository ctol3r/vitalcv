/**
 * Specialty Distribution Chart Component
 * Phase 1: Task 4 - Specialty distribution visualization
 */

'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { SpecialtyDistribution } from '@/lib/workforce/models';

interface SpecialtyDistributionChartProps {
  data: SpecialtyDistribution[];
}

export function SpecialtyDistributionChart({ data }: SpecialtyDistributionChartProps) {
  const chartData = data.map((item) => ({
    specialty: item.specialty,
    count: item.count,
    percentage: item.percentage,
    averageTrustScore: item.averageTrustScore,
    complianceRate: item.complianceRate * 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="specialty"
          angle={-45}
          textAnchor="end"
          height={100}
          interval={0}
          fontSize={12}
        />
        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
        <Tooltip
          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
          formatter={(value: number, name: string) => {
            if (name === 'percentage') return [`${value.toFixed(1)}%`, 'Percentage'];
            if (name === 'complianceRate') return [`${value.toFixed(1)}%`, 'Compliance Rate'];
            if (name === 'averageTrustScore') return [value.toFixed(2), 'Avg Trust Score'];
            return [value, name];
          }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Count" />
        <Bar yAxisId="right" dataKey="averageTrustScore" fill="#82ca9d" name="Avg Trust Score" />
      </BarChart>
    </ResponsiveContainer>
  );
}








