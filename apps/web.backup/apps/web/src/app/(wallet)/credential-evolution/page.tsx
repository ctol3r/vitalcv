'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Timeline, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CredentialEvolutionPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [clinicianId, setClinicianId] = useState('');

  useEffect(() => {
    if (clinicianId) {
      loadData();
    }
  }, [clinicianId]);

  async function loadData() {
    if (!clinicianId) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/credential-evolution/${clinicianId}`);
      if (res.ok) {
        const evolutionData = await res.json();
        setData(evolutionData);
      }
    } catch (error) {
      console.error('Failed to load credential evolution:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!clinicianId) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Credential Evolution Engine</h1>
          <p className="text-muted-foreground mt-2">
            Track, predict, and optimize how credentials evolve across a clinician's career
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Enter Clinician ID</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="text"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Enter clinician ID"
              className="w-full p-2 border rounded"
            />
            <Button onClick={loadData} className="mt-4">
              Load Evolution Data
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const evolution = data?.evolution || {};
  const credentials = evolution.credentials || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Evolution Timeline</h1>
          <p className="text-muted-foreground mt-2">
            Track how credentials change over time
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {credentials.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No credential evolution data found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {credentials.map((cred: any, idx: number) => (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Credential {cred.credentialId}</CardTitle>
                  <Badge variant={cred.regressionDetected ? 'destructive' : 'default'}>
                    {cred.status || 'active'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {cred.regressionDetected && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <div className="font-semibold text-red-600">Regression Detected</div>
                      <div className="text-sm text-muted-foreground">
                        Type: {cred.regressionDetected.type} | Severity: {cred.regressionDetected.severity}
                      </div>
                    </div>
                  </div>
                )}

                {cred.predictedRenewal && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="font-semibold">Predicted Renewal</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Date: {new Date(cred.predictedRenewal.date).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Confidence: {(cred.predictedRenewal.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm mt-2">
                      Required Evidence:
                      <ul className="list-disc list-inside ml-2">
                        {cred.predictedRenewal.requiredEvidence?.map((ev: string, i: number) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {cred.decayScore !== undefined && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Credential Strength</span>
                      <span className="text-sm text-muted-foreground">
                        {(cred.decayScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          cred.decayScore > 0.7 ? 'bg-green-500' : cred.decayScore > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${cred.decayScore * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {cred.changes && cred.changes.length > 0 && (
                  <div>
                    <div className="font-semibold mb-2">Change History</div>
                    <div className="space-y-2">
                      {cred.changes.slice(-5).map((change: any, i: number) => (
                        <div key={i} className="text-sm border-l-2 pl-3">
                          <div className="font-medium">{change.field}</div>
                          <div className="text-muted-foreground">
                            {String(change.oldValue)} → {String(change.newValue)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(change.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

