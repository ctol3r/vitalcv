'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, BellRing, Contact2, RefreshCw, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

type CrmSummary = {
  totalTracked: number;
  activeLeads: number;
  avgReadiness: number;
  contactCoverage: number;
  readinessImproving: number;
  readinessDeclining: number;
};

type Lead = {
  clinicianId: string;
  readinessScore: number;
  sanctionsClear: boolean;
  lastUpdated?: string;
  lastContactedAt?: string | null;
};

type ContactEvent = {
  id: string;
  clinicianId: string;
  recruiterId: string;
  contactedAt: string;
  channel?: string | null;
};

type ReadinessChange = {
  clinicianId: string;
  currentScore: number;
  previousScore: number;
  delta: number;
  updatedAt: string;
  notes?: string[];
};

type CrmResponse = {
  summary: CrmSummary;
  activeLeads: Lead[];
  staleContacts: Lead[];
  recentContacts: ContactEvent[];
  readinessChanges: ReadinessChange[];
};

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');

export default function RecruiterCrmPage() {
  const [data, setData] = useState<CrmResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);

  const fetchCrm = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/api/recruiter/crm'));
      if (!response.ok) throw new Error(`Failed to load CRM (${response.status})`);
      const payload = (await response.json()) as CrmResponse;
      setData(payload);
    } catch (err) {
      console.error('Failed to load CRM dashboard', err);
      setError(err instanceof Error ? err.message : 'Unable to load CRM data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCrm();
  }, [fetchCrm]);

  async function handleRemind(clinicianId: string) {
    setReminding(clinicianId);
    try {
      const response = await fetch(buildApiUrl(`/api/recruiter/contact/${clinicianId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'reminder' }),
      });
      if (!response.ok) throw new Error('Unable to log reminder');
      await fetchCrm();
    } catch (err) {
      console.error('Reminder failed', err);
      setError(err instanceof Error ? err.message : 'Unable to trigger reminder');
    } finally {
      setReminding(null);
    }
  }

  const summary = data?.summary;
  const topLeads = useMemo(() => data?.activeLeads.slice(0, 8) ?? [], [data]);

  return (
    <div className="container max-w-6xl space-y-8 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Recruiter CRM</p>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline control center</h1>
          <p className="text-muted-foreground max-w-2xl">
            Blend readiness, contact coverage, and surge alerts to prioritize outreach.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void fetchCrm()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Users className="h-5 w-5 text-primary" />}
          title="Active leads"
          value={summary?.activeLeads ?? 0}
          description={`${summary?.totalTracked ?? 0} tracked`}
        />
        <SummaryCard
          icon={<Activity className="h-5 w-5 text-primary" />}
          title="Avg readiness"
          value={(summary?.avgReadiness ?? 0).toFixed(2)}
          description="Composite readiness index"
        />
        <SummaryCard
          icon={<Contact2 className="h-5 w-5 text-primary" />}
          title="Contact coverage"
          value={`${Math.round((summary?.contactCoverage ?? 0) * 100)}%`}
          description="Touched in last 7 days"
        />
        <SummaryCard
          icon={
            (summary?.readinessImproving ?? 0) >= (summary?.readinessDeclining ?? 0) ? (
              <TrendingUp className="h-5 w-5 text-primary" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )
          }
          title="Readiness delta"
          value={`${summary?.readinessImproving ?? 0} ↑ / ${summary?.readinessDeclining ?? 0} ↓`}
          description="Past 24h adjustments"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>High-priority leads</CardTitle>
            <CardDescription>Top readiness with sanctions cleared</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading leads…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinician</TableHead>
                    <TableHead>Readiness</TableHead>
                    <TableHead>Last contact</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLeads.map((lead) => (
                    <TableRow key={lead.clinicianId}>
                      <TableCell className="font-medium">{lead.clinicianId}</TableCell>
                      <TableCell>
                        <Badge variant={lead.readinessScore >= 0.85 ? 'default' : 'secondary'}>
                          {lead.readinessScore.toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.lastContactedAt
                          ? new Date(lead.lastContactedAt).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleRemind(lead.clinicianId)}
                          disabled={reminding === lead.clinicianId}
                        >
                          <BellRing className="mr-2 h-4 w-4" />
                          Remind
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact health</CardTitle>
            <CardDescription>Stale touchpoints needing outreach</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.staleContacts.length ? (
              data.staleContacts.map((lead) => (
                <div
                  key={lead.clinicianId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{lead.clinicianId}</p>
                    <p className="text-xs text-muted-foreground">
                      Last contact{' '}
                      {lead.lastContactedAt
                        ? new Date(lead.lastContactedAt).toLocaleDateString()
                        : 'never'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void handleRemind(lead.clinicianId)}
                    disabled={reminding === lead.clinicianId}
                  >
                    Trigger reminder
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">All active leads are fresh.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent recruiter contacts</CardTitle>
            <CardDescription>Last 10 logged touches</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.recentContacts.slice(0, 10).map((contact) => (
              <div key={contact.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{contact.clinicianId}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(contact.contactedAt).toLocaleString()} · {contact.recruiterId}
                  </p>
                </div>
                <Badge variant="outline">{contact.channel ?? 'log'}</Badge>
              </div>
            )) || <p className="text-sm text-muted-foreground">No contacts logged yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Readiness shifts</CardTitle>
            <CardDescription>Signals that moved in the last interval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.readinessChanges.slice(0, 6).map((change) => (
              <div key={`${change.clinicianId}-${change.updatedAt}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{change.clinicianId}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(change.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={change.delta >= 0 ? 'default' : 'destructive'}>
                    {change.delta >= 0 ? '+' : ''}
                    {change.delta.toFixed(2)}
                  </Badge>
                </div>
                <Progress value={(change.currentScore ?? 0) * 100} className="h-2" />
                {change.notes?.length ? (
                  <p className="text-xs text-muted-foreground">{change.notes[0]}</p>
                ) : null}
              </div>
            )) || <p className="text-sm text-muted-foreground">No changes recorded.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  description,
}: {
  icon: ReactNode;
  title: string;
  value: string | number;
  description: string;
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
      </CardContent>
    </Card>
  );
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

