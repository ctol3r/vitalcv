'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface CredentialForensics {
  syntheticDetection: {
    score: number;
    indicators: string[];
  };
  ocrAnomalies: Array<{
    type: string;
    location: string;
    severity: string;
    confidence: number;
  }>;
  fieldMismatches: Array<{
    field: string;
    severity: string;
  }>;
  signatureForgery: {
    detected: boolean;
    confidence: number;
  };
  blacklistMatches: Array<{
    entity: string;
    reason: string;
  }>;
  overallRisk: number;
}

export default function ForensicsPage() {
  const [credentialId, setCredentialId] = useState('');
  const [forensics, setForensics] = useState<CredentialForensics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForensics = useCallback(async () => {
    if (!credentialId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/credential-forensics/${credentialId}`);
      if (!res.ok) throw new Error(`Failed to load forensics (${res.status})`);
      const data = await res.json();
      setForensics(data);
    } catch (err) {
      console.error('Failed to fetch credential forensics', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  useEffect(() => {
    if (credentialId) {
      fetchForensics();
    }
  }, [credentialId, fetchForensics]);

  const criticalAnomalies = forensics?.ocrAnomalies.filter((a) => a.severity === 'critical' || a.severity === 'high') || [];
  const criticalMismatches = forensics?.fieldMismatches.filter((m) => m.severity === 'critical' || m.severity === 'high') || [];

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Credential Forensics</h1>
          <p className="text-muted-foreground">
            Forensic engine to detect fraud, forgery, anomalies & synthetic documents with AI.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={credentialId}
            onChange={(e) => setCredentialId(e.target.value)}
            placeholder="Credential ID"
            className="md:w-56"
          />
          <Button onClick={fetchForensics} variant="secondary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Analyze
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Analyzing credential...</p>
        </div>
      )}

      {!loading && forensics && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Overall Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{forensics.overallRisk.toFixed(0)}</div>
                <Progress value={forensics.overallRisk} className="mt-2" />
                <Badge
                  variant={
                    forensics.overallRisk > 70 ? 'destructive' : forensics.overallRisk > 40 ? 'default' : 'secondary'
                  }
                  className="mt-2"
                >
                  {forensics.overallRisk > 70 ? 'High Risk' : forensics.overallRisk > 40 ? 'Medium Risk' : 'Low Risk'}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Synthetic Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{forensics.syntheticDetection.score.toFixed(0)}</div>
                <Progress value={forensics.syntheticDetection.score} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">OCR Anomalies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{forensics.ocrAnomalies.length}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {criticalAnomalies.length} critical
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Field Mismatches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{forensics.fieldMismatches.length}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {criticalMismatches.length} critical
                </p>
              </CardContent>
            </Card>
          </div>

          {forensics.signatureForgery.detected && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Signature Forgery Detected</AlertTitle>
              <AlertDescription>
                Confidence: {(forensics.signatureForgery.confidence * 100).toFixed(0)}%
              </AlertDescription>
            </Alert>
          )}

          {forensics.blacklistMatches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Blacklist Matches</CardTitle>
                <CardDescription>Known fraudulent entities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {forensics.blacklistMatches.map((match, idx) => (
                    <Alert key={idx} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{match.entity}</AlertTitle>
                      <AlertDescription>{match.reason}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {forensics.syntheticDetection.indicators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Synthetic Detection Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {forensics.syntheticDetection.indicators.map((indicator, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      {indicator}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {criticalAnomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Critical OCR Anomalies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {criticalAnomalies.map((anomaly, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{anomaly.type}</div>
                        <div className="text-sm text-muted-foreground">{anomaly.location}</div>
                      </div>
                      <Badge variant="destructive">
                        {(anomaly.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}








