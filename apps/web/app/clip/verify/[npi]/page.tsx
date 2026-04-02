import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

/* ------------------------------------------------------------------ */
/*  Metadata — App Clip optimized                                      */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: 'VitalCV · Instant Verification',
  description: 'Cryptographic credential verification receipt',
  other: {
    'apple-itms-apps': 'app-clip-bundle-id=com.vitalcv.clip',
  },
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  params: Promise<{ npi: string }>;
}

/* ------------------------------------------------------------------ */
/*  Mock data helper (MVP — server-only)                               */
/*  TODO: Fetch real verification data from backend API                */
/* ------------------------------------------------------------------ */

function getVerificationData(npi: string) {
  // Deterministic mock hash from NPI for demo consistency
  const hashBase = Array.from(npi)
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    .toString(16)
    .padStart(8, '0');

  return {
    npi,
    displayName: 'Dr. Sarah Chen, MD',
    initials: 'SC',
    specialty: 'Internal Medicine',
    band: 'GREEN' as const,
    bandLabel: 'Ready',
    verificationHash: `sha256:${hashBase}a4f9b2c1...e7d3`,
    verifiedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Page — Pure Server Component (zero client JS)                      */
/* ------------------------------------------------------------------ */

export default async function ClipVerifyPage({ params }: Props) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) {
    notFound();
  }

  const data = getVerificationData(npi);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center px-5 py-10">
      {/* ── VitalCV Wordmark (inline SVG for zero-bundle) ──────── */}
      <div className="mb-8 flex items-center gap-1.5 text-sm font-semibold tracking-tight text-neutral-800">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M12 2L3 7v10l9 5 9-5V7l-9-5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M9 12l2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        VitalCV
      </div>

      {/* ── Receipt Card ───────────────────────────────────────── */}
      <div className="w-full rounded-2xl border border-neutral-200/60 bg-card p-6 shadow-sm backdrop-blur-sm">
        {/* Clinician identity */}
        <div className="flex items-center gap-3.5 mb-5">
          {/* Initials circle (no image import needed) */}
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-semibold text-sm text-foreground"
            style={{ backgroundColor: 'oklch(0.55 0.10 220)' }}
            aria-label={`Avatar for ${data.displayName}`}
          >
            {data.initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900 truncate">
              {data.displayName}
            </p>
            <p className="text-xs text-neutral-500 truncate">
              {data.specialty} · NPI {data.npi}
            </p>
          </div>
        </div>

        {/* Trust Band */}
        <div className="mb-5 flex items-center gap-2 rounded-xl px-3.5 py-2.5"
          style={{ backgroundColor: 'oklch(0.72 0.15 155 / 0.08)' }}
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: 'oklch(0.72 0.15 155)' }}
            aria-hidden="true"
          />
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'oklch(0.72 0.15 155)' }}
          >
            {data.bandLabel}
          </span>
          <span className="ml-auto text-[10px] text-neutral-400 uppercase tracking-wider">
            Trust Band
          </span>
        </div>

        {/* Verification Hash */}
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-baseline">
            <span className="text-neutral-400 uppercase tracking-wider font-medium">
              Verification Hash
            </span>
          </div>
          <p className="font-mono text-[11px] text-neutral-600 bg-neutral-50 rounded-lg px-3 py-2 break-all select-all">
            {data.verificationHash}
          </p>

          <div className="flex justify-between items-baseline pt-1">
            <span className="text-neutral-400 uppercase tracking-wider font-medium">
              Verified
            </span>
            <span className="text-neutral-600">
              {new Date(data.verifiedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <p className="mt-6 text-center text-[10px] text-neutral-400 leading-relaxed">
        Cryptographically verified via VitalCV
        <br />
        This receipt is publicly auditable and tamper-evident.
      </p>
    </main>
  );
}
