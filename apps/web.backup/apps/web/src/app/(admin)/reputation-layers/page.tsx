'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Layers, TrendingUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface ReputationLayers {
  credentialReliability: { score: number; accuracy: number };
  complianceDiscipline: { score: number; cmePattern: any; renewalBehavior: any; documentAccuracy: number };
  professionalismInteraction: { score: number; communicationQuality: number; responseTime: number };
  futureRiskPrediction: { score: number; probability: number; factors: any[] };
}

export default function ReputationLayersPage() {
  const searchParams = useSearchParams();
  const clinicianId = searchParams.get('clinicianId') || 'self';
  const [layers, setLayers] = useState<ReputationLayers | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [gaps, setGaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [clinicianId]);

  const fetchData = async () => {
    try {
      const [layersRes, scoreRes, gapsRes] = await Promise.all([
        fetch(`${API_BASE}/api/reputation/layers/${clinicianId}`),
        fetch(`${API_BASE}/api/reputation/layers/${clinicianId}/score`),
        fetch(`${API_BASE}/api/reputation/layers/${clinicianId}/gaps`),
      ]);

      if (layersRes.ok) {
        const data = await layersRes.json();
        setLayers(data);
      }
      if (scoreRes.ok) {
        const data = await scoreRes.json();
        setScore(data.score);
      }
      if (gapsRes.ok) {
        const data = await gapsRes.json();
        setGaps(data.gaps || []);
      }
    } catch (error) {
      console.error('Failed to fetch reputation layers', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multi-Layer Reputation AI</h1>
        <p className="text-muted-foreground mt-2">Deep learning analytical layer for clinician reliability</p>
      </div>

      {score !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Overall Reputation Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{(score * 100).toFixed(1)}%</span>
                <Badge variant={score >= 0.8 ? 'default' : score >= 0.6 ? 'secondary' : 'destructive'}>
                  {score >= 0.8 ? 'Excellent' : score >= 0.6 ? 'Good' : 'Needs Improvement'}
                </Badge>
              </div>
              <Progress value={score * 100} />
            </div>
          </CardContent>
        </Card>
      )}

      {layers && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Credential Reliability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Score</span>
                  <span className="font-bold">{(layers.credentialReliability.score * 100).toFixed(1)}%</span>
                </div>
                <Progress value={layers.credentialReliability.score * 100} />
                <p className="text-sm text-muted-foreground">
                  Accuracy: {(layers.credentialReliability.accuracy * 100).toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Compliance Discipline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Score</span>
                  <span className="font-bold">{(layers.complianceDiscipline.score * 100).toFixed(1)}%</span>
                </div>
                <Progress value={layers.complianceDiscipline.score * 100} />
                <p className="text-sm text-muted-foreground">
                  Document Accuracy: {(layers.complianceDiscipline.documentAccuracy * 100).toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Professionalism Interaction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Score</span>
                  <span className="font-bold">{(layers.professionalismInteraction.score * 100).toFixed(1)}%</span>
                </div>
                <Progress value={layers.professionalismInteraction.score * 100} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Future Risk Prediction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Risk Probability</span>
                  <span className="font-bold">{(layers.futureRiskPrediction.probability * 100).toFixed(1)}%</span>
                </div>
                <Progress value={layers.futureRiskPrediction.probability * 100} />
                {layers.futureRiskPrediction.factors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {layers.futureRiskPrediction.factors.slice(0, 2).map((factor: any, idx: number) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        {factor.factor}: {(factor.weight * 100).toFixed(0)}%
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Anomaly Gaps Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gaps.map((gap, idx) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <Badge variant={gap.severity === 'high' ? 'destructive' : 'secondary'} className="mb-2">
                    {gap.severity}
                  </Badge>
                  <p className="text-sm">{gap.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

