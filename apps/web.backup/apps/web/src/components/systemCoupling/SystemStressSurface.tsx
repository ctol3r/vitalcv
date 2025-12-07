'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StressDataPoint {
  department: string;
  time: number; // 0-23 (hours or time steps)
  stress: number; // 0-1
}

interface SystemStressSurfaceProps {
  data: StressDataPoint[];
  departments: string[];
  timeRange?: { start: number; end: number };
  title?: string;
  description?: string;
}

export function SystemStressSurface({
  data,
  departments,
  timeRange = { start: 0, end: 23 },
  title = 'System Stress Surface',
  description = 'Heatmap showing predicted stress levels over time',
}: SystemStressSurfaceProps) {
  const width = 800;
  const height = 400;
  const cellWidth = width / (timeRange.end - timeRange.start + 1);
  const cellHeight = height / departments.length;

  // Create grid data
  const gridData = useMemo(() => {
    const grid: Map<string, number> = new Map();
    data.forEach((point) => {
      const key = `${point.department}-${point.time}`;
      grid.set(key, point.stress);
    });
    return grid;
  }, [data]);

  const getColor = (stress: number) => {
    if (stress >= 0.8) return '#dc2626'; // red-600
    if (stress >= 0.6) return '#ea580c'; // orange-600
    if (stress >= 0.4) return '#f59e0b'; // amber-500
    if (stress >= 0.2) return '#eab308'; // yellow-500
    return '#22c55e'; // green-500
  };

  const maxStress = useMemo(() => {
    return Math.max(...data.map((d) => d.stress), 0);
  }, [data]);

  const avgStress = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((sum, d) => sum + d.stress, 0) / data.length;
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Peak Stress</div>
              <div className="text-2xl font-bold text-rose-600">{(maxStress * 100).toFixed(0)}%</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Average Stress</div>
              <div className="text-2xl font-bold text-orange-600">{(avgStress * 100).toFixed(0)}%</div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="w-full overflow-auto rounded-lg border bg-slate-950/90 p-4">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
              {/* Render grid cells */}
              {departments.map((dept, deptIdx) => {
                return Array.from({ length: timeRange.end - timeRange.start + 1 }, (_, timeIdx) => {
                  const time = timeRange.start + timeIdx;
                  const key = `${dept}-${time}`;
                  const stress = gridData.get(key) || 0;
                  const x = timeIdx * cellWidth;
                  const y = deptIdx * cellHeight;

                  return (
                    <rect
                      key={`${dept}-${time}`}
                      x={x}
                      y={y}
                      width={cellWidth}
                      height={cellHeight}
                      fill={getColor(stress)}
                      opacity={0.8}
                      stroke="#1e293b"
                      strokeWidth={0.5}
                    >
                      <title>{`${dept} at time ${time}: ${(stress * 100).toFixed(0)}% stress`}</title>
                    </rect>
                  );
                });
              })}

              {/* Department labels */}
              {departments.map((dept, idx) => (
                <text
                  key={dept}
                  x={-10}
                  y={idx * cellHeight + cellHeight / 2}
                  textAnchor="end"
                  fill="white"
                  className="text-xs"
                  dominantBaseline="middle"
                >
                  {dept}
                </text>
              ))}

              {/* Time labels */}
              {Array.from({ length: timeRange.end - timeRange.start + 1 }, (_, idx) => {
                const time = timeRange.start + idx;
                return (
                  <text
                    key={time}
                    x={idx * cellWidth + cellWidth / 2}
                    y={height + 15}
                    textAnchor="middle"
                    fill="white"
                    className="text-xs"
                  >
                    {time}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Time progression</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">Stress Level:</span>
              <div className="flex items-center gap-1">
                <div className="h-4 w-4 rounded bg-green-500" />
                <span className="text-xs">Low</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-4 w-4 rounded bg-yellow-500" />
                <span className="text-xs">Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-4 w-4 rounded bg-orange-500" />
                <span className="text-xs">High</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-4 w-4 rounded bg-red-500" />
                <span className="text-xs">Critical</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

