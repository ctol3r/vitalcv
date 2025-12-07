'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PrivilegeStatus {
  code: string;
  status: 'aligned' | 'restricted' | 'flagged';
  safetyScore: number;
}

interface AlignmentData {
  clinicianId: string;
  alignmentScore: number;
  privileges: PrivilegeStatus[];
  recommendations: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function AlignmentPage() {
  const [alignment, setAlignment] = useState<AlignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clinicianId, setClinicianId] = useState('');

  const fetchAlignment = useCallback(async () => {
    if (!clinicianId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/privilege-alignment/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load alignment (${response.status})`);
      }
      const data = await response.json();
      setAlignment(data);
    } catch (err) {
      console.error('Failed to fetch alignment', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const exportReport = useCallback(async () => {
    if (!clinicianId) return;

    try {
      const response = await fetch(`${API_BASE}/api/privilege-alignment/${clinicianId}/export`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to export report (${response.status})`);
      }
      const data = await response.json();
      // In production, would download the PDF
      alert(`Report generated: ${data.reportUrl}`);
    } catch (err) {
      console.error('Failed to export report', err);
      alert('Failed to export report');
    }
  }, [clinicianId]);

  const statusCounts = alignment
    ? alignment.privileges.reduce(
        (acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      )
    : {};

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aligned':
        return <Badge variant="default">Aligned</Badge>;
      case 'flagged':
        return <Badge variant="secondary">Flagged</Badge>;
      case 'restricted':
        return <Badge variant="destructive">Restricted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Privilege Safety Alignment</h1>
          <p className="text-muted-foreground">
            Automate alignment between clinician safety signals and privilege assignments.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={clinicianId}
            onChange={(e) => setClinicianId(e.target.value)}
            placeholder="Clinician ID"
            className="md:w-64"
          />
          <Button onClick={fetchAlignment} variant="secondary">
            Analyze
          </Button>
          {alignment && (
            <Button onClick={exportReport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {alignment && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alignment Score</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(alignment.alignmentScore * 100).toFixed(0)}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aligned</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statusCounts.aligned || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Flagged</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statusCounts.flagged || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Restricted</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statusCounts.restricted || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Privilege Status</CardTitle>
              <CardDescription>Safety alignment by privilege code</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alignment.privileges.map((priv, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium">{priv.code}</div>
                        <div className="text-sm text-muted-foreground">
                          Safety score: {(priv.safetyScore * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(priv.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {alignment.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Actions to improve safety alignment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alignment.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-2 border rounded">
                      <div className="text-sm">{rec}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Analyzing alignment...</div>
        </div>
      )}
    </div>
  );
}








