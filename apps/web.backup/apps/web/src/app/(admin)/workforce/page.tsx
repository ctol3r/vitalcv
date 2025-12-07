'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DriverBreakdown {
  issuancePressure: number;
  credentialChurn: number;
  sanctionsDrag: number;
  compactReliefGap: number;
}

interface SpecialtyImpact {
  specialty: string;
  region?: string;
  shortageIndex: number;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  drivers: DriverBreakdown;
  expiringCredentials: number;
  licenseIssuanceVelocity: number;
}

interface WorkforcePredictionResponse {
  shortageIndex: number;
  reasoning: {
    issuancePressure: number;
    credentialChurn: number;
    sanctionsDrag: number;
    compactReliefGap: number;
    summary: string[];
  };
  specialtiesImpacted: SpecialtyImpact[];
  recommendedHires: number;
  cached?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function WorkforceIntelligencePanel() {
  const [orgId, setOrgId] = useState('demo-org');
  const [prediction, setPrediction] = useState<WorkforcePredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchPrediction = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/workforce/predict/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load workforce prediction (${response.status})`);
      }
      const data = await response.json();
      setPrediction(data);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('Failed to fetch workforce prediction', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchPrediction();
    const interval = setInterval(fetchPrediction, 30_000);
    return () => clearInterval(interval);
  }, [fetchPrediction]);

  const severity = useMemo(() => classifySeverity(prediction?.shortageIndex ?? 0), [prediction]);
  const recommendations = useMemo(() => buildRecommendations(prediction), [prediction]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce Readiness</h1>
          <p className="text-muted-foreground">
            Real-time shortage signals, impacted specialties, and surge hiring guidance.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={orgId}
            onChange={(event) => setOrgId(event.target.value)}
            placeholder="Org identifier"
            className="md:w-56"
          />
          <Button onClick={fetchPrediction} variant="secondary">
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load predictions</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium">Shortage Index</CardTitle>
            <CardDescription>Composite shortage probability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">
                {prediction ? `${(prediction.shortageIndex * 100).toFixed(0)}%` : '--'}
              </div>
              <Badge variant={severity.badgeVariant}>{severity.label}</Badge>
            </div>
            <Progress
              value={(prediction?.shortageIndex ?? 0) * 100}
              className="mt-4"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {prediction?.cached ? 'Cached signal' : 'Live signal'} ·{' '}
              {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : 'Awaiting data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium">Credential Pressure</CardTitle>
            <CardDescription>Expirations + sanction drag</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricRow
              icon={<Activity className="h-4 w-4 text-muted-foreground" />}
              label="Credential churn"
              value={`${Math.round((prediction?.reasoning.credentialChurn ?? 0) * 100)}%`}
            />
            <MetricRow
              icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
              label="Sanctions density"
              value={`${Math.round((prediction?.reasoning.sanctionsDrag ?? 0) * 100)}%`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium">Compact Relief</CardTitle>
            <CardDescription>Eligibility buffer vs demand</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricRow
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              label="Compact gap"
              value={`${Math.round((prediction?.reasoning.compactReliefGap ?? 0) * 100)}%`}
            />
            <MetricRow
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              label="Recommended hires"
              value={prediction?.recommendedHires ?? '--'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium">Rationale</CardTitle>
            <CardDescription>AI + signal fusion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {prediction?.reasoning.summary?.slice(0, 3).map((item) => (
              <p key={item}>&bull; {item}</p>
            )) || <p>Awaiting rationale...</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Specialty-level predictions</CardTitle>
            <CardDescription>Shortage severity by specialty + primary driver</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading signal surface...</p>
            ) : prediction && prediction.specialtiesImpacted.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Shortage</TableHead>
                    <TableHead>Top driver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prediction.specialtiesImpacted.map((specialty) => (
                    <TableRow key={`${specialty.region}-${specialty.specialty}`}>
                      <TableCell className="font-semibold">{specialty.specialty}</TableCell>
                      <TableCell>{specialty.region ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={badgeVariantFromSeverity(specialty.severity)}>
                          {specialty.severity.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{(specialty.shortageIndex * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getTopDriver(specialty.drivers)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No impacted specialties detected for this org.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hiring recommendations</CardTitle>
            <CardDescription>AI-generated actions for recruiter ops</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Generating actions…</p>}
            {!loading && recommendations.length === 0 && (
              <p className="text-sm text-muted-foreground">No urgent recommendations.</p>
            )}
            {recommendations.map((rec) => (
              <Alert key={rec.title} variant={rec.variant}>
                <rec.icon className="h-4 w-4" />
                <AlertTitle>{rec.title}</AlertTitle>
                <AlertDescription>{rec.description}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function classifySeverity(shortageIndex: number) {
  if (shortageIndex >= 0.8) {
    return { label: 'Critical', badgeVariant: 'destructive' as const };
  }
  if (shortageIndex >= 0.6) {
    return { label: 'High', badgeVariant: 'destructive' as const };
  }
  if (shortageIndex >= 0.4) {
    return { label: 'Elevated', badgeVariant: 'secondary' as const };
  }
  return { label: 'Stable', badgeVariant: 'outline' as const };
}

function badgeVariantFromSeverity(severity: SpecialtyImpact['severity']) {
  if (severity === 'critical' || severity === 'high') return 'destructive';
  if (severity === 'moderate') return 'secondary';
  return 'outline';
}

function getTopDriver(drivers: DriverBreakdown) {
  const entries = [
    { label: 'Issuance gap', value: drivers.issuancePressure },
    { label: 'Expiring creds', value: drivers.credentialChurn },
    { label: 'Sanctions', value: drivers.sanctionsDrag },
    { label: 'Compact gap', value: drivers.compactReliefGap },
  ];
  const top = entries.sort((a, b) => b.value - a.value)[0];
  return `${top.label} · ${(top.value * 100).toFixed(0)}%`;
}

function buildRecommendations(prediction: WorkforcePredictionResponse | null) {
  if (!prediction) return [];

  const recs: {
    title: string;
    description: string;
    icon: typeof AlertTriangle;
    variant: 'default' | 'destructive';
  }[] = [];

  recs.push({
    title: 'Deploy surge hires',
    description: `Authorize ${prediction.recommendedHires} immediate hires to offset projected gaps.`,
    icon: Users,
    variant: 'default',
  });

  if (prediction.reasoning.credentialChurn >= 0.6) {
    recs.push({
      title: 'Renew expiring credentials',
      description: 'Batch renewals for the 45-day pipeline to drop credential churn below 40%.',
      icon: AlertTriangle,
      variant: 'destructive',
    });
  }

  if (prediction.reasoning.compactReliefGap >= 0.5) {
    recs.push({
      title: 'Expand compact coverage',
      description: 'Fast-track clinicians with compact eligibility to unlock cross-state coverage.',
      icon: Activity,
      variant: 'default',
    });
  }

  return recs;
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

