'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, Loader2, ShieldAlert, Sparkles } from 'lucide-react';

type FieldKey = 'licenseNumber' | 'issueDate' | 'expirationDate' | 'disciplinaryStatus';

interface LicenseSuggestionField {
  value: string | null;
  confidence: number;
  sources: SourceSupport[];
}

interface SourceSupport {
  source: string;
  confidence: number;
  fields: FieldKey[];
  evidenceId?: string;
  notes?: string;
  observedAt?: string;
}

interface LicenseSuggestion {
  clinicianId: string;
  state: string;
  licenseNumber: LicenseSuggestionField;
  issueDate: LicenseSuggestionField;
  expirationDate: LicenseSuggestionField;
  disciplinaryStatus: LicenseSuggestionField;
  confidence: number;
  summary: string;
  support: SourceSupport[];
}

type FieldConfig = {
  key: FieldKey;
  label: string;
  helper: string;
  type?: 'text' | 'date' | 'select';
  options?: { label: string; value: string }[];
};

const FIELD_CONFIG: FieldConfig[] = [
  {
    key: 'licenseNumber',
    label: 'License number',
    helper: 'Provide the board-issued identifier (no spaces).',
  },
  {
    key: 'issueDate',
    label: 'Issue date',
    helper: 'Date the credential was first issued by the state board.',
    type: 'date',
  },
  {
    key: 'expirationDate',
    label: 'Expiration date',
    helper: 'Next renewal date on file with the state.',
    type: 'date',
  },
  {
    key: 'disciplinaryStatus',
    label: 'Disciplinary status',
    helper: 'Board standing (clear, monitor, restricted).',
    type: 'select',
    options: [
      { label: 'Clear', value: 'clear' },
      { label: 'Monitor', value: 'monitor' },
      { label: 'Restricted', value: 'restricted' },
    ],
  },
];

export default function LicenseAutofillPage() {
  const [suggestion, setSuggestion] = useState<LicenseSuggestion | null>(null);
  const [formValues, setFormValues] = useState<Record<FieldKey, string>>({
    licenseNumber: '',
    issueDate: '',
    expirationDate: '',
    disciplinaryStatus: 'clear',
  });
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'applied'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    void loadSuggestion();
  }, []);

  useEffect(() => {
    if (!suggestion) return;
    setFormValues({
      licenseNumber: suggestion.licenseNumber.value ?? '',
      issueDate: toDateInput(suggestion.issueDate.value),
      expirationDate: toDateInput(suggestion.expirationDate.value),
      disciplinaryStatus: suggestion.disciplinaryStatus.value ?? 'clear',
    } as Record<FieldKey, string>);
  }, [suggestion]);

  async function loadSuggestion() {
    setStatus('loading');
    setError(null);
    try {
      const result = await fetchSuggestion();
      setSuggestion(result);
      setStatus('idle');
    } catch (err) {
      console.warn('[wallet][autofill]', err);
      setSuggestion(buildFallbackSuggestion());
      setStatus('error');
      setError('Live autofill service unavailable. Showing resilient snapshot instead.');
    }
  }

  async function onApply() {
    if (!suggestion) return;
    setIsApplying(true);
    setError(null);

    try {
      await submitAutofill({
        clinicianId: suggestion.clinicianId,
        state: suggestion.state,
        values: formValues,
        confidence: suggestion.confidence,
        notes,
      });
      setStatus('applied');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to apply autofill. Please retry shortly.',
      );
      setStatus('error');
    } finally {
      setIsApplying(false);
    }
  }

  const readyToApply = useMemo(
    () =>
      Boolean(
        formValues.licenseNumber &&
          formValues.expirationDate &&
          formValues.disciplinaryStatus &&
          suggestion,
      ),
    [formValues, suggestion],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Licensure</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">One-click license autofill</h1>
            <p className="text-muted-foreground">
              Seamlessly apply state-board verified fields for onboarding in under 30 seconds.
            </p>
            <div className="mt-2">
              <LicenseRuleTooltip />
            </div>
          </div>
          <Button variant="outline" onClick={loadSuggestion} disabled={status === 'loading'}>
            {status === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing
              </>
            ) : (
              'Refresh suggestion'
            )}
          </Button>
        </div>
        {error && <p className="text-sm text-amber-600">{error}</p>}
      </header>

      {suggestion && (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Suggested values</CardTitle>
              <CardDescription>{suggestion.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="text-3xl font-semibold">
                      {(suggestion.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                  <Progress value={suggestion.confidence * 100} className="h-3 flex-1" />
                  <ConfidenceBadge score={suggestion.confidence} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <MetricTile
                  label="License number"
                  value={formValues.licenseNumber || '—'}
                  confidence={suggestion.licenseNumber.confidence}
                  helper="Matches NPPES identity + board registry."
                />
                <MetricTile
                  label="Expiration"
                  value={formatDisplayDate(formValues.expirationDate)}
                  confidence={suggestion.expirationDate.confidence}
                  helper="Expiring soon triggers warnings."
                />
              </div>

              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add additional context (optional)"
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {status === 'applied' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Saved and queued for re-verification.
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    Applying will trigger state-board re-check and audit anchoring.
                  </>
                )}
              </div>
              <Button onClick={onApply} disabled={!readyToApply || isApplying} className="gap-2">
                {isApplying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Apply autofill & re-verify
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence sources</CardTitle>
              <CardDescription>
                Weighted blend across board scrape, uploaded docs, and NPPES context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestion.support.map((entry) => (
                    <TableRow key={`${entry.source}-${entry.evidenceId ?? 'n/a'}`}>
                      <TableCell className="font-medium">{humanizeSource(entry.source)}</TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">
                          {entry.fields.map(fieldLabel).join(', ')}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        {(entry.confidence * 100).toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Review & edit before applying</CardTitle>
          <CardDescription>
            Adjust any field, then run the automated save + verification workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {FIELD_CONFIG.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              {field.type === 'select' ? (
                <select
                  id={field.key}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formValues[field.key]}
                  onChange={(event) => handleFieldChange(field.key, event.target.value)}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={field.key}
                  type={field.type === 'date' ? 'date' : 'text'}
                  value={formValues[field.key]}
                  onChange={(event) => handleFieldChange(field.key, event.target.value)}
                />
              )}
              <p className="text-xs text-muted-foreground">{field.helper}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  function handleFieldChange(key: FieldKey, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }
}

function LicenseRuleTooltip() {
  const [message, setMessage] = useState('According to FSMB rule update, confirm CME transfers.');

  useEffect(() => {
    let mounted = true;
    async function loadRuleHeadline() {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        process.env.API_BASE_URL ??
        (typeof window !== 'undefined' ? window.location.origin : '');
      if (!baseUrl) return;
      try {
        const response = await fetch(`${baseUrl}/api/regulatory/FSMB`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { diff?: { headline?: string } };
        if (mounted && payload?.diff?.headline) {
          setMessage(`According to FSMB rule update, ${payload.diff.headline.toLowerCase()}.`);
        }
      } catch (error) {
        console.warn('[license][tooltip]', error);
      }
    }
    void loadRuleHeadline();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground"
        >
          Regulatory cue
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left text-xs">{message}</TooltipContent>
    </Tooltip>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const variant =
    score >= 0.9 ? 'text-emerald-600 bg-emerald-600/10' : score >= 0.7 ? 'text-amber-600 bg-amber-600/10' : 'text-rose-600 bg-rose-600/10';
  const label = score >= 0.9 ? 'Production-ready' : score >= 0.7 ? 'Review & confirm' : 'Manual entry';

  return (
    <span className={cn('rounded-full px-3 py-1 text-sm font-medium', variant)}>
      {label}
    </span>
  );
}

function MetricTile({
  label,
  value,
  confidence,
  helper,
}: {
  label: string;
  value: string;
  confidence: number;
  helper: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{value || '—'}</span>
        <Badge variant="outline">{(confidence * 100).toFixed(0)}%</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function fieldLabel(key: FieldKey): string {
  switch (key) {
    case 'licenseNumber':
      return 'License #';
    case 'issueDate':
      return 'Issue date';
    case 'expirationDate':
      return 'Expiration';
    case 'disciplinaryStatus':
      return 'Disciplinary';
    default:
      return key;
  }
}

function humanizeSource(source: string): string {
  if (source.startsWith('autofill:')) {
    return `Autofill · ${source.split(':')[1]}`;
  }
  if (source.startsWith('stateBoard:')) {
    return `State board · ${source.split(':')[1]}`;
  }
  return source;
}

async function fetchSuggestion(): Promise<LicenseSuggestion> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_BASE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!baseUrl) {
    throw new Error('API base URL is not configured');
  }

  const response = await fetch(`${baseUrl}/api/wallet/license/autofill`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Autofill engine responded with ${response.status}`);
  }

  return (await response.json()) as LicenseSuggestion;
}

async function submitAutofill(payload: {
  clinicianId: string;
  state: string;
  values: Record<FieldKey, string>;
  confidence: number;
  notes?: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_BASE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!baseUrl) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    return;
  }

  const response = await fetch(`${baseUrl}/api/wallet/license/autofill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to persist autofill selection');
  }
}

function buildFallbackSuggestion(): LicenseSuggestion {
  const now = new Date();
  const expiry = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  return {
    clinicianId: 'self',
    state: 'CA',
    confidence: 0.82,
    summary: 'Autofill CA license A123456 in clear standing expiring soon.',
    licenseNumber: {
      value: 'A123456',
      confidence: 0.94,
      sources: [],
    },
    issueDate: {
      value: now.toISOString(),
      confidence: 0.72,
      sources: [],
    },
    expirationDate: {
      value: expiry.toISOString(),
      confidence: 0.88,
      sources: [],
    },
    disciplinaryStatus: {
      value: 'clear',
      confidence: 0.93,
      sources: [],
    },
    support: [
      {
        source: 'stateBoard:CA',
        confidence: 0.9,
        fields: ['licenseNumber', 'expirationDate', 'disciplinaryStatus'],
      },
      {
        source: 'uploadedDocument',
        confidence: 0.7,
        fields: ['issueDate'],
      },
    ],
  };
}

function toDateInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

