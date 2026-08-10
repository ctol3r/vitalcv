import * as React from 'react';
import { AlertTriangle, Fingerprint, ShieldCheck } from 'lucide-react';
import { EvidenceProvenanceChip as StateChip } from '@/lib/vital/evidenceStateToProvenance';
import type {
  ApplicationEvidenceAbsence,
  ApplicationEvidenceChangeKind,
  ApplicationEvidenceField,
  ApplicationEvidenceLoadResult,
} from '@/lib/applications/evidenceView';
import type { EvidenceState } from '@/lib/vital/evidenceState';

/** How a section is named to a reader. Unknown ids show as themselves. */
const SECTION_LABEL: Readonly<Record<string, string>> = {
  identity: 'Identity',
  licensure: 'Licensure',
  enrollment: 'Medicare enrollment',
  exclusions: 'Federal exclusion screening',
};

function sectionLabel(sectionId: string): string {
  return SECTION_LABEL[sectionId] ?? sectionId;
}

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

/**
 * What was selected but produced nothing — rendered, never left silent.
 *
 * A section named in the disclosure with no row beneath it reads as "checked,
 * came back clean". These rows say the opposite out loud. Each carries a
 * StateChip so the meaning survives with colour removed (EC-4), and the chip is
 * given NO attribution: there is no source reading to attribute, and inventing
 * one would be the fabrication this whole record exists to prevent (EC-3).
 */
function AbsenceList({
  absences,
  unexplainedSectionIds,
  scope,
}: {
  /**
   * Which panel this list belongs to. The two make DIFFERENT claims — the
   * sealed one is about what was captured at submission, the live one about
   * what sources return now — so they must not share a sentence.
   */
  scope: 'submitted' | 'current';
  // `undefined` is reachable in production, not just in fixtures: web and API
  // deploy separately, so a browser can hold a page build newer than the API
  // that answers it. Treated as "not recorded" — the same fail-safe as null,
  // and never as the positive claim that every section contributed.
  absences: ApplicationEvidenceAbsence[] | null | undefined;
  unexplainedSectionIds: string[] | undefined;
}) {
  // Sealed before absences were captured. An empty list here would assert
  // "every section contributed" about a record that never made that claim.
  if (absences === null || absences === undefined) {
    if (!unexplainedSectionIds || unexplainedSectionIds.length === 0) return null;
    return (
      <div
        data-absences="unrecorded" data-absences-scope={scope}
        className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">
              Nothing was found for {unexplainedSectionIds.map(sectionLabel).join(', ')}
            </p>
            <p className="mt-1 text-sm">
              This submission predates per-section absence capture, so it does not record why. Do not
              read these as checks that came back clean.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (absences.length === 0) {
    return (
      <p data-absences="none" data-absences-scope={scope} className="mt-4 text-sm text-muted-foreground">
        {scope === 'submitted'
          ? 'Every selected section contributed evidence.'
          : 'Every selected section has current evidence.'}
      </p>
    );
  }

  return (
    <div data-absences="present" data-absences-scope={scope} className="mt-5">
      <h4 className="text-sm font-semibold text-foreground">Nothing was found for these sections</h4>
      <p className="mt-1 text-sm text-muted-foreground">
        {scope === 'submitted'
          ? 'The clinician chose to disclose these, and no evidence came back at submission. That is not the same as a check that came back clean.'
          : 'The clinician chose to disclose these, and no evidence comes back from current sources. That is not the same as a check that came back clean.'}
      </p>
      <ul className="mt-3 divide-y divide-amber-200 rounded-xl border border-amber-300 bg-amber-50">
        {absences.map((absence) => (
          <li
            key={absence.sectionId}
            data-absence-section={absence.sectionId}
            className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
          >
            <div className="min-w-0">
              <p className="font-medium text-amber-950">{sectionLabel(absence.sectionId)}</p>
              <p className="mt-1 break-words text-sm text-amber-900">{absence.reason}</p>
            </div>
            {/* 'declared' announces the state's own meaning and names no
                source — the honest attribution when no source answered. */}
            <StateChip state={absence.evidenceState} attribution="declared" size="sm" />
          </li>
        ))}
      </ul>
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
          The submitted record is immutable historical evidence. Current source results are compared separately and never overwrite it.
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
                <h3 className="font-semibold">Submitted record · version {packet.packetVersion}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Consented {formatDate(packet.consentAt)} for {packet.purpose} to {packet.recipient}.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
              <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" /> Integrity valid
            </span>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-muted-foreground">Consent receipt</dt><dd className="mt-1 break-all font-mono text-xs text-foreground">{packet.consentReceiptId}</dd></div>
            <div><dt className="text-muted-foreground">Record hash</dt><dd className="mt-1 break-all font-mono text-xs text-foreground">{packet.packetHash}</dd></div>
            <div><dt className="text-muted-foreground">Lifecycle</dt><dd className="mt-1 font-medium text-foreground">{packet.lifecycle}</dd></div>
            <div><dt className="text-muted-foreground">Methodology</dt><dd className="mt-1 font-medium text-foreground">{packet.methodologyVersion}</dd></div>
          </dl>
          {packet.clinicianNote ? <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-foreground"><strong>Clinician note:</strong> {packet.clinicianNote}</p> : null}
          <div className="mt-5"><FieldList fields={packet.fields} empty="No fields were captured in this record." /></div>
          <AbsenceList
            absences={packet.sectionAbsences}
            unexplainedSectionIds={packet.unexplainedSectionIds}
            scope="submitted"
          />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
        <div className="rounded-2xl border border-border bg-background p-5">
          <h3 className="font-semibold text-foreground">Current profile evidence</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{data.currentEvidence.notice}</p>
          {data.currentEvidence.observedAt ? <p className="mt-1 text-xs text-muted-foreground">Computed {formatDate(data.currentEvidence.observedAt)}</p> : null}
          <div className="mt-4"><FieldList fields={data.currentEvidence.fields} empty="No current source result is available." /></div>
          {/* The live panel recomputes, so it must recompute the silences too —
              otherwise the sealed record is honest and the panel beside it is not. */}
          <AbsenceList absences={data.currentEvidence.sectionAbsences} unexplainedSectionIds={[]} scope="current" />
        </div>
        <div className="rounded-2xl border border-border bg-muted/50 p-5">
          <h3 className="font-semibold text-foreground">Changes since submission</h3>
          {data.mode === 'legacy' ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">No historical record exists, so VitalCV cannot reconstruct a submitted-versus-current comparison.</p>
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
