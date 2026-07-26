/**
 * selfAttested — the clinician's USER_ENTERED profile layer.
 *
 * These structured sections (contact, medical school, subspecialty, work
 * history, affiliations, career goals, research) are typed by the clinician and
 * stored as one JSON document on PersonProfile.selfAttested. They are NEVER
 * source-verified: everything here renders with USER_ENTERED provenance and is
 * shared with employers as self-attested information.
 *
 * Read path:  GET  /api/me/workspaces → personProfile.selfAttested
 * Write path: POST /api/profile/self-attested { selfAttested }  (full replace)
 */

import type { ExtendedProfileData } from '@/components/profile/ClinicianProfileSections';

export interface SelfAttestedContact {
  practiceEmail?: string;
  practicePhone?: string;
  practiceWebsite?: string;
}

export interface SelfAttestedEducation {
  institutionName?: string;
  degree?: string;
  graduationYear?: number;
}

export interface SelfAttestedWorkEntry {
  employer: string;
  role?: string;
  startYear?: number;
  endYear?: number;
}

export interface SelfAttestedAffiliation {
  organization: string;
  role?: string;
}

export interface SelfAttestedProfile {
  contact?: SelfAttestedContact;
  medicalSchool?: SelfAttestedEducation;
  subspecialty?: string;
  workHistory?: SelfAttestedWorkEntry[];
  affiliations?: SelfAttestedAffiliation[];
  careerGoals?: string;
  researchSummary?: string;
  /** Clinician-provided Doximity profile URL. Host-validated (doximity.com, https). */
  doximityUrl?: string;
}

/**
 * Accept only a well-formed https doximity.com profile URL. Mirrors the
 * backend `cleanDoximityUrl` so the surface never stores or renders a link
 * that points somewhere other than Doximity.
 */
export function cleanDoximityUrl(value: unknown): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return undefined;
  const host = url.hostname.toLowerCase();
  if (host !== 'doximity.com' && host !== 'www.doximity.com') return undefined;
  return url.toString();
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

function year(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  const y = Math.trunc(n);
  return y >= 1900 && y <= 2100 ? y : undefined;
}

function compact<T extends Record<string, unknown>>(obj: T): T | undefined {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

/**
 * Defensive parse of the self-attested payload read from the workspace. Mirrors
 * the backend sanitizer so the surface never renders a malformed row.
 */
export function parseSelfAttested(payload: unknown): SelfAttestedProfile {
  if (!payload || typeof payload !== 'object') return {};
  const p = payload as Record<string, unknown>;
  const out: SelfAttestedProfile = {};

  const c = (p.contact && typeof p.contact === 'object' ? p.contact : {}) as Record<string, unknown>;
  const contact = compact({
    practiceEmail: str(c.practiceEmail),
    practicePhone: str(c.practicePhone),
    practiceWebsite: str(c.practiceWebsite),
  });
  if (contact) out.contact = contact;

  const s = (p.medicalSchool && typeof p.medicalSchool === 'object' ? p.medicalSchool : {}) as Record<string, unknown>;
  const medicalSchool = compact({
    institutionName: str(s.institutionName),
    degree: str(s.degree),
    graduationYear: year(s.graduationYear),
  });
  if (medicalSchool) out.medicalSchool = medicalSchool;

  const subspecialty = str(p.subspecialty);
  if (subspecialty) out.subspecialty = subspecialty;

  if (Array.isArray(p.workHistory)) {
    const rows = p.workHistory
      .map((raw) => {
        const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        const employer = str(r.employer);
        if (!employer) return null;
        const entry: SelfAttestedWorkEntry = { employer };
        const role = str(r.role);
        if (role) entry.role = role;
        const startYear = year(r.startYear);
        if (startYear !== undefined) entry.startYear = startYear;
        const endYear = year(r.endYear);
        if (endYear !== undefined) entry.endYear = endYear;
        return entry;
      })
      .filter((r): r is SelfAttestedWorkEntry => r !== null);
    if (rows.length > 0) out.workHistory = rows;
  }

  if (Array.isArray(p.affiliations)) {
    const rows = p.affiliations
      .map((raw) => {
        const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        const organization = str(r.organization);
        if (!organization) return null;
        const entry: SelfAttestedAffiliation = { organization };
        const role = str(r.role);
        if (role) entry.role = role;
        return entry;
      })
      .filter((r): r is SelfAttestedAffiliation => r !== null);
    if (rows.length > 0) out.affiliations = rows;
  }

  const careerGoals = str(p.careerGoals);
  if (careerGoals) out.careerGoals = careerGoals;

  const researchSummary = str(p.researchSummary);
  if (researchSummary) out.researchSummary = researchSummary;

  const doximityUrl = cleanDoximityUrl(p.doximityUrl);
  if (doximityUrl) out.doximityUrl = doximityUrl;

  return out;
}

/**
 * Project the self-attested layer onto the ExtendedProfileData shape the
 * read-only ClinicianProfileSections grid consumes, so saved values render with
 * their USER_ENTERED badges. Fields the self-attested layer doesn't own
 * (publications, documents) stay null.
 */
export function selfAttestedToExtended(sa: SelfAttestedProfile): Partial<ExtendedProfileData> {
  return {
    contact: {
      practiceEmail: sa.contact?.practiceEmail ?? null,
      practicePhone: sa.contact?.practicePhone ?? null,
      practiceWebsite: sa.contact?.practiceWebsite ?? null,
    },
    medicalSchool: {
      institutionName: sa.medicalSchool?.institutionName ?? null,
      degree: sa.medicalSchool?.degree ?? null,
      graduationYear: sa.medicalSchool?.graduationYear ?? null,
    },
    researchSummary: sa.researchSummary ?? null,
    careerGoals: sa.careerGoals ?? null,
    affiliations: (sa.affiliations ?? []).map((a) => ({ organization: a.organization, role: a.role ?? null })),
    workHistory: (sa.workHistory ?? []).map((w) => ({
      employer: w.employer,
      role: w.role ?? null,
      startYear: w.startYear ?? null,
      endYear: w.endYear ?? null,
    })),
  };
}

/** True when the clinician has saved anything in the self-attested layer. */
export function hasSelfAttestedContent(sa: SelfAttestedProfile): boolean {
  return Object.keys(sa).length > 0;
}

/** Count of filled self-attested sections, for the "N sections added" summary. */
export function countSelfAttestedSections(sa: SelfAttestedProfile): number {
  let n = 0;
  if (sa.contact) n += 1;
  if (sa.medicalSchool) n += 1;
  if (sa.subspecialty) n += 1;
  if (sa.workHistory?.length) n += 1;
  if (sa.affiliations?.length) n += 1;
  if (sa.careerGoals) n += 1;
  if (sa.researchSummary) n += 1;
  return n;
}
