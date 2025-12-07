'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { getJSON } from '@/components/api/http';
import { DriftGraph } from '@/components/compliance/DriftGraph';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export default function PredictivePage() {
  const [credentialId, setCredentialId] = useState('');
  const [queryId, setQueryId] = useState('');

  const { data, error, isLoading } = useSWR(
    queryId ? `/api/compliance/predict/${queryId}` : null,
    (path) => getJSON<any>(path)
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQueryId(credentialId);
  };

  // Merge history and projection for the graph
  const graphData = React.useMemo(() => {
    if (!data) return [];
    const history = (data.riskHistory || []).map((d: any) => ({ ...d, risk: d.riskLevel, type: 'historical' as const }));
    const projection = (data.timelineProjection || []).map((d: any) => ({ ...d, risk: d.riskLevel, type: 'projected' as const }));
    return [...history, ...projection].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Compliance Predictor</h1>
        <p className="text-muted-foreground">
          AI-driven risk analysis and compliance forecasting.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analyze Credential</CardTitle>
          <CardDescription>Enter a Credential ID to generate a risk report.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <Input
              placeholder="Credential ID..."
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              className="max-w-md"
            />
            <Button type="submit" disabled={!credentialId}>
              Analyze
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && <div>Analyzing patterns and history...</div>}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load prediction data. {error.message}</AlertDescription>
        </Alert>
      )}

      {data && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">

          <div className="col-span-4 space-y-6">
            <DriftGraph data={graphData} />

            <Card>
              <CardHeader>
                <CardTitle>Risk Heat Map (Projected 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {(data.timelineProjection || []).map((day: any, i: number) => {
                    const risk = day.riskLevel;
                    let bg = 'bg-green-500';
                    if (risk > 0.7) bg = 'bg-red-500';
                    else if (risk > 0.4) bg = 'bg-yellow-500';

                    return (
                      <div
                        key={i}
                        className={`h-8 w-8 ${bg} rounded hover:opacity-80 cursor-help transition-colors`}
                        title={`${day.date}: ${(risk * 100).toFixed(0)}% Risk`}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-muted-foreground flex gap-4">
                  <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded"></div> Low Risk</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded"></div> Medium Risk</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> High Risk</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-3 space-y-6">

            <Card>
              <CardHeader>
                <CardTitle>Projected Compliance State</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Failure Risk</span>
                  <span className={`text-2xl font-bold ${data.failureRisk > 0.7 ? 'text-red-600' : 'text-green-600'}`}>
                    {(data.failureRisk * 100).toFixed(1)}%
                  </span>
                </div>

                {data.mostLikelyFailRule && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Most Likely Failure</p>
                    <p className="font-medium text-foreground mt-1">{data.mostLikelyFailRule}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommended Fixes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {data.recommendedActions.map((action: string, i: number) => (
                    <li key={i} className="flex gap-3 items-start">
                      {data.failureRisk > 0.7 ? (
                         <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                      ) : (
                         <RefreshCw className="h-5 w-5 text-blue-500 shrink-0" />
                      )}
                      <span className="text-sm">{action}</span>
                    </li>
                  ))}
                </ul>
                {data.failureRisk > 0.7 && (
                  <Button className="w-full mt-6" variant="destructive">
                    Take Action Now
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}


