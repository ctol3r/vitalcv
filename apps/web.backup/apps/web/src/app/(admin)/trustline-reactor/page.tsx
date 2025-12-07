'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Network, TrendingUp, AlertTriangle, Shield, Activity } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function TrustlineReactorPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('demo-org-id'); // Replace with actual org ID

  useEffect(() => {
    fetch(`${API_BASE}/api/trustline/reactor/${orgId}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load trustline reactor', err);
        setLoading(false);
      });
  }, [orgId]);

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/trustline/reactor/${orgId}/anchor`, {
        method: 'POST',
      });
      const result = await res.json();
      alert('Trustline reactor anchored successfully!');
    } catch (err) {
      console.error('Failed to anchor', err);
      alert('Failed to anchor trustline reactor');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Trustline Graph Reactor
              </CardTitle>
              <CardDescription>
                30-node trustline reactor capturing how trust flows between employers, systems, regions, regulators & clinicians
              </CardDescription>
            </div>
            <Button onClick={handleAnchor} variant="outline">
              Anchor Snapshot
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-6">
              {/* Fusion Score */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Unified Trustline Score
                </h3>
                <div className="p-4 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span>Fusion Score</span>
                    <span className="font-bold text-3xl">{(data.fusionScore * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={data.fusionScore * 100} className="mb-4" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Verification Accuracy</p>
                      <p className="font-bold">{(data.verificationAccuracy?.score * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fairness Signals</p>
                      <p className="font-bold">{(data.fairnessSignals?.score * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Safety Correlations</p>
                      <p className="font-bold">{(data.safetyCorrelations?.score * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Contract Integrity</p>
                      <p className="font-bold">{(data.contractIntegrity?.score * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trustline Shift Prediction */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Trustline Shift Prediction
                </h3>
                <div className="p-4 border rounded">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Direction</p>
                      <Badge
                        variant={
                          data.shiftPrediction?.direction === 'increasing'
                            ? 'default'
                            : data.shiftPrediction?.direction === 'decreasing'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="mt-1"
                      >
                        {data.shiftPrediction?.direction}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Magnitude</p>
                      <p className="font-bold">{data.shiftPrediction?.magnitude}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Timeframe</p>
                      <p className="font-bold">{data.shiftPrediction?.timeframe} days</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Confidence</p>
                      <p className="font-bold">{(data.shiftPrediction?.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Anomalies */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Trustline Anomalies
                </h3>
                <div className="space-y-2">
                  {data.anomalies?.length > 0 ? (
                    data.anomalies.map((anomaly: any, idx: number) => (
                      <div key={idx} className="p-3 border rounded">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{anomaly.type}</span>
                          <Badge
                            variant={
                              anomaly.severity > 0.7
                                ? 'destructive'
                                : anomaly.severity > 0.4
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            Severity: {(anomaly.severity * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Detected: {new Date(anomaly.detectedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 border rounded text-sm text-muted-foreground">
                      No anomalies detected
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-Hop Stability */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Multi-Hop Trust Stability
                </h3>
                <div className="p-4 border rounded">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Stability Score</p>
                      <p className="font-bold text-2xl">{(data.multiHopStability?.stabilityScore * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Hop Count</p>
                      <p className="font-bold text-2xl">{data.multiHopStability?.hopCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Paths Analyzed</p>
                      <p className="font-bold text-2xl">{data.multiHopStability?.paths?.length || 0}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {data.multiHopStability?.paths?.slice(0, 3).map((path: any, idx: number) => (
                      <div key={idx} className="p-2 bg-muted rounded text-sm">
                        <div className="flex items-center justify-between">
                          <span>{path.path.join(' → ')}</span>
                          <Badge>{(path.stability * 100).toFixed(0)}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Economic Influence */}
              <div>
                <h3 className="font-semibold mb-3">Economic Influence Analysis</h3>
                <div className="p-4 border rounded">
                  <div className="flex items-center justify-between mb-4">
                    <span>ROI</span>
                    <span className="font-bold text-2xl">{data.economicInfluence?.roi?.toFixed(2)}x</span>
                  </div>
                  <div className="space-y-2">
                    {data.economicInfluence?.factors?.map((factor: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">{factor.factor}</span>
                        <Badge variant="outline">{factor.impact}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Collapse Forecast */}
              <div>
                <h3 className="font-semibold mb-3">Trustline Collapse Forecast</h3>
                <div className="p-4 border rounded">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Risk Level</p>
                      <Badge
                        variant={
                          data.collapseForecast?.riskLevel === 'critical'
                            ? 'destructive'
                            : data.collapseForecast?.riskLevel === 'high'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="mt-1"
                      >
                        {data.collapseForecast?.riskLevel}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Probability</p>
                      <p className="font-bold">{(data.collapseForecast?.probability * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Timeframe</p>
                      <p className="font-bold">{data.collapseForecast?.timeframe} days</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stabilization Status */}
              <div>
                <h3 className="font-semibold mb-3">Stabilization Status</h3>
                <div className="p-4 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span>Status</span>
                    <Badge
                      variant={
                        data.stabilization?.status === 'stable'
                          ? 'default'
                          : data.stabilization?.status === 'stabilizing'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {data.stabilization?.status}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    {data.stabilization?.actions?.map((action: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="mr-1">
                        {action}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Clusters */}
              <div>
                <h3 className="font-semibold mb-3">Employer Clusters</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.clusters?.map((cluster: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="font-medium mb-2">{cluster.clusterId}</div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Members: {cluster.members.length}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {cluster.characteristics?.map((char: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {char}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>No trustline reactor data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








