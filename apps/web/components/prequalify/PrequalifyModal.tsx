'use client';

/**
 * PrequalifyModal — Wave 182: Mercorized Prequalification Shell
 *
 * Sheet-first modal that launches from homepage, /explore, and employer pages.
 * Feature-flagged behind NEXT_PUBLIC_FEATURE_PREQUALIFY_FLOW_V2.
 *
 * Steps:
 *   0. Role selection (Clinician / Employer / Both)
 *   1. Identity bootstrap (NPI entry)
 *   2. Links (LinkedIn / portfolio)
 *   3. Work authorization
 *   4. Credential import
 *   5. Completion ("Ready for Instant Offers")
 */

import { FEATURES } from '@/lib/features';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BriefcaseMedical,
  Building2,
  CheckCircle,
  ChevronRight,
  FileText,
  Layers3,
  Link2,
  ShieldCheck,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'CLINICIAN' | 'VERIFIER' | 'BOTH';

interface StepData {
  role?: Role;
  npi?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  workAuthStatus?: string;
  credentialsImported?: boolean;
}

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 'role',       label: 'Who you are',         icon: Layers3 },
  { id: 'identity',  label: 'NPI / Identity',        icon: ShieldCheck },
  { id: 'links',     label: 'Links',                 icon: Link2 },
  { id: 'work-auth', label: 'Work Authorization',    icon: FileText },
  { id: 'credentials', label: 'Import Credentials', icon: Upload },
  { id: 'complete',  label: 'Done',                  icon: CheckCircle },
] as const;

type StepId = (typeof STEPS)[number]['id'];

// ── Sub-step components ───────────────────────────────────────────────────────

function StepRole({ onNext }: { onNext: (role: Role) => void }) {
  const options: Array<{ role: Role; icon: typeof BriefcaseMedical; title: string; body: string; color: string }> = [
    { role: 'CLINICIAN', icon: BriefcaseMedical, title: "I'm a Clinician", body: "Build your trust passport, get matched, unlock instant offers.", color: 'ring-vt-success/40 hover:ring-vt-success/80' },
    { role: 'VERIFIER',  icon: Building2,         title: "I'm an Employer",  body: "Publish roles, receive prequalified candidates, hire faster.",   color: 'ring-vt-info/40 hover:ring-vt-info/80' },
    { role: 'BOTH',      icon: Layers3,           title: "I'm Both",         body: "Switch between clinician and employer without logging out.",     color: 'ring-vt-warning/40 hover:ring-vt-warning/80' },
  ];
  return (
    <div className="space-y-3">
      <p className="body-sm text-vt-neutral-200 mb-4">How will you use VitalCV?</p>
      {options.map(({ role, icon: Icon, title, body, color }) => (
        <button
          key={role}
          onClick={() => onNext(role)}
          className={`w-full flex items-start gap-4 rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5 text-left ring-1 ring-transparent transition-all ${color}`}
        >
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-vt-neutral-100" />
          <div>
            <p className="heading-sm text-white">{title}</p>
            <p className="body-sm mt-0.5 text-vt-neutral-200">{body}</p>
          </div>
          <ChevronRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-vt-neutral-800" />
        </button>
      ))}
    </div>
  );
}

function StepIdentity({ data, onNext }: { data: StepData; onNext: (npi: string) => void }) {
  const [npi, setNpi] = useState(data.npi ?? '');
  const [error, setError] = useState('');
  const valid = /^\d{10}$/.test(npi);

  const handleSubmit = () => {
    if (!valid) { setError('NPI must be exactly 10 digits.'); return; }
    onNext(npi);
  };

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="pq-npi" className="label mb-2 block text-vt-neutral-200">
          Your NPI (National Provider Identifier)
        </label>
        <input
          id="pq-npi"
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={npi}
          onChange={(e) => { setNpi(e.target.value.replace(/\D/g, '')); setError(''); }}
          placeholder="1234567890"
          className="w-full rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/50 px-4 py-3 body text-white placeholder:text-vt-neutral-800 focus:border-vt-info/60 focus:outline-none focus:ring-1 focus:ring-vt-info/30"
        />
        {error && <p className="body-sm mt-1.5 text-vt-danger">{error}</p>}
        <p className="body-sm mt-2 text-vt-neutral-800">
          We'll look up your public NPPES registry data automatically.
        </p>
      </div>
      {data.role === 'VERIFIER' && (
        <p className="body-sm text-vt-neutral-200 rounded-xl border border-vt-neutral-800 p-4">
          For organizations: enter your Type 2 NPI (group practice / facility).
          VitalCV will detect it automatically.
        </p>
      )}
      <button
        onClick={handleSubmit}
        disabled={!npi}
        className="w-full rounded-xl bg-vt-success py-3 text-sm font-semibold text-black disabled:opacity-40 hover:bg-vt-success/90 transition"
      >
        Verify NPI <ChevronRight className="inline h-4 w-4" />
      </button>
      <button
        onClick={() => onNext('')}
        className="w-full rounded-xl vt-glass py-2.5 text-sm text-vt-neutral-200 hover:text-white transition"
      >
        Skip for now
      </button>
    </div>
  );
}

function StepLinks({ data, onNext }: { data: StepData; onNext: (linkedin: string, portfolio: string) => void }) {
  const [linkedin, setLinkedin] = useState(data.linkedinUrl ?? '');
  const [portfolio, setPortfolio] = useState(data.portfolioUrl ?? '');
  return (
    <div className="space-y-4">
      <p className="body-sm text-vt-neutral-200">Add your professional links to strengthen your profile.</p>
      {[
        { id: 'pq-linkedin',  label: 'LinkedIn',          value: linkedin,  set: setLinkedin,  placeholder: 'https://linkedin.com/in/yourname' },
        { id: 'pq-portfolio', label: 'Portfolio / Other', value: portfolio, set: setPortfolio, placeholder: 'https://yourwebsite.com' },
      ].map(({ id, label, value, set, placeholder }) => (
        <div key={id}>
          <label htmlFor={id} className="label mb-1.5 block text-vt-neutral-200">{label}</label>
          <input
            id={id}
            type="url"
            value={value}
            onChange={(e) => set(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/50 px-4 py-3 body text-white placeholder:text-vt-neutral-800 focus:border-vt-info/60 focus:outline-none focus:ring-1 focus:ring-vt-info/30"
          />
        </div>
      ))}
      <button
        onClick={() => onNext(linkedin, portfolio)}
        className="w-full rounded-xl bg-vt-success py-3 text-sm font-semibold text-black hover:bg-vt-success/90 transition"
      >
        Continue <ChevronRight className="inline h-4 w-4" />
      </button>
      <button onClick={() => onNext('', '')} className="w-full rounded-xl vt-glass py-2.5 text-sm text-vt-neutral-200 hover:text-white transition">
        Skip
      </button>
    </div>
  );
}

function StepWorkAuth({ onNext }: { onNext: (status: string) => void }) {
  const options = [
    { value: 'authorized',    label: 'Authorized to work in the US' },
    { value: 'visa_required', label: 'Visa / sponsorship required' },
    { value: 'other',         label: 'Other / prefer not to say' },
  ];
  return (
    <div className="space-y-3">
      <p className="body-sm text-vt-neutral-200 mb-4">
        Work authorization status is required for most locums and perm placements.
      </p>
      {options.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onNext(value)}
          className="w-full flex items-center justify-between rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 px-5 py-3.5 text-left hover:border-vt-neutral-700 transition-colors"
        >
          <span className="body text-white">{label}</span>
          <ChevronRight className="h-4 w-4 text-vt-neutral-800" />
        </button>
      ))}
    </div>
  );
}

function StepCredentials({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <p className="body-sm text-vt-neutral-200">
        Upload your credentials now or connect them after profile creation.
        VitalCV verifies in the background — no waiting.
      </p>
      <div className="rounded-2xl border-2 border-dashed border-vt-neutral-800 bg-vt-surface-ops-base p-10 text-center">
        <Upload className="mx-auto mb-3 h-8 w-8 text-vt-neutral-800" />
        <p className="heading-sm text-vt-neutral-100">Drop files here</p>
        <p className="body-sm mt-1 text-vt-neutral-800">State license · Board cert · DEA · Malpractice</p>
        <button className="mt-4 rounded-full vt-glass px-5 py-2 text-sm text-vt-neutral-200 hover:text-white transition">
          Browse files
        </button>
      </div>
      <button
        onClick={onNext}
        className="w-full rounded-xl bg-vt-success py-3 text-sm font-semibold text-black hover:bg-vt-success/90 transition"
      >
        Continue <ChevronRight className="inline h-4 w-4" />
      </button>
      <button onClick={onNext} className="w-full rounded-xl vt-glass py-2.5 text-sm text-vt-neutral-200 hover:text-white transition">
        Skip — I'll add credentials later
      </button>
    </div>
  );
}

function StepComplete({ data, onClose }: { data: StepData; onClose: () => void }) {
  return (
    <div className="py-4 text-center space-y-5">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-vt-success/15 ring-2 ring-vt-success/30">
        <Zap className="h-7 w-7 text-vt-success" />
      </div>
      <div>
        <h3 className="heading-lg text-white">
          {data.role === 'VERIFIER' ? 'Employer profile created.' : 'Trust profile created.'}
        </h3>
        <p className="body mt-2 text-vt-neutral-200">
          {data.role === 'VERIFIER'
            ? 'You can now publish opportunities and receive prequalified candidates.'
            : 'Complete credential verification to unlock instant offers from employers.'}
        </p>
      </div>
      <div className="rounded-2xl border border-vt-success/20 bg-vt-success/5 p-5">
        <p className="heading-sm text-vt-success">Ready for Instant Offers</p>
        <p className="body-sm mt-1 text-vt-neutral-200">
          Add verified credentials to skip the application queue entirely.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <a
          href={data.role === 'VERIFIER' ? '/verifier/home' : '/holder/home'}
          className="w-full rounded-xl bg-vt-success py-3 text-center text-sm font-semibold text-black hover:bg-vt-success/90 transition"
        >
          Go to my workspace
        </a>
        <button onClick={onClose} className="w-full rounded-xl vt-glass py-2.5 text-sm text-vt-neutral-200 hover:text-white transition">
          Keep browsing
        </button>
      </div>
    </div>
  );
}

// ── Progress rail ─────────────────────────────────────────────────────────────

function ProgressRail({ steps, current }: { steps: typeof STEPS; current: number }) {
  return (
    <div className="flex items-center gap-1.5" role="list" aria-label="Prequalification steps">
      {steps.map((step, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <div
            key={step.id}
            role="listitem"
            aria-current={active ? 'step' : undefined}
            className={`relative flex-1 h-1 rounded-full transition-all duration-300 ${
              done ? 'bg-vt-success' : active ? 'bg-vt-info' : 'bg-vt-neutral-800'
            }`}
          />
        );
      })}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface PrequalifyModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PrequalifyModal({ open, onClose }: PrequalifyModalProps) {
  const [step, setStep]     = useState(0);
  const [data, setData]     = useState<StepData>({});

  const advance = useCallback(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), []);
  const reset   = useCallback(() => { setStep(0); setData({}); }, []);
  const close   = useCallback(() => { onClose(); setTimeout(reset, 400); }, [onClose, reset]);

  if (!FEATURES.PREQUALIFY_FLOW_V2) return null;

  const currentStep = STEPS[step];
  const isLast      = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ opacity: 0, y: 48, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: 48, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-label="Get Prequalified"
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-lg rounded-t-3xl border border-vt-neutral-800 bg-vt-surface-ops-base px-6 pb-8 pt-6 shadow-2xl md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-3xl"
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="label text-vt-neutral-800">
                  Step {step + 1} of {STEPS.length}
                </p>
                <h2 className="heading-md text-white">
                  {isLast ? 'Profile Created ✨' : currentStep.label}
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="rounded-full p-2 text-vt-neutral-800 hover:bg-vt-surface-ops-raised hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress rail */}
            {!isLast && (
              <div className="mb-6">
                <ProgressRail steps={STEPS} current={step} />
              </div>
            )}

            {/* Step content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{   opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                {step === 0 && (
                  <StepRole onNext={(role) => { setData((d) => ({ ...d, role })); advance(); }} />
                )}
                {step === 1 && (
                  <StepIdentity data={data} onNext={(npi) => { setData((d) => ({ ...d, npi })); advance(); }} />
                )}
                {step === 2 && (
                  <StepLinks data={data} onNext={(linkedin, portfolio) => {
                    setData((d) => ({ ...d, linkedinUrl: linkedin, portfolioUrl: portfolio }));
                    advance();
                  }} />
                )}
                {step === 3 && (
                  <StepWorkAuth onNext={(status) => { setData((d) => ({ ...d, workAuthStatus: status })); advance(); }} />
                )}
                {step === 4 && (
                  <StepCredentials onNext={() => { setData((d) => ({ ...d, credentialsImported: true })); advance(); }} />
                )}
                {step === 5 && (
                  <StepComplete data={data} onClose={close} />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
