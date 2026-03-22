'use client';

/**
 * /verifier/company — Organization Profile Setup
 * Employers set up their org profile here before posting opportunities.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';

const FACILITY_TYPES = ['hospital', 'health_system', 'practice', 'staffing_agency', 'telehealth', 'clinic', 'other'];
const SPECIALTIES = ['Cardiology', 'Emergency Medicine', 'Family Medicine', 'Internal Medicine', 'Neurology', 'OB/GYN', 'Oncology', 'Orthopedics', 'Pediatrics', 'Psychiatry', 'Radiology', 'Surgery', 'Urology', 'Other'];
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const HIRING_TYPES = ['locums', 'perm', 'telehealth', 'contract', 'per_diem'];

type Phase = 'loading' | 'form' | 'saving' | 'saved' | 'error';

type EmployerProfileResponse = {
  name?: string;
  facilityType?: string;
  specialties?: string[];
  statesCovered?: string[];
  hiringTypes?: string[];
  tagline?: string;
  description?: string;
  website?: string;
  pilotMode?: boolean;
  organizationAcceptanceRules?: {
    acceptL3CredentialsAutomatically?: boolean;
    requirePsvOnlyForGaps?: boolean;
  };
  trustAcceptanceContracts?: {
    triggerDecisionCapsuleOnHire?: boolean;
  };
  automationRules?: {
    enabled?: boolean;
    minReadinessScore?: number;
    requiredCredentials?: string[];
    readyToInterviewThreshold?: number;
    autoAcceptThreshold?: number | null;
    notifyEmployer?: boolean;
    notifyClinician?: boolean;
  };
};

function serializeCredentialList(value: string[] | undefined): string {
  return Array.isArray(value) ? value.join(', ') : '';
}

function parseCredentialList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry, index, values) => entry.length > 0 && values.indexOf(entry) === index);
}

export default function VerifierCompanyPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [name, setName] = useState('');
  const [facilityType, setFacilityType] = useState('hospital');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [statesCovered, setStatesCovered] = useState<string[]>([]);
  const [hiringTypes, setHiringTypes] = useState<string[]>([]);
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [pilotMode, setPilotMode] = useState(false);
  const [acceptL3Automatically, setAcceptL3Automatically] = useState(false);
  const [requirePsvOnlyForGaps, setRequirePsvOnlyForGaps] = useState(false);
  const [triggerDecisionCapsuleOnHire, setTriggerDecisionCapsuleOnHire] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [minReadinessScore, setMinReadinessScore] = useState('60');
  const [readyToInterviewThreshold, setReadyToInterviewThreshold] = useState('85');
  const [autoAcceptThreshold, setAutoAcceptThreshold] = useState('');
  const [requiredCredentials, setRequiredCredentials] = useState('');
  const [notifyEmployer, setNotifyEmployer] = useState(true);
  const [notifyClinician, setNotifyClinician] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/employer/profile')
      .then(r => r.ok ? r.json() : null)
      .then((data: EmployerProfileResponse | null) => {
        if (data) {
          setName(data.name ?? '');
          setFacilityType(data.facilityType ?? 'hospital');
          setSpecialties(data.specialties ?? []);
          setStatesCovered(data.statesCovered ?? []);
          setHiringTypes(data.hiringTypes ?? []);
          setTagline(data.tagline ?? '');
          setDescription(data.description ?? '');
          setWebsite(data.website ?? '');
          setPilotMode(data.pilotMode ?? false);
          setAcceptL3Automatically(data.organizationAcceptanceRules?.acceptL3CredentialsAutomatically ?? false);
          setRequirePsvOnlyForGaps(data.organizationAcceptanceRules?.requirePsvOnlyForGaps ?? false);
          setTriggerDecisionCapsuleOnHire(data.trustAcceptanceContracts?.triggerDecisionCapsuleOnHire ?? false);
          setAutomationEnabled(data.automationRules?.enabled ?? false);
          setMinReadinessScore(String(data.automationRules?.minReadinessScore ?? 60));
          setReadyToInterviewThreshold(String(data.automationRules?.readyToInterviewThreshold ?? 85));
          setAutoAcceptThreshold(
            typeof data.automationRules?.autoAcceptThreshold === 'number'
              ? String(data.automationRules.autoAcceptThreshold)
              : '',
          );
          setRequiredCredentials(serializeCredentialList(data.automationRules?.requiredCredentials));
          setNotifyEmployer(data.automationRules?.notifyEmployer !== false);
          setNotifyClinician(data.automationRules?.notifyClinician !== false);
        }
        setPhase('form');
      })
      .catch(() => setPhase('form'));
  }, []);

  function toggle<T>(list: T[], item: T, setter: (v: T[]) => void) {
    setter(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  }

  async function handleSave() {
    if (!name.trim()) { setError('Organization name is required.'); return; }
    setError('');
    setPhase('saving');
    try {
      const res = await fetch('/api/employer/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          facilityType,
          specialties,
          statesCovered,
          hiringTypes,
          tagline,
          description,
          website,
          pilotMode,
          organizationAcceptanceRules: {
            acceptL3CredentialsAutomatically: acceptL3Automatically,
            requirePsvOnlyForGaps,
          },
          trustAcceptanceContracts: {
            triggerDecisionCapsuleOnHire,
          },
          automationRules: {
            enabled: automationEnabled,
            minReadinessScore: Number(minReadinessScore) || 0,
            requiredCredentials: parseCredentialList(requiredCredentials),
            readyToInterviewThreshold: Number(readyToInterviewThreshold) || 0,
            autoAcceptThreshold: autoAcceptThreshold.trim().length > 0
              ? Number(autoAcceptThreshold)
              : null,
            notifyEmployer,
            notifyClinician,
          },
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `Save failed (${res.status})`);
      }
      setPhase('saved');
      setTimeout(() => router.push('/verifier/opportunities'), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setPhase('form');
    }
  }

  if (phase === 'loading') return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-7 w-7 text-vt-neutral-500 animate-spin" />
    </div>
  );

  if (phase === 'saved') return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-vt-success mx-auto" />
        <p className="text-white font-semibold">Profile saved. Taking you to post your first opportunity…</p>
      </div>
    </div>
  );

  return (
    <>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Breadcrumb items={[{ label: 'Employer Dashboard', href: '/verifier/home' }, { label: 'Organization Profile' }]} className="mb-6" />
        <header className="mb-8 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-vt-info/10 flex items-center justify-center ring-1 ring-vt-info/20">
            <Building2 className="h-5 w-5 text-vt-info" />
          </div>
          <div>
            <h1 className="heading-lg text-white">Organization Profile</h1>
            <p className="body-sm text-vt-neutral-200">Clinicians see this before applying.</p>
          </div>
        </header>

        <div className="space-y-6">
          {/* Name */}
          <Field label="Organization Name" required>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Bay Area Medical Center" className={INPUT} />
          </Field>

          {/* Tagline */}
          <Field label="Tagline" hint="One line — what makes you great to work for">
            <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Where great clinicians come to grow." className={INPUT} />
          </Field>

          {/* Facility type */}
          <Field label="Facility Type">
            <select value={facilityType} onChange={e => setFacilityType(e.target.value)} className={INPUT}>
              {FACILITY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>

          {/* Specialties */}
          <Field label="Specialties You Hire" hint="Select all that apply">
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map(s => (
                <button key={s} type="button" onClick={() => toggle(specialties, s, setSpecialties)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${specialties.includes(s) ? 'bg-vt-info/20 border-vt-info text-vt-info' : 'border-vt-neutral-800 text-vt-neutral-200 hover:border-vt-neutral-700'}`}>
                  {s}
                </button>
              ))}
            </div>
          </Field>

          {/* States */}
          <Field label="States Covered" hint="Where you hire">
            <div className="flex flex-wrap gap-1.5">
              {STATES.map(s => (
                <button key={s} type="button" onClick={() => toggle(statesCovered, s, setStatesCovered)}
                  className={`rounded px-2.5 py-1 text-xs font-mono font-medium border transition ${statesCovered.includes(s) ? 'bg-vt-success/20 border-vt-success text-vt-success' : 'border-vt-neutral-800 text-vt-neutral-800 hover:border-vt-neutral-700 hover:text-vt-neutral-200'}`}>
                  {s}
                </button>
              ))}
            </div>
          </Field>

          {/* Hiring types */}
          <Field label="Hiring Types">
            <div className="flex flex-wrap gap-2">
              {HIRING_TYPES.map(t => (
                <button key={t} type="button" onClick={() => toggle(hiringTypes, t, setHiringTypes)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${hiringTypes.includes(t) ? 'bg-vt-warning/20 border-vt-warning text-vt-warning' : 'border-vt-neutral-800 text-vt-neutral-200 hover:border-vt-neutral-700'}`}>
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </Field>

          {/* Description */}
          <Field label="About Your Organization" hint="Optional — shown on your employer page">
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe your facility, culture, and what makes you a great employer for clinicians." className={`${INPUT} resize-none`} />
          </Field>

          {/* Website */}
          <Field label="Website">
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourfacility.com" className={INPUT} />
          </Field>

          <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-base/70 p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white">Pilot Readiness Mode</h2>
              <p className="mt-1 text-xs text-vt-neutral-200">
                Configure how your organization accepts high-trust clinicians during pilot onboarding.
              </p>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-xl border border-vt-neutral-800 px-4 py-3">
                <input type="checkbox" checked={pilotMode} onChange={e => setPilotMode(e.target.checked)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Enable pilot mode</p>
                  <p className="mt-1 text-xs text-vt-neutral-200">Turns on pilot acceptance rules and hire-time capsule automation.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-vt-neutral-800 px-4 py-3">
                <input type="checkbox" checked={acceptL3Automatically} onChange={e => setAcceptL3Automatically(e.target.checked)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Accept L3 credentials automatically</p>
                  <p className="mt-1 text-xs text-vt-neutral-200">Auto-accept clinicians whose latest trust snapshot is already at L3.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-vt-neutral-800 px-4 py-3">
                <input type="checkbox" checked={requirePsvOnlyForGaps} onChange={e => setRequirePsvOnlyForGaps(e.target.checked)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Require PSV only for gaps</p>
                  <p className="mt-1 text-xs text-vt-neutral-200">Escalate only the missing evidence instead of re-running PSV on fully backed artifacts.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-vt-neutral-800 px-4 py-3">
                <input type="checkbox" checked={triggerDecisionCapsuleOnHire} onChange={e => setTriggerDecisionCapsuleOnHire(e.target.checked)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Trigger Decision Capsule on hire</p>
                  <p className="mt-1 text-xs text-vt-neutral-200">Create a hospital-specific decision capsule automatically when a hire is attested to start.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-base/70 p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white">Hiring Automation Rules</h2>
              <p className="mt-1 text-xs text-vt-neutral-200">
                Configure recommendation thresholds and workflow fan-out for employer-facing automation.
              </p>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-xl border border-vt-neutral-800 px-4 py-3">
                <input type="checkbox" checked={automationEnabled} onChange={e => setAutomationEnabled(e.target.checked)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Enable hiring automation</p>
                  <p className="mt-1 text-xs text-vt-neutral-200">Generates hiring recommendations, queue routing, and employer workflow metadata in real time.</p>
                </div>
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Minimum readiness">
                  <input value={minReadinessScore} onChange={e => setMinReadinessScore(e.target.value)} inputMode="numeric" className={INPUT} />
                </Field>
                <Field label="Interview threshold">
                  <input value={readyToInterviewThreshold} onChange={e => setReadyToInterviewThreshold(e.target.value)} inputMode="numeric" className={INPUT} />
                </Field>
                <Field label="Auto-accept preview threshold" hint="Optional">
                  <input value={autoAcceptThreshold} onChange={e => setAutoAcceptThreshold(e.target.value)} inputMode="numeric" placeholder="90" className={INPUT} />
                </Field>
              </div>

              <Field label="Required credentials" hint="Comma-separated labels used by the automation engine">
                <textarea
                  value={requiredCredentials}
                  onChange={e => setRequiredCredentials(e.target.value)}
                  rows={3}
                  placeholder="Active CA license, Board certification, DEA registration"
                  className={`${INPUT} resize-none`}
                />
              </Field>

              <label className="flex items-start gap-3 rounded-xl border border-vt-neutral-800 px-4 py-3">
                <input type="checkbox" checked={notifyEmployer} onChange={e => setNotifyEmployer(e.target.checked)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Notify employer workflow</p>
                  <p className="mt-1 text-xs text-vt-neutral-200">Marks recommendations as eligible for employer notification and webhook fan-out.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-vt-neutral-800 px-4 py-3">
                <input type="checkbox" checked={notifyClinician} onChange={e => setNotifyClinician(e.target.checked)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Create clinician credential requests</p>
                  <p className="mt-1 text-xs text-vt-neutral-200">Turns missing-credential findings into clinician-facing request workflows instead of passive review notes.</p>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}

          <button onClick={handleSave} disabled={phase === 'saving'}
            className="w-full rounded-xl bg-vt-success px-6 py-3.5 font-semibold text-black hover:bg-vt-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {phase === 'saving' ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>Save Profile & Continue <ChevronRight className="h-4 w-4" /></>}
          </button>
        </div>
      </main>
    </>
  );
}

const INPUT = 'w-full rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-base px-4 py-2.5 text-white placeholder:text-vt-neutral-800 focus:border-vt-info focus:outline-none focus:ring-1 focus:ring-vt-info transition text-sm';

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-white">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
        {hint && <span className="ml-2 text-xs font-normal text-vt-neutral-200">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
