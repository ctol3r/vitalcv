'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Shield } from 'lucide-react';

interface ConductDimensions {
  SafetyAlignment: number;
  Fairness: number;
  BiasDetection: number;
  RegulatoryCooperation: number;
  VerificationAccuracy: number;
  HiringStability: number;
  ContractEthics: number;
  PrivilegeBehavior: number;
  BurnoutContribution: number;
  ReadinessUtilization: number;
  Overall: number;
  [key: string]: number;
}

interface ConductAnomaly {
  pattern: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface ConductReactor {
  orgId: string;
  dimensions: ConductDimensions;
  anomalies?: ConductAnomaly[];
  predictions?: {
    trajectory: 'improving' | 'stable' | 'declining';
    riskScore: number;
    forecast: Array<{ date: string; score: number }>;
  };
}

export default function ConductReactorPage() {
  const [orgId, setOrgId] = useState('');
  const [reactor, setReactor] = useState<ConductReactor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReactor = async () => {
    if (!orgId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/conduct-reactor/${orgId}`);
      if (!res.ok) throw new Error('Failed to fetch reactor');
      const data = await res.json();
      setReactor(data.reactor);
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

  const getTrajectoryIcon = (trajectory: string) => {
    switch (trajectory) {
      case 'improving':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      default:
        return <Shield className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trust-Risk Conduct Reactor</h1>
          <p className="text-muted-foreground mt-2">
            Employer trust-risk conduct reactor v9 - 30-vector reactor evaluating employer integrity
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Lookup</CardTitle>
          <CardDescription>Enter an organization ID to view its conduct reactor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Enter organization ID"
              className="flex-1 px-4 py-2 border rounded-md"
            />
            <button
              onClick={fetchReactor}
              disabled={loading || !orgId}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Reactor'}
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

      {reactor && (
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
                <CardTitle>Overall Conduct Score</CardTitle>
                <CardDescription>Organization ID: {reactor.orgId}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold" className={getScoreColor(reactor.dimensions.Overall)}>
                    {(reactor.dimensions.Overall * 100).toFixed(1)}%
                  </div>
                  {getScoreBadge(reactor.dimensions.Overall)}
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-primary h-4 rounded-full transition-all"
                      style={{ width: `${reactor.dimensions.Overall * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Safety Alignment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" className={getScoreColor(reactor.dimensions.SafetyAlignment)}>
                    {(reactor.dimensions.SafetyAlignment * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Fairness</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" className={getScoreColor(reactor.dimensions.Fairness)}>
                    {(reactor.dimensions.Fairness * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" className={getScoreColor(reactor.dimensions.RegulatoryCooperation)}>
                    {(reactor.dimensions.RegulatoryCooperation * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Verification Accuracy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" className={getScoreColor(reactor.dimensions.VerificationAccuracy)}>
                    {(reactor.dimensions.VerificationAccuracy * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="dimensions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Dimensions</CardTitle>
                <CardDescription>30-vector conduct dimensions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(reactor.dimensions).map(([key, value]) => (
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
                <CardTitle>Conduct Anomalies</CardTitle>
                <CardDescription>Detected patterns and risk signals</CardDescription>
              </CardHeader>
              <CardContent>
                {reactor.anomalies && reactor.anomalies.length > 0 ? (
                  <div className="space-y-4">
                    {reactor.anomalies.map((anomaly, idx) => (
                      <Alert key={idx} variant={anomaly.severity === 'high' ? 'destructive' : 'default'}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold">{anomaly.pattern}</span>
                            <Badge className={anomaly.severity === 'high' ? 'bg-red-100 text-red-800' : anomaly.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}>
                              {anomaly.severity}
                            </Badge>
                          </div>
                          <p>{anomaly.description}</p>
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
                <CardTitle>Trajectory Predictions</CardTitle>
                <CardDescription>Conduct trajectory and risk forecasts</CardDescription>
              </CardHeader>
              <CardContent>
                {reactor.predictions ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        {getTrajectoryIcon(reactor.predictions.trajectory)}
                        <div>
                          <p className="text-sm text-muted-foreground">Trajectory</p>
                          <p className="text-lg font-semibold capitalize">{reactor.predictions.trajectory}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Risk Score</p>
                        <p className="text-2xl font-bold">{(reactor.predictions.riskScore * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                    {reactor.predictions.forecast && (
                      <div>
                        <p className="text-sm font-medium mb-2">12-Month Forecast</p>
                        <div className="space-y-2">
                          {reactor.predictions.forecast.slice(0, 6).map((forecast, idx) => (
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








