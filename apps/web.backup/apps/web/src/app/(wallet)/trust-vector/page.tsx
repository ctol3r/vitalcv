'use client';

import { Activity, AlertTriangle, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface TrustVector {
  overall: number;
  privilege: number;
  verification: number;
  evidence: number;
  regulatory: number;
  employer: number;
  chain: number;
  timestamp: string;
}

interface TrustForecast {
  days: number;
  predictedTrust: number;
  confidence: number;
}

interface TrustReinforcement {
  action: string;
  priority: 'high' | 'medium' | 'low';
  expectedImpact: number;
}

interface TrustFragility {
  component: string;
  fragility: number;
  risk: 'high' | 'medium' | 'low';
}

export default function TrustVectorPage() {
  const [loading, setLoading] = useState(true);
  const [currentVector, setCurrentVector] = useState<TrustVector | null>(null);
  const [phase, setPhase] = useState<string>('');
  const [forecast, setForecast] = useState<TrustForecast[]>([]);
  const [suggestions, setSuggestions] = useState<TrustReinforcement[]>([]);
  const [fragility, setFragility] = useState<TrustFragility[]>([]);
  const [clinicianId, setClinicianId] = useState<string>('');

  useEffect(() => {
    // Get clinician ID from URL or context
    const params = new URLSearchParams(window.location.search);
    const id = params.get('clinicianId') || 'default-clinician';
    setClinicianId(id);
    loadTrustVector(id);
  }, []);

  const loadTrustVector = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/trust-vector-evolution/${id}`);
      const data = await res.json();

      const vectors = data.vectors || [];
      if (vectors.length > 0) {
        setCurrentVector(vectors[vectors.length - 1]);
      }

      setPhase(data.currentPhase || 'Stable');

      // Load forecast
      const forecastRes = await fetch(`${API_BASE}/api/trust-vector-evolution/${id}/forecast`);
      const forecastData = await forecastRes.json();
      setForecast(forecastData);

      // Load suggestions
      const suggestionsRes = await fetch(`${API_BASE}/api/trust-vector-evolution/${id}/suggestions`);
      const suggestionsData = await suggestionsRes.json();
      setSuggestions(suggestionsData);

      // Load fragility
      const fragilityRes = await fetch(`${API_BASE}/api/trust-vector-evolution/${id}/fragility`);
      const fragilityData = await fragilityRes.json();
      setFragility(fragilityData);
    } catch (error) {
      console.error('Failed to load trust vector:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      await fetch(`${API_BASE}/api/trust-vector-evolution/${clinicianId}/anchor`, {
        method: 'POST',
      });
      alert('Trust vector evolution anchored successfully');
    } catch (error) {
      console.error('Failed to anchor:', error);
      alert('Failed to anchor trust vector evolution');
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
          <h1 className="text-3xl font-bold">Trust Vector Evolution</h1>
          <p className="text-muted-foreground mt-2">
            Track and optimize clinician trust across multiple dimensions
          </p>
        </div>
        <Button onClick={handleAnchor}>Anchor Snapshot</Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="fragility">Fragility Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Overall Trust</CardTitle>
                <CardDescription>Current trust score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {currentVector ? Math.round(currentVector.overall * 100) : 0}%
                </div>
                <Progress
                  value={currentVector ? currentVector.overall * 100 : 0}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Phase</CardTitle>
                <CardDescription>Trust transition state</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant={phase === 'Rising' ? 'default' : phase === 'Volatile' ? 'destructive' : 'secondary'}>
                  {phase}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Task 460.16 - Multi-angle trust radar visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Trust Radar</CardTitle>
              <CardDescription>Multi-dimensional trust visualization</CardDescription>
            </CardHeader>
            <CardContent>
              {currentVector ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Privilege</span>
                      <span>{Math.round(currentVector.privilege * 100)}%</span>
                    </div>
                    <Progress value={currentVector.privilege * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Verification</span>
                      <span>{Math.round(currentVector.verification * 100)}%</span>
                    </div>
                    <Progress value={currentVector.verification * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Evidence</span>
                      <span>{Math.round(currentVector.evidence * 100)}%</span>
                    </div>
                    <Progress value={currentVector.evidence * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Regulatory</span>
                      <span>{Math.round(currentVector.regulatory * 100)}%</span>
                    </div>
                    <Progress value={currentVector.regulatory * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Employer</span>
                      <span>{Math.round(currentVector.employer * 100)}%</span>
                    </div>
                    <Progress value={currentVector.employer * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>Chain</span>
                      <span>{Math.round(currentVector.chain * 100)}%</span>
                    </div>
                    <Progress value={currentVector.chain * 100} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No trust vector data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trust Forecast</CardTitle>
              <CardDescription>Predicted trust evolution 30-180 days ahead</CardDescription>
            </CardHeader>
            <CardContent>
              {forecast.length > 0 ? (
                <div className="space-y-4">
                  {forecast.map((f, i) => (
                    <div key={i}>
                      <div className="flex justify-between mb-2">
                        <span>{f.days} days</span>
                        <span>{Math.round(f.predictedTrust * 100)}% (confidence: {Math.round(f.confidence * 100)}%)</span>
                      </div>
                      <Progress value={f.predictedTrust * 100} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No forecast data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trust Reinforcement Suggestions</CardTitle>
              <CardDescription>Recommended actions to improve trust</CardDescription>
            </CardHeader>
            <CardContent>
              {suggestions.length > 0 ? (
                <div className="space-y-4">
                  {suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                      <Zap className="h-5 w-5 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={s.priority === 'high' ? 'destructive' : s.priority === 'medium' ? 'default' : 'secondary'}>
                            {s.priority}
                          </Badge>
                          <span className="font-medium">{s.action}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expected impact: +{Math.round(s.expectedImpact * 100)}%
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

        <TabsContent value="fragility" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trust Fragility Analysis</CardTitle>
              <CardDescription>Vulnerability points in trust vector</CardDescription>
            </CardHeader>
            <CardContent>
              {fragility.length > 0 ? (
                <div className="space-y-4">
                  {fragility.map((f, i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">{f.component}</span>
                        <Badge variant={f.risk === 'high' ? 'destructive' : f.risk === 'medium' ? 'default' : 'secondary'}>
                          {f.risk} risk
                        </Badge>
                      </div>
                      <Progress value={f.fragility * 100} className="mt-2" />
                      <p className="text-sm text-muted-foreground mt-1">
                        Fragility: {Math.round(f.fragility * 100)}%
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No fragility data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}








