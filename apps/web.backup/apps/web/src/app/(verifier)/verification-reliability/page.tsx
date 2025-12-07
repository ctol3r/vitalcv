'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, RefreshCw, Anchor, Shield } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function VerificationReliabilityPage() {
  const [reliability, setReliability] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = 'demo-session-id'; // In production, get from context

  useEffect(() => {
    loadReliability();
  }, []);

  const loadReliability = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/verification-reliability/${sessionId}`);
      if (!res.ok) throw new Error('Failed to load reliability');
      const data = await res.json();
      setReliability(data.reliability);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/verification-reliability/${sessionId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadReliability();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Verification Reliability</h1>
          <p className="text-muted-foreground">
            Score and optimize the reliability of verification across all networks, devices, and wallets
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadReliability}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reliability Score</CardTitle>
          <CardDescription>Overall verification reliability</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{reliability?.reliability?.score || 0}</div>
            <div className="flex-1">
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${reliability?.reliability?.score || 0}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {reliability?.session && (
        <Card>
          <CardHeader>
            <CardTitle>Session Information</CardTitle>
            <CardDescription>Device and network context</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Browser</div>
                <div className="font-medium">{reliability.session.browser}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Device Type</div>
                <div className="font-medium">{reliability.session.deviceType}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Network Quality</div>
                <Badge>{reliability.session.networkQuality}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Agent Context</div>
                <div className="font-medium">{reliability.session.agentContext}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {reliability?.failurePatterns && reliability.failurePatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Failure Patterns</CardTitle>
            <CardDescription>Common verification failures detected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reliability.failurePatterns.map((pattern: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{pattern.pattern}</span>
                    <Badge variant={pattern.severity === 'high' ? 'destructive' : 'default'}>
                      {pattern.severity}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Frequency: {pattern.frequency}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {reliability?.prediction && (
        <Card>
          <CardHeader>
            <CardTitle>Reliability Prediction</CardTitle>
            <CardDescription>Forecast for future sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Future Reliability</span>
                <Badge>{reliability.prediction.futureReliability}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Confidence</span>
                <Badge>{reliability.prediction.confidence}%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {reliability?.reinforcementSuggestions && reliability.reinforcementSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reinforcement Suggestions</CardTitle>
            <CardDescription>Steps to improve verification reliability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reliability.reinforcementSuggestions.map((suggestion: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={suggestion.priority === 'high' ? 'destructive' : 'default'}>
                      {suggestion.priority}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      +{suggestion.expectedImprovement}% improvement
                    </span>
                  </div>
                  <p className="font-medium">{suggestion.action}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

