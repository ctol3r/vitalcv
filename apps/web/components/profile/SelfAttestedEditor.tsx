'use client';

/**
 * SelfAttestedEditor — edits the clinician's USER_ENTERED profile layer:
 * contact, medical school, subspecialty, work history, affiliations, career
 * goals, and a research summary. Everything here is self-attested — typed by
 * the clinician and never source-verified. Saves the whole layer in one
 * document to POST /api/profile/self-attested (full replace).
 *
 * Styled for the D57 `.vcv-doc` paper/ink system: assumes a `.vcv-doc` ancestor
 * supplies the design tokens.
 */

import { useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type {
  SelfAttestedAffiliation,
  SelfAttestedProfile,
  SelfAttestedWorkEntry,
} from '@/lib/clinician-profile/selfAttested';
import { cleanDoximityUrl, parseSelfAttested } from '@/lib/clinician-profile/selfAttested';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Editable form mirror of SelfAttestedProfile — strings everywhere for inputs. */
interface EditorState {
  practiceEmail: string;
  practicePhone: string;
  practiceWebsite: string;
  schoolInstitution: string;
  schoolDegree: string;
  schoolGradYear: string;
  subspecialty: string;
  workHistory: Array<{ employer: string; role: string; startYear: string; endYear: string }>;
  affiliations: Array<{ organization: string; role: string }>;
  careerGoals: string;
  researchSummary: string;
  doximityUrl: string;
}

function toEditorState(sa: SelfAttestedProfile): EditorState {
  return {
    practiceEmail: sa.contact?.practiceEmail ?? '',
    practicePhone: sa.contact?.practicePhone ?? '',
    practiceWebsite: sa.contact?.practiceWebsite ?? '',
    schoolInstitution: sa.medicalSchool?.institutionName ?? '',
    schoolDegree: sa.medicalSchool?.degree ?? '',
    schoolGradYear: sa.medicalSchool?.graduationYear ? String(sa.medicalSchool.graduationYear) : '',
    subspecialty: sa.subspecialty ?? '',
    workHistory: (sa.workHistory ?? []).map((w) => ({
      employer: w.employer,
      role: w.role ?? '',
      startYear: w.startYear ? String(w.startYear) : '',
      endYear: w.endYear ? String(w.endYear) : '',
    })),
    affiliations: (sa.affiliations ?? []).map((a) => ({ organization: a.organization, role: a.role ?? '' })),
    careerGoals: sa.careerGoals ?? '',
    researchSummary: sa.researchSummary ?? '',
    doximityUrl: sa.doximityUrl ?? '',
  };
}

function yearOrUndef(raw: string): number | undefined {
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return undefined;
  const y = Math.trunc(n);
  return y >= 1900 && y <= 2100 ? y : undefined;
}

/** Build the SelfAttestedProfile payload from editor state (drops empties). */
function toPayload(s: EditorState): SelfAttestedProfile {
  const out: SelfAttestedProfile = {};

  const contact = {
    ...(s.practiceEmail.trim() ? { practiceEmail: s.practiceEmail.trim() } : {}),
    ...(s.practicePhone.trim() ? { practicePhone: s.practicePhone.trim() } : {}),
    ...(s.practiceWebsite.trim() ? { practiceWebsite: s.practiceWebsite.trim() } : {}),
  };
  if (Object.keys(contact).length) out.contact = contact;

  const school = {
    ...(s.schoolInstitution.trim() ? { institutionName: s.schoolInstitution.trim() } : {}),
    ...(s.schoolDegree.trim() ? { degree: s.schoolDegree.trim() } : {}),
    ...(yearOrUndef(s.schoolGradYear) !== undefined ? { graduationYear: yearOrUndef(s.schoolGradYear) } : {}),
  };
  if (Object.keys(school).length) out.medicalSchool = school;

  if (s.subspecialty.trim()) out.subspecialty = s.subspecialty.trim();

  const work = s.workHistory
    .map((w): SelfAttestedWorkEntry | null => {
      const employer = w.employer.trim();
      if (!employer) return null;
      const entry: SelfAttestedWorkEntry = { employer };
      if (w.role.trim()) entry.role = w.role.trim();
      const sy = yearOrUndef(w.startYear);
      if (sy !== undefined) entry.startYear = sy;
      const ey = yearOrUndef(w.endYear);
      if (ey !== undefined) entry.endYear = ey;
      return entry;
    })
    .filter((w): w is SelfAttestedWorkEntry => w !== null);
  if (work.length) out.workHistory = work;

  const affs = s.affiliations
    .map((a): SelfAttestedAffiliation | null => {
      const organization = a.organization.trim();
      if (!organization) return null;
      const entry: SelfAttestedAffiliation = { organization };
      if (a.role.trim()) entry.role = a.role.trim();
      return entry;
    })
    .filter((a): a is SelfAttestedAffiliation => a !== null);
  if (affs.length) out.affiliations = affs;

  if (s.careerGoals.trim()) out.careerGoals = s.careerGoals.trim();
  if (s.researchSummary.trim()) out.researchSummary = s.researchSummary.trim();

  // Host-validate the Doximity link; an off-Doximity or malformed value is
  // dropped rather than stored (mirrors the backend sanitizer).
  const doximityUrl = cleanDoximityUrl(s.doximityUrl);
  if (doximityUrl) out.doximityUrl = doximityUrl;

  return out;
}

const INPUT_CLASS = 'w-full rounded-[6px] border px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]';
const INPUT_STYLE = { borderColor: 'var(--paper-edge)', background: '#fff', color: 'var(--ink)' } as const;

export default function SelfAttestedEditor({
  initial,
  onSaved,
}: {
  initial: SelfAttestedProfile;
  onSaved: (next: SelfAttestedProfile) => void;
}) {
  const [state, setState] = useState<EditorState>(() => toEditorState(initial));
  const [baseline, setBaseline] = useState<SelfAttestedProfile>(initial);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(() => toPayload(state), [state]);
  const dirty = useMemo(
    () => JSON.stringify(payload) !== JSON.stringify(baseline),
    [payload, baseline],
  );

  function patch(p: Partial<EditorState>) {
    setState((s) => ({ ...s, ...p }));
    setSaveState((s) => (s === 'saving' ? s : 'idle'));
    setError(null);
  }

  function addWork() {
    patch({ workHistory: [...state.workHistory, { employer: '', role: '', startYear: '', endYear: '' }] });
  }
  function removeWork(index: number) {
    patch({ workHistory: state.workHistory.filter((_, i) => i !== index) });
  }
  function updateWork(index: number, field: keyof EditorState['workHistory'][number], value: string) {
    patch({ workHistory: state.workHistory.map((w, i) => (i === index ? { ...w, [field]: value } : w)) });
  }

  function addAffiliation() {
    patch({ affiliations: [...state.affiliations, { organization: '', role: '' }] });
  }
  function removeAffiliation(index: number) {
    patch({ affiliations: state.affiliations.filter((_, i) => i !== index) });
  }
  function updateAffiliation(index: number, field: 'organization' | 'role', value: string) {
    patch({ affiliations: state.affiliations.map((a, i) => (i === index ? { ...a, [field]: value } : a)) });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saveState === 'saving') return;
    setSaveState('saving');
    setError(null);
    try {
      const res = await fetch('/api/profile/self-attested', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selfAttested: payload }),
      });
      if (!res.ok) {
        setSaveState('error');
        setError(
          res.status === 401
            ? 'Your session expired. Sign in again to save.'
            : 'Saving is temporarily unavailable. Your entries were not lost; try again shortly.',
        );
        return;
      }
      const body: unknown = await res.json().catch(() => null);
      const saved =
        body && typeof body === 'object' && 'selfAttested' in body
          ? parseSelfAttested((body as { selfAttested: unknown }).selfAttested)
          : payload;
      setBaseline(saved);
      setState(toEditorState(saved));
      setSaveState('saved');
      onSaved(saved);
    } catch {
      setSaveState('error');
      setError('Saving is temporarily unavailable. Your entries were not lost; try again shortly.');
    }
  }

  const saving = saveState === 'saving';

  return (
    <section
      className="vcv-panel p-5 sm:p-6"
      aria-labelledby="self-attested-editor-heading"
      data-testid="self-attested-editor"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="vcv-eyebrow mb-1">Your self-attested profile</p>
          <h2 id="self-attested-editor-heading" className="vcv-title text-xl">
            Add the details you want employers to see
          </h2>
        </div>
        <span className="vcv-chip" data-state="pending">Self-attested</span>
      </div>
      <p className="mt-2 text-sm vcv-muted">
        You type these, and they are shared with employers as self-attested information. Nothing here
        is source-verified — a reviewer still confirms it against evidence.
      </p>

      <form onSubmit={save} className="mt-5 space-y-6" noValidate>
        {/* Contact */}
        <FieldGroup label="Contact">
          <div className="grid gap-3 sm:grid-cols-3">
            <Labeled label="Practice email">
              <input className={INPUT_CLASS} style={INPUT_STYLE} value={state.practiceEmail}
                disabled={saving} onChange={(e) => patch({ practiceEmail: e.target.value })} placeholder="you@practice.org" />
            </Labeled>
            <Labeled label="Practice phone">
              <input className={INPUT_CLASS} style={INPUT_STYLE} value={state.practicePhone}
                disabled={saving} onChange={(e) => patch({ practicePhone: e.target.value })} placeholder="(555) 555-5555" />
            </Labeled>
            <Labeled label="Practice website">
              <input className={INPUT_CLASS} style={INPUT_STYLE} value={state.practiceWebsite}
                disabled={saving} onChange={(e) => patch({ practiceWebsite: e.target.value })} placeholder="practice.org" />
            </Labeled>
          </div>
        </FieldGroup>

        {/* Medical school + subspecialty */}
        <FieldGroup label="Education">
          <div className="grid gap-3 sm:grid-cols-3">
            <Labeled label="Medical school">
              <input className={INPUT_CLASS} style={INPUT_STYLE} value={state.schoolInstitution}
                disabled={saving} onChange={(e) => patch({ schoolInstitution: e.target.value })} placeholder="Institution" />
            </Labeled>
            <Labeled label="Degree">
              <input className={INPUT_CLASS} style={INPUT_STYLE} value={state.schoolDegree}
                disabled={saving} onChange={(e) => patch({ schoolDegree: e.target.value })} placeholder="MD, DO, PA-C…" />
            </Labeled>
            <Labeled label="Graduation year">
              <input className={INPUT_CLASS} style={INPUT_STYLE} value={state.schoolGradYear} inputMode="numeric"
                disabled={saving} onChange={(e) => patch({ schoolGradYear: e.target.value })} placeholder="2015" />
            </Labeled>
          </div>
          <Labeled label="Subspecialty">
            <input className={INPUT_CLASS} style={INPUT_STYLE} value={state.subspecialty}
              disabled={saving} onChange={(e) => patch({ subspecialty: e.target.value })} placeholder="e.g. Interventional cardiology" />
          </Labeled>
        </FieldGroup>

        {/* Work history */}
        <FieldGroup label="Work history" onAdd={saving ? undefined : addWork} addLabel="Add role">
          {state.workHistory.length === 0 ? (
            <EmptyRow label="No employment added yet." />
          ) : (
            <div className="space-y-3">
              {state.workHistory.map((w, i) => (
                <RepeatableRow key={i} onRemove={saving ? undefined : () => removeWork(i)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Labeled label="Employer">
                      <input className={INPUT_CLASS} style={INPUT_STYLE} value={w.employer}
                        disabled={saving} onChange={(e) => updateWork(i, 'employer', e.target.value)} placeholder="Employer" />
                    </Labeled>
                    <Labeled label="Role">
                      <input className={INPUT_CLASS} style={INPUT_STYLE} value={w.role}
                        disabled={saving} onChange={(e) => updateWork(i, 'role', e.target.value)} placeholder="Title" />
                    </Labeled>
                    <Labeled label="Start year">
                      <input className={INPUT_CLASS} style={INPUT_STYLE} value={w.startYear} inputMode="numeric"
                        disabled={saving} onChange={(e) => updateWork(i, 'startYear', e.target.value)} placeholder="2018" />
                    </Labeled>
                    <Labeled label="End year">
                      <input className={INPUT_CLASS} style={INPUT_STYLE} value={w.endYear} inputMode="numeric"
                        disabled={saving} onChange={(e) => updateWork(i, 'endYear', e.target.value)} placeholder="2022 or blank" />
                    </Labeled>
                  </div>
                </RepeatableRow>
              ))}
            </div>
          )}
        </FieldGroup>

        {/* Affiliations */}
        <FieldGroup label="Affiliations" onAdd={saving ? undefined : addAffiliation} addLabel="Add affiliation">
          {state.affiliations.length === 0 ? (
            <EmptyRow label="No affiliations added yet." />
          ) : (
            <div className="space-y-3">
              {state.affiliations.map((a, i) => (
                <RepeatableRow key={i} onRemove={saving ? undefined : () => removeAffiliation(i)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Labeled label="Organization">
                      <input className={INPUT_CLASS} style={INPUT_STYLE} value={a.organization}
                        disabled={saving} onChange={(e) => updateAffiliation(i, 'organization', e.target.value)} placeholder="Hospital or group" />
                    </Labeled>
                    <Labeled label="Role">
                      <input className={INPUT_CLASS} style={INPUT_STYLE} value={a.role}
                        disabled={saving} onChange={(e) => updateAffiliation(i, 'role', e.target.value)} placeholder="Attending, member…" />
                    </Labeled>
                  </div>
                </RepeatableRow>
              ))}
            </div>
          )}
        </FieldGroup>

        {/* Career goals + research */}
        <FieldGroup label="Narrative">
          <Labeled label="Career goals">
            <textarea className={INPUT_CLASS} style={INPUT_STYLE} rows={2} value={state.careerGoals}
              disabled={saving} onChange={(e) => patch({ careerGoals: e.target.value })}
              placeholder="What you're looking for next. Used for matching, never for verification." />
          </Labeled>
          <Labeled label="Research summary">
            <textarea className={INPUT_CLASS} style={INPUT_STYLE} rows={2} value={state.researchSummary}
              disabled={saving} onChange={(e) => patch({ researchSummary: e.target.value })}
              placeholder="A short summary of your research interests or output." />
          </Labeled>
        </FieldGroup>

        {/* External profiles */}
        <FieldGroup label="External profiles">
          <Labeled label="Doximity profile">
            <input
              className={INPUT_CLASS}
              style={INPUT_STYLE}
              type="url"
              inputMode="url"
              value={state.doximityUrl}
              disabled={saving}
              onChange={(e) => patch({ doximityUrl: e.target.value })}
              placeholder="https://www.doximity.com/profiles/your-profile"
              aria-describedby="doximity-help"
            />
            <p id="doximity-help" className="mt-1 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              {state.doximityUrl.trim() && !cleanDoximityUrl(state.doximityUrl)
                ? 'Enter a full https://doximity.com profile link — other links are not saved.'
                : 'Optional. A self-reported link to your Doximity profile. Not a verification.'}
            </p>
          </Labeled>
        </FieldGroup>

        <div className="flex flex-wrap items-center gap-3 border-t pt-4" style={{ borderColor: 'var(--paper-edge)' }}>
          <button
            type="submit"
            disabled={!dirty || saving}
            className="vcv-cta inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…</>) : 'Save self-attested details'}
          </button>
          <p aria-live="polite" className="text-sm" data-testid="self-attested-editor-status">
            {error ? (
              <span role="alert" style={{ color: 'var(--state-blocked)' }}>{error}</span>
            ) : saving ? (
              <span className="vcv-muted">Saving your self-attested details…</span>
            ) : saveState === 'saved' && !dirty ? (
              <span style={{ color: 'var(--state-verified)' }}>Saved as self-attested.</span>
            ) : dirty ? (
              <span style={{ color: 'var(--state-pending)' }}>Unsaved changes.</span>
            ) : (
              <span className="vcv-subtle">No unsaved changes.</span>
            )}
          </p>
        </div>
      </form>
    </section>
  );
}

function FieldGroup({
  label,
  onAdd,
  addLabel,
  children,
}: {
  label: string;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="vcv-eyebrow">{label}</h3>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> {addLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs vcv-muted">{label}</span>
      {children}
    </label>
  );
}

function RepeatableRow({ onRemove, children }: { onRemove?: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border p-3" style={{ borderColor: 'var(--paper-edge)', background: 'var(--paper-warm)' }}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="mt-6 shrink-0 rounded p-1 transition hover:opacity-70"
            style={{ color: 'var(--ink-subtle)' }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="text-sm vcv-subtle">{label}</p>;
}
