'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RuleDiffIntelligence {
  region: string;
  diffs: Array<{
    source: string;
    change: string;
    severity: string;
  }>;
  severityCounts: {
    minor: number;
    medium: number;
    high: number;
    critical: number;
  };
  forecast?: {
    predictedChanges: number;
    timeframe: string;
    confidence: number;
  };
  narrative?: string;
}

export default function RuleDiffPage() {
  const [intelligence, setIntelligence] = useState<RuleDiffIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState('US');

  const fetchIntelligence = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rule-diff/${region}`);
      const data = await res.json();
      setIntelligence(data);
    } catch (error) {
      console.error('Failed to fetch rule diff intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [region]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Regulatory Rule-Diff Intelligence</h1>
        <p className="text-muted-foreground mt-2">
          Track regulatory changes across regions, chains & rule-sources
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Region</CardTitle>
          <CardDescription>Select region to analyze rule changes</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="US">United States</option>
            <option value="EU">European Union</option>
            <option value="CA">Canada</option>
          </select>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {intelligence && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Severity Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {intelligence.severityCounts.critical}
                  </div>
                  <div className="text-sm text-muted-foreground">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {intelligence.severityCounts.high}
                  </div>
                  <div className="text-sm text-muted-foreground">High</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {intelligence.severityCounts.medium}
                  </div>
                  <div className="text-sm text-muted-foreground">Medium</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {intelligence.severityCounts.minor}
                  </div>
                  <div className="text-sm text-muted-foreground">Minor</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {intelligence.narrative && (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{intelligence.narrative}</p>
              </CardContent>
            </Card>
          )}

          {intelligence.forecast && (
            <Card>
              <CardHeader>
                <CardTitle>Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold">Predicted Changes: </span>
                    {intelligence.forecast.predictedChanges} over {intelligence.forecast.timeframe}
                  </div>
                  <div>
                    <span className="font-semibold">Confidence: </span>
                    {(intelligence.forecast.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Rule Changes</CardTitle>
              <CardDescription>{intelligence.diffs.length} total changes detected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {intelligence.diffs.map((diff, idx) => (
                  <div key={idx} className="flex items-start justify-between p-3 border rounded-md">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge>{diff.source}</Badge>
                        <Badge className={getSeverityColor(diff.severity)}>
                          {diff.severity}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{diff.change}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

