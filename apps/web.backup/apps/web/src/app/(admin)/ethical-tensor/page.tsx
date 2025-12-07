'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EthicalTensor {
  orgId: string;
  deviations: Array<{
    dimension: string;
    magnitude: number;
    timestamp: string;
  }>;
  riskScore: number;
  complianceAlignment: {
    aligned: boolean;
    gaps: string[];
  };
  forecast: {
    trajectory: 'improving' | 'stable' | 'declining';
    confidence: number;
  };
}

export default function EthicalTensorPage() {
  const [tensor, setTensor] = useState<EthicalTensor | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState('');

  const fetchTensor = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ethical-tensor/${orgId}`);
      const data = await res.json();
      setTensor(data);
    } catch (error) {
      console.error('Failed to fetch ethical tensor:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employer Ethical Conduct Tensor</h1>
        <p className="text-muted-foreground mt-2">
          A tensor that evaluates employer ethical behavior across hiring, fairness, transparency, compliance & retention
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization ID</CardTitle>
          <CardDescription>Enter organization ID to view ethical conduct tensor</CardDescription>
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
              onClick={fetchTensor}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {tensor && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ethical Risk Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span>Risk Score</span>
                    <Badge variant={tensor.riskScore > 70 ? 'destructive' : tensor.riskScore > 40 ? 'default' : 'outline'}>
                      {tensor.riskScore}/100
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        tensor.riskScore > 70 ? 'bg-destructive' :
                        tensor.riskScore > 40 ? 'bg-yellow-500' : 'bg-primary'
                      }`}
                      style={{ width: `${tensor.riskScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {tensor.deviations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ethical Deviations</CardTitle>
                <CardDescription>Detected dips in ethical behavior</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tensor.deviations.map((deviation, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <Badge>{deviation.dimension}</Badge>
                        <span className="text-sm text-muted-foreground">
                          Magnitude: {deviation.magnitude.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(deviation.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Compliance Alignment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Alignment Status</span>
                  <Badge variant={tensor.complianceAlignment.aligned ? 'default' : 'destructive'}>
                    {tensor.complianceAlignment.aligned ? 'Aligned' : 'Gaps Detected'}
                  </Badge>
                </div>
                {tensor.complianceAlignment.gaps.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Gaps:</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {tensor.complianceAlignment.gaps.map((gap, idx) => (
                        <li key={idx}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ethical Trajectory Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Trajectory</span>
                  <Badge variant={
                    tensor.forecast.trajectory === 'improving' ? 'default' :
                    tensor.forecast.trajectory === 'stable' ? 'outline' : 'destructive'
                  }>
                    {tensor.forecast.trajectory}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Confidence: {(tensor.forecast.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}








