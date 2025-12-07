'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert, ShieldCheck, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { LineagePanel } from './lineage';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface TrustBreachSummary {
  issuerDid: string;
  count: number;
  lastDetectedAt: string;
  reasons: string[];
  blacklisted: boolean;
}

interface TrustPanelIssuer {
  did: string;
  orgName?: string | null;
  orgNpi?: string | null;
  weight: number;
  normalizedWeight: number;
  adjustedWeight: number;
  adjustedNormalized: number;
  lastIssuanceAt?: string;
  monthsInactive: number;
  temporalStatus: 'healthy' | 'stale' | 'dormant';
  confidence: number;
  requiresSecondFactor: boolean;
  revocationRate: number;
  issuanceCount: number;
  anchorCount: number;
  lastAnchorAt?: string;
  lineageDepth: number;
  federationPath: string[];
  notes: string[];
  status: 'healthy' | 'warning' | 'critical' | 'blocked';
  breach?: TrustBreachSummary | null;
}

interface TrustPanelResponse {
  threshold: number;
  overallConfidence: number;
  issuers: TrustPanelIssuer[];
  breaches: TrustBreachSummary[];
  generatedAt: string;
}

export default function TrustFabricPage() {
  const { toast } = useToast();
  const [panel, setPanel] = useState<TrustPanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDid, setSelectedDid] = useState<string | undefined>();

  const fetchPanel = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/trust/fabric/panel`);
      if (!response.ok) {
        throw new Error(`Unable to load trust fabric (${response.status})`);
      }
      const payload = (await response.json()) as TrustPanelResponse;
      setPanel(payload);
      if (!selectedDid && payload.issuers?.length) {
        setSelectedDid(payload.issuers[0].did);
      }
    } catch (error) {
      console.error('[trust-fabric] failed to load panel', error);
      toast({
        title: 'Unable to load trust fabric',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDid, toast]);

  useEffect(() => {
    fetchPanel();
  }, [fetchPanel]);

  const atRiskCount = useMemo(
    () => panel?.issuers.filter((issuer) => issuer.requiresSecondFactor).length ?? 0,
    [panel],
  );

  const blockedCount = useMemo(
    () => panel?.issuers.filter((issuer) => issuer.status === 'blocked').length ?? 0,
    [panel],
  );

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Trust Fabric</h1>
          <p className="text-muted-foreground">
            Monitor issuer weights, lineage depth, and breach conditions across the federation.
          </p>
        </div>
        <Button variant="outline" onClick={fetchPanel} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing
            </>
          ) : (
            'Refresh'
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Overall confidence"
          description={`Threshold ${panel?.threshold?.toFixed(2) ?? '0.00'}`}
          value={panel ? `${Math.round((panel.overallConfidence ?? 0) * 100)}%` : '--'}
          icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
          progress={panel ? panel.overallConfidence * 100 : 0}
        />
        <SummaryCard
          title="Second-factor required"
          description="Issuers below the trust floor"
          value={panel ? `${atRiskCount}` : '--'}
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          progress={
            panel && panel.issuers.length
              ? (atRiskCount / panel.issuers.length) * 100
              : 0
          }
        />
        <SummaryCard
          title="Active issuers"
          description="Currently monitored"
          value={panel ? `${panel.issuers.length}` : '--'}
          icon={<Users className="h-5 w-5 text-slate-500" />}
          progress={panel ? (panel.issuers.length ? 100 : 0) : 0}
        />
        <SummaryCard
          title="Blocked issuers"
          description="Auto-blacklisted"
          value={panel ? `${blockedCount}` : '--'}
          icon={<ShieldAlert className="h-5 w-5 text-red-500" />}
          progress={
            panel && panel.issuers.length ? (blockedCount / panel.issuers.length) * 100 : 0
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Issuer trust table</CardTitle>
              <CardDescription>Select an issuer to inspect lineage</CardDescription>
            </div>
            <Badge variant="outline">
              Updated {panel?.generatedAt ? new Date(panel.generatedAt).toLocaleString() : '—'}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading trust signals...
              </div>
            ) : panel?.issuers?.length ? (
              <div className="max-h-[540px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issuer</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Last issuance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {panel.issuers.map((issuer) => (
                      <TableRow
                        key={issuer.did}
                        className={`cursor-pointer ${
                          issuer.did === selectedDid ? 'bg-muted/50' : ''
                        }`}
                        onClick={() => setSelectedDid(issuer.did)}
                      >
                        <TableCell className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{issuer.did}</span>
                            {issuer.requiresSecondFactor && (
                              <Badge variant="destructive" className="text-[10px]">
                                2nd factor
                              </Badge>
                            )}
                            {issuer.breach?.blacklisted && (
                              <Badge variant="outline" className="border-red-500 text-red-500">
                                Blocked
                              </Badge>
                            )}
                          </div>
                          {issuer.orgName && (
                            <p className="text-xs text-muted-foreground">{issuer.orgName}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {(issuer.confidence * 100).toFixed(0)}%
                            </div>
                            <Progress value={issuer.confidence * 100} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {issuer.adjustedWeight.toFixed(2)} / {issuer.weight.toFixed(2)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Revocations {Math.round(issuer.revocationRate * 1000) / 10}%
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {issuer.lastIssuanceAt
                              ? new Date(issuer.lastIssuanceAt).toLocaleDateString()
                              : 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {issuer.monthsInactive.toFixed(1)} months inactive
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(issuer.status)}>{issuer.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                No issuers found in trust registry.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="max-h-[620px]">
          <CardHeader>
            <CardTitle>Trust breaches</CardTitle>
            <CardDescription>Auto-blacklist history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 overflow-auto">
            {panel?.breaches?.length ? (
              panel.breaches.map((breach) => (
                <div
                  key={`${breach.issuerDid}-${breach.lastDetectedAt}`}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{breach.issuerDid}</span>
                    <Badge variant={breach.blacklisted ? 'destructive' : 'outline'}>
                      {breach.blacklisted ? 'Blacklisted' : 'Flagged'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {breach.count} breach{breach.count === 1 ? '' : 'es'} ·{' '}
                    {new Date(breach.lastDetectedAt).toLocaleString()}
                  </p>
                  {breach.reasons?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {breach.reasons.slice(0, 4).map((reason) => (
                        <Badge key={reason} variant="secondary" className="text-[10px]">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No breach events recorded.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issuer lineage</CardTitle>
          <CardDescription>
            Visualize federation depth and parents for {selectedDid ?? 'selected issuer'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LineagePanel focusDid={selectedDid} />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  description,
  value,
  progress,
  icon,
}: {
  title: string;
  description: string;
  value: string;
  progress: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        <Progress value={progress} className="mt-3 h-1.5" />
      </CardContent>
    </Card>
  );
}

function statusVariant(status: TrustPanelIssuer['status']): 'default' | 'secondary' | 'destructive' {
  if (status === 'blocked' || status === 'critical') {
    return 'destructive';
  }
  if (status === 'warning') {
    return 'secondary';
  }
  return 'default';
}

