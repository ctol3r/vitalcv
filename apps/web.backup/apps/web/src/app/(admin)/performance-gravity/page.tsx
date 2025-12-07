'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PerformanceGravity {
  orgId: string;
  gravityField: {
    gravityScore: number;
    attractionPower: number;
  };
  drift: {
    drift: number;
    factors: string[];
  };
  magnetism: {
    score: number;
    topClinicianAttraction: number;
    factors: string[];
  };
  forecast: Array<{
    month: number;
    predictedGravity: number;
  }>;
  competitivePosition: {
    rank: number;
    competitors: Array<{
      orgId: string;
      gravityScore: number;
    }>;
  };
}

export default function PerformanceGravityPage() {
  const [gravity, setGravity] = useState<PerformanceGravity | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState('');

  const fetchGravity = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/performance-gravity/${orgId}`);
      const data = await res.json();
      setGravity(data);
    } catch (error) {
      console.error('Failed to fetch performance gravity:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employer Performance Gravity Field</h1>
        <p className="text-muted-foreground mt-2">
          How strongly an employer pulls high-performing clinicians into its orbit
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization ID</CardTitle>
          <CardDescription>Enter organization ID to view performance gravity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Enter organization ID"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              onClick={fetchGravity}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {gravity && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gravity Field</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Gravity Score</span>
                  <Badge variant={gravity.gravityField.gravityScore > 70 ? 'default' : gravity.gravityField.gravityScore > 50 ? 'secondary' : 'outline'}>
                    {gravity.gravityField.gravityScore}/100
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Attraction Power</span>
                  <Badge variant="outline">
                    {Math.round(gravity.gravityField.attractionPower * 100)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gravity Drift</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Drift</span>
                  <Badge variant={gravity.drift.drift > 0 ? 'destructive' : 'default'}>
                    {gravity.drift.drift > 0 ? '+' : ''}{Math.round(gravity.drift.drift * 100)}%
                  </Badge>
                </div>
                {gravity.drift.factors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-semibold mb-1">Factors:</div>
                    <div className="flex flex-wrap gap-2">
                      {gravity.drift.factors.map((factor, idx) => (
                        <Badge key={idx} variant="outline">{factor}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Magnetism Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Score</span>
                  <Badge variant={gravity.magnetism.score > 70 ? 'default' : 'secondary'}>
                    {gravity.magnetism.score}/100
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Top Clinician Attraction</span>
                  <Badge variant="outline">
                    {Math.round(gravity.magnetism.topClinicianAttraction * 100)}%
                  </Badge>
                </div>
                {gravity.magnetism.factors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-semibold mb-1">Factors:</div>
                    <div className="flex flex-wrap gap-2">
                      {gravity.magnetism.factors.map((factor, idx) => (
                        <Badge key={idx} variant="outline">{factor}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gravity Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {gravity.forecast.slice(0, 6).map((forecast, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span>Month {forecast.month}:</span>
                    <Badge variant="outline">{forecast.predictedGravity.toFixed(1)}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Competitive Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Rank</span>
                  <Badge variant={gravity.competitivePosition.rank <= 3 ? 'default' : 'secondary'}>
                    #{gravity.competitivePosition.rank}
                  </Badge>
                </div>
                {gravity.competitivePosition.competitors.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold mb-2">Competitors:</div>
                    <div className="space-y-1">
                      {gravity.competitivePosition.competitors.slice(0, 5).map((comp, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span>{comp.orgId}</span>
                          <Badge variant="outline">{comp.gravityScore.toFixed(1)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}








