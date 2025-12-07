'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';

interface TensorDimensions {
  Evidence: number;
  Issuer: number;
  Chain: number;
  Regulatory: number;
  Privilege: number;
  Specialty: number;
  Time: number;
  Stability: number;
  Integrity: number;
  Consistency: number;
  Drift: number;
  Variance: number;
  Overall: number;
  [key: string]: number;
}

interface TensorAnomaly {
  dimension: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedAction: string;
}

interface CoherenceTensor {
  credentialId: string;
  dimensions: TensorDimensions;
  anomalies?: TensorAnomaly[];
  predictions?: {
    stability: number;
    driftRisk: number;
    coherenceForecast: Array<{ date: string; score: number }>;
  };
}

export default function TensorPage() {
  const [credentialId, setCredentialId] = useState('');
  const [tensor, setTensor] = useState<CoherenceTensor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTensor = async () => {
    if (!credentialId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coherence-tensor/${credentialId}`);
      if (!res.ok) throw new Error('Failed to fetch tensor');
      const data = await res.json();
      setTensor(data.tensor);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-100 text-green-800">High</Badge>;
    if (score >= 0.5) return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    return <Badge className="bg-red-100 text-red-800">Low</Badge>;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Coherence Tensor</h1>
          <p className="text-muted-foreground mt-2">
            Global credential coherence tensor v10 - 30-component tensor modeling credential coherence
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credential Lookup</CardTitle>
          <CardDescription>Enter a credential ID to view its coherence tensor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="Enter credential ID"
              className="flex-1 px-4 py-2 border rounded-md"
            />
            <button
              onClick={fetchTensor}
              disabled={loading || !credentialId}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Tensor'}
            </button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tensor && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Overall Coherence</CardTitle>
                <CardDescription>Credential ID: {tensor.credentialId}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold" className={getScoreColor(tensor.dimensions.Overall)}>
                    {(tensor.dimensions.Overall * 100).toFixed(1)}%
                  </div>
                  {getScoreBadge(tensor.dimensions.Overall)}
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-primary h-4 rounded-full transition-all"
                      style={{ width: `${tensor.dimensions.Overall * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Stability</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" className={getScoreColor(tensor.dimensions.Stability)}>
                    {(tensor.dimensions.Stability * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Integrity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" className={getScoreColor(tensor.dimensions.Integrity)}>
                    {(tensor.dimensions.Integrity * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Consistency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" className={getScoreColor(tensor.dimensions.Consistency)}>
                    {(tensor.dimensions.Consistency * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="dimensions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Dimensions</CardTitle>
                <CardDescription>30-component tensor dimensions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(tensor.dimensions).map(([key, value]) => (
                    <div key={key} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{key}</span>
                        <span className={getScoreColor(value)}>{(value * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${value * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="anomalies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Anomalies</CardTitle>
                <CardDescription>Detected tensor anomalies and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                {tensor.anomalies && tensor.anomalies.length > 0 ? (
                  <div className="space-y-4">
                    {tensor.anomalies.map((anomaly, idx) => (
                      <Alert key={idx} variant={anomaly.severity === 'high' ? 'destructive' : 'default'}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold">{anomaly.dimension}</span>
                            <Badge className={getSeverityColor(anomaly.severity)}>
                              {anomaly.severity}
                            </Badge>
                          </div>
                          <p className="mb-2">{anomaly.description}</p>
                          <p className="text-sm text-muted-foreground">
                            <strong>Suggested Action:</strong> {anomaly.suggestedAction}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600" />
                    <p>No anomalies detected</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Predictions</CardTitle>
                <CardDescription>Coherence stability and drift predictions</CardDescription>
              </CardHeader>
              <CardContent>
                {tensor.predictions ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Stability</p>
                        <p className="text-2xl font-bold">{(tensor.predictions.stability * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Drift Risk</p>
                        <p className="text-2xl font-bold">{(tensor.predictions.driftRisk * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                    {tensor.predictions.coherenceForecast && (
                      <div>
                        <p className="text-sm font-medium mb-2">12-Month Forecast</p>
                        <div className="space-y-2">
                          {tensor.predictions.coherenceForecast.slice(0, 6).map((forecast, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-sm">
                                {new Date(forecast.date).toLocaleDateString()}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{(forecast.score * 100).toFixed(1)}%</span>
                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-primary h-2 rounded-full"
                                    style={{ width: `${forecast.score * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No predictions available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}








