// ============================================================
// Wave 1B — NPPES Primary-Source Adapter
// ============================================================

import type { ProviderType } from "../types/psv";
import type { PsvAdapter, NormalizedCredentialPayload } from "./types";

const NPPES_ENDPOINT =
  "https://npiregistry.cms.hhs.gov/api/?version=2.1&number=";

// ── Taxonomy → ProviderType mapping ─────────────────────────

const TAXONOMY_MAP: Record<string, ProviderType> = {
  "363L00000X": "NP", // Nurse Practitioner
  "363LF0000X": "NP", // Nurse Practitioner - Family
  "363LP0200X": "NP", // Nurse Practitioner - Pediatrics
  "363LA2200X": "NP", // Nurse Practitioner - Adult Health
  "363LC1500X": "NP", // Nurse Practitioner - Community Health
  "363LP0808X": "NP", // Nurse Practitioner - Psych/Mental Health
  "163W00000X": "RN", // Registered Nurse
  "163WA0400X": "RN", // Registered Nurse - Addiction
  "163WP0808X": "RN", // Registered Nurse - Psych/Mental Health
  "207R00000X": "MD", // Internal Medicine
  "207Q00000X": "MD", // Family Medicine
  "208D00000X": "MD", // General Practice
  "2084P0800X": "MD", // Psychiatry
  "207V00000X": "MD", // Obstetrics & Gynecology
  "208600000X": "MD", // Surgery
  "208000000X": "MD", // Pediatrics
  "207RC0000X": "MD", // Cardiovascular Disease
  "208100000X": "DO", // Physical Medicine & Rehabilitation (often DO)
  "363A00000X": "PA", // Physician Assistant
  "367500000X": "CRNA", // Certified Registered Nurse Anesthetist
  "103T00000X": "Psychologist", // Psychologist
  "103TA0400X": "Psychologist", // Psychologist - Addiction
  "103TC0700X": "Psychologist", // Psychologist - Clinical
  "1223G0001X": "Dentist", // General Practice of Dentistry
  "122300000X": "Dentist", // Dentist
  "225100000X": "PT", // Physical Therapist
  "225X00000X": "OT", // Occupational Therapist
  "183500000X": "Pharmacist", // Pharmacist
};

function inferProviderType(taxonomyCode: string | undefined): ProviderType {
  if (!taxonomyCode) return "Other";
  return TAXONOMY_MAP[taxonomyCode] ?? "Other";
}

// ── NPPES response shapes (subset) ──────────────────────────

interface NppesTaxonomy {
  code: string;
  desc: string;
  primary: boolean;
  state: string;
  license: string;
}

interface NppesAddress {
  address_1: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  address_purpose: string; // "LOCATION" | "MAILING"
}

interface NppesBasic {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  organization_name?: string;
  enumeration_date: string;
  status: string; // "A" = Active
  enumeration_type: string; // "NPI-1" | "NPI-2"
}

interface NppesResult {
  number: string;
  basic: NppesBasic;
  taxonomies: NppesTaxonomy[];
  addresses: NppesAddress[];
}

interface NppesApiResponse {
  result_count: number;
  results: NppesResult[];
}

// ── Error ────────────────────────────────────────────────────

export class NppesLookupError extends Error {
  constructor(
    public readonly npi: string,
    public readonly reason: "NOT_FOUND" | "EMPTY_RESPONSE" | "API_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "NppesLookupError";
  }
}

// ── Adapter ──────────────────────────────────────────────────

export const NppesAdapter: PsvAdapter = {
  adapterName: "NPPES",

  supportedProviderTypes: [
    "NP",
    "RN",
    "MD",
    "DO",
    "PA",
    "CRNA",
    "Psychologist",
    "Dentist",
    "PT",
    "OT",
    "Pharmacist",
    "Other",
  ],

  supportedCredentialTypes: ["License"],

  async verify({ npi }): Promise<NormalizedCredentialPayload> {
    const url = `${NPPES_ENDPOINT}${encodeURIComponent(npi)}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new NppesLookupError(
        npi,
        "API_ERROR",
        `NPPES API returned HTTP ${res.status}`,
      );
    }

    const body = (await res.json()) as NppesApiResponse;

    if (!body.results || body.results.length === 0 || body.result_count === 0) {
      throw new NppesLookupError(
        npi,
        "NOT_FOUND",
        `NPI ${npi} not found in NPPES registry`,
      );
    }

    const result = body.results[0];
    const { basic, taxonomies, addresses } = result;

    // Primary taxonomy (or first available)
    const primaryTax =
      taxonomies?.find((t) => t.primary) ?? taxonomies?.[0] ?? undefined;
    const taxonomyCode = primaryTax?.code ?? "";

    // Practice address (prefer LOCATION, fall back to first)
    const practiceAddr =
      addresses?.find((a) => a.address_purpose === "LOCATION") ??
      addresses?.[0];
    const practiceState = practiceAddr?.state ?? "";

    // Full name
    const fullName =
      basic.enumeration_type === "NPI-2" && basic.organization_name
        ? basic.organization_name
        : [basic.first_name, basic.middle_name, basic.last_name]
            .filter(Boolean)
            .join(" ");

    // Status mapping
    const status = basic.status === "A" ? "Active" : "Unknown";

    return {
      provider: {
        npi: result.number,
        taxonomyCode,
        providerType: inferProviderType(taxonomyCode || undefined),
        fullName,
        stateOfPractice: practiceState,
      },
      credential: {
        credentialType: "License",
        credentialIdentifier: result.number,
        issuingStateOrBody: practiceState,
        status,
        issueDate: basic.enumeration_date ?? undefined,
        expirationDate: undefined,
      },
      source: {
        sourceName: "NPPES",
        sourceType: "API",
        sourceEndpoint:
          "https://npiregistry.cms.hhs.gov/api/?version=2.1",
        sourceRecognition: "PrimarySource",
      },
      retrieval: {
        retrievedAtUtc: new Date().toISOString(),
        retrievalMethod: "API",
        rawPayload: body,
      },
    };
  },
};
