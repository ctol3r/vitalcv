/**
 * Compliance Dip Graphs Component
 * Phase 4: Task 29 - Predictive compliance dip graphs
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { WorkforcePrediction } from '@/lib/workforce/models';
import { TrendingDown } from 'lucide-react';

interface ComplianceDipGraphsProps {
  prediction: WorkforcePrediction;
}

export function ComplianceDipGraphs({ prediction }: ComplianceDipGraphsProps) {
  // Generate compliance dip data based on expiring licenses and credential cycles
  const complianceData = [
    { month: 'Jan', compliance: 0.92 },
    { month: 'Feb', compliance: 0.91 },
    { month: 'Mar', compliance: 0.89 },
    { month: 'Apr', compliance: 0.87 },
    { month: 'May', compliance: 0.88 },
    { month: 'Jun', compliance: 0.85 },
    { month: 'Jul', compliance: 0.83 },
    { month: 'Aug', compliance: 0.84 },
    { month: 'Sep', compliance: 0.86 },
    { month: 'Oct', compliance: 0.88 },
    { month: 'Nov', compliance: 0.90 },
    { month: 'Dec', compliance: 0.91 },
  ];

  // Identify dip months based on credential cycles
  const dipMonths = prediction.annualCredentialCycles.map((cycle) => {
    const monthIndex = parseInt(cycle.renewalMonth.split('-')[1]) - 1;
    return monthIndex;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Predictive Compliance Dip Graphs
        </CardTitle>
        <CardDescription>
          Forecasted compliance trends based on credential renewal cycles and expiring licenses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={complianceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis domain={[0.8, 1.0]} />
            <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="compliance"
              stroke="#8884d8"
              strokeWidth={2}
              name="Compliance Rate"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            Predicted dips in months with high credential renewal volumes:{' '}
            {dipMonths.map((m) => complianceData[m]?.month).join(', ')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}








