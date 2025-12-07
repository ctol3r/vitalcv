'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Star, TrendingUp, AlertCircle, Target } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ProfileQualityPage() {
  const [loading, setLoading] = useState(true);
  const [clinicianId] = useState('demo-clinician-1'); // In production, get from auth
  const [metrics, setMetrics] = useState<any>(null);
  const [enhancement, setEnhancement] = useState<any[]>([]);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [decay, setDecay] = useState<any>(null);

  useEffect(() => {
    loadQuality();
  }, [clinicianId]);

  async function loadQuality() {
    try {
      setLoading(true);
      const [metricsRes, enhancementRes, benchmarkRes, decayRes] = await Promise.all([
        fetch(`${API_BASE}/api/profile-quality/${clinicianId}`),
        fetch(`${API_BASE}/api/profile-quality/${clinicianId}/enhancement`),
        fetch(`${API_BASE}/api/profile-quality/${clinicianId}/benchmark`),
        fetch(`${API_BASE}/api/profile-quality/${clinicianId}/decay`),
      ]);

      const metricsData = await metricsRes.json();
      if (metricsData.success) {
        setMetrics(metricsData.metrics);
      }

      const enhancementData = await enhancementRes.json();
      if (enhancementData.success) {
        setEnhancement(enhancementData.pathways || []);
      }

      const benchmarkData = await benchmarkRes.json();
      if (benchmarkData.success) {
        setBenchmark(benchmarkData.benchmark);
      }

      const decayData = await decayRes.json();
      if (decayData.success) {
        setDecay(decayData.decay);
      }
    } catch (error) {
      console.error('Failed to load quality:', error);
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
        <h1 className="text-3xl font-bold">Profile Quality</h1>
        <p className="text-muted-foreground mt-2">
          Score the completeness, strength, clarity & reliability of your profile
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Overall Quality
            </CardTitle>
            <CardDescription>Completeness, clarity, and proof strength</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics && (
              <>
                <div className="text-3xl font-bold mb-2">{metrics.overall.toFixed(1)}/100</div>
                <Progress value={metrics.overall} className="mt-4" />
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Completeness</div>
                    <div className="text-lg font-semibold">{metrics.completeness.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Clarity</div>
                    <div className="text-lg font-semibold">{metrics.clarity.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Proof Strength</div>
                    <div className="text-lg font-semibold">{metrics.proofStrength.toFixed(0)}</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Benchmark
            </CardTitle>
            <CardDescription>Comparison with specialty average</CardDescription>
          </CardHeader>
          <CardContent>
            {benchmark && (
              <>
                <div className="text-sm text-muted-foreground mb-2">
                  {benchmark.specialty}
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Your Score</div>
                    <div className="text-2xl font-bold">{benchmark.clinicianScore.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Specialty Avg</div>
                    <div className="text-2xl font-bold">{benchmark.specialtyAverage.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Percentile</div>
                    <div className="text-2xl font-bold">{benchmark.percentile}%</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Enhancement Pathways
            </CardTitle>
            <CardDescription>Steps to improve profile quality</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {enhancement.length > 0 ? (
                enhancement.map((pathway, i) => (
                  <div key={i} className="p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{pathway.action}</span>
                      <Badge variant={pathway.priority === 'high' ? 'destructive' : 'default'}>
                        {pathway.priority}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Expected improvement: +{pathway.expectedImprovement} points
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No enhancements needed</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Decay Monitoring
            </CardTitle>
            <CardDescription>Profile relevance tracking</CardDescription>
          </CardHeader>
          <CardContent>
            {decay && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={decay.decaying ? 'destructive' : 'default'}>
                    {decay.decaying ? 'Decaying' : 'Healthy'}
                  </Badge>
                </div>
                {decay.indicators.length > 0 ? (
                  <div className="space-y-2">
                    {decay.indicators.map((indicator: any, i: number) => (
                      <div key={i} className="text-sm text-muted-foreground">
                        • {indicator.type}: {indicator.daysSinceUpdate || indicator.score}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No decay indicators</span>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

