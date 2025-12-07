'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Clock, RefreshCcw, ShieldCheck } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
const CLINICIAN_ID = process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID || 'cln_demo';

interface MateSummary {
  mateCompliant: boolean;
  missingHours: number;
  invalidCategories: string[];
  acceptedCategories: string[];
  totalHours: number;
}

interface DeaSummary {
  deaNumber: string;
  status: 'ACTIVE' | 'EXPIRED';
  expiration: string;
  prescriptiveAuthority: string;
  schedules: string[];
  mate: MateSummary;
  lastVerifiedAt: string | null;
  source: string;
}

interface DeaCredentialRecord {
  id: string;
  deaNumber: string;
  expiration: string;
  mateHours: number;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

interface SummaryResponse {
  credential: DeaCredentialRecord | null;
  summary: DeaSummary | null;
}

export default function DeaCredentialDashboard() {
  const { toast } = useToast();
  const [record, setRecord] = useState<DeaCredentialRecord | null>(null);
  const [summary, setSummary] = useState<DeaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expiresIn = useMemo(() => {
    if (!summary?.expiration) return null;
    const expiresAt = new Date(summary.expiration).getTime();
    const diffDays = Math.round((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [summary]);

  const complianceBadge = summary ? (
    summary.mate.mateCompliant ? (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700">MATE compliant</Badge>
    ) : (
      <Badge variant="destructive" className="gap-1">
        Needs {summary.mate.missingHours} hrs
      </Badge>
    )
  ) : null;

  async function loadSummary() {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/credentials/dea/${encodeURIComponent(CLINICIAN_ID)}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to load DEA credential (${response.status})`);
      }
      const payload = (await response.json()) as SummaryResponse;
      setRecord(payload.credential);
      setSummary(payload.summary);
    } catch (error) {
      console.error('[wallet][dea] load failed', error);
      toast({
        title: 'Unable to load DEA credential',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/api/credentials/dea/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicianId: CLINICIAN_ID }),
      });
      if (!response.ok) {
        throw new Error(`Refresh failed (${response.status})`);
      }
      const payload = await response.json();
      setRecord({
        id: payload.record.id,
        deaNumber: payload.record.deaNumber,
        expiration: payload.record.expiration,
        mateHours: payload.record.mateHours,
        metadata: payload.record.metadata,
        updatedAt: payload.record.updatedAt,
      });
      setSummary({
        deaNumber: payload.registry.deaNumber,
        status: payload.registry.status,
        expiration: payload.registry.expirationDate,
        prescriptiveAuthority: payload.registry.prescriptiveAuthority,
        schedules: payload.registry.schedules,
        mate: payload.mate,
        lastVerifiedAt: payload.registry.lastVerifiedAt,
        source: payload.registry.source,
      });
      toast({ title: 'DEA data refreshed', description: payload.registry.status });
    } catch (error) {
      console.error('[wallet][dea] refresh failed', error);
      toast({
        title: 'Refresh failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Controlled Substances</Badge>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">DEA &amp; MATE status</h1>
            <p className="text-muted-foreground">
              Track registry status, schedule coverage, and MATE Act training in one place.
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh DEA
          </Button>
        </div>
      </header>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading DEA credential…</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ) : summary ? (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  DEA {summary.deaNumber}
                </CardTitle>
                <CardDescription>
                  {summary.prescriptiveAuthority} · Schedules {summary.schedules.join(', ')}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={summary.status === 'ACTIVE' ? 'default' : 'destructive'}>
                  {summary.status}
                </Badge>
                {complianceBadge}
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <StatBlock
                label="Next renewal"
                value={
                  summary.expiration ? new Date(summary.expiration).toLocaleDateString() : 'N/A'
                }
                helper={
                  typeof expiresIn === 'number'
                    ? expiresIn >= 0
                      ? `${expiresIn} days remaining`
                      : `${Math.abs(expiresIn)} days overdue`
                    : 'No expiration captured'
                }
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
              />
              <StatBlock
                label="MATE hours"
                value={`${summary.mate.totalHours.toFixed(1)} hrs`}
                helper={
                  summary.mate.mateCompliant
                    ? 'Requirement met'
                    : `${summary.mate.missingHours} hrs missing`
                }
                icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
              />
              <StatBlock
                label="Last verified"
                value={
                  summary.lastVerifiedAt
                    ? new Date(summary.lastVerifiedAt).toLocaleString()
                    : 'Unknown'
                }
                helper={`Source: ${summary.source}`}
                icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>MATE validation</CardTitle>
              <CardDescription>Document accepted categories and outstanding work.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">Accepted categories</p>
                {summary.mate.acceptedCategories.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {summary.mate.acceptedCategories.map((category) => (
                      <Badge key={category} variant="secondary">
                        {category}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No accepted training logged.</p>
                )}
              </div>
              {summary.mate.invalidCategories.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Unrecognized CME categories</p>
                  <p>{summary.mate.invalidCategories.join(', ')}</p>
                </div>
              )}
              <Separator />
              <div className="text-xs text-muted-foreground">
                Wallet clinician ID <span className="font-mono">{CLINICIAN_ID}</span>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No DEA credential yet</CardTitle>
            <CardDescription>Refresh to pull registry data into the wallet.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh}>Refresh DEA</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-2xl font-semibold">{value}</p>
      {helper && <p className="text-sm text-muted-foreground">{helper}</p>}
    </div>
  );
}











