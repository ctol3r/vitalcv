'use client';

import { CRSBadge } from '@/components/CRSBadge';
import { TrustOutcomeBadge } from '@/components/TrustOutcomeBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Activity, AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface DashboardSummary {
  totalVerifications: number;
  averageCRS: number;
  revokedCount: number;
  uncheckableCount: number;
  lastUpdated: string;
}

interface AuditEventSummary {
  type?: string | null;
  timestamp?: string | null;
  hash?: string | null;
  subjectId?: string | null;
}

interface AuditSummary {
  lastEvent?: AuditEventSummary | null;
  eventCount?: number | null;
  latestHash?: string | null;
  lastCredentialIssuanceAt?: string | null;
  lastVerificationAt?: string | null;
  lastRevocationAt?: string | null;
  merkleRoot?: string | null;
  recentCount?: number | null;
  anchorReference?: string | null;
}

export default function VerifierDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const { toast } = useToast();

  const verifierApiUrl = (
    process.env.NEXT_PUBLIC_VERIFIER_API_URL ?? 'http://localhost:4002'
  ).replace(/\/+$/, '');

  const fetchSummary = async () => {
    setLoading(true);
    try {
      // The endpoint we created is /dashboard/summary.
      // In src/index.ts we mounted dashboardRouter at /dashboard.
      // So URL is {verifierApiUrl}/dashboard/summary
      const res = await fetch(`${verifierApiUrl}/dashboard/summary`);
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard summary');
      }
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditSummary = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await fetch('/api/audit/summary', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to fetch audit receipt');
      }
      const data = await res.json();
      setAuditSummary(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch audit receipt';
      setAuditError(message);
      toast({
        title: 'Audit Receipt Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setAuditLoading(false);
    }
  };

  const handleAuditDrawerChange = (open: boolean) => {
    setAuditDrawerOpen(open);
    if (open && !auditSummary && !auditLoading) {
      fetchAuditSummary();
    }
  };

  const formatTimestamp = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Verifier Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Overview of credential verification activities and trust scores.
            </p>
          </div>
          <div className="flex gap-2">
            <Drawer open={auditDrawerOpen} onOpenChange={handleAuditDrawerChange}>
              <DrawerTrigger asChild>
                <Button variant="outline">Audit Receipt</Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Audit Receipt</DrawerTitle>
                  <DrawerDescription>
                    Latest audit anchor summary for verification activity.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 pb-2">
                  {auditLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-[60%]" />
                      <Skeleton className="h-4 w-[80%]" />
                      <Skeleton className="h-4 w-[70%]" />
                    </div>
                  ) : auditError ? (
                    <p className="text-sm text-destructive">{auditError}</p>
                  ) : auditSummary ? (
                    <div className="grid gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Latest Receipt Hash</div>
                        <code className="break-all text-xs">{auditSummary.latestHash || '—'}</code>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Merkle Root</div>
                        <code className="break-all text-xs">{auditSummary.merkleRoot || '—'}</code>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-muted-foreground">Event Count</div>
                          <div className="font-medium">{auditSummary.eventCount ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Recent Events</div>
                          <div className="font-medium">{auditSummary.recentCount ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Last Issuance</div>
                          <div className="font-medium">
                            {formatTimestamp(auditSummary.lastCredentialIssuanceAt)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Last Verification</div>
                          <div className="font-medium">
                            {formatTimestamp(auditSummary.lastVerificationAt)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Last Revocation</div>
                          <div className="font-medium">
                            {formatTimestamp(auditSummary.lastRevocationAt)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Anchor Reference</div>
                          <div className="font-medium">{auditSummary.anchorReference || '—'}</div>
                        </div>
                      </div>
                      <div className="rounded-md border border-dashed p-3">
                        <div className="text-muted-foreground">Latest Event</div>
                        <div className="mt-1 space-y-1 text-xs">
                          <div>Type: {auditSummary.lastEvent?.type || '—'}</div>
                          <div>Subject: {auditSummary.lastEvent?.subjectId || '—'}</div>
                          <div>
                            Timestamp: {formatTimestamp(auditSummary.lastEvent?.timestamp || null)}
                          </div>
                          <div>Hash: {auditSummary.lastEvent?.hash || '—'}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No audit receipt available.</p>
                  )}
                </div>
                <DrawerFooter>
                  <Button variant="outline" onClick={fetchAuditSummary} disabled={auditLoading}>
                    Refresh Receipt
                  </Button>
                  <DrawerClose asChild>
                    <Button>Close</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
            <Button variant="outline" onClick={fetchSummary} disabled={loading}>
              Refresh
            </Button>
            <Button asChild>
              <Link href="/verify">Verify New Credential</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    <Skeleton className="h-4 w-[100px]" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-[60px]" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : summary ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalVerifications}</div>
                <p className="text-xs text-muted-foreground">Across all verifiers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average CRS</CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">{summary.averageCRS.toFixed(1)}</div>
                  <CRSBadge score={Math.round(summary.averageCRS)} />
                </div>
                <p className="text-xs text-muted-foreground">Mean readiness score</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revoked Credentials</CardTitle>
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.revokedCount}</div>
                <div className="mt-1">
                  <TrustOutcomeBadge status="REVOKED" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uncheckable</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.uncheckableCount}</div>
                <div className="mt-1">
                  <TrustOutcomeBadge status="UNCHECKABLE" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">Failed to load data.</p>
          </div>
        )}

        {/* Placeholder for future charts or lists */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest verifications processed by the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center border-dashed border-2 rounded-md bg-slate-50">
              <p className="text-muted-foreground text-sm">Activity log chart coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
