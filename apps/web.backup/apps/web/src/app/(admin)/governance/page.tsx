'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  ConfigChangeSet,
  ConfigChangeType,
  GovernanceProposalView,
  GovernanceTimelineEvent,
  GovernanceVoteOption,
} from '@/lib/governance/types';
import GovernanceTimeline from './timeline';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Vote as VoteIcon } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');
const DEFAULT_PROPOSER =
  process.env.NEXT_PUBLIC_GOVERNANCE_PROPOSER_DID ?? 'did:web:vital.example/system';

type NewProposalForm = {
  proposerDid: string;
  title: string;
  description: string;
  changeSet: ConfigChangeSet;
};

export default function GovernanceConsolePage() {
  const [proposals, setProposals] = useState<GovernanceProposalView[]>([]);
  const [timeline, setTimeline] = useState<GovernanceTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [votePending, setVotePending] = useState<string | null>(null);
  const [form, setForm] = useState<NewProposalForm>(() => ({
    proposerDid: DEFAULT_PROPOSER,
    title: '',
    description: '',
    changeSet: {
      type: 'blockTimeTuning',
      params: { targetMilliseconds: 5000, minMilliseconds: 3500, maxMilliseconds: 6500 },
      impact: {
        securityPolicy: 'unchanged',
        auditAnchoring: 'required',
        revocationChecks: 'required',
      },
    },
  }));

  useEffect(() => {
    void loadGovernance();
  }, []);

  const statusOverview = useMemo(() => {
    return proposals.reduce<Record<string, number>>((acc, proposal) => {
      const key = proposal.status;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [proposals]);

  async function loadGovernance() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/governance/proposals'));
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }
      const payload = (await response.json()) as {
        proposals: GovernanceProposalView[];
        timeline: GovernanceTimelineEvent[];
      };
      setProposals(payload.proposals ?? []);
      setTimeline(payload.timeline ?? []);
    } catch (err) {
      console.error('Failed to load governance data', err);
      setError('Unable to load governance data. Check API connectivity.');
    } finally {
      setLoading(false);
    }
  }

  async function handleProposalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/governance/proposals'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? `Request failed with ${response.status}`);
      }
      setForm((current) => ({
        ...current,
        title: '',
        description: '',
      }));
      await loadGovernance();
    } catch (err) {
      console.error('Proposal submission failed', err);
      setError(err instanceof Error ? err.message : 'Unable to submit proposal');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(proposalId: string, vote: GovernanceVoteOption) {
    setVotePending(`${proposalId}:${vote}`);
    setError(null);
    try {
      const response = await fetch(buildApiUrl(`/governance/proposals/${proposalId}/votes`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voterDid: DEFAULT_PROPOSER,
          vote,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? `Vote failed with status ${response.status}`);
      }
      await loadGovernance();
    } catch (err) {
      console.error('Failed to cast vote', err);
      setError(err instanceof Error ? err.message : 'Unable to cast vote');
    } finally {
      setVotePending(null);
    }
  }

  function handleChangeType(type: ConfigChangeType) {
    setForm((current) => ({
      ...current,
      changeSet: buildDefaultChangeSet(type, current.changeSet.impact),
    }));
  }

  function updateChangeSetParams<T extends ConfigChangeSet['params']>(
    updater: (params: any) => T,
  ) {
    setForm((current) => ({
      ...current,
      changeSet: {
        ...current.changeSet,
        params: updater(current.changeSet.params),
      } as ConfigChangeSet,
    }));
  }

  function updateImpact(field: keyof NonNullable<ConfigChangeSet['impact']>, value: string) {
    setForm((current) => ({
      ...current,
      changeSet: {
        ...current.changeSet,
        impact: {
          ...current.changeSet.impact,
          [field]: value,
        },
      },
    }));
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Chain Governance</p>
        <h1 className="text-3xl font-bold">Governance Console</h1>
        <p className="max-w-3xl text-muted-foreground">
          Submit config-change proposals, monitor validator votes, and review the execution
          timeline for critical chain parameters.
        </p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={<VoteIcon className="h-4 w-4" aria-hidden="true" />}
          label="Active Proposals"
          value={statusOverview.active ?? 0}
        />
        <MetricCard
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
          label="Accepted"
          value={statusOverview.accepted ?? 0}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          label="Executed"
          value={statusOverview.executed ?? 0}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submit Proposal</CardTitle>
            <CardDescription>Config changes are restricted to approved templates.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleProposalSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  required
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Block time tuning"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  required
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Explain the motivation and impact of the change."
                  rows={4}
                />
              </div>
              <div className="grid gap-2">
                <Label>Proposal Type</Label>
                <Select value={form.changeSet.type} onValueChange={(value) => handleChangeType(value as ConfigChangeType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select change type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blockTimeTuning">Block time tuning</SelectItem>
                    <SelectItem value="validatorWeights">Validator weights</SelectItem>
                    <SelectItem value="auditRetentionPolicies">Audit retention policies</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {renderChangeSpecificFields(form.changeSet, updateChangeSetParams)}

              <div className="grid gap-2">
                <Label>Impact Assessment</Label>
                <div className="grid gap-3 md:grid-cols-3">
                  <Select
                    value={form.changeSet.impact?.securityPolicy ?? 'unchanged'}
                    onValueChange={(value) => updateImpact('securityPolicy', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Security" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strengthened">Security ↑</SelectItem>
                      <SelectItem value="unchanged">Security ↔</SelectItem>
                      <SelectItem value="relaxed">Security ↓</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={form.changeSet.impact?.auditAnchoring ?? 'required'}
                    onValueChange={(value) => updateImpact('auditAnchoring', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Anchoring" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="required">Anchoring required</SelectItem>
                      <SelectItem value="optional">Anchoring optional</SelectItem>
                      <SelectItem value="disabled">Anchoring disabled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={form.changeSet.impact?.revocationChecks ?? 'required'}
                    onValueChange={(value) => updateImpact('revocationChecks', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Revocation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="required">Revocation enforced</SelectItem>
                      <SelectItem value="optional">Revocation optional</SelectItem>
                      <SelectItem value="bypass">Bypass revocation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Guardrails block proposals that weaken security, disable anchoring, or bypass
                  revocation.
                </p>
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Proposal'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>Latest governance milestones across proposals.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <GovernanceTimeline events={timeline} />
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Proposals</CardTitle>
            <CardDescription>Cast validator votes and inspect multi-sig state.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : proposals.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">
                {proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    votePending={votePending}
                    onVote={handleVote}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function buildApiUrl(path: string): string {
  if (!API_BASE) return `/api${path}`;
  return `${API_BASE}${path}`;
}

function buildDefaultChangeSet(
  type: ConfigChangeType,
  impact: ConfigChangeSet['impact'] = {
    securityPolicy: 'unchanged',
    auditAnchoring: 'required',
    revocationChecks: 'required',
  },
): ConfigChangeSet {
  switch (type) {
    case 'validatorWeights':
      return {
        type,
        params: { weights: [{ validator: 'did:key:z6Mkvalidator-1', weight: 1 }] },
        impact,
      };
    case 'auditRetentionPolicies':
      return {
        type,
        params: { retentionDays: 90, coldStorageDays: 365, anchorEveryMinutes: 30 },
        impact,
      };
    case 'blockTimeTuning':
    default:
      return {
        type: 'blockTimeTuning',
        params: { targetMilliseconds: 5000, minMilliseconds: 3500, maxMilliseconds: 6500 },
        impact,
      };
  }
}

function renderChangeSpecificFields(
  changeSet: ConfigChangeSet,
  updateParams: (updater: (params: any) => ConfigChangeSet['params']) => void,
) {
  if (changeSet.type === 'blockTimeTuning') {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {['targetMilliseconds', 'minMilliseconds', 'maxMilliseconds'].map((field) => (
          <div className="grid gap-1.5" key={field}>
            <Label htmlFor={field}>{labelForField(field)}</Label>
            <Input
              id={field}
              type="number"
              value={(changeSet.params as any)[field] ?? ''}
              onChange={(event) =>
                updateParams((params) => ({
                  ...params,
                  [field]: Number(event.target.value),
                }))
              }
              placeholder="5000"
              min={0}
            />
          </div>
        ))}
      </div>
    );
  }

  if (changeSet.type === 'validatorWeights') {
    const params = changeSet.params as Extract<ConfigChangeSet, { type: 'validatorWeights' }>['params'];
    return (
      <div className="space-y-3">
        <Label>Validator Weights</Label>
        <div className="space-y-3">
          {params.weights.map((entry, index) => (
            <div className="grid gap-2 md:grid-cols-3" key={`weight-${index}`}>
              <Input
                value={entry.validator}
                onChange={(event) =>
                  updateParams((p) => {
                    const next = { ...(p as typeof params) };
                    next.weights[index] = { ...entry, validator: event.target.value };
                    return next;
                  })
                }
                placeholder="did:key:z6Mk..."
              />
              <Input
                type="number"
                value={entry.weight}
                onChange={(event) =>
                  updateParams((p) => {
                    const next = { ...(p as typeof params) };
                    next.weights[index] = { ...entry, weight: Number(event.target.value) };
                    return next;
                  })
                }
                min={0.1}
                step={0.1}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  updateParams((p) => {
                    const next = { ...(p as typeof params) };
                    next.weights = next.weights.filter((_, idx) => idx !== index);
                    return next;
                  })
                }
                disabled={params.weights.length === 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            updateParams((p) => {
              const next = { ...(p as typeof params) };
              next.weights = [
                ...next.weights,
                { validator: `did:key:z6Mkvalidator-${next.weights.length + 1}`, weight: 1 },
              ];
              return next;
            })
          }
        >
          Add Validator
        </Button>
      </div>
    );
  }

  if (changeSet.type === 'auditRetentionPolicies') {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {(['retentionDays', 'coldStorageDays', 'anchorEveryMinutes'] as const).map((field) => (
          <div className="grid gap-1.5" key={field}>
            <Label htmlFor={field}>{labelForField(field)}</Label>
            <Input
              id={field}
              type="number"
              value={(changeSet.params as any)[field] ?? ''}
              onChange={(event) =>
                updateParams((params) => ({
                  ...params,
                  [field]: Number(event.target.value),
                }))
              }
              min={0}
            />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function labelForField(field: string): string {
  switch (field) {
    case 'targetMilliseconds':
      return 'Target (ms)';
    case 'minMilliseconds':
      return 'Min (ms)';
    case 'maxMilliseconds':
      return 'Max (ms)';
    case 'retentionDays':
      return 'Retention (days)';
    case 'coldStorageDays':
      return 'Cold storage (days)';
    case 'anchorEveryMinutes':
      return 'Anchor interval (min)';
    default:
      return field;
  }
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <ShieldAlert className="mx-auto mb-4 h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        No governance proposals yet. Use the submission form to create the first entry.
      </p>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-6">
        <div className="rounded-full bg-muted p-2 text-muted-foreground">{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProposalCard({
  proposal,
  onVote,
  votePending,
}: {
  proposal: GovernanceProposalView;
  onVote: (proposalId: string, vote: GovernanceVoteOption) => Promise<void>;
  votePending: string | null;
}) {
  const chain = proposal.chain;
  const approvals = chain ? `${chain.approvals}/${chain.threshold}` : '0/0';
  const timeline = chain ? `${chain.yesVotes} yes • ${chain.noVotes} no • ${chain.abstainVotes} abstain` : 'Awaiting votes';

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{proposal.title}</h3>
            <Badge variant={statusVariant(proposal.status)}>{proposal.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{proposal.description}</p>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>Approvals: {approvals}</p>
          <p>{timeline}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['yes', 'no', 'abstain'] as GovernanceVoteOption[]).map((vote) => (
          <Button
            key={`${proposal.id}-${vote}`}
            variant="outline"
            size="sm"
            disabled={votePending === `${proposal.id}:${vote}`}
            onClick={() => onVote(proposal.id, vote)}
          >
            {vote === 'yes' && <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />}
            {vote === 'no' && <ShieldAlert className="mr-2 h-4 w-4" aria-hidden="true" />}
            {vote === 'abstain' && <Clock className="mr-2 h-4 w-4" aria-hidden="true" />}
            {vote.charAt(0).toUpperCase() + vote.slice(1)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'accepted':
      return 'default';
    case 'executed':
      return 'default';
    case 'rejected':
      return 'destructive';
    case 'draft':
      return 'outline';
    default:
      return 'secondary';
  }
}


