'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EHRBadge, EHRBadgeStatus } from '@/components/privileges/EHRBadge';

interface EhrSyncRow {
  id: string;
  privilegeCode: string;
  privilegeSetId?: string | null;
  privilegeSetName?: string | null;
  privilegeGrantedId?: string | null;
  status: EHRBadgeStatus;
  lastSyncedAt?: string | null;
  lastAttemptAt?: string | null;
  mismatchDetails?: {
    missing?: string[];
    unexpected?: string[];
  } | null;
  failureReason?: string | null;
}

interface EhrSyncPayload {
  clinicianId: string;
  clinicianDid?: string | null;
  orgId?: string | null;
  rows: EhrSyncRow[];
  lastJobRunAt?: string | null;
  hasErrors: boolean;
}

export default function ClinicianEhrSyncPage({ params }: { params: { id: string } }) {
  const [status, setStatus] = useState<EhrSyncPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/demo/org/clinicians/${params.id}/ehr`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }
      const payload = (await response.json()) as EhrSyncPayload;
      setStatus(payload);
    } catch (err) {
      console.warn('Falling back to demo EHR sync data', err);
      setError('Showing demo EHR sync data until live integration completes.');
      setStatus(buildFallbackPayload(params.id));
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const triggerRetry = useCallback(async () => {
    setRetrying(true);
    setError(null);
    try {
      const response = await fetch(`/api/demo/org/clinicians/${params.id}/ehr`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Retry request failed with ${response.status}`);
      }
      await loadStatus();
    } catch (err) {
      console.error('Manual EHR sync retry failed', err);
      setError('Unable to trigger sync retry. Please try again later.');
    } finally {
      setRetrying(false);
    }
  }, [params.id, loadStatus]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const summary = useMemo(() => {
    if (!status) {
      return {
        lastRun: 'N/A',
        total: 0,
        synced: 0,
        failures: 0,
        drift: 0,
      };
    }
    const total = status.rows.length;
    const synced = status.rows.filter((row) => row.status === 'SYNCED').length;
    const drift = status.rows.filter((row) => row.status === 'DRIFT').length;
    const failures = status.rows.filter((row) => row.status === 'FAILED').length;
    return {
      lastRun: status.lastJobRunAt ? formatDate(status.lastJobRunAt) : 'Never',
      total,
      synced,
      failures,
      drift,
    };
  }, [status]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Demo » Org » Clinicians » {params.id}</p>
          <h1 className="text-3xl font-bold">EHR Privilege Synchronization</h1>
          <p className="text-muted-foreground">
            Compare VitalCV privilege assignments with downstream EHR records.
          </p>
        </div>
        <Button variant="outline" onClick={triggerRetry} disabled={retrying || loading}>
          {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          {retrying ? 'Retrying…' : 'Retry sync'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-500/60 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard label="Last sync" value={summary.lastRun} />
        <SummaryCard label="Total privilege sets" value={summary.total} />
        <SummaryCard
          label="Health"
          value={`${summary.synced} synced · ${summary.drift} drift · ${summary.failures} failed`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Synchronization status</CardTitle>
          <CardDescription>
            {status?.rows.length ? 'Latest privilege sync attempts per clinician bundle.' : 'No sync data recorded yet.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading sync status…
            </div>
          ) : status?.rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Privilege bundle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last attempt</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.rows.map((row) => (
                  <TableRow key={row.id} className={row.status === 'DRIFT' ? 'bg-amber-50' : undefined}>
                    <TableCell className="font-medium">
                      {row.privilegeSetName ?? row.privilegeCode}
                      {row.privilegeSetId && (
                        <p className="text-xs text-muted-foreground">Set ID: {row.privilegeSetId}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <EHRBadge status={row.status} lastAttemptAt={row.lastAttemptAt ?? row.lastSyncedAt} />
                    </TableCell>
                    <TableCell>{formatDate(row.lastAttemptAt ?? row.lastSyncedAt)}</TableCell>
                    <TableCell>
                      <RowDetails row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No sync attempts recorded yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function RowDetails({ row }: { row: EhrSyncRow }) {
  if (row.mismatchDetails && (row.mismatchDetails.missing?.length || row.mismatchDetails.unexpected?.length)) {
    return (
      <div className="space-y-1 text-sm">
        {row.mismatchDetails.missing?.length ? (
          <div>
            <p className="font-medium text-amber-900">Missing in EHR</p>
            <p className="text-muted-foreground">{row.mismatchDetails.missing.join(', ')}</p>
          </div>
        ) : null}
        {row.mismatchDetails.unexpected?.length ? (
          <div>
            <p className="font-medium text-amber-900">Unexpected in EHR</p>
            <p className="text-muted-foreground">{row.mismatchDetails.unexpected.join(', ')}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (row.failureReason) {
    return <p className="text-sm text-muted-foreground">{row.failureReason}</p>;
  }

  if (row.status === 'SYNCED' && row.lastSyncedAt) {
    return <p className="text-sm text-muted-foreground">Synced {formatDate(row.lastSyncedAt)}</p>;
  }

  return <p className="text-sm text-muted-foreground">No additional details</p>;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildFallbackPayload(clinicianId: string): EhrSyncPayload {
  const now = new Date();
  const rows: EhrSyncRow[] = [
    {
      id: `demo:${clinicianId}:core`,
      privilegeCode: 'SET-CORE',
      privilegeSetName: 'Emergency Medicine Core',
      status: 'SYNCED',
      lastSyncedAt: now.toISOString(),
      lastAttemptAt: now.toISOString(),
    },
    {
      id: `demo:${clinicianId}:ortho`,
      privilegeCode: 'SET-ORTHO',
      privilegeSetName: 'Orthopedics Trauma',
      status: 'DRIFT',
      lastAttemptAt: now.toISOString(),
      mismatchDetails: {
        missing: ['ORIF-LIMB'],
        unexpected: ['ORIF-ELBOW'],
      },
    },
    {
      id: `demo:${clinicianId}:obs`,
      privilegeCode: 'SET-OBS',
      privilegeSetName: 'OB Emergency',
      status: 'FAILED',
      failureReason: 'EHR API responded with 503 – maintenance window',
      lastAttemptAt: now.toISOString(),
    },
  ];

  return {
    clinicianId,
    rows,
    lastJobRunAt: now.toISOString(),
    hasErrors: true,
  };
}
