'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCcw, Shield, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface Conflict {
  field: string;
  sources: Array<{ sourceId: string; value: any; trust: number; recency: string }>;
  severity: number;
  predicted: boolean;
}

interface Resolution {
  field: string;
  canonicalValue: any;
  canonicalSource: string;
  reason: string;
  confidence: number;
}

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState('demo_clinician_123');

  useEffect(() => {
    loadConflicts();
  }, []);

  async function loadConflicts() {
    setLoading(true);
    try {
      const [conflictsRes, auditRes] = await Promise.all([
        fetch(`${API_BASE}/api/credential-conflicts/${clinicianId}/detect`, {
          method: 'POST',
        }),
        fetch(`${API_BASE}/api/credential-conflicts/${clinicianId}/audit`),
      ]);

      if (conflictsRes.ok) {
        const data = await conflictsRes.json();
        setConflicts(data.conflicts || []);
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAudit(auditData);
      }
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function resolveConflicts() {
    try {
      const response = await fetch(`${API_BASE}/api/credential-conflicts/${clinicianId}/resolve`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setResolutions(data.resolutions || []);
        await loadConflicts();
      }
    } catch (error) {
      console.error('Failed to resolve conflicts:', error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Issuer · Conflict Resolution</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Credential Conflict Resolution</h1>
            <p className="text-muted-foreground">
              Automatic reconciliation of conflicting, inconsistent, or stale credential data
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => loadConflicts()}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {audit && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-2xl">{audit.resolved || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unresolved</CardDescription>
              <CardTitle className="text-2xl text-amber-600">{audit.unresolved || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Predicted</CardDescription>
              <CardTitle className="text-2xl text-blue-600">{audit.predicted || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Critical</CardDescription>
              <CardTitle className="text-2xl text-red-600">
                {audit.severityBreakdown?.critical || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Detected Conflicts</CardTitle>
                <CardDescription>{conflicts.length} conflict(s) found</CardDescription>
              </div>
              <Button onClick={resolveConflicts}>Auto-Resolve All</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {conflicts.map((conflict, idx) => (
              <div key={idx} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="font-medium">{conflict.field}</span>
                      {conflict.predicted && (
                        <Badge variant="outline" className="text-xs">
                          Predicted
                        </Badge>
                      )}
                    </div>
                    <Progress value={conflict.severity} className="mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Severity: {conflict.severity}/100
                    </p>
                    <div className="mt-2 space-y-1">
                      {conflict.sources.map((source, sIdx) => (
                        <div key={sIdx} className="text-sm">
                          <span className="font-medium">{source.sourceId}:</span>{' '}
                          <span className="text-muted-foreground">
                            {JSON.stringify(source.value)} (trust: {source.trust})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {resolutions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resolutions</CardTitle>
            <CardDescription>Canonical values selected for each conflict</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resolutions.map((resolution, idx) => (
              <div key={idx} className="rounded-lg border p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">{resolution.field}</div>
                    <div className="text-sm text-muted-foreground">
                      Value: {JSON.stringify(resolution.canonicalValue)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Source: {resolution.canonicalSource} · Confidence: {resolution.confidence}% ·{' '}
                      {resolution.reason}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && conflicts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-muted-foreground">No conflicts detected</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








