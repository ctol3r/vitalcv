'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, RefreshCcw, Shield } from 'lucide-react';
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
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface IntegrityAlerts {
  hasAlerts: boolean;
  alerts: string[];
}

interface OriginScore {
  exifScore: number;
  signatureScore: number;
  pdfProducerScore: number;
  overallScore: number;
}

export default function EvidenceIntegrityPage() {
  const [evidenceId, setEvidenceId] = useState('');
  const [integrityScore, setIntegrityScore] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<IntegrityAlerts | null>(null);
  const [originScore, setOriginScore] = useState<OriginScore | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkIntegrity() {
    if (!evidenceId) return;
    setLoading(true);
    try {
      const [alertsRes, integrityRes] = await Promise.all([
        fetch(`${API_BASE}/api/evidence-integrity/${evidenceId}/alerts`),
        fetch(`${API_BASE}/api/evidence-integrity/${evidenceId}/export`),
      ]);

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      }

      if (integrityRes.ok) {
        const integrityData = await integrityRes.json();
        setIntegrityScore(integrityData.integrity);
        setOriginScore(integrityData.originScore);
      }
    } catch (error) {
      console.error('Failed to check integrity:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Issuer · Evidence Integrity</Badge>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Evidence Integrity Network</h1>
          <p className="text-muted-foreground">
            Protect, track, and verify document origin, chain of custody, and integrity
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Check Evidence Integrity</CardTitle>
          <CardDescription>Enter evidence ID to verify integrity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Evidence ID"
              value={evidenceId}
              onChange={(e) => setEvidenceId(e.target.value)}
              className="flex-1 rounded-md border px-3 py-2"
            />
            <Button onClick={checkIntegrity} disabled={loading || !evidenceId}>
              <RefreshCcw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Check
            </Button>
          </div>
        </CardContent>
      </Card>

      {alerts?.hasAlerts && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Integrity Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {alerts.alerts.map((alert, idx) => (
                <li key={idx} className="text-sm text-amber-800 dark:text-amber-200">
                  • {alert}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {integrityScore !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Integrity Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold">
                  {(integrityScore * 100).toFixed(1)}%
                </span>
                <Badge variant={integrityScore > 0.8 ? 'default' : 'secondary'}>
                  {integrityScore > 0.8 ? 'High' : integrityScore > 0.6 ? 'Medium' : 'Low'}
                </Badge>
              </div>
              <Progress value={integrityScore * 100} />
            </div>
          </CardContent>
        </Card>
      )}

      {originScore && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">EXIF Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {(originScore.exifScore * 100).toFixed(0)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Signature Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {(originScore.signatureScore * 100).toFixed(0)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">PDF Producer Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {(originScore.pdfProducerScore * 100).toFixed(0)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

