'use client';

import { Activity, AlertTriangle, TrendingUp, Target } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface PrecisionIndex {
  overall: number;
  dimensions: {
    accuracy: number;
    reliability: number;
    timeliness: number;
    compliance: number;
    credentialFidelity: number;
  };
  anomalies: Array<{ type: string; severity: number; detectedAt: string }>;
  trajectory: Array<{ date: string; score: number }>;
}

export default function PrecisionIndexPage() {
  const [index, setIndex] = useState<PrecisionIndex | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrecisionIndex();
  }, []);

  async function fetchPrecisionIndex() {
    try {
      // Get clinicianId from session or use a default for demo
      const clinicianId = 'demo-clinician-id'; // TODO: Get from auth context
      const res = await fetch(`${API_BASE}/api/precision-index/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setIndex(data);
      }
    } catch (error) {
      console.error('Failed to fetch precision index:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!index) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Precision Index</CardTitle>
            <CardDescription>No precision data available</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const dimensions = [
    { key: 'accuracy', label: 'Accuracy', icon: Target },
    { key: 'reliability', label: 'Reliability', icon: Activity },
    { key: 'timeliness', label: 'Timeliness', icon: TrendingUp },
    { key: 'compliance', label: 'Compliance', icon: AlertTriangle },
    { key: 'credentialFidelity', label: 'Credential Fidelity', icon: Target },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Precision Index</h1>
        <p className="text-muted-foreground mt-2">
          Score each clinician's precision: accuracy, reliability, timeliness, compliance & credential fidelity
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall Precision Score</CardTitle>
          <CardDescription>Composite precision index</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{Math.round(index.overall * 100)}%</span>
              <Badge variant={index.overall >= 0.8 ? 'default' : index.overall >= 0.6 ? 'secondary' : 'destructive'}>
                {index.overall >= 0.8 ? 'High' : index.overall >= 0.6 ? 'Medium' : 'Low'}
              </Badge>
            </div>
            <Progress value={index.overall * 100} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dimensions.map(({ key, label, icon: Icon }) => {
          const value = index.dimensions[key as keyof typeof index.dimensions];
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-semibold">{Math.round(value * 100)}%</span>
                  </div>
                  <Progress value={value * 100} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {index.anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Anomalies Detected</CardTitle>
            <CardDescription>Inconsistent credential updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {index.anomalies.map((anomaly, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium">{anomaly.type}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {new Date(anomaly.detectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Badge variant={anomaly.severity > 0.7 ? 'destructive' : 'secondary'}>
                    Severity: {Math.round(anomaly.severity * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {index.trajectory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Precision Trajectory</CardTitle>
            <CardDescription>Historical precision scores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {index.trajectory.slice(0, 10).map((point, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {new Date(point.date).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2 w-48">
                    <Progress value={point.score * 100} className="flex-1" />
                    <span className="text-sm font-medium w-12 text-right">
                      {Math.round(point.score * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

