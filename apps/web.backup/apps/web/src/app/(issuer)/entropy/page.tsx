'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EntropyData {
  credentialId: string;
  entropy: number;
  signals: {
    revocationVolatility: {
      volatility: number;
    };
    issuerChangeFrequency: {
      changes: number;
    };
    signatureInconsistencies: {
      count: number;
    };
  };
  drift: {
    drift: number;
    factors: string[];
  };
  instabilityPrediction: {
    probability: number;
    factors: string[];
  };
  recommendations: Array<{
    action: string;
    priority: string;
  }>;
}

export default function EntropyPage() {
  const [entropy, setEntropy] = useState<EntropyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [credentialId, setCredentialId] = useState('');

  const fetchEntropy = async () => {
    if (!credentialId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/entropy/${credentialId}`);
      const data = await res.json();
      setEntropy(data);
    } catch (error) {
      console.error('Failed to fetch entropy data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Credential Reliability Entropy Matrix</h1>
        <p className="text-muted-foreground mt-2">
          Measure the entropy of credential reliability — stability vs randomness across time, issuers, chains
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credential ID</CardTitle>
          <CardDescription>Enter credential ID to view entropy matrix</CardDescription>
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
              onClick={fetchEntropy}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {entropy && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Entropy Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Entropy Score</span>
                  <Badge variant={entropy.entropy < 0.3 ? 'default' : entropy.entropy < 0.7 ? 'secondary' : 'destructive'}>
                    {Math.round(entropy.entropy * 100)}%
                  </Badge>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full ${
                      entropy.entropy < 0.3 ? 'bg-green-500' :
                      entropy.entropy < 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${entropy.entropy * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entropy Signals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Revocation Volatility</span>
                  <Badge variant="outline">
                    {Math.round(entropy.signals.revocationVolatility.volatility * 100)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Issuer Changes</span>
                  <Badge variant="outline">
                    {entropy.signals.issuerChangeFrequency.changes}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Signature Inconsistencies</span>
                  <Badge variant="outline">
                    {entropy.signals.signatureInconsistencies.count}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entropy Drift</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Drift</span>
                  <Badge variant={entropy.drift.drift > 0 ? 'destructive' : 'default'}>
                    {entropy.drift.drift > 0 ? '+' : ''}{Math.round(entropy.drift.drift * 100)}%
                  </Badge>
                </div>
                {entropy.drift.factors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-semibold mb-1">Factors:</div>
                    <div className="flex flex-wrap gap-2">
                      {entropy.drift.factors.map((factor, idx) => (
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
              <CardTitle>Instability Prediction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Probability</span>
                  <Badge variant={entropy.instabilityPrediction.probability > 0.7 ? 'destructive' : entropy.instabilityPrediction.probability > 0.5 ? 'secondary' : 'default'}>
                    {Math.round(entropy.instabilityPrediction.probability * 100)}%
                  </Badge>
                </div>
                {entropy.instabilityPrediction.factors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-semibold mb-1">Factors:</div>
                    <div className="flex flex-wrap gap-2">
                      {entropy.instabilityPrediction.factors.map((factor, idx) => (
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
              <CardTitle>Stabilization Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {entropy.recommendations.map((rec, idx) => (
                  <Alert key={idx} variant={rec.priority === 'high' ? 'destructive' : 'default'}>
                    <AlertDescription>
                      <div className="flex justify-between items-start">
                        <span>{rec.action}</span>
                        <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'}>
                          {rec.priority}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}








