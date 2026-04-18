/**
 * acceptance-graph.ts
 *
 * Single source of truth for the Acceptance Graph & Predictive Routing
 * wave. Holds the narrow domain types and the demo fixtures that power:
 *
 *   1. Predictive Acceptance Widget   (clinician passport)
 *   2. Facility Policy Overlay         (employer review)
 *   3. Network Consensus Indicator     (employer review)
 *   4. Time-to-Start Leaderboard       (clinician passport)
 *
 * Types are kept flat and serializable so fixtures can later be swapped
 * for a real API without touching the presentation layer.
 */

// ── Facilities ────────────────────────────────────────────────────────

export interface TargetFacility {
  facilityId: string;
  facilityName: string;
  region: string;
  accreditation: ReadonlyArray<"JointCommission" | "DNV" | "CIHQ">;
}

// ── Predictive Acceptance (Feature 1) ─────────────────────────────────

export interface AcceptancePrediction {
  facilityId: string;
  acceptanceProbability: number; // integer 0–100
  estTimeToClear: string; // e.g. "3-5 days"
  policyGap: string | null; // null when nothing is missing
}

// ── Facility Policy (Feature 2) ───────────────────────────────────────

export type PolicyScope = "FEDERAL" | "STATE" | "LOCAL";
export type PolicyStatus = "MET" | "MISSING" | "PENDING";

export interface FacilityPolicyRequirement {
  id: string;
  label: string;
  scope: PolicyScope;
  status: PolicyStatus;
  sourceClause?: string; // citation in the bylaws
}

export interface FacilityPolicy {
  facilityId: string;
  facilityName: string;
  bylawSummary: string;
  requirements: FacilityPolicyRequirement[];
}

// ── Network Consensus (Feature 3) ─────────────────────────────────────

export interface NetworkConsensus {
  accreditationType: string; // "Joint Commission-accredited"
  acceptedCount: number;
  timeframe: string; // "last 90 days"
  packetFingerprint: string; // first 8 chars of sha256 of the packet
  sampleFacilities: string[]; // anonymized / redacted names
}

// ── Leaderboard (Feature 4) ───────────────────────────────────────────

export interface OpenRequisition {
  facilityId: string;
  facilityName: string;
  role: string;
  requiredDelta: string; // what is missing, joined by " · "
  estStartVelocity: string; // display, e.g. "3d"
  estStartDays: number; // integer, for sort
}

// ── Fixture data ──────────────────────────────────────────────────────

export const DEMO_FACILITIES: TargetFacility[] = [
  { facilityId: "FAC-CEDAR-SF", facilityName: "Cedar Health", region: "SF Bay Area", accreditation: ["JointCommission"] },
  { facilityId: "FAC-KAISER-IRV", facilityName: "Kaiser Permanente — Irvine", region: "Orange County", accreditation: ["JointCommission"] },
  { facilityId: "FAC-SUTTER-SAC", facilityName: "Sutter Health — Sacramento", region: "Sacramento Valley", accreditation: ["DNV"] },
  { facilityId: "FAC-DIGNITY-PHX", facilityName: "Dignity Health — Phoenix", region: "Phoenix Metro", accreditation: ["JointCommission"] },
  { facilityId: "FAC-STANFORD", facilityName: "Stanford Hospital", region: "Palo Alto", accreditation: ["JointCommission"] },
];

export const DEMO_ACCEPTANCE_PREDICTIONS: AcceptancePrediction[] = [
  { facilityId: "FAC-CEDAR-SF", acceptanceProbability: 94, estTimeToClear: "3-5 days", policyGap: "Missing: Current PPD Skin Test required by Cedar Health bylaws." },
  { facilityId: "FAC-KAISER-IRV", acceptanceProbability: 88, estTimeToClear: "5-7 days", policyGap: "Missing: Facility-specific HIPAA training (Kaiser P&P 14.3)." },
  { facilityId: "FAC-SUTTER-SAC", acceptanceProbability: 72, estTimeToClear: "9-12 days", policyGap: "Missing: Local background check + BLS re-cert (<2y)." },
  { facilityId: "FAC-DIGNITY-PHX", acceptanceProbability: 61, estTimeToClear: "12-18 days", policyGap: "Missing: AZ state license, facility HIPAA, fit test." },
];

export const DEMO_FACILITY_POLICIES: FacilityPolicy[] = [
  {
    facilityId: "FAC-CEDAR-SF",
    facilityName: "Cedar Health",
    bylawSummary: "Medical Staff Bylaws § 4.2 — PPD skin test, facility HIPAA, and two-peer attestations within 180d of appointment.",
    requirements: [
      { id: "cedar-ppd", label: "Current PPD Skin Test (<1y)", scope: "LOCAL", status: "MISSING", sourceClause: "§4.2(a)" },
      { id: "cedar-hipaa", label: "Facility-specific HIPAA training", scope: "LOCAL", status: "MET", sourceClause: "§4.2(b)" },
      { id: "cedar-peer", label: "Two peer attestations", scope: "LOCAL", status: "MET", sourceClause: "§4.2(c)" },
      { id: "cedar-npdb", label: "NPDB continuous query", scope: "FEDERAL", status: "MET" },
      { id: "cedar-ca-license", label: "CA Medical Board license", scope: "STATE", status: "MET" },
    ],
  },
  {
    facilityId: "FAC-KAISER-IRV",
    facilityName: "Kaiser Permanente — Irvine",
    bylawSummary: "Kaiser P&P 14.3 — facility HIPAA + code-of-conduct attestation refreshed annually; EMR-specific onboarding module required pre-start.",
    requirements: [
      { id: "kaiser-hipaa", label: "Facility-specific HIPAA training", scope: "LOCAL", status: "MISSING", sourceClause: "P&P 14.3" },
      { id: "kaiser-emr", label: "EMR onboarding module (Epic)", scope: "LOCAL", status: "PENDING", sourceClause: "P&P 14.4" },
      { id: "kaiser-conduct", label: "Code-of-conduct attestation", scope: "LOCAL", status: "MET" },
      { id: "kaiser-npdb", label: "NPDB continuous query", scope: "FEDERAL", status: "MET" },
      { id: "kaiser-ca-license", label: "CA Medical Board license", scope: "STATE", status: "MET" },
    ],
  },
  {
    facilityId: "FAC-SUTTER-SAC",
    facilityName: "Sutter Health — Sacramento",
    bylawSummary: "Medical Staff Bylaws § 6 — local background check (vendor-specific), BLS re-cert within 24 months, fit-test for N95.",
    requirements: [
      { id: "sutter-bg", label: "Local background check", scope: "LOCAL", status: "MISSING", sourceClause: "§6.1" },
      { id: "sutter-bls", label: "BLS re-cert (<24m)", scope: "LOCAL", status: "MISSING", sourceClause: "§6.2" },
      { id: "sutter-fit", label: "N95 fit-test", scope: "LOCAL", status: "MET", sourceClause: "§6.3" },
      { id: "sutter-oig", label: "OIG/LEIE exclusion check", scope: "FEDERAL", status: "MET" },
      { id: "sutter-ca-license", label: "CA Medical Board license", scope: "STATE", status: "MET" },
    ],
  },
];

export const DEMO_NETWORK_CONSENSUS: Record<string, NetworkConsensus> = {
  "1234567890": { accreditationType: "Joint Commission-accredited", acceptedCount: 3, timeframe: "last 90 days", packetFingerprint: "0x8f2c3e14", sampleFacilities: ["JC-Facility-A", "JC-Facility-B", "JC-Facility-C"] },
  "1003000126": { accreditationType: "Joint Commission-accredited", acceptedCount: 7, timeframe: "last 60 days", packetFingerprint: "0x3d91e7aa", sampleFacilities: ["JC-Facility-D", "JC-Facility-E"] },
  "9876543210": { accreditationType: "DNV-accredited", acceptedCount: 1, timeframe: "last 120 days", packetFingerprint: "0x61b27f05", sampleFacilities: ["DNV-Facility-F"] },
};

export const DEMO_OPEN_REQUISITIONS: OpenRequisition[] = [
  { facilityId: "FAC-CEDAR-SF", facilityName: "Cedar Health", role: "Attending Hospitalist", requiredDelta: "PPD", estStartVelocity: "3d", estStartDays: 3 },
  { facilityId: "FAC-KAISER-IRV", facilityName: "Kaiser Permanente — Irvine", role: "Hospitalist — Nights", requiredDelta: "Facility HIPAA", estStartVelocity: "5d", estStartDays: 5 },
  { facilityId: "FAC-STANFORD", facilityName: "Stanford Hospital", role: "Locums Hospitalist", requiredDelta: "None", estStartVelocity: "2d", estStartDays: 2 },
  { facilityId: "FAC-SUTTER-SAC", facilityName: "Sutter Health — Sacramento", role: "Internist — Outpatient", requiredDelta: "Local BG · BLS", estStartVelocity: "11d", estStartDays: 11 },
  { facilityId: "FAC-DIGNITY-PHX", facilityName: "Dignity Health — Phoenix", role: "Hospitalist Lead", requiredDelta: "AZ license · HIPAA · Fit-test", estStartVelocity: "18d", estStartDays: 18 },
];

// ── Selectors / small pure helpers ─────────────────────────────────────

export function facilityById(id: string): TargetFacility | undefined {
  return DEMO_FACILITIES.find((f) => f.facilityId === id);
}

export function sortRequisitionsByVelocity(reqs: readonly OpenRequisition[]): OpenRequisition[] {
  return [...reqs].sort((a, b) => a.estStartDays - b.estStartDays);
}

export function requirementsByScope(policy: FacilityPolicy): Record<PolicyScope, FacilityPolicyRequirement[]> {
  const grouped: Record<PolicyScope, FacilityPolicyRequirement[]> = { FEDERAL: [], STATE: [], LOCAL: [] };
  for (const r of policy.requirements) grouped[r.scope].push(r);
  return grouped;
}

export function policyGapCount(policy: FacilityPolicy): number {
  return policy.requirements.filter((r) => r.scope === "LOCAL" && r.status === "MISSING").length;
}
