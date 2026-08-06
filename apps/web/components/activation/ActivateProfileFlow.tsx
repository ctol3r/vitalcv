'use client';

/**
 * The clinician activation flow — Wave 1076 B1.
 *
 * The product direction this is the first expression of:
 *
 *   Enter your NPI. Verify it is you. VitalCV tells you exactly what needs to
 *   happen next, explains how to do it, and completes everything it safely can.
 *
 * So this is not a form editor and not a credential folder. It is a short,
 * legible sequence: here is what we found · here is where each piece came from ·
 * here is what is missing and why it matters · nothing is shared without you ·
 * keep it · here is what is next.
 *
 * THE SERVER DECIDES. Every gate rendered below reads a timestamp the server
 * stamped — `reviewedAt`, `sharingConfirmedAt`, `savedAt`, `activatedAt` — and
 * there is no local "activated" flag anywhere in this file. That is deliberate
 * and it is the single most important property here: a surface that tracked
 * activation itself could show someone an active profile the server never
 * activated, which is a lie about their career told in their own browser. For
 * the same reason there is no Activate button. The clinician asks to SAVE; the
 * server concludes activation when review, sharing control and save are all
 * true, and this file finds out by reading the response.
 *
 * RECOVERY is layered, because each layer fails differently: the URL survives
 * sign-in, localStorage survives a browser restart, and the durable draft on
 * the server survives a new machine. `bootstrap` below tries them in that
 * order, so a clinician never re-enters information they already gave — which
 * is the entire promise of a reusable profile.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TruthBadge } from '@/components/activation/TruthBadge';
import { ReadinessPlannerPanel } from '@/components/activation/ReadinessPlannerPanel';
import {
  claimProfile,
  confirmReview,
  confirmSharing,
  listProfiles,
  saveCorrections,
  saveReusableProfile,
  type ApiError,
} from '@/lib/activation/client';
import { missingFieldGuidance } from '@/lib/activation/fieldGuidance';
import {
  activationConditions,
  displayValue,
  fieldFor,
  type ProfileFieldSpec,
  type ProfileView,
} from '@/lib/activation/profileView';
import { editedFromPublicSourceNote } from '@/lib/activation/truthLabels';
import {
  clearPendingNpi,
  rememberPendingNpi,
  resolveWorkingNpi,
} from '@/lib/activation/pendingNpi';

type Phase = 'starting' | 'ready' | 'no_npi' | 'unavailable';

/**
 * Which control a field gets.
 *
 * The server registry stays canonical for WHICH fields exist and which are
 * required — this only picks a widget. `freeText` from the spec is the
 * fallback, so a field added on the server alone still renders an input rather
 * than disappearing.
 */
type InputKind = 'text' | 'email' | 'state' | 'state_list' | 'work_arrangement';

function inputKind(spec: ProfileFieldSpec): InputKind {
  switch (spec.key) {
    case 'contactEmail':
      return 'email';
    case 'practiceState':
      return 'state';
    case 'licensedStates':
    case 'preferredStates':
      return 'state_list';
    case 'workArrangement':
      return 'work_arrangement';
    default:
      return 'text';
  }
}

/**
 * Mirrors the server's allowed values. The server validates regardless — if
 * these ever drift, the answer is a field-level 400 the surface shows inline,
 * not a silently accepted value.
 */
const WORK_ARRANGEMENTS: Array<{ value: string; label: string }> = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'locums', label: 'Locums' },
  { value: 'per_diem', label: 'Per diem' },
  { value: 'additional_role', label: 'An additional role alongside my current one' },
];

const HINT: Partial<Record<InputKind, string>> = {
  state: 'Two-letter state code, e.g. CA',
  state_list: 'Two-letter state codes, separated by commas — e.g. CA, TX, NY',
};

/** Turn an input string into the shape the field's validator expects. */
function toPayload(kind: InputKind, raw: string): unknown {
  if (kind === 'state_list') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return raw.trim();
}

export function ActivateProfileFlow({ initialNpi }: { initialNpi: string | null }) {
  const [phase, setPhase] = useState<Phase>('starting');
  const [view, setView] = useState<ProfileView | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [notice, setNotice] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const startedRef = useRef(false);

  const apply = useCallback((next: ProfileView) => {
    setView(next);
    rememberPendingNpi(next.npi);
    // Corrections that committed are no longer pending edits — keeping them in
    // local state would make the inputs disagree with the server the moment a
    // value was normalized (a lowercased email, an upper-cased state code).
    setEdits({});
    setFieldError(null);
  }, []);

  /**
   * Find the profile this session is about, trying each recovery layer in turn.
   */
  const bootstrap = useCallback(async () => {
    setPhase('starting');
    const npi = resolveWorkingNpi(initialNpi);

    if (npi) {
      // Claim is create-or-recover and safe to repeat: an interrupted clinician
      // who returns lands on their own draft, edits intact, rather than a
      // second one.
      const res = await claimProfile(npi);
      if (res.ok) {
        apply(res.data);
        setPhase('ready');
        return;
      }
      // A refused claim is not the end of the road — the clinician may still
      // have a draft from an earlier session. Fall through to the server list
      // and only then give up.
      setNotice(res.error);
    }

    const mine = await listProfiles();
    if (mine.ok && mine.data.length > 0) {
      // Ordered most-recently-updated first by the server.
      apply(mine.data[0]);
      setNotice(null);
      setPhase('ready');
      return;
    }

    setPhase(npi ? 'unavailable' : 'no_npi');
  }, [initialNpi, apply]);

  useEffect(() => {
    // React 18 mounts effects twice in development; claiming twice is harmless
    // upstream but would double the audit rows for no reason.
    if (startedRef.current) return;
    startedRef.current = true;
    void bootstrap();
  }, [bootstrap]);

  const run = useCallback(
    async (key: string, fn: () => Promise<{ ok: true; data: ProfileView } | { ok: false; error: ApiError }>) => {
      setBusy(key);
      setNotice(null);
      const res = await fn();
      setBusy(null);
      if (res.ok) {
        apply(res.data);
        return true;
      }
      if (res.error.field) {
        setFieldError({ field: res.error.field, message: res.error.message });
      } else {
        setNotice(res.error);
      }
      return false;
    },
    [apply],
  );

  const dirty = useMemo(() => Object.keys(edits), [edits]);

  const onSaveCorrections = useCallback(async () => {
    if (!view || dirty.length === 0) return;
    const payload: Record<string, unknown> = {};
    for (const key of dirty) {
      const spec = view.fieldSpecs.find((s) => s.key === key);
      if (!spec) continue;
      payload[key] = toPayload(inputKind(spec), edits[key]);
    }
    await run('corrections', () => saveCorrections(view.npi, payload));
  }, [view, dirty, edits, run]);

  if (phase === 'starting') {
    return (
      <Shell>
        <p className="text-muted-foreground" role="status">
          Finding your profile…
        </p>
      </Shell>
    );
  }

  if (phase === 'no_npi' || phase === 'unavailable') {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight">Start with your NPI</h1>
        <p className="text-muted-foreground mt-3">
          {phase === 'unavailable'
            ? 'That profile could not be opened just now, and nothing was changed. You can try again, or start from your NPI.'
            : 'Enter your 10-digit NPI and VitalCV will show you what public sources already know.'}
        </p>
        {notice && <Notice error={notice} />}
        <Button asChild className="mt-6">
          <Link href="/profile/activate">Look up an NPI</Link>
        </Button>
      </Shell>
    );
  }

  if (!view) return null;

  const cond = activationConditions(view);
  const missing = missingFieldGuidance(view);
  const complete = view.missingRequired.length === 0;

  return (
    <Shell>
      <header data-activation-stage="review">
        <p className="text-muted-foreground text-sm">
          NPI <span className="tabular-nums">{view.npi}</span>
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {cond.activated ? 'Your reusable VitalCV profile' : 'Review what VitalCV found'}
        </h1>
        <p className="text-muted-foreground mt-3" data-activation-disclosure="">
          {view.disclosure}
        </p>
      </header>

      {notice && <Notice error={notice} />}

      {/* ── 1 · What we found, and where each value came from ─────────────── */}
      <section className="mt-10" aria-label="Your profile information">
        <h2 className="text-xl font-semibold">Your information</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Each value says where it came from. Change anything that is wrong or out of date — what
          you change becomes yours, and the original public answer stays on your record.
        </p>

        <div className="mt-6 space-y-5">
          {view.fieldSpecs.map((spec) => {
            const current = fieldFor(view, spec.key);
            const kind = inputKind(spec);
            const value = edits[spec.key] ?? displayValue(current?.value);
            const err = fieldError?.field === spec.key ? fieldError.message : null;
            const editedFromPublic =
              current?.truthClass === 'clinician_provided' && spec.origin === 'public_source_correctable';

            return (
              <div key={spec.key} className="rounded-2xl border p-4 sm:p-5" data-field={spec.key}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor={`f-${spec.key}`} className="text-sm font-medium">
                    {spec.label}
                    {spec.required && (
                      <span className="text-muted-foreground font-normal"> · needed</span>
                    )}
                  </Label>
                  {current ? (
                    <TruthBadge truthClass={current.truthClass} source={current.source} />
                  ) : (
                    <span className="text-muted-foreground text-xs">Not filled in yet</span>
                  )}
                </div>

                {kind === 'work_arrangement' ? (
                  <select
                    id={`f-${spec.key}`}
                    className="border-input bg-background mt-3 h-10 w-full rounded-lg border px-3 text-sm"
                    value={value}
                    onChange={(e) => setEdits((p) => ({ ...p, [spec.key]: e.target.value }))}
                  >
                    <option value="">Not set</option>
                    {WORK_ARRANGEMENTS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`f-${spec.key}`}
                    className="mt-3"
                    type={kind === 'email' ? 'email' : 'text'}
                    inputMode={kind === 'email' ? 'email' : undefined}
                    autoComplete={kind === 'email' ? 'email' : 'off'}
                    value={value}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={err ? `e-${spec.key}` : undefined}
                    onChange={(e) => setEdits((p) => ({ ...p, [spec.key]: e.target.value }))}
                  />
                )}

                {HINT[kind] && !err && (
                  <p className="text-muted-foreground mt-2 text-xs">{HINT[kind]}</p>
                )}
                {err && (
                  <p id={`e-${spec.key}`} className="text-destructive mt-2 text-xs" role="alert">
                    {err}
                  </p>
                )}
                {editedFromPublic && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    {editedFromPublicSourceNote(current?.source)}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => void onSaveCorrections()} disabled={dirty.length === 0 || busy !== null}>
            {busy === 'corrections' ? 'Keeping your changes…' : 'Keep these changes'}
          </Button>
          <p className="text-muted-foreground text-sm">
            {dirty.length === 0
              ? 'Your changes are kept as a draft as you go.'
              : `${dirty.length} change${dirty.length === 1 ? '' : 's'} not kept yet.`}
          </p>
        </div>
      </section>

      {/* ── 2 · What is missing, why it matters, what it unlocks ──────────── */}
      {missing.length > 0 && (
        <section className="mt-10" aria-label="What is still needed" data-missing-guidance="">
          <h2 className="text-xl font-semibold">Before you can save this for reuse</h2>
          <ul className="mt-4 space-y-4">
            {missing.map((g) => (
              <li key={g.key} className="rounded-2xl border p-4 sm:p-5" data-missing-field={g.key}>
                <p className="font-medium">{g.ask}</p>
                <p className="text-muted-foreground mt-1.5 text-sm">{g.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 3 · Review confirmation ───────────────────────────────────────── */}
      <section className="mt-10" aria-label="Confirm your review">
        <h2 className="text-xl font-semibold">Confirm you have reviewed this</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Review it, and add what is missing. This records that you looked — it does not share
          anything, and you can keep editing afterwards.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant={cond.reviewed ? 'outline' : 'default'}
            disabled={cond.reviewed || busy !== null}
            onClick={() => void run('review', () => confirmReview(view.npi))}
            data-action="confirm-review"
          >
            {cond.reviewed ? 'Reviewed' : busy === 'review' ? 'Recording…' : "I've reviewed this"}
          </Button>
          {cond.reviewed && (
            <span className="text-muted-foreground text-sm">
              Recorded. Edit anything you like — this stays confirmed.
            </span>
          )}
        </div>
      </section>

      {/* ── 4 · Sharing control ───────────────────────────────────────────── */}
      <section className="mt-10" aria-label="How sharing works" data-sharing-control="">
        <h2 className="text-xl font-semibold">You choose what gets shared.</h2>
        <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
          <li>Nothing is sent to an employer automatically. You decide when, and to whom.</li>
          <li>Before anything is sent, you see exactly what it contains.</li>
          <li>
            Institution review decides the outcome. VitalCV never approves, credentials, or hires
            anyone.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant={cond.sharingConfirmed ? 'outline' : 'default'}
            disabled={cond.sharingConfirmed || busy !== null}
            onClick={() => void run('sharing', () => confirmSharing(view.npi))}
            data-action="confirm-sharing"
          >
            {cond.sharingConfirmed
              ? 'Confirmed'
              : busy === 'sharing'
                ? 'Recording…'
                : 'I understand — I control sharing'}
          </Button>
        </div>
      </section>

      {/* ── 5 · The explicit save ─────────────────────────────────────────── */}
      <section className="mt-10" aria-label="Save your reusable profile">
        <h2 className="text-xl font-semibold">Save your reusable profile</h2>
        <div className="text-muted-foreground mt-3 space-y-2 text-sm">
          <p>Your changes are already kept as a draft. Saving is a different thing:</p>
          <ul className="space-y-2">
            <li>Saving creates the one profile you reuse for future applications and requests.</li>
            <li>
              Saving does not mean ownership, credentials, employment, or readiness were
              independently checked. It means you reviewed this and chose to keep it.
            </li>
          </ul>
        </div>

        {!complete && (
          <p className="mt-4 text-sm" data-save-blocked="">
            {missing.length} thing{missing.length === 1 ? '' : 's'} still needed above before this
            can be saved for reuse.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            disabled={busy !== null || cond.saved}
            onClick={() => void run('save', () => saveReusableProfile(view.npi))}
            data-action="save-profile"
          >
            {cond.saved
              ? 'Saved'
              : busy === 'save'
                ? 'Saving…'
                : 'Save my reusable profile'}
          </Button>
          {cond.saved && view.savedAt && (
            <span className="text-muted-foreground text-sm">
              Saved. Re-saving would not change anything.
            </span>
          )}
        </div>
      </section>

      {/* ── 6 · What is next ──────────────────────────────────────────────── */}
      {cond.activated ? (
        <ActivatedSummary view={view} />
      ) : (
        <p className="text-muted-foreground mt-10 text-sm">
          Your profile becomes reusable once you have reviewed it, confirmed how sharing works, and
          saved it. VitalCV records that itself — there is nothing else to press.
        </p>
      )}
    </Shell>
  );
}

/**
 * The activated state.
 *
 * Note what it says about private holdings. A saved profile is not proof the
 * NPI belongs to this person, so anything held privately for that clinician
 * stays locked — and the surface states the lock rather than leaving its
 * absence to be noticed.
 */
function ActivatedSummary({ view }: { view: ProfileView }) {
  return (
    <>
      <section className="mt-10 rounded-2xl border p-5 sm:p-6" data-activation-stage="active">
        <h2 className="text-xl font-semibold">Your profile is saved and reusable.</h2>
        <p className="text-muted-foreground mt-2 text-sm">{view.disclosure}</p>
        <ul className="text-muted-foreground mt-4 space-y-2 text-sm">
          <li>You can reuse it for applications instead of entering this information again.</li>
          <li>Opportunity matching can now run against it.</li>
          <li>
            {view.permissions.privateCredentialHoldings
              ? 'Credential records held privately for you are available, because your ownership of this NPI was separately confirmed.'
              : 'Credential records held privately for you stay locked. Saving a profile does not prove the NPI is yours — that is a separate check.'}
          </li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/explore">Find roles that fit</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/profile/${view.npi}`}>See your profile</Link>
          </Button>
        </div>
      </section>
      <ReadinessPlannerPanel view={view} />
      <ClearPendingOnActivation />
    </>
  );
}

/**
 * The handoff value has done its job once the profile is active. Cleared so a
 * later visit to the bare activation URL does not silently reopen someone
 * else's finished flow on a shared computer.
 */
function ClearPendingOnActivation() {
  useEffect(() => {
    clearPendingNpi();
  }, []);
  return null;
}

function Notice({ error }: { error: ApiError }) {
  const signedOut = error.status === 401;
  return (
    <div className="mt-6 rounded-2xl border p-4" role="alert" data-activation-notice="">
      <p className="text-sm">{error.message}</p>
      {signedOut && (
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/sign-in">Sign in again</Link>
        </Button>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">{children}</div>;
}
