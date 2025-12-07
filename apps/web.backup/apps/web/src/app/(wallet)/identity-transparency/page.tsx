'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCcw, Shield, Source } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';
const CLINICIAN_ID = process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID || 'cln_demo';

interface IdentitySource {
  sourceId: string;
  sourceType: 'NPPES' | 'STATE_BOARD' | 'NPDB' | 'GLOBAL_REGULATOR';
  confidence: number;
  timestamp: string;
}

interface IdentityFusionData {
  clinicianId: string;
  fused: Record<string, unknown>;
  confidence: number;
  timestamp: string;
  sources: IdentitySource[];
  conflicts: {
    total: number;
    resolved: number;
    unresolved: number;
  };
  reliability: {
    overallScore: number;
    sourceDiversity: number;
    validationDensity: number;
    temporalConsistency: number;
    fieldCoverage: number;
  };
  eventLog?: Array<{
    eventType: string;
    changeHash: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
}

export default function IdentityTransparencyPage() {
  const [data, setData] = useState<IdentityFusionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdentity = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/fusion/identity/${CLINICIAN_ID}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch identity: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const refreshIdentity = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/fusion/identity/${CLINICIAN_ID}/refresh`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Failed to refresh identity: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading && !data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading identity data...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchIdentity} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const sourceTypeLabels: Record<string, string> = {
    NPPES: 'NPPES Registry',
    STATE_BOARD: 'State Board',
    NPDB: 'NPDB',
    GLOBAL_REGULATOR: 'Global Regulator',
  };

  const sourceTypeColors: Record<string, string> = {
    NPPES: 'bg-blue-500',
    STATE_BOARD: 'bg-green-500',
    NPDB: 'bg-red-500',
    GLOBAL_REGULATOR: 'bg-purple-500',
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Identity Transparency</h1>
          <p className="text-muted-foreground mt-1">
            View which data sources contributed to your fused identity
          </p>
        </div>
        <Button onClick={refreshIdentity} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overall Confidence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Identity Confidence
          </CardTitle>
          <CardDescription>
            Overall confidence score: {(data.confidence * 100).toFixed(1)}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={data.confidence * 100} className="h-3" />
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Source Diversity</div>
              <div className="text-2xl font-bold">
                {(data.reliability.sourceDiversity * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Validation Density</div>
              <div className="text-2xl font-bold">
                {(data.reliability.validationDensity * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Temporal Consistency</div>
              <div className="text-2xl font-bold">
                {(data.reliability.temporalConsistency * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Field Coverage</div>
              <div className="text-2xl font-bold">
                {(data.reliability.fieldCoverage * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Source className="h-5 w-5" />
            Data Sources ({data.sources.length})
          </CardTitle>
          <CardDescription>
            Sources that contributed to your fused identity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.sources.map((source) => (
              <div
                key={source.sourceId}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-3 h-3 rounded-full ${sourceTypeColors[source.sourceType] ?? 'bg-gray-500'}`}
                  />
                  <div>
                    <div className="font-medium">
                      {sourceTypeLabels[source.sourceType] ?? source.sourceType}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(source.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">
                    {(source.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conflicts */}
      {data.conflicts.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Conflicts ({data.conflicts.total})
            </CardTitle>
            <CardDescription>
              {data.conflicts.resolved} resolved, {data.conflicts.unresolved} unresolved
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.conflicts.resolved > 0 && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{data.conflicts.resolved} conflicts resolved</span>
                </div>
              )}
              {data.conflicts.unresolved > 0 && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{data.conflicts.unresolved} conflicts need attention</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Log */}
      {data.eventLog && data.eventLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Event Log</CardTitle>
            <CardDescription>History of identity changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.eventLog.map((event, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{event.eventType}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {event.changeHash.slice(0, 8)}...
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

