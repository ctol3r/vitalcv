'use client';

import { AlertCircle, Anchor, Download, RefreshCw, TrendingDown, TrendingUp, Activity, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface StabilityData {
  summary: {
    credentialId: string;
    overallStability: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    lastUpdated: string;
  };
  forecast: {
    stability: number;
    volatility: number;
    complianceStrength: number;
    riskExposure: number;
    predictions: Array<{ month: number; stability: number; risk: number }>;
  };
  entropy: {
    entropy: number;
    evidenceQuality: Array<{ evidenceId: string; entropy: number; freshness: number }>;
  };
  curvature: {
    curvature: number;
    trajectory: Array<{ date: string; stability: number; curvature: number }>;
    inflectionPoints: Array<{ date: string; type: string }>;
  };
  crossChain: {
    substrate: number;
    evm: number;
    cosmos: number;
    eudi: number;
    blended: number;
    consistency: number;
  };
  survival: {
    probability: number;
    factors: Array<{ factor: string; contribution: number }>;
    confidence: number;
  };
  reinforcement: {
    actions: Array<{ action: string; priority: string; timeline: string; expectedImpact: number }>;
    expectedStabilityGain: number;
  };
}

export default function CredStabilityPage() {
  const [credentialId, setCredentialId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StabilityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStability = async () => {
    if (!credentialId.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/credential-stability/${credentialId}`);
      if (!res.ok) throw new Error('Failed to fetch stability data');
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuild = async () => {
    if (!credentialId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/credential-stability/${credentialId}/build`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to build stability');
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    if (!credentialId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/credential-stability/${credentialId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      alert('Stability snapshot anchored successfully');
      fetchStability();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stability-dossier-${credentialId}-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'high':
        return 'bg-orange-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Stability Engine</h1>
          <p className="text-muted-foreground mt-2">
            Predictive stability, volatility, compliance strength, and risk exposure analysis
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credential Lookup</CardTitle>
          <CardDescription>Enter a credential ID to analyze stability</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Credential ID"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchStability()}
            />
            <Button onClick={fetchStability} disabled={loading || !credentialId.trim()}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Analyze
            </Button>
            <Button onClick={handleBuild} disabled={loading || !credentialId.trim()} variant="outline">
              Build
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !data && (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stability Summary</CardTitle>
                  <CardDescription>Credential: {data.summary.credentialId}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAnchor} variant="outline" size="sm">
                    <Anchor className="h-4 w-4 mr-2" />
                    Anchor
                  </Button>
                  <Button onClick={handleExport} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Stability</span>
                    <span className="text-2xl font-bold">{data.summary.overallStability}%</span>
                  </div>
                  <Progress value={data.summary.overallStability} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Risk Level</span>
                    <Badge className={getRiskColor(data.summary.riskLevel)}>
                      {data.summary.riskLevel.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Survival Probability</span>
                    <span className="text-2xl font-bold">{Math.round(data.survival.probability * 100)}%</span>
                  </div>
                  <Progress value={data.survival.probability * 100} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="forecast" className="space-y-4">
            <TabsList>
              <TabsTrigger value="forecast">Forecast</TabsTrigger>
              <TabsTrigger value="entropy">Entropy</TabsTrigger>
              <TabsTrigger value="curvature">Curvature</TabsTrigger>
              <TabsTrigger value="crosschain">Cross-Chain</TabsTrigger>
              <TabsTrigger value="reinforcement">Reinforcement</TabsTrigger>
            </TabsList>

            <TabsContent value="forecast" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Stability Forecast</CardTitle>
                  <CardDescription>12-month horizon predictions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <div className="text-sm text-muted-foreground">Stability</div>
                      <div className="text-2xl font-bold">{data.forecast.stability}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Volatility</div>
                      <div className="text-2xl font-bold">{data.forecast.volatility}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Compliance</div>
                      <div className="text-2xl font-bold">{data.forecast.complianceStrength}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Risk Exposure</div>
                      <div className="text-2xl font-bold">{data.forecast.riskExposure}%</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Monthly Predictions</h4>
                    {data.forecast.predictions.slice(0, 6).map((pred) => (
                      <div key={pred.month} className="flex items-center gap-4">
                        <span className="w-20 text-sm">Month {pred.month}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">Stability: {pred.stability}%</span>
                            <span className="text-sm">Risk: {pred.risk}%</span>
                          </div>
                          <Progress value={pred.stability} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="entropy" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Stability Entropy</CardTitle>
                  <CardDescription>Evidence uncertainty measurement</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall Entropy</span>
                      <span className="text-2xl font-bold">{Math.round(data.entropy.entropy * 100)}%</span>
                    </div>
                    <Progress value={data.entropy.entropy * 100} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Evidence Quality</h4>
                    {data.entropy.evidenceQuality.map((ev) => (
                      <div key={ev.evidenceId} className="flex items-center gap-4">
                        <span className="w-32 text-sm truncate">{ev.evidenceId}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">Entropy: {Math.round(ev.entropy * 100)}%</span>
                            <span className="text-sm">Freshness: {ev.freshness} days</span>
                          </div>
                          <Progress value={ev.entropy * 100} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="curvature" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Volatility Curvature</CardTitle>
                  <CardDescription>Stability trajectory analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Curvature</span>
                      <span className="text-2xl font-bold">
                        {data.curvature.curvature > 0 ? (
                          <TrendingUp className="h-6 w-6 text-red-500" />
                        ) : (
                          <TrendingDown className="h-6 w-6 text-green-500" />
                        )}
                        {data.curvature.curvature.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {data.curvature.curvature > 0
                        ? 'Accelerating instability detected'
                        : 'Stabilizing trend detected'}
                    </p>
                  </div>
                  {data.curvature.inflectionPoints.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Inflection Points</h4>
                      {data.curvature.inflectionPoints.map((point, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Badge variant="outline">{point.type}</Badge>
                          <span className="text-sm">{new Date(point.date).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="crosschain" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cross-Chain Stability</CardTitle>
                  <CardDescription>Multi-chain stability scores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Substrate</div>
                      <div className="text-2xl font-bold">{data.crossChain.substrate}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">EVM</div>
                      <div className="text-2xl font-bold">{data.crossChain.evm}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Cosmos</div>
                      <div className="text-2xl font-bold">{data.crossChain.cosmos}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">EUDI</div>
                      <div className="text-2xl font-bold">{data.crossChain.eudi}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Blended</div>
                      <div className="text-2xl font-bold">{data.crossChain.blended}%</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Consistency</span>
                      <span className="text-lg font-bold">{Math.round(data.crossChain.consistency * 100)}%</span>
                    </div>
                    <Progress value={data.crossChain.consistency * 100} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reinforcement" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Stability Reinforcement</CardTitle>
                  <CardDescription>Corrective action plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Expected Stability Gain</span>
                      <span className="text-2xl font-bold">+{data.reinforcement.expectedStabilityGain}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Recommended Actions</h4>
                    {data.reinforcement.actions.map((action, idx) => (
                      <Card key={idx}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{action.action}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Timeline: {action.timeline} • Impact: +{action.expectedImpact}%
                              </div>
                            </div>
                            <Badge variant={action.priority === 'critical' ? 'destructive' : 'secondary'}>
                              {action.priority}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}








