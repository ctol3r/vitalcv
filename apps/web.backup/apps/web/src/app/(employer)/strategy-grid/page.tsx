'use client';

import { Target, TrendingUp, Users, DollarSign, AlertTriangle, CheckCircle, Compass } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface StrategyGridData {
  summary: {
    orgId: string;
    overallStrategy: string;
    keyPriorities: string[];
    expectedOutcomes: string[];
    lastUpdated: string;
  };
  gap: {
    gaps: Array<{ area: string; current: number; target: number; gap: number; priority: string }>;
    overallGap: number;
    recommendations: string[];
  };
  heatfield: {
    specialties: Array<{ specialty: string; priority: number; urgency: string }>;
    roles: Array<{ role: string; priority: number; urgency: string }>;
  };
  elasticity: {
    elasticity: number;
    predictions: Array<{ compChange: number; supplyChange: number; timeline: string }>;
  };
  retention: {
    riskProfiles: Array<{ profile: string; clinicians: string[]; risk: number; actions: string[] }>;
    strategies: Array<{ action: string; target: string; expectedImpact: number; timeline: string }>;
  };
  stability: {
    score: number;
    employerStability: number;
    workforcePlacement: number;
    alignment: number;
  };
  surge: {
    score: number;
    readiness: Array<{ dimension: string; score: number; gaps: string[] }>;
  };
  benchmark: {
    overallRank: number;
    strengths: string[];
    weaknesses: string[];
  };
}

export default function StrategyGridPage() {
  const [orgId, setOrgId] = useState('demo-org-id');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StrategyGridData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategy = async () => {
    if (!orgId.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/workforce-strategy/${orgId}`);
      if (!res.ok) throw new Error('Failed to fetch strategy data');
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuild = async () => {
    if (!orgId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/workforce-strategy/${orgId}/build`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to build strategy');
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategy();
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'text-red-500';
      case 'high':
        return 'text-orange-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workforce Strategy Grid</h1>
          <p className="text-muted-foreground mt-2">
            Strategic grid for hiring, readiness, privileges, and incentives optimization
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Lookup</CardTitle>
          <CardDescription>Enter an organization ID to view strategy grid</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Organization ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchStrategy()}
            />
            <Button onClick={fetchStrategy} disabled={loading || !orgId.trim()}>
              Refresh
            </Button>
            <Button onClick={handleBuild} disabled={loading || !orgId.trim()} variant="outline">
              Build Strategy
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
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
              <CardTitle>Strategy Summary</CardTitle>
              <CardDescription>Organization: {data.summary.orgId}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Overall Strategy</p>
                  <p className="font-medium">{data.summary.overallStrategy}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Key Priorities</p>
                  <div className="flex flex-wrap gap-2">
                    {data.summary.keyPriorities.map((priority, idx) => (
                      <Badge key={idx} variant="outline">
                        {priority}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Expected Outcomes</p>
                  <ul className="list-disc list-inside space-y-1">
                    {data.summary.expectedOutcomes.map((outcome, idx) => (
                      <li key={idx} className="text-sm">{outcome}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="gaps" className="space-y-4">
            <TabsList>
              <TabsTrigger value="gaps">Gaps</TabsTrigger>
              <TabsTrigger value="heatfield">Hiring Priority</TabsTrigger>
              <TabsTrigger value="elasticity">Compensation</TabsTrigger>
              <TabsTrigger value="retention">Retention</TabsTrigger>
              <TabsTrigger value="surge">Surge Preparedness</TabsTrigger>
              <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
            </TabsList>

            <TabsContent value="gaps" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Strategic Gaps</CardTitle>
                  <CardDescription>Current vs target analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall Gap</span>
                      <span className="text-2xl font-bold">{data.gap.overallGap}%</span>
                    </div>
                    <Progress value={data.gap.overallGap} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    {data.gap.gaps.map((gap, idx) => (
                      <Card key={idx}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{gap.area.replace(/_/g, ' ').toUpperCase()}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Current: {gap.current}% • Target: {gap.target}% • Gap: {gap.gap.toFixed(1)}%
                              </div>
                              <Progress value={gap.current} className="h-2 mt-2" />
                            </div>
                            <Badge className={getPriorityColor(gap.priority)}>{gap.priority}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {data.gap.recommendations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Recommendations</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {data.gap.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="heatfield" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Hiring Priority Heatfield</CardTitle>
                  <CardDescription>Specialties and roles needing priority</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Specialties</h4>
                      <div className="space-y-2">
                        {data.heatfield.specialties.map((spec, idx) => (
                          <div key={idx} className="flex items-center gap-4">
                            <span className="w-48 text-sm">{spec.specialty.replace(/_/g, ' ')}</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm">Priority: {spec.priority}%</span>
                                <span className={`text-sm font-medium ${getUrgencyColor(spec.urgency)}`}>
                                  {spec.urgency.toUpperCase()}
                                </span>
                              </div>
                              <Progress value={spec.priority} className="h-2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Roles</h4>
                      <div className="space-y-2">
                        {data.heatfield.roles.map((role, idx) => (
                          <div key={idx} className="flex items-center gap-4">
                            <span className="w-48 text-sm">{role.role.replace(/_/g, ' ')}</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm">Priority: {role.priority}%</span>
                                <span className={`text-sm font-medium ${getUrgencyColor(role.urgency)}`}>
                                  {role.urgency.toUpperCase()}
                                </span>
                              </div>
                              <Progress value={role.priority} className="h-2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="elasticity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Compensation Elasticity</CardTitle>
                  <CardDescription>How compensation changes affect candidate supply</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Elasticity</span>
                      <span className="text-2xl font-bold">{data.elasticity.elasticity.toFixed(2)}x</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {data.elasticity.elasticity.toFixed(2)}% supply change per 1% compensation change
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Predictions</h4>
                    {data.elasticity.predictions.map((pred, idx) => (
                      <Card key={idx}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">
                                {pred.compChange > 0 ? '+' : ''}{pred.compChange}% Compensation
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Timeline: {pred.timeline}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-500">
                                +{pred.supplyChange.toFixed(1)}%
                              </div>
                              <div className="text-sm text-muted-foreground">Supply Change</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="retention" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Clinician Retention Strategy</CardTitle>
                  <CardDescription>Risk profiles and retention actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Risk Profiles</h4>
                      {data.retention.riskProfiles.map((profile, idx) => (
                        <Card key={idx} className="mb-2">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{profile.profile.replace(/_/g, ' ')}</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {profile.clinicians.length} clinician(s) • Risk: {profile.risk}%
                                </div>
                                <div className="mt-2">
                                  <div className="text-sm font-medium">Actions:</div>
                                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                                    {profile.actions.map((action, aIdx) => (
                                      <li key={aIdx}>{action.replace(/_/g, ' ')}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              <Badge variant={profile.risk > 70 ? 'destructive' : 'secondary'}>
                                {profile.risk}% Risk
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Strategies</h4>
                      {data.retention.strategies.map((strategy, idx) => (
                        <Card key={idx} className="mb-2">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{strategy.action}</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  Target: {strategy.target} • Timeline: {strategy.timeline}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-500">
                                  +{strategy.expectedImpact}%
                                </div>
                                <div className="text-sm text-muted-foreground">Impact</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="surge" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Surge Preparedness Index</CardTitle>
                  <CardDescription>Readiness for sudden volume surges</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall Score</span>
                      <span className="text-2xl font-bold">{data.surge.score}%</span>
                    </div>
                    <Progress value={data.surge.score} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Readiness Dimensions</h4>
                    {data.surge.readiness.map((dim, idx) => (
                      <div key={idx} className="flex items-center gap-4">
                        <span className="w-48 text-sm">{dim.dimension.replace(/_/g, ' ')}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">Score: {dim.score}%</span>
                          </div>
                          <Progress value={dim.score} className="h-2" />
                          {dim.gaps.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Gaps: {dim.gaps.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="benchmark" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Strategic Benchmarking</CardTitle>
                  <CardDescription>Comparison vs regional competitors</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall Rank</span>
                      <span className="text-2xl font-bold">#{data.benchmark.overallRank}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Strengths
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {data.benchmark.strengths.map((strength, idx) => (
                          <li key={idx} className="text-sm">{strength}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Weaknesses
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {data.benchmark.weaknesses.map((weakness, idx) => (
                          <li key={idx} className="text-sm">{weakness}</li>
                        ))}
                      </ul>
                    </div>
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








