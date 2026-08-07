'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Icon } from '@/components/Icon';
import type {
  ApplyIntentField,
  ApplyIntentSubmissionResult,
  ApplyIntentView,
} from '@/lib/apply-intent/types';

const SECTION_LABELS: Record<string, string> = {
  identity: 'Identity and NPI',
  exclusions: 'Exclusion screening',
  licensure: 'Licensure',
  enrollment: 'Enrollment',
};

function evidenceLabel(state: ApplyIntentField['evidenceState']): string {
  switch (state) {
    case 'source_backed': return 'Source-backed';
    case 'checked': return 'Checked';
    case 'self_attested': return 'Self-attested';
    case 'needs_review': return 'Needs review';
    case 'access_required': return 'Source access required';
    case 'unavailable': return 'Unavailable';
    case 'employer_decided': return 'Employer decided';
  }
}

function safeParentOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('parent_origin');
  if (!raw) return null;
  try {
    const origin = new URL(raw).origin;
    return origin === raw.replace(/\/$/, '') ? origin : null;
  } catch {
    return null;
  }
}

export function ApplyIntentComposer({
  requestUri,
  initialIntent,
}: {
  requestUri: string;
  initialIntent: ApplyIntentView;
}) {
  const [preview, setPreview] = useState<ApplyIntentView | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    () => new Set(initialIntent.requestedSections),
  );
  const [coverNote, setCoverNote] = useState('');
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyIntentSubmissionResult | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/apply/intents/${encodeURIComponent(requestUri)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as ApplyIntentView & { error?: string; message?: string };
        if (!response.ok) throw new Error(body.message ?? body.error ?? 'Your evidence preview is unavailable.');
        if (active) setPreview(body);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Your evidence preview is unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [requestUri]);

  const fieldsBySection = useMemo(() => {
    const groups = new Map<string, ApplyIntentField[]>();
    for (const field of preview?.fields ?? []) {
      const group = groups.get(field.sectionId) ?? [];
      group.push(field);
      groups.set(field.sectionId, group);
    }
    return groups;
  }, [preview]);

  function toggleSection(section: string) {
    if (section === 'identity') return;
    setSelectedSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
    setConsented(false);
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/apply/intents/${encodeURIComponent(requestUri)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedSections: [...selectedSections],
          coverNote: coverNote.trim() || null,
          authenticationMethod: 'clerk_session',
        }),
      });
      const body = await response.json().catch(() => ({})) as ApplyIntentSubmissionResult & { error?: string; message?: string };
      if (!response.ok) throw new Error(body.message ?? body.error ?? 'The application could not be submitted.');
      setResult(body);
      const parentOrigin = safeParentOrigin();
      const message = {
        type: 'VITALCV_APPLICATION_SUBMITTED',
        payload: {
          applicationId: body.applicationId,
          opportunityId: body.opportunityId,
          handoffId: body.handoffId,
          packetHash: body.packet.hash,
          receiptStatus: body.handoffReceipt.status,
        },
      } as const;
      if (parentOrigin && window.parent !== window) {
        window.parent.postMessage(message, parentOrigin);
      }
      if (parentOrigin && window.opener && window.opener !== window) {
        window.opener.postMessage(message, parentOrigin);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The application could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="rounded-[28px] border border-emerald-600/20 bg-emerald-50 p-6 shadow-sm" aria-live="polite">
        <div className="flex items-start gap-3">
          <Icon name="file-check" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">Application handed off</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Your exact packet is sealed and recorded.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
              VitalCV created a transport receipt. This confirms the handoff record—not employer review, acceptance, credentialing, privileging, or clearance to start.
            </p>
          </div>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-900/10 bg-white p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Packet hash</dt>
            <dd className="mt-2 break-all font-mono text-xs text-slate-800">{result.packet.hash}</dd>
          </div>
          <div className="rounded-2xl border border-emerald-900/10 bg-white p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Handoff receipt</dt>
            <dd className="mt-2 text-sm font-medium text-slate-900">{result.handoffReceipt.status.replace(/_/g, ' ')}</dd>
          </div>
        </dl>
        {result.limitations.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Recorded limitations:</strong> {result.limitations.join(' ')}
          </div>
        ) : null}
        <a
          href={result.returnUrl}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Return to employer <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
        </a>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-start gap-3">
        <Icon name="file-check" className="mt-1 h-5 w-5 shrink-0 text-indigo-700" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">The packet you choose</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Review each disclosure section</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Identity is required to attribute the packet. Every other section remains your choice. Source labels and observation times travel with the values.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <Icon name="loader" className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your evidence preview…
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="alert">
          {error} <Link href={`/onboarding?redirect_url=${encodeURIComponent(`/apply/${requestUri}`)}`} className="font-semibold underline">Open clinician onboarding</Link>.
        </div>
      ) : null}

      {preview ? (
        <div className="mt-6 space-y-4">
          {initialIntent.requestedSections.map((section) => {
            const selected = selectedSections.has(section);
            const fields = fieldsBySection.get(section) ?? [];
            return (
              <article key={section} className="rounded-2xl border border-slate-200 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={section === 'identity'}
                    onChange={() => toggleSection(section)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    <span className="font-semibold text-slate-950">{SECTION_LABELS[section] ?? section}</span>
                    {section === 'identity' ? <span className="ml-2 text-xs text-slate-500">Required</span> : null}
                  </span>
                </label>
                <div className="mt-3 space-y-2 pl-7">
                  {fields.length === 0 ? (
                    <p className="text-sm text-slate-500">No current evidence is available in this section.</p>
                  ) : fields.map((field) => (
                    <div key={field.fieldId} className="rounded-xl bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{field.label}</p>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                          {evidenceLabel(field.evidenceState)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{field.value ?? 'No value recorded'}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Source: {field.sourceId}{field.sourceObservedAt ? ` · observed ${new Date(field.sourceObservedAt).toLocaleString()}` : ' · observation time unavailable'}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <label className="mt-6 block text-sm font-medium text-slate-900">
        Optional note to the employer
        <textarea
          value={coverNote}
          onChange={(event) => setCoverNote(event.target.value.slice(0, 2_000))}
          rows={3}
          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          placeholder="Availability, timing, or other application context"
        />
      </label>

      <label className="mt-5 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-slate-800">
        <input
          type="checkbox"
          checked={consented}
          onChange={(event) => setConsented(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-indigo-300"
        />
        <span>
          I authorize VitalCV to disclose the selected evidence to <strong>{initialIntent.organization.name}</strong> for <strong>{initialIntent.purpose}</strong>. I understand the handoff receipt records transport, not an employer decision.
        </span>
      </label>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!preview || !consented || submitting || selectedSections.size === 0}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
      >
        {submitting ? <Icon name="loader" className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon name="shield" className="h-4 w-4" aria-hidden="true" />}
        {submitting ? 'Sealing and handing off…' : 'Authorize and apply'}
      </button>
    </section>
  );
}
