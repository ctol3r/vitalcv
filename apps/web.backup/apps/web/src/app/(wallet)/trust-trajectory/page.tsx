'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface TrustTrajectoryPoint {
  timestamp: string;
  trustScore: number;
  confidence: number;
}

interface TrustTrajectory {
  trajectory: {
    points: TrustTrajectoryPoint[];
    currentScore: number;
    trend: string;
    volatility: number;
  };
  anomalies: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  narrative: {
    summary: string;
    currentStatus: string;
    recommendations: string[];
  };
}

export default function TrustTrajectoryPage() {
  const [trajectory, setTrajectory] = useState<TrustTrajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState<string>('');

  useEffect(() => {
    // Get clinician ID from context or params
    const id = 'self'; // Replace with actual clinician ID
    setClinicianId(id);

    fetch(`${API_BASE}/api/trust/trajectory/${id}`)
      .then(res => res.json())
      .then(data => {
        setTrajectory(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load trust trajectory', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!trajectory) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Trust Trajectory</CardTitle>
            <CardDescription>No trajectory data available</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const chartData = trajectory.trajectory.points.map(p => ({
    date: new Date(p.timestamp).toLocaleDateString(),
    score: Math.round(p.trustScore * 100),
    confidence: Math.round(p.confidence * 100),
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Trust Trajectory</CardTitle>
          <CardDescription>Track and forecast trust in clinicians over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Score</p>
                <p className="text-2xl font-bold">{Math.round(trajectory.trajectory.currentScore * 100)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <p className="text-2xl font-bold capitalize">{trajectory.trajectory.trend}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Volatility</p>
                <p className="text-2xl font-bold">
                  {trajectory.trajectory.volatility < 0.1 ? 'Low' :
                   trajectory.trajectory.volatility < 0.2 ? 'Moderate' : 'High'}
                </p>
              </div>
            </div>

            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <ReferenceLine y={70} stroke="green" strokeDasharray="3 3" label="High" />
                  <ReferenceLine y={40} stroke="red" strokeDasharray="3 3" label="Low" />
                  <Line type="monotone" dataKey="score" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {trajectory.anomalies.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Anomalies</h3>
                <div className="space-y-2">
                  {trajectory.anomalies.map((anomaly, i) => (
                    <div key={i} className="p-3 border rounded">
                      <p className="font-medium capitalize">{anomaly.type.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                      <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                        anomaly.severity === 'high' ? 'bg-red-100 text-red-800' :
                        anomaly.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {anomaly.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-2">Summary</h3>
              <p className="text-sm text-muted-foreground">{trajectory.narrative.summary}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
              <ul className="list-disc list-inside space-y-1">
                {trajectory.narrative.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-muted-foreground">{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

