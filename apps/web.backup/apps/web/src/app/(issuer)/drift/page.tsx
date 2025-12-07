'use client';

import { AlertCircle, TrendingDown, RefreshCw, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface DriftData {
  magnitude: number;
  direction: string;
  components: Record<string, number>;
  severity: {
    level: 'low' | 'medium' | 'high' | 'critical';
    urgency: number;
    affectedFields: string[];
  };
  corrections: Array<{ date: string; correction: string; fields: string[] }>;
}

export default function DriftPage() {
  const [drift, setDrift] = useState<DriftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    fetchDrift();
  }, []);

  async function fetchDrift() {
    try {
      // Get credentialId from query params or use a default for demo
      const credentialId = 'demo-credential-id'; // TODO: Get from route params
      const res = await fetch(`${API_BASE}/api/drift/${credentialId}`);
      if (res.ok) {
        const data = await res.json();
        setDrift(data);
      }
    } catch (error) {
      console.error('Failed to fetch drift data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleReconcile() {
    setReconciling(true);
    try {
      const credentialId = 'demo-credential-id'; // TODO: Get from route params
      const res = await fetch(`${API_BASE}/api/drift/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });
      if (res.ok) {
        await fetchDrift();
      }
    } catch (error) {
      console.error('Failed to reconcile drift:', error);
    } finally {
      setReconciling(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!drift) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Credential Drift</CardTitle>
            <CardDescription>No drift data available</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const severityColors = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Drift Engine</h1>
          <p className="text-muted-foreground mt-2">
            Detect and prevent drift between actual credential state and system representation
          </p>
        </div>
        <Button onClick={handleReconcile} disabled={reconciling}>
          <RefreshCw className={`h-4 w-4 mr-2 ${reconciling ? 'animate-spin' : ''}`} />
          Reconcile Drift
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Drift Overview</CardTitle>
          <CardDescription>Current drift magnitude and severity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold">{Math.round(drift.magnitude * 100)}%</span>
                <p className="text-sm text-muted-foreground">Drift Magnitude</p>
              </div>
              <Badge
                className={severityColors[drift.severity.level]}
                variant="outline"
              >
                {drift.severity.level.toUpperCase()}
              </Badge>
            </div>
            <Progress value={drift.magnitude * 100} />
            <div className="text-sm text-muted-foreground">
              Affected fields: {drift.direction || 'None'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Drift Components</CardTitle>
          <CardDescription>Per-field drift analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(drift.components).map(([field, value]) => (
              <div key={field} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{field}</span>
                  <span>{Math.round(value * 100)}%</span>
                </div>
                <Progress value={value * 100} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Severity Analysis</CardTitle>
          <CardDescription>Drift classification and urgency</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Urgency</span>
              <Badge variant={drift.severity.urgency > 0.7 ? 'destructive' : 'secondary'}>
                {Math.round(drift.severity.urgency * 100)}%
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Affected Fields:</p>
              <div className="flex flex-wrap gap-2">
                {drift.severity.affectedFields.map((field) => (
                  <Badge key={field} variant="outline">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {drift.corrections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Correction Timeline</CardTitle>
            <CardDescription>History of drift corrections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {drift.corrections.map((correction, i) => (
                <div key={i} className="border-l-2 border-primary pl-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{correction.correction}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(correction.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {correction.fields.map((field) => (
                      <Badge key={field} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

