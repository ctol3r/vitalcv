'use client';

import { useCallback, useState } from 'react';
import { Heart, TrendingUp, FileDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ResonancePage() {
  const [clinicianId, setClinicianId] = useState('');
  const [employerId, setEmployerId] = useState('');
  const [resonance, setResonance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResonance = useCallback(async () => {
    if (!clinicianId || !employerId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/talent-resonance/${clinicianId}/${employerId}`);
      if (!response.ok) {
        throw new Error(`Failed to load resonance (${response.status})`);
      }
      const data = await response.json();
      setResonance(data);
    } catch (err) {
      console.error('Failed to fetch resonance', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId, employerId]);

  const anchorSnapshot = useCallback(async () => {
    if (!clinicianId || !employerId) return;
    try {
      const response = await fetch(`${API_BASE}/api/talent-resonance/${clinicianId}/${employerId}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Resonance snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [clinicianId, employerId]);

  const exportBundle = useCallback(async () => {
    if (!clinicianId || !employerId) return;
    try {
      const response = await fetch(`${API_BASE}/api/talent-resonance/${clinicianId}/${employerId}/export`);
      if (!response.ok) {
        throw new Error('Failed to export bundle');
      }
      const data = await response.json();
      const blob = new Blob([data.pdfData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resonance-${clinicianId}-${employerId}-${Date.now()}.json`;
      a.click();
    } catch (err) {
      console.error('Failed to export bundle', err);
      alert('Failed to export bundle');
    }
  }, [clinicianId, employerId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Talent Resonance & Match Quality Engine</h1>
          <p className="text-muted-foreground">
            Measure "resonance" — how deeply a clinician matches an employer's needs, culture & trajectory
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Talent Resonance</CardTitle>
          <CardDescription>Enter clinician and employer IDs to view resonance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Input
              value={employerId}
              onChange={(e) => setEmployerId(e.target.value)}
              placeholder="Employer ID"
              className="flex-1"
            />
            <Button onClick={fetchResonance} disabled={!clinicianId || !employerId || loading}>
              View
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {resonance && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Match Quality Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">
                  {(resonance.resonance?.matchQuality * 100 || 0).toFixed(1)}%
                </div>
                <div className="flex-1">
                  <Progress value={resonance.resonance?.matchQuality * 100 || 0} className="h-2" />
                </div>
                <Badge variant={(resonance.resonance?.matchQuality || 0) >= 0.8 ? 'default' : (resonance.resonance?.matchQuality || 0) >= 0.6 ? 'secondary' : 'destructive'}>
                  {(resonance.resonance?.matchQuality || 0) >= 0.8 ? 'High' : (resonance.resonance?.matchQuality || 0) >= 0.6 ? 'Medium' : 'Low'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {resonance.resonance?.factors && (
            <Card>
              <CardHeader>
                <CardTitle>Resonance Factors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(resonance.resonance.factors).map(([key, value]: [string, any]) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm capitalize">{key}</span>
                      <span className="text-sm font-medium">{(value * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={value * 100} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {resonance.resonance?.culturalFit && (
            <Card>
              <CardHeader>
                <CardTitle>Cultural Fit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(resonance.resonance.culturalFit).map(([key, value]: [string, any]) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm capitalize">{key}</span>
                      <span className="text-sm font-medium">{(value * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={value * 100} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button onClick={anchorSnapshot} variant="outline">
              <CheckCircle className="mr-2 h-4 w-4" />
              Anchor Snapshot
            </Button>
            <Button onClick={exportBundle} variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Export Bundle
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

