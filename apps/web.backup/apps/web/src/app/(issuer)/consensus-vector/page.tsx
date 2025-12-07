'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConsensusVector {
  credentialId: string;
  signals: Array<{
    source: string;
    correctness: number;
  }>;
  fusion: {
    weightedScore: number;
    confidence: number;
    contradictions: Array<{
      sourceA: string;
      sourceB: string;
      conflict: string;
    }>;
  };
  timeline: Array<{
    timestamp: string;
    vector: any;
  }>;
}

export default function ConsensusVectorPage() {
  const [vector, setVector] = useState<ConsensusVector | null>(null);
  const [loading, setLoading] = useState(true);
  const [credentialId, setCredentialId] = useState('');

  const fetchVector = async () => {
    if (!credentialId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/consensus-vector/${credentialId}`);
      const data = await res.json();
      setVector(data);
    } catch (error) {
      console.error('Failed to fetch consensus vector:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Consensus Vector</h1>
          <p className="text-muted-foreground mt-2">
            Compute consensus vector blending all sources of truth
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credential ID</CardTitle>
          <CardDescription>Enter credential ID to compute consensus vector</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="Enter credential ID"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              onClick={fetchVector}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Compute
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {vector && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Consensus Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span>Weighted Score</span>
                    <Badge variant="outline">
                      {(vector.fusion.weightedScore * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${vector.fusion.weightedScore * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span>Confidence</span>
                    <Badge variant="outline">
                      {(vector.fusion.confidence * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${vector.fusion.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signals</CardTitle>
              <CardDescription>Sources of truth contributing to consensus</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {vector.signals.map((signal, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Badge>{signal.source}</Badge>
                      <span>Correctness</span>
                    </div>
                    <Badge variant="outline">
                      {(signal.correctness * 100).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {vector.fusion.contradictions.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="font-semibold mb-2">
                  {vector.fusion.contradictions.length} Contradiction(s) Detected
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {vector.fusion.contradictions.map((c, idx) => (
                    <li key={idx}>
                      {c.sourceA} vs {c.sourceB}: {c.conflict}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

