// VitalCV · Trust Surfaces · Canonical types
// These mirror the backend trust ontology. Match field names exactly when wiring real data.

export type TrustState = "preview" | "snapshot" | "signed";

export type OwnerState = "subject" | "delegated" | "unbound";

export type TrustTier = "T1" | "T2" | "T3" | "T4";

export type ReplayState = "anchored" | "pending" | "none";

export type FailureMode = "A" | "B" | "C" | "D" | "E";
// A = source unreachable
// B = anonymous restriction
// C = infrastructure outage (VitalCV-side)
// D = no adverse findings (success, NOT failure — desired outcome of an exclusion check)
// E = issuer unavailable (signing path)

export type ChipVariant = "solid" | "outline" | "dashed" | "dotted";

/** A single asserted claim about a subject. */
export interface Claim {
  /** the OBJECT — the claim itself, e.g. "CA medical license · A-148293" */
  object: string;
  /** short descriptor under the object, e.g. "active · no board action" */
  objectSub?: string;

  /** ownership semantics — who asserted */
  ownership: OwnerState;

  /** when the source was consulted */
  checkedAtIso: string; // UTC ISO-like — e.g. "2026-05-11T14:31:58Z"
  /** relative age string e.g. "10 s ago" — produced by lib/trust/format.ts */
  checkedAgo: string;

  /** the SOURCE — registry / authority */
  source: string;
  sourceSub?: string;

  /** trust tier */
  tier: TrustTier;

  /** receipt produced by this check */
  receiptId: string; // e.g. "#48,214"
  receiptHash: string; // e.g. "7a2c…b8d3"

  /** stale-but-signed — set by the source-fetch layer */
  degraded?: boolean;

  /** affirmative-negative — exclusion list returned 0 records (Mode D) */
  noAdverseFindings?: boolean;
}

/** The header anchor — the canonical reading order, rendered top + bottom. */
export interface Lineage {
  state: TrustState;
  /** OBJECT · the subject of the surface (e.g. "Mira Chen, MD · NPI 1356428912") */
  object: string;
  objectSub?: string;
  /** OWNERSHIP · holder-of-record */
  ownership: OwnerState;
  /** CHECKED_AT · most recent source-of-record check */
  checkedAtIso: string;
  checkedAgo: string;
  /** CHANNEL · zone the artifact was rendered through */
  channel: string; // e.g. "verify.vitalcv.health"
  /** REPLAY · re-verifiability state */
  replay: ReplayState;
  /** RUN_ID · batch hash this rendering was produced under */
  runId: string;
}

/** Signer continuity facts — rendered by <SignaturePanel />. */
export interface SignerContinuity {
  did: string; // e.g. "did:web:vitalcv.health"
  activeKeyFingerprint: string; // short, ellipsised e.g. "4f2a · 91c5 · 7e08 · b8d3"
  activeKeyInServiceDays: number;
  activeKeyRotationDays: number; // e.g. 365
  didDocumentUrl: string; // e.g. "/.well-known/did.json"
  statusListUrl: string; // e.g. "vitalcv.health/status/v1/list.jsonld"
  backupKeyFingerprint: string;
  backupKeyArmed: boolean;
  quorumRequired: number;
  quorumAvailable: number;
}

/** A node in the replay chain. */
export interface ChainNode {
  hash: string; // short e.g. "7a2c…b8d3"
  isHead?: boolean;
}

/** The verdict line — single sentence + supporting line counts. */
export interface Verdict {
  state: "verifiable" | "degraded" | "anonymous-restricted" | "outage" | "issuer-unavailable" | "no-adverse-findings";
  headline: string; // shown in the dark pill — e.g. "Verifiable"
  facts: string[]; // pipe-separated body — e.g. ["4 of 4 lanes signed", "3 fresh · 1 stale", "0 revocations"]
  readTime?: string; // e.g. "≈ 30 s"
}

/** A failure mode banner. */
export interface FailureBannerData {
  mode: FailureMode;
  title: string;
  cause: string;
  owner: string;
  cta?: { label: string; href?: string };
}

/** A row in the holder's replay timeline. */
export interface ReplayCheck {
  whenIso: string;
  whenAgo: string; // e.g. "7 d ago"
  what: string;
  whatSub: string;
  receiptId: string;
  prevHash: string;
  degraded?: boolean;
  current?: boolean;
}
