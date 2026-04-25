/**
 * ClinicianProfileSections — Wave LIVE-100B rich profile MVP+.
 *
 * Renders sixteen profile sections under the passport view with a
 * provenance badge on every user-visible field. The badges use the
 * shared vocabulary in lib/profile/provenance.ts:
 *
 *   VERIFIED     — source-of-record backed (NPPES, OIG LEIE, PECOS,
 *                  state board lane where live)
 *   USER_ENTERED — typed by the clinician; never PSV
 *   INFERRED     — derived (publication matching, taxonomy heuristics);
 *                  never a verified claim
 *   UNKNOWN      — no data; neutral, not evidence of absence
 *   CONFLICT     — two or more sources disagree; surface, do not pick
 *
 * Design rules:
 *   - NPPES identity is not license proof. Identity section is
 *     VERIFIED for NPPES-backed fields only; license fields live
 *     under Licenses / Board certifications with their own provenance.
 *   - User-entered med school / residency / fellowship is always
 *     USER_ENTERED until a registrar source attaches a receipt.
 *   - Inferred research / publications are INFERRED, never VERIFIED.
 *   - Every section is rendered even when empty, so reviewers see
 *     the shape of the profile and the honest gaps.
 */

import * as React from 'react';
import type { PassportData } from '@/lib/trust/passport-contract';
import {
  PROVENANCE_META,
  normalizeFieldProvenance,
  type ProfileProvenance,
} from '@/lib/profile/provenance';

export interface ClinicianProfileSectionsProps {
  passport: PassportData;
  /** Optional extension data for fields not yet modelled in PassportData. */
  extended?: Partial<ExtendedProfileData>;
  className?: string;
}

/**
 * Extended profile fields that are not yet carried on PassportData.
 * Kept as an optional input so the live route can render the full
 * shape today without forcing a backend contract change.
 */
export interface ExtendedProfileData {
  contact: {
    practiceEmail?: string | null;
    practicePhone?: string | null;
    practiceWebsite?: string | null;
  };
  medicalSchool: {
    institutionName?: string | null;
    degree?: string | null;
    graduationYear?: number | null;
  };
  researchSummary: string | null;
  publicationsCount: number | null;
  documentsCount: number | null;
  careerGoals: string | null;
  affiliations: Array<{ organization: string; role?: string | null }>;
  workHistory: Array<{
    employer: string;
    role?: string | null;
    startYear?: number | null;
    endYear?: number | null;
  }>;
}

function ProvenanceBadge({ provenance }: { provenance: ProfileProvenance }) {
  const meta = PROVENANCE_META[provenance];
  return (
    <span
      title={meta.description}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${meta.badgeClass}`}
      data-provenance={provenance}
    >
      {meta.label}
    </span>
  );
}

function Field({
  label,
  value,
  provenance,
}: {
  label: string;
  value: string | number | null | undefined;
  provenance: ProfileProvenance;
}) {
  const { display, provenance: resolved } = normalizeFieldProvenance(value, provenance);
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between gap-y-1">
      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </span>
      <span className="flex items-center gap-2 text-sm text-foreground/90">
        <span className="break-words">{display}</span>
        <ProvenanceBadge provenance={resolved} />
      </span>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`profile-${id}`}
      data-testid={`profile-section-${id}`}
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <header className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground/80">{description}</p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function EmptyList({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground/70">{label}</span>
      <ProvenanceBadge provenance="UNKNOWN" />
    </div>
  );
}

function isSourceBackedVerificationLevel(level: string | null | undefined): boolean {
  return level === 'PRIMARY_SOURCE'
    || level === 'PRIMARY_SOURCE_VERIFICATION'
    || level === 'SOURCE_VERIFIED'
    || level === 'CRYPTOGRAPHICALLY_SIGNED';
}

export function ClinicianProfileSections({
  passport,
  extended,
  className,
}: ClinicianProfileSectionsProps): React.ReactElement {
  const wrapperClass = className
    ? `mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${className}`
    : 'mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3';

  const licences = passport.authority?.credentials.filter((c) => c.domain === 'LICENSURE') ?? [];
  const boards = passport.authority?.credentials.filter((c) => c.domain === 'BOARD_CERTIFICATION') ?? [];
  const trainingRecords = passport.training?.records ?? [];
  const residencyRecords = trainingRecords.filter((r) => /residency/i.test(r.recordType));
  const fellowshipRecords = trainingRecords.filter((r) => /fellowship/i.test(r.recordType));

  return (
    <div className={wrapperClass} data-testid="clinician-profile-sections">
      <Section
        id="identity"
        title="Identity"
        description="Backed by NPPES public registry fields. Does not confirm licensure."
      >
        <Field label="Display name" value={passport.identity?.displayName} provenance="VERIFIED" />
        <Field label="NPI" value={passport.npi ?? passport.identity?.npi ?? null} provenance="VERIFIED" />
        <Field label="Entity type" value={passport.identity?.entityType} provenance="VERIFIED" />
        <Field label="NPPES status" value={passport.identity?.status} provenance="VERIFIED" />
      </Section>

      <Section
        id="contact"
        title="Contact"
        description="User-entered practice contact details. Not primary source verified."
      >
        <Field label="Practice email" value={extended?.contact?.practiceEmail ?? null} provenance="USER_ENTERED" />
        <Field label="Practice phone" value={extended?.contact?.practicePhone ?? null} provenance="USER_ENTERED" />
        <Field label="Practice website" value={extended?.contact?.practiceWebsite ?? null} provenance="USER_ENTERED" />
      </Section>

      <Section
        id="locations"
        title="Practice locations"
        description="Addresses listed on NPPES for the NPI. Address accuracy is NPPES-dependent."
      >
        <EmptyList label="No NPPES practice addresses hydrated on this passport yet." />
      </Section>

      <Section
        id="specialty"
        title="Specialty"
        description="NPPES primary taxonomy. Specialty claim, not a board-certification claim."
      >
        <Field label="Primary specialty" value={passport.identity?.specialty} provenance="VERIFIED" />
      </Section>

      <Section
        id="subspecialty"
        title="Subspecialty"
        description="Secondary taxonomy or self-declared subspecialty. User-entered until a board source attaches evidence."
      >
        <EmptyList label="No subspecialty declared." />
      </Section>

      <Section
        id="medical-school"
        title="Medical school"
        description="User-entered until a registrar source attaches a receipt. NPPES does not confirm this field."
      >
        <Field label="Institution" value={extended?.medicalSchool?.institutionName ?? null} provenance="USER_ENTERED" />
        <Field label="Degree" value={extended?.medicalSchool?.degree ?? null} provenance="USER_ENTERED" />
        <Field label="Graduation year" value={extended?.medicalSchool?.graduationYear ?? null} provenance="USER_ENTERED" />
      </Section>

      <Section
        id="residency"
        title="Residency"
        description="User-entered training history. Not primary source verified."
      >
        {residencyRecords.length === 0 ? (
          <EmptyList label="No residency records on file." />
        ) : (
          residencyRecords.map((r) => (
            <div key={r.id} className="space-y-1">
              <Field label="Program" value={r.programName ?? r.institutionName ?? null} provenance="USER_ENTERED" />
              <Field label="Specialty" value={r.specialty ?? null} provenance="USER_ENTERED" />
              <Field label="End year" value={r.endYear ?? null} provenance="USER_ENTERED" />
            </div>
          ))
        )}
      </Section>

      <Section
        id="fellowship"
        title="Fellowship"
        description="User-entered. Verification requires a program registrar source."
      >
        {fellowshipRecords.length === 0 ? (
          <EmptyList label="No fellowship records on file." />
        ) : (
          fellowshipRecords.map((r) => (
            <div key={r.id} className="space-y-1">
              <Field label="Program" value={r.programName ?? r.institutionName ?? null} provenance="USER_ENTERED" />
              <Field label="Specialty" value={r.specialty ?? null} provenance="USER_ENTERED" />
              <Field label="End year" value={r.endYear ?? null} provenance="USER_ENTERED" />
            </div>
          ))
        )}
      </Section>

      <Section
        id="board-certifications"
        title="Board certifications"
        description="Claim state mirrors the source adapter. ABMS integration is out of scope for the current wedge."
      >
        {boards.length === 0 ? (
          <EmptyList label="No board certifications recorded." />
        ) : (
          boards.map((b) => (
            <div key={b.id} className="space-y-1">
              <Field label="Issuer" value={b.issuerName ?? b.issuerEntityId ?? null} provenance={isSourceBackedVerificationLevel(b.verificationLevel) ? 'VERIFIED' : 'USER_ENTERED'} />
              <Field label="Status" value={b.statusLabel ?? b.status} provenance={isSourceBackedVerificationLevel(b.verificationLevel) ? 'VERIFIED' : 'USER_ENTERED'} />
              <Field label="Expires" value={b.expiresAt ?? null} provenance={isSourceBackedVerificationLevel(b.verificationLevel) ? 'VERIFIED' : 'USER_ENTERED'} />
            </div>
          ))
        )}
      </Section>

      <Section
        id="licenses"
        title="Licenses"
        description="State-board coverage depends on the configured pilot lane. Uninstrumented states are an adapter gap, not a verified claim."
      >
        {licences.length === 0 ? (
          <EmptyList label="No licensure records attached for this NPI." />
        ) : (
          licences.map((l) => (
            <div key={l.id} className="space-y-1">
              <Field label="Jurisdiction" value={l.jurisdiction ?? null} provenance={isSourceBackedVerificationLevel(l.verificationLevel) ? 'VERIFIED' : 'USER_ENTERED'} />
              <Field label="Status" value={l.statusLabel ?? l.status} provenance={isSourceBackedVerificationLevel(l.verificationLevel) ? 'VERIFIED' : 'USER_ENTERED'} />
              <Field label="Expires" value={l.expiresAt ?? null} provenance={isSourceBackedVerificationLevel(l.verificationLevel) ? 'VERIFIED' : 'USER_ENTERED'} />
            </div>
          ))
        )}
      </Section>

      <Section
        id="work-history"
        title="Work history"
        description="User-entered employment. Employer and role claims are not primary source verified."
      >
        {(extended?.workHistory ?? []).length === 0 ? (
          <EmptyList label="No employment records on file." />
        ) : (
          (extended?.workHistory ?? []).map((w, idx) => (
            <div key={`${w.employer}-${idx}`} className="space-y-1">
              <Field label="Employer" value={w.employer} provenance="USER_ENTERED" />
              <Field label="Role" value={w.role ?? null} provenance="USER_ENTERED" />
              <Field label="Start" value={w.startYear ?? null} provenance="USER_ENTERED" />
              <Field label="End" value={w.endYear ?? null} provenance="USER_ENTERED" />
            </div>
          ))
        )}
      </Section>

      <Section
        id="affiliations"
        title="Affiliations"
        description="User-entered hospital / group affiliations. Not primary source verified."
      >
        {(extended?.affiliations ?? []).length === 0 ? (
          <EmptyList label="No affiliations declared." />
        ) : (
          (extended?.affiliations ?? []).map((a, idx) => (
            <div key={`${a.organization}-${idx}`} className="space-y-1">
              <Field label="Organization" value={a.organization} provenance="USER_ENTERED" />
              <Field label="Role" value={a.role ?? null} provenance="USER_ENTERED" />
            </div>
          ))
        )}
      </Section>

      <Section
        id="research"
        title="Research"
        description="Inferred from indirect signals (publication matching, taxonomy heuristics). Not verified."
      >
        <Field label="Summary" value={extended?.researchSummary ?? null} provenance="INFERRED" />
      </Section>

      <Section
        id="publications"
        title="Publications"
        description="Publication counts are inferred until a bibliographic registry attaches receipts."
      >
        <Field label="Matched publications" value={extended?.publicationsCount ?? null} provenance="INFERRED" />
      </Section>

      <Section
        id="documents"
        title="Documents"
        description="User-uploaded supporting documents. Upload does not equal verification."
      >
        <Field label="On file" value={extended?.documentsCount ?? null} provenance="USER_ENTERED" />
      </Section>

      <Section
        id="career-goals"
        title="Career goals"
        description="User-entered preference signal. Used for matching, never for verification."
      >
        <Field label="Stated goal" value={extended?.careerGoals ?? null} provenance="USER_ENTERED" />
      </Section>
    </div>
  );
}

export default ClinicianProfileSections;
