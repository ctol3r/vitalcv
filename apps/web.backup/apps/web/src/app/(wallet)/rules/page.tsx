'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info, RefreshCcw, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  '';

const DEFAULT_AUTHORITIES = ['FSMB', 'NCSBN', 'GMC', 'AHPRA'];

interface RegulatoryApiResponse {
  authority: {
    code: string;
    country: string;
    apiUrl?: string | null;
    updatedAt: string;
  };
  snapshot: {
    id: string;
    fetchedAt: string;
    snapshotHash: string;
    diffHash?: string | null;
    ruleVersion: number;
    anchor?: AnchorSummary | null;
  };
  ruleSet: RegulatoryRuleSet;
  diff: RuleDiffSummary;
  insights: RegulatoryInsight[];
  timeline: RegulatoryTimelineEvent[];
  source: 'cache' | 'refreshed';
}

interface AnchorSummary {
  txHash: string;
  network: string;
  anchorId: string;
  timestamp: string;
}

interface RegulatoryRuleSet {
  authorityCode: string;
  fetchedAt: string;
  cme: {
    categories: Array<{
      code: string;
      label: string;
      minimumHours: number;
      renewalPeriodMonths: number;
      description: string;
    }>;
    renewalCycles: Array<{
      cycleLabel: string;
      months: number;
      minimumHours: number;
      requiresAudit: boolean;
      carryOverHours: number;
    }>;
    specialtyRules: Array<{
      specialty: string;
      minimumHours: number;
      notes: string;
      enforcementLevel: string;
    }>;
  };
  controlledSubstances: {
    mateActHours: number;
    csLicenseRequirements: Array<{ label: string; description: string; enforcement: string }>;
    attestationFields: Array<{ field: string; description: string; required: boolean }>;
  };
  stateRules: {
    states: Array<{
      state: string;
      boardName: string;
      renewalWindowMonths: number;
      telehealthFlexibility: string;
      verificationLagDays: number;
      requiresCmeAudit: boolean;
      sourceUrl: string;
      lastObserved: string;
    }>;
  };
}

interface RuleDiffSummary {
  hasChanges: boolean;
  headline: string;
  tags: string[];
  newRequirements: Array<{ label: string; requirementType: string }>;
  changedRenewalWindows: Array<{ state: string; previousWindow: number; currentWindow: number }>;
  impactScore: number;
}

interface RegulatoryInsight {
  title: string;
  value: string;
  helper: string;
  tone?: 'default' | 'warning' | 'success';
}

interface RegulatoryTimelineEvent {
  id: string;
  authorityCode: string;
  title: string;
  description?: string | null;
  eventType: string;
  tags: string[];
  occurredAt: string;
  anchor?: AnchorSummary | null;
}

export default function RulesDashboardPage() {
  const [authority, setAuthority] = useState(DEFAULT_AUTHORITIES[0]);
  const [data, setData] = useState<RegulatoryApiResponse | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const loadRules = useCallback(
    async (refresh = false) => {
      if (!authority) return;
      setState('loading');
      setError(null);
      try {
        const payload = await fetchRegulatoryRules(authority, refresh);
        setData(payload);
        setState('idle');
      } catch (err) {
        console.warn('[wallet][rules]', err);
        setError(
          err instanceof Error ? err.message : 'Unable to load regulatory rules right now.',
        );
        setData(buildFallbackResponse(authority));
        setState('error');
      }
    },
    [authority],
  );

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const insightCards = data?.insights ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Wallet · Regulatory rules</Badge>
          <Select value={authority} onValueChange={(value) => setAuthority(value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Authority" />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_AUTHORITIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => loadRules(true)} disabled={state === 'loading'}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', state === 'loading' && 'animate-spin')} />
            Refresh snapshot
          </Button>
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold leading-tight">Board rule dashboard</h1>
          <p className="text-muted-foreground">
            Monitor CME minimums, controlled-substance attestations, and renewal windows anchored on-chain.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </header>

      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            {insightCards.map((insight) => (
              <Card key={insight.title}>
                <CardHeader>
                  <CardDescription>{insight.title}</CardDescription>
                  <CardTitle
                    className={cn(
                      'text-3xl font-semibold',
                      insight.tone === 'warning' && 'text-amber-600',
                      insight.tone === 'success' && 'text-emerald-600',
                    )}
                  >
                    {insight.value}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{insight.helper}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>{data.diff.headline}</CardTitle>
                <CardDescription>
                  Snapshot {data.snapshot.ruleVersion.toString().padStart(2, '0')} ·{' '}
                  {new Date(data.snapshot.fetchedAt).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.diff.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
                {data.snapshot.anchor && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Anchored · {shortHash(data.snapshot.anchor.txHash)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
              <TimelineList events={data.timeline.slice(0, 4)} />
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Info className="h-4 w-4" />
                  Compliance cue
                </p>
                <p className="mt-2">
                  According to {authority} rule update, {data.diff.newRequirements.length} requirement
                  {data.diff.newRequirements.length === 1 ? '' : 's'} must be acknowledged across your license records.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Impact score {data.diff.impactScore.toFixed(1)} · {data.diff.tags.join(', ') || 'no tags'}.
                </p>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>CME categories</CardTitle>
                  <ComplianceTooltip headline={data.diff.headline} />
                </div>
                <CardDescription>Board minimums with renewal cadence.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Renewal</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ruleSet.cme.categories.map((category) => (
                      <TableRow key={category.code}>
                        <TableCell className="font-medium">{category.label}</TableCell>
                        <TableCell>{category.minimumHours} hrs</TableCell>
                        <TableCell>{category.renewalPeriodMonths} mo</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {category.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Controlled-substance attestations</CardTitle>
                <CardDescription>MATE, PDMP, and tele-CS attestation prompts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">MATE Act floor</p>
                  <p className="text-lg font-semibold">{data.ruleSet.controlledSubstances.mateActHours} hrs</p>
                  <p className="text-xs text-muted-foreground">Required per provider</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">License requirements</p>
                  <ul className="space-y-2 text-sm">
                    {data.ruleSet.controlledSubstances.csLicenseRequirements.map((req) => (
                      <li key={req.label} className="rounded-md border border-dashed p-3">
                        <p className="font-semibold">{req.label}</p>
                        <p className="text-xs text-muted-foreground">{req.description}</p>
                        <Badge variant="outline" className="mt-2">
                          {req.enforcement}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Attestation fields</p>
                  <ul className="space-y-1 text-sm">
                    {data.ruleSet.controlledSubstances.attestationFields.map((field) => (
                      <li key={field.field} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <p className="font-medium">{field.field}</p>
                          <p className="text-xs text-muted-foreground">{field.description}</p>
                        </div>
                        <Badge variant={field.required ? 'default' : 'secondary'}>
                          {field.required ? 'Required' : 'Optional'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>State board renewal windows</CardTitle>
              <CardDescription>Scraped renewal windows and telehealth stance.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {data.ruleSet.stateRules.states.map((rule) => (
                <div key={rule.state} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold">{rule.boardName}</p>
                      <p className="text-xs uppercase text-muted-foreground">{rule.state}</p>
                    </div>
                    <Badge variant="outline">{rule.renewalWindowMonths} mo</Badge>
                  </div>
                  <p className="mt-2 text-sm">
                    Telehealth: <span className="font-medium capitalize">{rule.telehealthFlexibility}</span>
                  </p>
                  <p className="text-sm">
                    Verification lag {rule.verificationLagDays} days · {rule.requiresCmeAudit ? 'CME audit enabled' : 'Spot audit'}
                  </p>
                  <a
                    href={rule.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs text-blue-600 underline"
                  >
                    View source →
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : state === 'loading' ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading regulatory data…</CardTitle>
            <CardDescription>Fetching latest CME + renewal requirements.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}

function TimelineList({ events }: { events: RegulatoryTimelineEvent[] }) {
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">No regulatory updates recorded yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-lg border border-dashed p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{event.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</p>
            </div>
            {event.anchor && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {shortHash(event.anchor.txHash)}
              </Badge>
            )}
          </div>
          {event.description && <p className="mt-2 text-sm">{event.description}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {event.tags.map((tag) => (
              <Badge key={`${event.id}-${tag}`} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ComplianceTooltip({ headline }: { headline: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-xs text-muted-foreground"
        >
          i
        </button>
      </TooltipTrigger>
      <TooltipContent>
        According to {headline}, apply the latest FSMB update across your license cards.
      </TooltipContent>
    </Tooltip>
  );
}

async function fetchRegulatoryRules(authority: string, refresh: boolean): Promise<RegulatoryApiResponse> {
  if (!API_BASE) {
    throw new Error('NEXT_PUBLIC_API_BASE is not configured');
  }
  const url = new URL(`${API_BASE}/api/regulatory/${authority}`);
  if (refresh) {
    url.searchParams.set('refresh', 'true');
  }
  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Regulatory API failed with ${response.status}`);
  }
  return (await response.json()) as RegulatoryApiResponse;
}

function buildFallbackResponse(authority: string): RegulatoryApiResponse {
  const now = new Date().toISOString();
  return {
    authority: {
      code: authority,
      country: 'US',
      apiUrl: null,
      updatedAt: now,
    },
    snapshot: {
      id: `fallback-${authority}`,
      fetchedAt: now,
      snapshotHash: shortHash(authority + now),
      diffHash: null,
      ruleVersion: 1,
      anchor: null,
    },
    ruleSet: {
      authorityCode: authority,
      fetchedAt: now,
      cme: {
        categories: [
          {
            code: `${authority}-fallback`,
            label: 'Patient safety',
            minimumHours: 8,
            renewalPeriodMonths: 12,
            description: 'Fallback safety training requirements.',
          },
        ],
        renewalCycles: [
          { cycleLabel: 'Annual', months: 12, minimumHours: 25, requiresAudit: true, carryOverHours: 6 },
        ],
        specialtyRules: [
          { specialty: 'General practice', minimumHours: 6, notes: 'Fallback specialty hours', enforcementLevel: 'recommended' },
        ],
      },
      controlledSubstances: {
        mateActHours: 8,
        csLicenseRequirements: [
          { label: 'Baseline CS license', description: 'Maintain active CS license', enforcement: 'mandatory' },
        ],
        attestationFields: [
          { field: 'mateTrainingCompleted', description: 'Confirm 8hr completion', required: true },
        ],
      },
      stateRules: {
        states: [
          {
            state: 'CA',
            boardName: 'CA Board of Medicine',
            renewalWindowMonths: 12,
            telehealthFlexibility: 'limited',
            verificationLagDays: 14,
            requiresCmeAudit: true,
            sourceUrl: 'https://example.com',
            lastObserved: now,
          },
        ],
      },
    },
    diff: {
      hasChanges: false,
      headline: 'Synthetic snapshot',
      tags: ['fallback'],
      newRequirements: [],
      changedRenewalWindows: [],
      impactScore: 0,
    },
    insights: [
      {
        title: 'Total CME category hours',
        value: '8 hrs',
        helper: 'Fallback insight',
      },
    ],
    timeline: [],
    source: 'cache',
  };
}

function shortHash(value: string) {
  if (!value) return '—';
  return value.slice(0, 8);
}









