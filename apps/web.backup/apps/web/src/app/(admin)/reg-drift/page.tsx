'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RegDriftRadar {
  region: string;
  propagation: {
    affectedRegions: string[];
    impact: string;
  };
  harmonization: {
    strategies: string[];
    priority: 'low' | 'medium' | 'high';
  };
  earlyWarning: {
    predicted: boolean;
    timeframe: string;
    factors: string[];
  };
  clustering: Array<{
    regions: string[];
    similarity: number;
  }>;
}

export default function RegDriftPage() {
  const [radar, setRadar] = useState<RegDriftRadar | null>(null);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState('');

  const fetchRadar = async () => {
    if (!region) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reg-drift/${region}`);
      const data = await res.json();
      setRadar(data);
    } catch (error) {
      console.error('Failed to fetch regulatory drift radar:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Global Regulatory Drift Radar</h1>
        <p className="text-muted-foreground mt-2">
          A radar detecting regulatory drift across jurisdictions, chains, boards, and rule sources
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Region</CardTitle>
          <CardDescription>Enter region to view regulatory drift radar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Enter region (e.g., US, EU, APAC)"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              onClick={fetchRadar}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {radar && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Drift Propagation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm font-semibold">Impact:</div>
                <div className="text-sm">{radar.propagation.impact}</div>
                {radar.propagation.affectedRegions.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-semibold mb-1">Affected Regions:</div>
                    <div className="flex flex-wrap gap-2">
                      {radar.propagation.affectedRegions.map((r, idx) => (
                        <Badge key={idx} variant="outline">{r}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Harmonization Strategies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span>Priority</span>
                  <Badge variant={
                    radar.harmonization.priority === 'high' ? 'destructive' :
                    radar.harmonization.priority === 'medium' ? 'default' : 'outline'
                  }>
                    {radar.harmonization.priority}
                  </Badge>
                </div>
                {radar.harmonization.strategies.length > 0 && (
                  <div className="space-y-1">
                    {radar.harmonization.strategies.map((strategy, idx) => (
                      <div key={idx} className="text-sm p-2 border rounded-md">
                        {strategy}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {radar.earlyWarning.predicted && (
            <Alert>
              <AlertDescription>
                <div className="font-semibold mb-2">Early Warning Drift Predicted</div>
                <div className="text-sm mb-2">Timeframe: {radar.earlyWarning.timeframe}</div>
                {radar.earlyWarning.factors.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-1">Factors:</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {radar.earlyWarning.factors.map((factor, idx) => (
                        <li key={idx}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {radar.clustering.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Region Clustering</CardTitle>
                <CardDescription>Regions grouped by drift similarity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {radar.clustering.map((cluster, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex flex-wrap gap-2">
                          {cluster.regions.map((r, rIdx) => (
                            <Badge key={rIdx} variant="outline">{r}</Badge>
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Similarity: {(cluster.similarity * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}








