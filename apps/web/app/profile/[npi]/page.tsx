/**
 * /profile/[npi] — the clinician-published public career profile.
 *
 * This page exists ONLY when the holder has set their career profile to
 * public (selfAttested.sharing.careerProfile === 'public'); otherwise 404.
 * It is the shareable "beautiful career profile" artifact: identity resolved
 * at the source, the clinician's self-attested career story clearly labeled
 * as self-attested, and a path to the full source-backed verification record
 * at /verify/[npi]. Provenance honesty: self-attested content is never
 * presented as source-checked, and no status renders a bare "Verified".
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBackendBase } from '@/lib/api';

export const dynamic = 'force-dynamic';

const NPI_RE = /^\d{10}$/;

interface PublicCareerProfile {
  npi: string;
  firstName: string | null;
  lastName: string | null;
  specialty: string | null;
  stateOfPractice: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  selfAttested: {
    contact?: { practiceEmail?: string; practicePhone?: string; practiceWebsite?: string };
    medicalSchool?: { institutionName?: string; degree?: string; graduationYear?: number };
    subspecialty?: string;
    workHistory?: Array<{ employer: string; role?: string; startYear?: number; endYear?: number }>;
    affiliations?: Array<{ organization: string; role?: string }>;
    careerGoals?: string;
    researchSummary?: string;
  };
  updatedAt: string | null;
}

interface PassportIdentity {
  identityVerified: boolean;
  licensureStatus: string;
  exclusionStatus: string;
}

async function fetchCareerProfile(npi: string): Promise<PublicCareerProfile | null> {
  try {
    const res = await fetch(`${getBackendBase()}/api/profile/public/${npi}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { shared?: boolean; profile?: PublicCareerProfile };
    return body.shared && body.profile ? body.profile : null;
  } catch {
    return null;
  }
}

/** Best-effort source-coverage summary; the page renders honestly without it. */
async function fetchPassportIdentity(npi: string): Promise<PassportIdentity | null> {
  try {
    const res = await fetch(`${getBackendBase()}/api/passport/npi/${npi}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, unknown>;
    const trust = (body.trustState ?? body) as Record<string, unknown>;
    return {
      identityVerified: trust.identityVerified === true,
      licensureStatus: typeof trust.licensureStatus === 'string' ? trust.licensureStatus : 'unknown',
      exclusionStatus: typeof trust.exclusionStatus === 'string' ? trust.exclusionStatus : 'UNCHECKED',
    };
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ npi: string }> },
): Promise<Metadata> {
  const { npi } = await params;
  if (!NPI_RE.test(npi)) return { title: 'Career Profile' };
  const profile = await fetchCareerProfile(npi);
  if (!profile) return { title: 'Career Profile' };
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || `NPI ${npi}`;
  return {
    title: `${name} — Career Profile`,
    description: `Clinician-published career profile, backed by the VitalCV career evidence wallet.`,
  };
}

function yearsLabel(start?: number, end?: number): string | null {
  if (!start && !end) return null;
  return `${start ?? '…'} – ${end ?? 'present'}`;
}

export default async function PublicCareerProfilePage(
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;
  if (!NPI_RE.test(npi)) notFound();

  const profile = await fetchCareerProfile(npi);
  if (!profile) notFound();

  const passport = await fetchPassportIdentity(npi);
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || `NPI ${npi}`;
  const sa = profile.selfAttested ?? {};
  const links = [
    profile.linkedinUrl ? { label: 'LinkedIn', href: profile.linkedinUrl } : null,
    profile.portfolioUrl ? { label: 'Portfolio', href: profile.portfolioUrl } : null,
    sa.contact?.practiceWebsite ? { label: 'Practice site', href: sa.contact.practiceWebsite } : null,
  ].filter((l): l is { label: string; href: string } => l !== null);

  const chips: string[] = [];
  if (passport?.identityVerified) chips.push('Identity source-backed · NPPES');
  if (passport && passport.licensureStatus === 'active') chips.push('Licensure active on record');
  if (passport && passport.exclusionStatus === 'CLEAR') chips.push('Exclusions checked · OIG');

  return (
    <div className="vcv-doc min-h-screen">
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-10">
        <p className="vcv-mono text-[10px] uppercase tracking-[0.22em] vcv-muted">
          Career profile · shared by the clinician
        </p>

        {/* Identity card */}
        <section className="vcv-panel mt-4 p-6">
          <h1 className="text-3xl" style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}>
            {name}
          </h1>
          <p className="vcv-mono mt-2 text-sm vcv-muted">
            {[profile.specialty, profile.stateOfPractice].filter(Boolean).join(' · ') || 'Clinician'}
          </p>
          <p className="vcv-mono mt-1 text-xs vcv-muted">NPI {profile.npi}</p>
          {chips.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="vcv-mono rounded-full border px-3 py-1 text-[11px]"
                  style={{ borderColor: 'var(--paper-edge)' }}
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
          {sa.subspecialty ? (
            <p className="mt-4 text-sm">Subspecialty: {sa.subspecialty}</p>
          ) : null}
          {links.length > 0 ? (
            <p className="mt-3 flex flex-wrap gap-4 text-sm">
              {links.map((l) => (
                <a key={l.label} href={l.href} rel="noopener noreferrer nofollow" target="_blank" className="underline underline-offset-4">
                  {l.label}
                </a>
              ))}
            </p>
          ) : null}
        </section>

        {/* Self-attested career story */}
        <section className="vcv-panel mt-5 p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg" style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}>
              Career history
            </h2>
            <span className="vcv-mono text-[10px] uppercase tracking-[0.18em] vcv-muted">
              Self-attested by the clinician
            </span>
          </div>

          {sa.medicalSchool?.institutionName ? (
            <div className="mt-4">
              <p className="vcv-mono text-[10px] uppercase tracking-[0.18em] vcv-muted">Education</p>
              <p className="mt-1 text-sm">
                {sa.medicalSchool.institutionName}
                {sa.medicalSchool.degree ? ` — ${sa.medicalSchool.degree}` : ''}
                {sa.medicalSchool.graduationYear ? ` (${sa.medicalSchool.graduationYear})` : ''}
              </p>
            </div>
          ) : null}

          {sa.workHistory && sa.workHistory.length > 0 ? (
            <div className="mt-4">
              <p className="vcv-mono text-[10px] uppercase tracking-[0.18em] vcv-muted">Experience</p>
              <ul className="mt-1 space-y-2">
                {sa.workHistory.map((row, i) => (
                  <li key={`${row.employer}-${i}`} className="text-sm">
                    <span className="font-medium">{row.employer}</span>
                    {row.role ? ` — ${row.role}` : ''}
                    {yearsLabel(row.startYear, row.endYear) ? (
                      <span className="vcv-mono vcv-muted"> · {yearsLabel(row.startYear, row.endYear)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {sa.affiliations && sa.affiliations.length > 0 ? (
            <div className="mt-4">
              <p className="vcv-mono text-[10px] uppercase tracking-[0.18em] vcv-muted">Affiliations</p>
              <ul className="mt-1 space-y-1">
                {sa.affiliations.map((row, i) => (
                  <li key={`${row.organization}-${i}`} className="text-sm">
                    {row.organization}
                    {row.role ? ` — ${row.role}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {sa.careerGoals ? (
            <div className="mt-4">
              <p className="vcv-mono text-[10px] uppercase tracking-[0.18em] vcv-muted">Career direction</p>
              <p className="mt-1 text-sm">{sa.careerGoals}</p>
            </div>
          ) : null}

          {sa.researchSummary ? (
            <div className="mt-4">
              <p className="vcv-mono text-[10px] uppercase tracking-[0.18em] vcv-muted">Research</p>
              <p className="mt-1 text-sm">{sa.researchSummary}</p>
            </div>
          ) : null}

          {!sa.medicalSchool?.institutionName
            && (!sa.workHistory || sa.workHistory.length === 0)
            && (!sa.affiliations || sa.affiliations.length === 0)
            && !sa.careerGoals
            && !sa.researchSummary ? (
            <p className="mt-4 text-sm vcv-muted">
              This clinician hasn&apos;t published career details yet.
            </p>
          ) : null}
        </section>

        {/* Provenance + the source-backed record */}
        <section className="vcv-panel mt-5 p-6">
          <h2 className="text-lg" style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}>
            What&apos;s behind this profile
          </h2>
          <p className="mt-2 text-sm vcv-muted">
            Career history above is self-attested by the clinician and is not
            source-checked. Identity, licensure, and exclusion signals come from
            primary sources and live on the verification record.
          </p>
          <Link
            href={`/verify/${profile.npi}`}
            className="vcv-mono mt-4 inline-block rounded-[6px] border px-4 py-2 text-xs uppercase tracking-[0.14em]"
            style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }}
          >
            View the source-backed record →
          </Link>
        </section>

        <p className="vcv-mono mt-6 text-center text-[10px] uppercase tracking-[0.18em] vcv-muted">
          Published by the clinician via VitalCV · sharing can be turned off anytime
        </p>
      </main>
    </div>
  );
}
