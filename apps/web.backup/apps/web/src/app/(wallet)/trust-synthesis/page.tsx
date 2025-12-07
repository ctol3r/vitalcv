'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface TrustSynthesis {
  clinicianId: string;
  overallScore: number;
  domainScores: Record<string, number>;
  stability: {
    score: number;
    trend: string;
    volatility: number;
  };
  contradictions: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  forecast: {
    horizonDays: number;
    predictedScore: number;
    confidence: number;
    trend: string;
  };
  updatedAt: string;
}

export default function TrustSynthesisPage() {
  const [synthesis, setSynthesis] = useState<TrustSynthesis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get clinicianId from context or URL params
    const clinicianId = 'self'; // TODO: Get from auth context

    fetch(`${API_BASE}/api/trust-synthesis/${clinicianId}`)
      .then((res) => res.json())
      .then((data) => {
        setSynthesis(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !synthesis) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Trust Synthesis</CardTitle>
            <CardDescription>Error loading trust synthesis</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error || 'No data available'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Provider Trust Synthesis</CardTitle>
          <CardDescription>Comprehensive trust profile across all subsystems</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Score */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Overall Trust Score</span>
              <span className="text-sm font-bold">{synthesis.overallScore.toFixed(1)}/100</span>
            </div>
            <Progress value={synthesis.overallScore} className="h-2" />
          </div>

          {/* Domain Scores */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Domain Scores</h3>
            <div className="space-y-2">
              {Object.entries(synthesis.domainScores).map(([domain, score]) => (
                <div key={domain}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm capitalize">{domain}</span>
                    <span className="text-sm">{score.toFixed(1)}</span>
                  </div>
                  <Progress value={score} className="h-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Stability */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Stability</h3>
            <div className="flex items-center gap-4">
              <Badge variant={synthesis.stability.score > 70 ? 'default' : 'destructive'}>
                {synthesis.stability.score.toFixed(1)}/100
              </Badge>
              <span className="text-sm">Trend: {synthesis.stability.trend}</span>
              <span className="text-sm">Volatility: {synthesis.stability.volatility.toFixed(1)}%</span>
            </div>
          </div>

          {/* Forecast */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Forecast ({synthesis.forecast.horizonDays} days)</h3>
            <div className="flex items-center gap-4">
              <span className="text-sm">Predicted: {synthesis.forecast.predictedScore.toFixed(1)}</span>
              <Badge variant="outline">Confidence: {(synthesis.forecast.confidence * 100).toFixed(0)}%</Badge>
              <span className="text-sm">Trend: {synthesis.forecast.trend}</span>
            </div>
          </div>

          {/* Contradictions */}
          {synthesis.contradictions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-destructive">Contradictions</h3>
              <div className="space-y-2">
                {synthesis.contradictions.map((c, i) => (
                  <div key={i} className="p-2 bg-destructive/10 rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        {c.severity}
                      </Badge>
                      <span className="text-sm">{c.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Last updated: {new Date(synthesis.updatedAt).toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

