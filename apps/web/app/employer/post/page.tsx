'use client';

/**
 * Employer job-posting surface — post a real opening and manage your openings.
 *
 * Wired to the live opportunity APIs (previously the backend accepted postings
 * but nothing in the product called it):
 *   GET  /api/employer/opportunities   → this employer's own postings
 *   POST /api/employer/opportunities   → create a real DB Opportunity (MATCHA
 *                                        scores clinicians against it)
 *   POST /api/employer/setup { name }  → first-time org setup (the honest
 *                                        "no organization yet" path)
 *
 * A posting is a plain listing — nothing here implies VitalCV verified the
 * employer. Calm-glass, employer (source-green) persona.
 */

import { useCallback, useEffect, useState } from 'react';
import { Reveal } from '@/components/motion/Reveal';

interface Opportunity {
  id: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange?: string | null;
  requirementLevel: string;
  description?: string | null;
  remote: boolean;
  status: string;
  createdAt?: string;
}

const HIRING_TYPES = [
  { value: 'perm', label: 'Permanent' },
  { value: 'locums', label: 'Locums' },
  { value: 'travel', label: 'Travel' },
  { value: 'telehealth', label: 'Telehealth' },
  { value: 'per_diem', label: 'Per diem' },
] as const;

const REQUIREMENT_LEVELS = [
  { value: 'L1', label: 'Registry identity', hint: 'NPPES match' },
  { value: 'L2', label: 'License + exclusion', hint: 'State board + OIG' },
  { value: 'L3', label: 'Full source-verified', hint: 'All primary sources' },
] as const;

// These drive real MATCHA scoring (employer-fit + urgency). Values match the
// engine's enums exactly.
const EMPLOYER_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'practice', label: 'Practice / group' },
  { value: 'health_system', label: 'Health system' },
  { value: 'telehealth', label: 'Telehealth' },
  { value: 'agency', label: 'Staffing agency' },
] as const;

const START_URGENCIES = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'within_2_weeks', label: 'Within 2 weeks' },
  { value: 'within_month', label: 'Within a month' },
  { value: 'flexible', label: 'Flexible' },
] as const;

const HIRING_LABEL: Record<string, string> = Object.fromEntries(
  HIRING_TYPES.map((h) => [h.value, h.label]),
);

export default function EmployerPostPage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [title, setTitle] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [hiringType, setHiringType] = useState<string>('perm');
  const [state, setState] = useState('');
  const [payRange, setPayRange] = useState('');
  const [payMin, setPayMin] = useState('');
  const [payMax, setPayMax] = useState('');
  const [employerType, setEmployerType] = useState<string>('hospital');
  const [startUrgency, setStartUrgency] = useState<string>('flexible');
  const [requirementLevel, setRequirementLevel] = useState('L1');
  const [description, setDescription] = useState('');
  const [remote, setRemote] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [posted, setPosted] = useState(false);

  // org-setup fallback (shown only when a post fails for lack of an org)
  const [needsOrg, setNeedsOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgSaving, setOrgSaving] = useState(false);

  const loadOpps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employer/opportunities', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { opportunities?: Opportunity[] };
        setOpps(data.opportunities ?? []);
      }
    } catch {
      /* leave list as-is; the form still works */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOpps();
  }, [loadOpps]);

  function resetForm() {
    setTitle('');
    setSpecialty('');
    setHiringType('perm');
    setState('');
    setPayRange('');
    setPayMin('');
    setPayMax('');
    setEmployerType('hospital');
    setStartUrgency('flexible');
    setRequirementLevel('L1');
    setDescription('');
    setRemote(false);
  }

  function validate(): string | null {
    if (!title.trim()) return 'Add a job title.';
    if (!specialty.trim()) return 'Add a specialty.';
    if (!hiringType) return 'Choose a hiring type.';
    if (!/^[A-Za-z]{2}$/.test(state.trim())) return 'Enter a 2-letter state (e.g. CA).';
    return null;
  }

  async function postJob(): Promise<{ ok: boolean; noOrg?: boolean; error?: string }> {
    const res = await fetch('/api/employer/opportunities', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        specialty: specialty.trim(),
        hiringType,
        state: state.trim().toUpperCase(),
        payRange: payRange.trim() || undefined,
        payMin: payMin.trim() ? Number(payMin.trim()) : undefined,
        payMax: payMax.trim() ? Number(payMax.trim()) : undefined,
        employerType,
        startUrgency,
        requirementLevel,
        description: description.trim() || undefined,
        remote,
      }),
    });
    if (res.ok) return { ok: true };
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    const msg = d.error ?? `Couldn't post (${res.status}).`;
    const noOrg = res.status === 404 || /organization/i.test(msg);
    return { ok: false, noOrg, error: msg };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setFormError(v);
      return;
    }
    setFormError('');
    setSaving(true);
    const r = await postJob();
    setSaving(false);
    if (r.ok) {
      setPosted(true);
      resetForm();
      void loadOpps();
      window.setTimeout(() => setPosted(false), 4000);
      return;
    }
    if (r.noOrg) {
      setNeedsOrg(true);
      return;
    }
    setFormError(r.error ?? 'Post failed.');
  }

  async function setupOrgThenPost(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) {
      setFormError('Add your organization name.');
      return;
    }
    setFormError('');
    setOrgSaving(true);
    try {
      const res = await fetch('/api/employer/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim() }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `Org setup failed (${res.status}).`);
      }
      // Org is set up — retry the post.
      const r = await postJob();
      if (r.ok) {
        setNeedsOrg(false);
        setPosted(true);
        resetForm();
        void loadOpps();
        window.setTimeout(() => setPosted(false), 4000);
      } else {
        setFormError(r.error ?? 'Post failed after setup.');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Org setup failed.');
    }
    setOrgSaving(false);
  }

  return (
    <main className="mz mz-paper mz-persona-employer min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Reveal variant="fade">
          <p className="mz-eyebrow">For employers</p>
          <h1 className="mz-display" style={{ marginTop: 14, maxWidth: 640 }}>
            Post a role. <span className="mz-accent">Get matched clinicians.</span>
          </h1>
          <p className="mz-lede" style={{ marginTop: 14, maxWidth: 620 }}>
            Your opening becomes a live listing that VitalCV matches source-backed
            clinicians against by specialty, state, and readiness. A posting is your
            own listing — VitalCV does not verify or endorse the employer.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          {/* ── Post form ─────────────────────────────────────────── */}
          <Reveal delay={60}>
            <form onSubmit={submit} className="mz-card mz-card-pad" noValidate>
              <h2 className="mz-h2">New opening</h2>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mz-eyebrow">Title</span>
                  <input
                    className="mz-input mt-1.5"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Family Medicine Physician"
                  />
                </label>

                <label className="block">
                  <span className="mz-eyebrow">Specialty</span>
                  <input
                    className="mz-input mt-1.5"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Family Medicine"
                  />
                </label>

                <div>
                  <span className="mz-eyebrow">Hiring type</span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {HIRING_TYPES.map((h) => (
                      <button
                        key={h.value}
                        type="button"
                        className="mz-opt"
                        aria-pressed={hiringType === h.value}
                        onClick={() => setHiringType(h.value)}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="block w-28">
                    <span className="mz-eyebrow">State</span>
                    <input
                      className="mz-input mt-1.5 uppercase"
                      value={state}
                      maxLength={2}
                      onChange={(e) => setState(e.target.value.replace(/[^A-Za-z]/g, ''))}
                      placeholder="CA"
                      aria-label="Two-letter state"
                    />
                  </label>
                  <label className="block flex-1 min-w-[10rem]">
                    <span className="mz-eyebrow">Pay range · optional</span>
                    <input
                      className="mz-input mt-1.5"
                      value={payRange}
                      onChange={(e) => setPayRange(e.target.value)}
                      placeholder="$220k–$260k"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="block flex-1 min-w-[8rem]">
                    <span className="mz-eyebrow">Pay min · matching</span>
                    <input
                      className="mz-input mt-1.5"
                      inputMode="numeric"
                      value={payMin}
                      onChange={(e) => setPayMin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="220000"
                      aria-label="Pay minimum for matching"
                    />
                  </label>
                  <label className="block flex-1 min-w-[8rem]">
                    <span className="mz-eyebrow">Pay max · matching</span>
                    <input
                      className="mz-input mt-1.5"
                      inputMode="numeric"
                      value={payMax}
                      onChange={(e) => setPayMax(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="260000"
                      aria-label="Pay maximum for matching"
                    />
                  </label>
                </div>
                <p className="mz-small" style={{ marginTop: -6 }}>
                  Numbers let VitalCV match on comp against what clinicians ask for.
                </p>

                <div>
                  <span className="mz-eyebrow">Employer type</span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {EMPLOYER_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        className="mz-opt"
                        aria-pressed={employerType === t.value}
                        onClick={() => setEmployerType(t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="mz-eyebrow">Start urgency</span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {START_URGENCIES.map((u) => (
                      <button
                        key={u.value}
                        type="button"
                        className="mz-opt"
                        aria-pressed={startUrgency === u.value}
                        onClick={() => setStartUrgency(u.value)}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="mz-eyebrow">Readiness required to apply</span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {REQUIREMENT_LEVELS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        className="mz-opt"
                        aria-pressed={requirementLevel === r.value}
                        onClick={() => setRequirementLevel(r.value)}
                        title={r.hint}
                      >
                        {r.value} · {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="mz-eyebrow">Description · optional</span>
                  <textarea
                    className="mz-input mt-1.5"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What the role involves, team, schedule…"
                  />
                </label>

                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={remote}
                    onChange={(e) => setRemote(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="mz-body">Remote / telehealth eligible</span>
                </label>
              </div>

              {formError ? (
                <p role="alert" className="mz-small mt-4" style={{ color: 'var(--p0)' }}>
                  {formError}
                </p>
              ) : null}
              {posted ? (
                <p className="mz-small mt-4" style={{ color: 'var(--ok)' }}>
                  Posted — it's live and matchable now.
                </p>
              ) : null}

              {needsOrg ? (
                <div className="mz-inset mt-5 p-4">
                  <p className="mz-h2">Set up your organization to post</p>
                  <p className="mz-small mt-1">
                    One-time — the name your openings post under.
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="block flex-1 min-w-[12rem]">
                      <span className="mz-eyebrow">Organization name</span>
                      <input
                        className="mz-input mt-1.5"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Bay Area Cardiac Group"
                      />
                    </label>
                    <button
                      type="button"
                      className="mz-btn"
                      disabled={orgSaving}
                      onClick={setupOrgThenPost}
                    >
                      {orgSaving ? 'Setting up…' : 'Set up & post'}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="submit" className="mz-btn mt-5" disabled={saving}>
                  {saving ? 'Posting…' : 'Post opening'}
                </button>
              )}
            </form>
          </Reveal>

          {/* ── Your openings ─────────────────────────────────────── */}
          <Reveal delay={120}>
            <section aria-label="Your openings">
              <h2 className="mz-h2">Your openings</h2>
              {loading ? (
                <p className="mz-small mt-3">Loading…</p>
              ) : opps.length === 0 ? (
                <p className="mz-small mt-3">
                  No openings yet — post one and it appears here, matchable
                  immediately.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {opps.map((o) => (
                    <li key={o.id} className="mz-card mz-card-pad">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="mz-h2">{o.title}</h3>
                        <span
                          className={`mz-chip ${o.status === 'ACTIVE' ? 'mz-chip-ok' : 'mz-chip-unknown'}`}
                        >
                          <span className="mz-gl" aria-hidden />
                          {o.status}
                        </span>
                      </div>
                      <p className="mz-small mt-1">
                        {o.specialty} · {HIRING_LABEL[o.hiringType] ?? o.hiringType} ·{' '}
                        {o.state}
                        {o.remote ? ' · Remote' : ''}
                        {o.payRange ? ` · ${o.payRange}` : ''}
                      </p>
                      {o.description ? (
                        <p className="mz-body mt-2">{o.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Reveal>
        </div>
      </div>
    </main>
  );
}
