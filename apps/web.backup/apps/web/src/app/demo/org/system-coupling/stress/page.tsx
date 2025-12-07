'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Calendar } from 'lucide-react';
import { SystemStressSurface } from '@/components/systemCoupling/SystemStressSurface';

// Mock data: stress levels over time for different departments
const generateMockStressData = (departments: string[], timeSteps: number) => {
  const data: Array<{ department: string; time: number; stress: number }> = [];

  departments.forEach((dept) => {
    for (let t = 0; t < timeSteps; t++) {
      // Simulate varying stress levels with some patterns
      let baseStress = 0.4;
      if (dept === 'anesthesia' || dept === 'or') {
        baseStress = 0.6 + Math.sin(t / 3) * 0.2; // Higher baseline with variation
      } else if (dept === 'cardiology') {
        baseStress = 0.5 + Math.sin(t / 4) * 0.15;
      }

      // Add some noise
      const noise = (Math.random() - 0.5) * 0.1;
      const stress = Math.max(0, Math.min(1, baseStress + noise));

      data.push({ department: dept, time: t, stress });
    }
  });

  return data;
};

const DEPARTMENTS = [
  'anesthesia',
  'or',
  'cardiology',
  'radiology',
  'pharmacy',
  'lab',
  'credentialing',
];

const TIME_RANGES = [
  { label: '24 Hours', value: 24, start: 0, end: 23 },
  { label: '7 Days', value: 168, start: 0, end: 167 },
  { label: '30 Days', value: 720, start: 0, end: 719 },
];

export default function SystemStressSurfacePage() {
  const [timeRange, setTimeRange] = useState(TIME_RANGES[0]);
  const [refreshKey, setRefreshKey] = useState(0);

  const stressData = useMemo(() => {
    return generateMockStressData(DEPARTMENTS, timeRange.value);
  }, [timeRange, refreshKey]);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • System Coupling</p>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" aria-hidden="true" />
            System Stress Surface
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Heatmap visualization showing predicted stress levels across departments over time. Darker colors indicate
            higher stress levels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={timeRange.label}
            onValueChange={(value) => {
              const range = TIME_RANGES.find((r) => r.label === value);
              if (range) setTimeRange(range);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.label} value={range.label}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
            <Calendar className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>
      </header>

      <SystemStressSurface
        data={stressData}
        departments={DEPARTMENTS}
        timeRange={timeRange}
        title="System Stress Heatmap"
        description={`Predicted stress propagation over ${timeRange.label.toLowerCase()}`}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interpretation Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium mb-1">Color Coding</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Red: Critical stress (≥80%)</li>
                <li>Orange: High stress (60-79%)</li>
                <li>Amber: Medium stress (40-59%)</li>
                <li>Yellow: Low stress (20-39%)</li>
                <li>Green: Very low stress (&lt;20%)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Reading the Heatmap</p>
              <p className="text-muted-foreground">
                Each row represents a department. Each column represents a time step. Hover over cells to see exact
                stress values.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium mb-1">Peak Stress Times</p>
              <p className="text-muted-foreground">
                Identify when departments experience maximum stress to plan resource allocation and interventions.
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">Propagation Patterns</p>
              <p className="text-muted-foreground">
                Observe how stress spreads from one department to another through dependencies, helping predict cascade
                failures.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

