'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, RefreshCw, Anchor, BookOpen } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function DutyCompetencyPage() {
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clinicianId = 'demo-clinician-id'; // In production, get from auth context

  useEffect(() => {
    loadLedger();
  }, []);

  const loadLedger = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/duty-competency/${clinicianId}`);
      if (!res.ok) throw new Error('Failed to load ledger');
      const data = await res.json();
      setLedger(data.ledger);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/duty-competency/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadLedger();
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
          <h1 className="text-3xl font-bold">Duty & Competency Ledger</h1>
          <p className="text-muted-foreground">
            Track every duty, competency, specialty skill, and procedural qualification
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadLedger}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Duties</CardTitle>
            <CardDescription>Tracked duties from employment, privileging, EHR</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ledger?.duties?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Competencies</CardTitle>
            <CardDescription>Linked competencies with evidence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ledger?.competencies?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {ledger?.gaps && ledger.gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Competency Gaps</CardTitle>
            <CardDescription>Missing requirements for desired roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ledger.gaps.map((gap: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{gap.requirement}</span>
                    <Badge variant={gap.priority === 'high' ? 'destructive' : 'default'}>
                      {gap.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Missing: {gap.missing}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {ledger?.drift && ledger.drift.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Drift Detection</CardTitle>
            <CardDescription>Mismatches between duty and credential</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ledger.drift.map((d: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <Badge variant={d.severity === 'high' ? 'destructive' : 'default'}>
                      {d.severity}
                    </Badge>
                  </div>
                  <p className="text-sm">{d.mismatch}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {ledger?.performanceOverlay && ledger.performanceOverlay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Overlay</CardTitle>
            <CardDescription>Performance scores linked to competency maturity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ledger.performanceOverlay.map((overlay: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{overlay.competency}</span>
                    <Badge>{overlay.maturity}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Performance Score: {overlay.performanceScore}
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

