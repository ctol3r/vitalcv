'use client';

import { Activity, AlertTriangle, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface FitnessDimensions {
  efficiency: number;
  reliability: number;
  safety: number;
  fairness: number;
  readiness: number;
  overall: number;
  timestamp: string;
}

interface FitnessForecast {
  months: number;
  predictedFitness: number;
  confidence: number;
}

interface Bottleneck {
  area: string;
  severity: 'high' | 'medium' | 'low';
  impact: number;
}

interface FitnessReinforcement {
  action: string;
  priority: 'high' | 'medium' | 'low';
  expectedImpact: number;
  dimension: string;
}

export default function EcosystemFitnessPage() {
  const [loading, setLoading] = useState(true);
  const [currentDimensions, setCurrentDimensions] = useState<FitnessDimensions | null>(null);
  const [quadrant, setQuadrant] = useState<string>('');
  const [forecast, setForecast] = useState<FitnessForecast[]>([]);
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [suggestions, setSuggestions] = useState<FitnessReinforcement[]>([]);
  const [orgId, setOrgId] = useState<string>('');

  useEffect(() => {
    // Get org ID from URL or context
    const params = new URLSearchParams(window.location.search);
    const id = params.get('orgId') || 'default-org';
    setOrgId(id);
    loadFitness(id);
  }, []);

  const loadFitness = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/ecosystem-fitness/${id}`);
      const data = await res.json();

      const dimensions = data.dimensions || [];
      if (dimensions.length > 0) {
        setCurrentDimensions(dimensions[dimensions.length - 1]);
      }

      setQuadrant(data.quadrant || 'Unknown');

      // Load forecast
      const forecastRes = await fetch(`${API_BASE}/api/ecosystem-fitness/${id}/forecast`);
      const forecastData = await forecastRes.json();
      setForecast(forecastData);

      // Load bottlenecks
      const bottlenecksRes = await fetch(`${API_BASE}/api/ecosystem-fitness/${id}/bottlenecks`);
      const bottlenecksData = await bottlenecksRes.json();
      setBottlenecks(bottlenecksData);

      // Load suggestions
      const suggestionsRes = await fetch(`${API_BASE}/api/ecosystem-fitness/${id}/suggestions`);
      const suggestionsData = await suggestionsRes.json();
      setSuggestions(suggestionsData);
    } catch (error) {
      console.error('Failed to load ecosystem fitness:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      await fetch(`${API_BASE}/api/ecosystem-fitness/${orgId}/anchor`, {
        method: 'POST',
      });
      alert('Ecosystem fitness anchored successfully');
    } catch (error) {
      console.error('Failed to anchor:', error);
      alert('Failed to anchor ecosystem fitness');
    }
  };

  const getQuadrantColor = (q: string) => {
    switch (q) {
      case 'Elite': return 'default';
      case 'Solid': return 'secondary';
      case 'Fragile': return 'default';
      case 'Risk': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ecosystem Fitness Matrix</h1>
          <p className="text-muted-foreground mt-2">
            Measure employer fitness within the credential ecosystem
          </p>
        </div>
        <Button onClick={handleAnchor}>Anchor Snapshot</Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Overall Fitness</CardTitle>
                <CardDescription>Current ecosystem fitness score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {currentDimensions ? Math.round(currentDimensions.overall) : 0}/100
                </div>
                <Progress
                  value={currentDimensions ? currentDimensions.overall : 0}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fitness Quadrant</CardTitle>
                <CardDescription>Classification</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant={getQuadrantColor(quadrant)}>
                  {quadrant}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bottlenecks</CardTitle>
                <CardDescription>Systemic friction points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{bottlenecks.length}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {bottlenecks.filter(b => b.severity === 'high').length} high severity
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dimensions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fitness Dimensions</CardTitle>
              <CardDescription>Multi-dimensional fitness grid</CardDescription>
            </CardHeader>
            <CardContent>
              {currentDimensions ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Efficiency</span>
                      <span>{Math.round(currentDimensions.efficiency)}/100</span>
                    </div>
                    <Progress value={currentDimensions.efficiency} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Reliability</span>
                      <span>{Math.round(currentDimensions.reliability)}/100</span>
                    </div>
                    <Progress value={currentDimensions.reliability} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Safety</span>
                      <span>{Math.round(currentDimensions.safety)}/100</span>
                    </div>
                    <Progress value={currentDimensions.safety} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Fairness</span>
                      <span>{Math.round(currentDimensions.fairness)}/100</span>
                    </div>
                    <Progress value={currentDimensions.fairness} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Readiness</span>
                      <span>{Math.round(currentDimensions.readiness)}/100</span>
                    </div>
                    <Progress value={currentDimensions.readiness} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No fitness dimensions available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fitness Forecast</CardTitle>
              <CardDescription>Predicted fitness 3-12 months ahead</CardDescription>
            </CardHeader>
            <CardContent>
              {forecast.length > 0 ? (
                <div className="space-y-4">
                  {forecast.map((f, i) => (
                    <div key={i}>
                      <div className="flex justify-between mb-2">
                        <span>{f.months} months</span>
                        <span>
                          {Math.round(f.predictedFitness)}/100
                          (confidence: {Math.round(f.confidence * 100)}%)
                        </span>
                      </div>
                      <Progress value={f.predictedFitness} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No forecast data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bottlenecks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Systemic Bottlenecks</CardTitle>
              <CardDescription>Areas contributing friction to ecosystem</CardDescription>
            </CardHeader>
            <CardContent>
              {bottlenecks.length > 0 ? (
                <div className="space-y-4">
                  {bottlenecks.map((b, i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{b.area}</span>
                        <Badge variant={b.severity === 'high' ? 'destructive' : b.severity === 'medium' ? 'default' : 'secondary'}>
                          {b.severity} severity
                        </Badge>
                      </div>
                      <Progress value={b.impact} className="mt-2" />
                      <p className="text-sm text-muted-foreground mt-1">
                        Impact: {Math.round(b.impact)}%
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No bottlenecks detected</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fitness Reinforcement Suggestions</CardTitle>
              <CardDescription>Recommended operational & compliance improvements</CardDescription>
            </CardHeader>
            <CardContent>
              {suggestions.length > 0 ? (
                <div className="space-y-4">
                  {suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                      <Activity className="h-5 w-5 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={s.priority === 'high' ? 'destructive' : s.priority === 'medium' ? 'default' : 'secondary'}>
                            {s.priority}
                          </Badge>
                          <span className="font-medium">{s.action}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Dimension: {s.dimension} | Expected impact: +{Math.round(s.expectedImpact)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No suggestions available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}








