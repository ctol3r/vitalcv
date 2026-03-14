import Link from 'next/link';
import { headers } from 'next/headers';
import PassportShareActions from '@/components/passport/PassportShareActions';

export const dynamic = 'force-dynamic';

const NPI_RE = /^\d{10}$/;

type TrustBand = 'GREEN' | 'YELLOW' | 'RED';

type PassportResponse = {
  npi: string;
  accessMode?: 'public' | 'wallet' | 'selective';
  public: {
    name: string;
    specialty: string;
    providerType: string;
    state: string;
    trustBand: TrustBand;
    readinessScore: number;
    totalCredentials: number;
    activeCredentials: number;
    shareUrl: string;
    embedUrl: string;
  };
  credentials: Array<{
    id: string;
    type: string;
    name: string;
    issuer: string;
    status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED' | 'UNKNOWN';
    verifiedAt: string | null;
    expiresAt: string | null;
    isPublic: boolean;
  }>;
  sanctions?: {
    status: 'CLEAR' | 'FLAGGED' | 'UNKNOWN';
    checkedAt: string | null;
  };
  privileges?: Array<{
    facility: string;
    privilegeType: string;
    status: 'ACTIVE' | 'AT_RISK' | 'REVOKED';
    grantedAt: string | null;
  }>;
  decisions?: Array<{
    id: string;
    decisionType: string;
    status: 'VALID' | 'AT_RISK' | 'INVALID';
    organization: string | null;
    grantedAt: string | null;
  }>;
  meta: {
    methodology: string;
    computedAt: string;
    passportVersion: string;
  };
};

type TrustResponse = {
  npi: string;
  trustBand: TrustBand;
  readinessScore: number;
  readinessStatus: string;
  computedAt: string;
  shareUrl: string;
};

async function getAppOrigin(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  const protocol =
    headerStore.get('x-forwarded-proto')
    ?? (process.env.NODE_ENV === 'development' ? 'http' : 'https');

  if (host) {
    return `${protocol}://${host}`;
  }

  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN
    || process.env.APP_ORIGIN
    || 'http://localhost:3000'
  ).replace(/\/$/, '');
}

async function loadPassportPageData(
  npi: string,
): Promise<{ passport: PassportResponse; trust: TrustResponse } | null> {
  const origin = await getAppOrigin();

  try {
    const [passportRes, trustRes] = await Promise.all([
      fetch(`${origin}/api/passport/${encodeURIComponent(npi)}`, {
        cache: 'no-store',
      }),
      fetch(`${origin}/api/passport/${encodeURIComponent(npi)}/trust`, {
        cache: 'no-store',
      }),
    ]);

    if (passportRes.status === 404 || trustRes.status === 404) {
      return null;
    }

    if (!passportRes.ok || !trustRes.ok) {
      return null;
    }

    return {
      passport: await passportRes.json() as PassportResponse,
      trust: await trustRes.json() as TrustResponse,
    };
  } catch {
    return null;
  }
}

function bandClasses(band: TrustBand): { chip: string; bar: string; track: string } {
  if (band === 'GREEN') {
    return {
      chip: 'border-emerald-400/30 bg-emerald-400/12 text-emerald-200',
      bar: 'bg-emerald-400',
      track: 'bg-emerald-400/12',
    };
  }
  if (band === 'YELLOW') {
    return {
      chip: 'border-amber-400/30 bg-amber-400/12 text-amber-100',
      bar: 'bg-amber-400',
      track: 'bg-amber-400/12',
    };
  }
  return {
    chip: 'border-rose-400/30 bg-rose-400/12 text-rose-100',
    bar: 'bg-rose-400',
    track: 'bg-rose-400/12',
  };
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Pending';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatStatusLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function PassportUnavailable({ npi }: { npi: string }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_38%),linear-gradient(180deg,_#050a14,_#0b1324)] px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-slate-950/55 p-10 text-center shadow-[0_30px_80px_rgba(5,10,20,0.45)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-300/75">
          VitalCV Passport
        </p>
        <h1 className="mt-4 text-3xl font-semibold">passport not available</h1>
        <p className="mt-3 text-sm text-slate-300">
          No public passport is available for NPI {npi}. The clinician may not have a current
          trust snapshot ready for public sharing.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function PassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const npi = id.trim();

  if (!NPI_RE.test(npi)) {
    return <PassportUnavailable npi={npi || 'unknown'} />;
  }

  const data = await loadPassportPageData(npi);
  if (!data) {
    return <PassportUnavailable npi={npi} />;
  }

  const { passport, trust } = data;
  const publicCredentials = passport.credentials.filter((credential) => credential.isPublic);
  const styles = bandClasses(trust.trustBand);
  const scoreWidth = `${Math.max(0, Math.min(trust.readinessScore, 100))}%`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_32%),linear-gradient(180deg,_#050a14,_#0b1324)] px-6 py-10 text-white md:px-8 md:py-14">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-7 shadow-[0_30px_90px_rgba(5,10,20,0.42)] md:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-300/75">
                Portable Clinician Passport
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
                {passport.public.name}
              </h1>
              <p className="mt-3 text-base text-slate-300 md:text-lg">
                {passport.public.specialty} · {passport.public.state} · {passport.public.providerType}
              </p>
              <p className="mt-2 text-sm text-slate-400">NPI {passport.npi}</p>
            </div>

            <div className="w-full max-w-sm rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.2em] ${styles.chip}`}>
                  {trust.trustBand}
                </span>
                <span className="text-sm font-medium text-slate-200">
                  Score {trust.readinessScore}
                </span>
              </div>
              <div className={`mt-4 h-3 overflow-hidden rounded-full ${styles.track}`}>
                <div className={`h-full rounded-full ${styles.bar}`} style={{ width: scoreWidth }} />
              </div>
              <p className="mt-4 text-sm text-slate-300">
                {formatStatusLabel(trust.readinessStatus)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Computed {formatDate(trust.computedAt)}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
              Credentials
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{passport.public.totalCredentials}</p>
            <p className="mt-1 text-sm text-slate-400">Tracked credential artifacts</p>
          </div>
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
              Active
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{passport.public.activeCredentials}</p>
            <p className="mt-1 text-sm text-slate-400">Active public and restricted signals</p>
          </div>
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
              Methodology
            </p>
            <p className="mt-3 text-lg font-semibold text-white">{passport.meta.methodology}</p>
            <p className="mt-1 text-sm text-slate-400">Passport v{passport.meta.passportVersion}</p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-7 md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300/75">
                Public Credentials
              </p>
              <h2 className="mt-3 text-2xl font-semibold">Credential list</h2>
            </div>
            <p className="text-sm text-slate-400">
              Only `isPublic=true` facts are shown on this page.
            </p>
          </div>

          <div className="mt-6 grid gap-4">
            {publicCredentials.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
                No public credentials are available for this passport yet.
              </div>
            ) : (
              publicCredentials.map((credential) => (
                <article
                  key={credential.id}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-white">{credential.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{credential.issuer}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-200">
                      {credential.status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-400 md:grid-cols-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Type</p>
                      <p className="mt-1 text-slate-200">{formatStatusLabel(credential.type)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Verified</p>
                      <p className="mt-1 text-slate-200">{formatDate(credential.verifiedAt)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Expires</p>
                      <p className="mt-1 text-slate-200">{formatDate(credential.expiresAt)}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* ── Sanctions status ─────────────────────────────────────────── */}
        {passport.sanctions && (
          <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-7 md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Sanctions &amp; Exclusions</p>
                <h2 className="mt-2 text-xl font-semibold">OIG / LEIE Status</h2>
              </div>
              <span className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-widest uppercase border ${
                passport.sanctions.status === 'CLEAR'   ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                passport.sanctions.status === 'FLAGGED' ? 'bg-red-500/15 text-red-300 border-red-500/30' :
                'bg-slate-500/15 text-slate-400 border-slate-500/30'
              }`}>
                {passport.sanctions.status === 'CLEAR' ? '✓ Clear' :
                 passport.sanctions.status === 'FLAGGED' ? '⚠ Flagged' : 'Not Checked'}
              </span>
            </div>
            {passport.sanctions.checkedAt && (
              <p className="mt-3 text-xs text-slate-500">Last verified {formatDate(passport.sanctions.checkedAt)}</p>
            )}
          </section>
        )}

        {/* ── Privileges ───────────────────────────────────────────────── */}
        {(passport.privileges?.length ?? 0) > 0 && (
          <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-7 md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-violet-300/75">Privileges</p>
            <h2 className="mt-2 text-xl font-semibold">Hospital &amp; Facility Privileges</h2>
            <div className="mt-5 grid gap-3">
              {passport.privileges!.map((priv, i) => (
                <div key={i} className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-5 py-4">
                  <div>
                    <p className="font-medium text-white">{priv.privilegeType}</p>
                    <p className="mt-0.5 text-sm text-slate-400">{priv.facility}</p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${
                      priv.status === 'ACTIVE'  ? 'bg-emerald-500/15 text-emerald-300' :
                      priv.status === 'AT_RISK' ? 'bg-yellow-500/15 text-yellow-300'  :
                      'bg-red-500/15 text-red-300'
                    }`}>{priv.status}</span>
                    {priv.grantedAt && <p className="mt-1 text-[11px] text-slate-500">{formatDate(priv.grantedAt)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Decision capsules ────────────────────────────────────────── */}
        {(passport.decisions?.length ?? 0) > 0 && (
          <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-7 md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-300/75">Decision History</p>
            <h2 className="mt-2 text-xl font-semibold">Auditable Hiring &amp; Privileging Decisions</h2>
            <div className="mt-5 space-y-3">
              {passport.decisions!.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-5 py-4">
                  <div>
                    <p className="font-medium capitalize text-white">{d.decisionType.toLowerCase().replace(/_/g, ' ')}</p>
                    {d.organization && <p className="mt-0.5 text-sm text-slate-400">{d.organization}</p>}
                    {d.grantedAt && <p className="mt-0.5 text-xs text-slate-500">{formatDate(d.grantedAt)}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${
                    d.status === 'VALID'   ? 'bg-emerald-500/15 text-emerald-300' :
                    d.status === 'AT_RISK' ? 'bg-yellow-500/15 text-yellow-300'  :
                    'bg-red-500/15 text-red-300'
                  }`}>{d.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-7 md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300/75">
              Share And Embed
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Portable verification surfaces</h2>
            <p className="mt-2 text-sm text-slate-400">
              Share the public passport directly or embed the signed SVG badge anywhere you need a lightweight trust signal.
            </p>
            <div className="mt-6">
              <PassportShareActions npi={passport.npi} name={passport.public.name} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-7 md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              Badge Preview
            </p>
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#080e1a] p-4">
              <img
                src={`/api/passport/${encodeURIComponent(passport.npi)}/embed.svg`}
                alt={`${passport.public.name} passport badge`}
                width={320}
                height={80}
                className="h-auto w-full"
              />
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Share URL</p>
                <p className="mt-1 break-all text-slate-200">{passport.public.shareUrl}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Embed URL</p>
                <p className="mt-1 break-all text-slate-200">{passport.public.embedUrl}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
