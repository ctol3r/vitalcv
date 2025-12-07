/**
 * Batch 477.16 - Deviation heatmap UI
 * Frontend page for visualizing employer behavioral differential heatmap
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DifferentialHeatmapData {
  orgId: string;
  axes: {
    [key: string]: number;
  };
  heatmap: Array<{
    axis: string;
    value: number;
    severity: 'low' | 'medium' | 'high';
    trend: 'improving' | 'stable' | 'declining';
  }>;
  clusters: string[];
  integrityScore: number;
  predictions: Array<{
    date: string;
    score: number;
  }>;
}

export default function DifferentialHeatmapPage() {
  const [data, setData] = useState<DifferentialHeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');

  useEffect(() => {
    if (orgId) {
      fetchDifferentialHeatmap(orgId);
    }
  }, [orgId]);

  async function fetchDifferentialHeatmap(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/employers/differential-heatmap?orgId=${id}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch differential heatmap:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Behavioral Differential Heatmap</h1>
        <input
          type="text"
          placeholder="Enter organization ID"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className="px-4 py-2 border rounded"
        />
      </div>

      {loading && <div>Loading...</div>}

      {data && (
        <Tabs defaultValue="heatmap" className="space-y-4">
          <TabsList>
            <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
            <TabsTrigger value="axes">30-Axis View</TabsTrigger>
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="heatmap">
            <Card>
              <CardHeader>
                <CardTitle>Differential Heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-2">
                  {data.heatmap.map((point, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded text-sm text-center ${
                        point.severity === 'high'
                          ? 'bg-red-500 text-white'
                          : point.severity === 'medium'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-green-500 text-white'
                      }`}
                      title={`${point.axis}: ${point.value.toFixed(2)}`}
                    >
                      <div className="font-semibold">{point.axis}</div>
                      <div className="text-xs mt-1">{point.value.toFixed(2)}</div>
                      <Badge
                        variant="outline"
                        className={`mt-1 ${
                          point.trend === 'improving'
                            ? 'bg-green-100'
                            : point.trend === 'declining'
                            ? 'bg-red-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        {point.trend}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="axes">
            <Card>
              <CardHeader>
                <CardTitle>30-Axis Differential View</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(data.axes).map(([axis, value]) => (
                    <div key={axis} className="flex items-center gap-4 p-2 border rounded">
                      <span className="flex-1 font-medium">{axis}</span>
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              value > 0.7 ? 'bg-green-500' : value > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${value * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-gray-600 w-16 text-right">
                        {(value * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="predictions">
            <Card>
              <CardHeader>
                <CardTitle>Trajectory Predictions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.predictions.map((pred, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-2 border rounded">
                      <span className="text-sm text-gray-500 w-32">{pred.date}</span>
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              pred.score > 70 ? 'bg-green-500' : pred.score > 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${pred.score}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-gray-600 w-16 text-right">{pred.score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis">
            <Card>
              <CardHeader>
                <CardTitle>Differential Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Integrity Score</p>
                    <p className="text-2xl font-bold">{data.integrityScore.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Classification</p>
                    <div className="flex gap-2 mt-2">
                      {data.clusters.map((cluster, idx) => (
                        <Badge key={idx} variant="outline">
                          {cluster}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {data.integrityScore < 50 && (
                  <Alert>
                    <AlertDescription>
                      Low integrity score detected. Review corrective actions.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}








