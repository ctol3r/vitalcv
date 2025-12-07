/**
 * Batch 476.10 - Provenance drift heatmap UI
 * Frontend page for visualizing provenance drift
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProvenanceDriftData {
  credentialId: string;
  drift: {
    nodes: number;
    edges: number;
    contradictions: number;
    mutations: number;
    anomalies: number;
  };
  heatmap: Array<{
    date: string;
    drift: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  timeline: Array<{
    date: string;
    event: string;
    type: string;
  }>;
}

export default function ProvenanceDriftPage() {
  const [data, setData] = useState<ProvenanceDriftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [credentialId, setCredentialId] = useState('');

  useEffect(() => {
    if (credentialId) {
      fetchProvenanceDrift(credentialId);
    }
  }, [credentialId]);

  async function fetchProvenanceDrift(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/provenance/drift?credentialId=${id}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch provenance drift:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Provenance Drift Heatmap</h1>
        <input
          type="text"
          placeholder="Enter credential ID"
          value={credentialId}
          onChange={(e) => setCredentialId(e.target.value)}
          className="px-4 py-2 border rounded"
        />
      </div>

      {loading && <div>Loading...</div>}

      {data && (
        <Tabs defaultValue="heatmap" className="space-y-4">
          <TabsList>
            <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="heatmap">
            <Card>
              <CardHeader>
                <CardTitle>Drift Heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-12 gap-2">
                  {data.heatmap.map((point, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-xs text-center ${
                        point.severity === 'high'
                          ? 'bg-red-500 text-white'
                          : point.severity === 'medium'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-green-500 text-white'
                      }`}
                      title={`${point.date}: ${point.drift.toFixed(2)}`}
                    >
                      {point.drift.toFixed(1)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle>Provenance Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.timeline.map((event, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-2 border rounded">
                      <span className="text-sm text-gray-500">{event.date}</span>
                      <Badge variant="outline">{event.type}</Badge>
                      <span>{event.event}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis">
            <Card>
              <CardHeader>
                <CardTitle>Drift Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Nodes</p>
                    <p className="text-2xl font-bold">{data.drift.nodes}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Edges</p>
                    <p className="text-2xl font-bold">{data.drift.edges}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Contradictions</p>
                    <p className="text-2xl font-bold text-red-600">{data.drift.contradictions}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Mutations</p>
                    <p className="text-2xl font-bold text-yellow-600">{data.drift.mutations}</p>
                  </div>
                </div>

                {data.drift.anomalies > 0 && (
                  <Alert>
                    <AlertDescription>
                      {data.drift.anomalies} anomaly(ies) detected in provenance chain
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








