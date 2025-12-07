'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function ContractHealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, get from params or context
    const clinicianId = 'self';
    const employerId = 'employer-1';

    fetch(`${API_BASE}/api/contracts/health/${clinicianId}/${employerId}`)
      .then(res => res.json())
      .then(data => {
        setHealth(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load contract health', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Contract Health</CardTitle>
            <CardDescription>No contract data available</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const overallHealth = health.health?.overall || 'unknown';
  const healthColor = overallHealth === 'healthy' ? 'green' : overallHealth === 'moderate' ? 'yellow' : 'red';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contract Health</CardTitle>
          <CardDescription>Monitor contract health between clinicians and employers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground">Overall Health</p>
              <Badge variant={healthColor === 'green' ? 'default' : healthColor === 'yellow' ? 'secondary' : 'destructive'}>
                {overallHealth.toUpperCase()}
              </Badge>
            </div>

            {health.health?.riskScore && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Risk Score</h3>
                <p className="text-sm">Overall: {(health.health.riskScore.overall * 100).toFixed(1)}%</p>
                <div className="mt-2 space-y-1">
                  {health.health.riskScore.factors.map((factor: any, i: number) => (
                    <div key={i} className="p-2 border rounded">
                      <p className="font-medium">{factor.name}</p>
                      <p className="text-sm text-muted-foreground">{factor.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {health.health?.suggestions && health.health.suggestions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Renegotiation Suggestions</h3>
                <div className="space-y-2">
                  {health.health.suggestions.map((suggestion: any, i: number) => (
                    <div key={i} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{suggestion.term}</p>
                        <Badge variant={suggestion.priority === 'high' ? 'destructive' : 'secondary'}>
                          {suggestion.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

