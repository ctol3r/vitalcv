'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Shield, TrendingUp, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function EmployerReliabilityPage() {
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<number | null>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [orgId] = useState('demo-org-1'); // In production, get from auth

  useEffect(() => {
    loadReliability();
  }, [orgId]);

  async function loadReliability() {
    try {
      setLoading(true);
      const [scoreRes, anomaliesRes] = await Promise.all([
        fetch(`${API_BASE}/api/employer-reliability/${orgId}`),
        fetch(`${API_BASE}/api/employer-reliability/${orgId}/anomalies`),
      ]);

      const scoreData = await scoreRes.json();
      if (scoreData.success) {
        setScore(scoreData.score);
      }

      const anomaliesData = await anomaliesRes.json();
      if (anomaliesData.success) {
        setAnomalies(anomaliesData.anomalies.anomalies || []);
      }
    } catch (error) {
      console.error('Failed to load reliability:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employer Reliability Grid</h1>
        <p className="text-muted-foreground mt-2">
          Holistic view of employer trust, hiring behavior, safety, and compliance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Reliability Score
            </CardTitle>
            <CardDescription>Overall trust and compliance rating</CardDescription>
          </CardHeader>
          <CardContent>
            {score !== null && (
              <>
                <div className="text-3xl font-bold mb-2">{score.toFixed(1)}/100</div>
                <Progress value={score} className="mt-4" />
                <div className="flex items-center gap-2 mt-4">
                  {score >= 80 ? (
                    <Badge variant="default" className="bg-green-500">
                      High Reliability
                    </Badge>
                  ) : score >= 60 ? (
                    <Badge variant="default" className="bg-yellow-500">
                      Medium Reliability
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-red-500">
                      Low Reliability
                    </Badge>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Hiring Behavior
            </CardTitle>
            <CardDescription>Verification accuracy and oversight</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Verification Accuracy</span>
                <span className="text-sm font-medium">95%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Sanction Oversight</span>
                <span className="text-sm font-medium">90%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Compliance Flagging</span>
                <span className="text-sm font-medium">85%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {anomalies.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Detected Anomalies
            </CardTitle>
            <CardDescription>{anomalies.length} issue(s) found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anomalies.map((anomaly, i) => (
                <div key={i} className="p-3 border rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{anomaly.type}</span>
                    <Badge variant="outline">
                      {anomaly.value < anomaly.threshold ? 'Below Threshold' : 'Warning'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Value: {anomaly.value.toFixed(2)} • Threshold: {anomaly.threshold}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

