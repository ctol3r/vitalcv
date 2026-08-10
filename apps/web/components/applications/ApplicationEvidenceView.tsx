import * as React from 'react';
import { AlertTriangle, Fingerprint, ShieldCheck } from 'lucide-react';
import { EvidenceProvenanceChip as StateChip } from '@/lib/vital/evidenceStateToProvenance';
import type {
  ApplicationEvidenceChangeKind,
  ApplicationEvidenceField,
  ApplicationEvidenceLoadResult,
} from '@/lib/applications/evidenceView';
import type { EvidenceState } from '@/lib/vital/evidenceState';

function formatDate(value: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function displayState(state: ApplicationEvidenceField['evidenceState']): EvidenceState {
  return state === 'employer_decided' ? 'employer_decision' : state;
}

/**
 * W1082: every field names its source (sourceId) and observation time, so the
 * chip's attribution comes straight from the field. A null observation stays
 * null — announced "as-of not recorded" — matching the visible "Not recorded"
 * this view already prints.
 */
function fieldAttribution(field: ApplicationEvidenceField) {
  return {
    source: field.sourceId,
    asOf: field.sourceObservedAt ? formatDate(field.sourceObservedAt) : null,
    asOfISO: field.sourceObservedAt ?? undefined,
  };
}

const CHANGE_LABEL: Record<ApplicationEvidenceChangeKind, string> = {
  unchanged: 'Unchanged',
  added_after_submission: 'Added after submission',
  changed_after_submission: 'Changed after submission',
  resolved_after_submission: 'Resolved after submission',
  became_stale: 'Became stale',
  became_unavailable: 'Became unavailable',
  removed_after_submission: 'Removed after submission',
};

function FieldList({ fields, empty }: { fields: ApplicationEvidenceField[]; empty: string }) {
  if (fields.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {fields.map((field) => (
        <div key={field.fieldId} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{field.label}</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">{field.value ?? 'No value returned'}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {field.sourceId} · observed {formatDate(field.sourceObservedAt)}
              {field.freshUntil ? ` · fresh through ${formatDate(field.freshUntil)}` : ''}
            </p>
          </div>
          <StateChip state={displayState(field.evidenceState)} attribution={fieldAttribution(field)} size="sm" />
        </div>
      ))}
    </div>
  );
}

export function ApplicationEvidenceView({ result }: { result: ApplicationEvidenceLoadResult }) {
  if (result.status !== 'ok') {
    const message = result.status === 'not_found'
      ? 'This application record was not found or is not available to your account.'
      : result.status === 'unauthorized'
        ? 'Sign in with an authorized account to view this application.'
        : result.message;
    return (
      <section role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div><h2 className="font-semibold">Evidence unavailable</h2><p className="mt-1 text-sm">{message}</p></div>
        </div>
      </section>
    );
  }

  const { data } = result;
  const packet = data.submittedPacket;
  const materialChanges = data.currentEvidence.changesSinceSubmission.filter((change) => change.kind !== 'unchanged');

  return (
    <section aria-labelledby="application-evidence-heading" className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Application evidence</p>
        <h2 id="application-evidence-heading" className="mt-2 text-2xl font-semibold text-foreground">Submitted record and current profile state</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          The submitted packet is immutable historical evidence. Current source results are compared separately and never overwrite it.
        </p>
      </div>

      {data.mode === 'legacy' ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <p className="font-semibold">Legacy application</p>
          <p className="mt-1 text-sm">{data.legacyNotice}</p>
        </div>
      ) : packet ? (
        <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                <h3 className="font-semibold">Submitted packet · version {packet.packetVersion}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Consented {formatDate(packet.consentAt)} for {packet.purpose} to {packet.recipient}.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
              <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" /> Integrity valid
            </span>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-muted-foreground">Consent receipt</dt><dd className="mt-1 break-all font-mono text-xs text-foreground">{packet.consentReceiptId}</dd></div>
            <div><dt className="text-muted-foreground">Packet hash</dt><dd className="mt-1 break-all font-mono text-xs text-foreground">{packet.packetHash}</dd></div>
            <div><dt className="text-muted-foreground">Lifecycle</dt><dd className="mt-1 font-medium text-foreground">{packet.lifecycle}</dd></div>
            <div><dt className="text-muted-foreground">Methodology</dt><dd className="mt-1 font-medium text-foreground">{packet.methodologyVersion}</dd></div>
          </dl>
          {packet.clinicianNote ? <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-foreground"><strong>Clinician note:</strong> {packet.clinicianNote}</p> : null}
          <div className="mt-5"><FieldList fields={packet.fields} empty="No fields were captured in this packet." /></div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
        <div className="rounded-2xl border border-border bg-background p-5">
          <h3 className="font-semibold text-foreground">Current profile evidence</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{data.currentEvidence.notice}</p>
          {data.currentEvidence.observedAt ? <p className="mt-1 text-xs text-muted-foreground">Computed {formatDate(data.currentEvidence.observedAt)}</p> : null}
          <div className="mt-4"><FieldList fields={data.currentEvidence.fields} empty="No current source result is available." /></div>
        </div>
        <div className="rounded-2xl border border-border bg-muted/50 p-5">
          <h3 className="font-semibold text-foreground">Changes since submission</h3>
          {data.mode === 'legacy' ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">No historical packet exists, so VitalCV cannot reconstruct a submitted-versus-current comparison.</p>
          ) : materialChanges.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">No material field changes were detected in the currently available evidence.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {materialChanges.map((change) => (
                <li key={change.fieldId} className="rounded-xl border border-border bg-background p-3">
                  <p className="font-medium text-foreground">{change.label}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{CHANGE_LABEL[change.kind]}</p>
                  <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-muted-foreground">Submitted</dt>
                      <dd className="mt-1 break-words text-foreground">{change.submitted?.value ?? 'Not present'}</dd>
                      {change.submitted ? <StateChip state={displayState(change.submitted.evidenceState)} attribution={fieldAttribution(change.submitted)} size="sm" className="mt-2" /> : null}
                    </div>
                    <div>
                      <dt className="font-semibold text-muted-foreground">Current</dt>
                      <dd className="mt-1 break-words text-foreground">{change.current?.value ?? 'Not present'}</dd>
                      {change.current ? <StateChip state={displayState(change.current.evidenceState)} attribution={fieldAttribution(change.current)} size="sm" className="mt-2" /> : null}
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
