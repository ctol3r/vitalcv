'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type EventKey = 'readinessUpdate' | 'credentialIssued' | 'sanctionFlag' | 'expirationWarning';

const AVAILABLE_EVENTS: Record<EventKey, { label: string; helper: string }> = {
  readinessUpdate: {
    label: 'Readiness score change',
    helper: 'Triggered when readiness improves by > 10 basis points.',
  },
  credentialIssued: {
    label: 'Credential issued',
    helper: 'Wallet or PSV credential issued to the clinician.',
  },
  sanctionFlag: {
    label: 'Sanction flag',
    helper: 'Immediate signal for sanction or board restriction events.',
  },
  expirationWarning: {
    label: 'Expiration warning',
    helper: 'License, DEA, or board certification within 60 day expiry window.',
  },
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

export default function RecruiterAtsSubscribePage() {
  const [orgId, setOrgId] = useState('demo-health-system');
  const [webhookUrl, setWebhookUrl] = useState('https://example.com/ats/webhooks/vitalcv');
  const [clinicianIds, setClinicianIds] = useState('');
  const [events, setEvents] = useState<Record<EventKey, boolean>>({
    readinessUpdate: true,
    credentialIssued: true,
    sanctionFlag: true,
    expirationWarning: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedEvents = useMemo(
    () => Object.entries(events).filter(([, enabled]) => enabled).map(([key]) => key) as EventKey[],
    [events],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await subscribeToUpdates({
        orgId,
        url: webhookUrl,
        clinicianIds: parseClinicianIds(clinicianIds),
        events: selectedEvents,
      });
      setSuccessMessage('Subscribed! We will deliver ATS-ready bundles for the selected events.');
    } catch (err) {
      console.error('[recruiter][ats-subscribe] failed', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach the ATS subscription API at this time.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Recruiter · ATS Auto-sync</Badge>
        <div>
          <h1 className="text-3xl font-semibold">Subscribe to clinician updates</h1>
          <p className="text-muted-foreground max-w-3xl">
            Register a webhook endpoint to receive FHIR applicant bundles, readiness jumps, and
            compliance telemetry in real time. We sign every payload and include diff metadata so
            your ATS can auto-promote viable candidates.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Webhook registration</CardTitle>
          <CardDescription>
            Configure the org scope, webhook endpoint, and optional clinician filters for your ATS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="orgId">Org ID</Label>
                <Input
                  id="orgId"
                  value={orgId}
                  onChange={(event) => setOrgId(event.target.value)}
                  placeholder="org-123"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Matches the org configured in Vital Credentialing.
                </p>
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  type="url"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  placeholder="https://ats.example.com/webhooks/vitalcv"
                  required
                />
                <p className="text-xs text-muted-foreground">HTTPS strongly recommended.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinicianIds">Clinician filters (optional)</Label>
              <Textarea
                id="clinicianIds"
                placeholder="clinician-123, clinician-456"
                value={clinicianIds}
                onChange={(event) => setClinicianIds(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Provide comma-separated clinician IDs or leave blank to receive all updates for your
                org.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Events to receive</p>
              <div className="space-y-2">
                {Object.entries(AVAILABLE_EVENTS).map(([key, value]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                  >
                    <Checkbox
                      checked={events[key as EventKey]}
                      onCheckedChange={(checked) =>
                        setEvents((prev) => ({
                          ...prev,
                          [key]: Boolean(checked),
                        }))
                      }
                    />
                    <div>
                      <p className="text-sm font-medium">{value.label}</p>
                      <p className="text-xs text-muted-foreground">{value.helper}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-amber-600">
                <AlertTriangle className="mr-1 inline h-4 w-4 align-middle" />
                {error}
              </p>
            )}
            {successMessage && (
              <p className="text-sm text-emerald-600">
                <CheckCircle2 className="mr-1 inline h-4 w-4 align-middle" />
                {successMessage}
              </p>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={submitting || selectedEvents.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving subscription…
                </>
              ) : (
                'Subscribe now'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

async function subscribeToUpdates(payload: {
  orgId: string;
  url: string;
  clinicianIds: string[];
  events: string[];
}): Promise<void> {
  if (!API_BASE) {
    throw new Error('API base URL not configured for ATS subscription');
  }

  const response = await fetch(`${API_BASE}/api/ats/subscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Subscription failed with ${response.status}`);
  }
}

function parseClinicianIds(value: string): string[] {
  return value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}










