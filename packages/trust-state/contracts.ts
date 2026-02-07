/** YC MVP — behavior frozen. Do not modify without scope approval. */
export type TrustBand = 'GREEN' | 'YELLOW' | 'RED';

export type BlockingReason =
  | 'MISSING_PSV'
  | 'EXPIRED_PSV'
  | 'REVOKED_PSV'
  | 'MISSING_ACCEPTANCE'
  | 'CRS_BELOW_THRESHOLD'
  | 'START_ALREADY_ATTESTED';

export type TrustState = {
  clinician_id: string;
  start_ready: boolean;
  score: number;
  band: TrustBand;
  blocking_reasons: BlockingReason[];
  last_verified_at: string;
  audit_ref: string;
  metrics: {
    latency_ms: number;
    p90_ms: number;
    verification_latency_ms: number;
  };
  linked_employers_count?: number;
  linked_clinicians_count?: number;
  timeline_preview?: readonly TrustTimelinePreviewEntry[];
};

export type TrustTimelinePreviewEntry = {
  event_type: string;
  occurred_at: string;
};

export type TrustStateScope = {
  employer_id: string;
  facility_id: string;
  role: string;
};

export type PsvReceiptRecord = {
  receipt_id: string;
  fetched_at: string;
  ttl_seconds: number;
  revoked: boolean;
};

export type AcceptanceScopeRecord = {
  clinician_id: string;
  employer_id: string;
  facility_id: string;
  role: string;
  accepted_at: string;
  acceptance_id?: string;
  hash_anchor?: string;
  hashAnchor?: string;
  employer_proof?: AcceptanceProofRecord;
  employerProof?: AcceptanceProofRecord;
};

export type AcceptanceProofRecord = {
  type: string;
  verificationMethod: string;
  proofValue: string;
};

export type StartScopeRecord = {
  clinician_id: string;
  employer_id: string;
  facility_id: string;
  role: string;
  attested_at: string;
  start_id?: string;
};

export type CrsResult = {
  clinician_id: string;
  score: number;
  band: TrustBand;
  blocking_reasons: string[];
  last_verified_at: string;
};

export type TrustStateAuditEvent =
  | {
      event_type: 'TRUST_STATE_CHECK';
      clinician_id: string;
      occurred_at: string;
      metadata: {
        start_ready: boolean;
        score: number;
        band: TrustBand;
        blocking_reasons: BlockingReason[];
        metrics: {
          latency_ms: number;
          p90_ms: number;
          p50_ms: number;
          p99_ms: number;
          bucket_counts: {
            p50: number;
            p90: number;
            p99: number;
          };
          verification_latency_ms: number;
          crs_band: TrustBand;
          blocking_reason_count: number;
        };
      };
    }
  | {
      event_type: 'TRUST_STATE_DECAY';
      clinician_id: string;
      occurred_at: string;
      metadata: {
        receipt_id: string;
        previous_band: TrustBand;
        new_band: 'RED';
        detected_at: string;
        status: 'EXPIRED' | 'REVOKED';
      };
    };

export type TrustStateResolverDependencies = {
  crs: {
    computeForClinician(input: { clinician_id: string; as_of: string }): Promise<CrsResult> | CrsResult;
  };
  receipts: {
    listByClinician(clinician_id: string): Promise<PsvReceiptRecord[]> | PsvReceiptRecord[];
  };
  acceptances: {
    existsForClinician(clinician_id: string): Promise<boolean> | boolean;
    listByClinician?(clinician_id: string):
      | Promise<AcceptanceScopeRecord[]>
      | AcceptanceScopeRecord[];
    existsForScope?(scope: TrustStateScope & { clinician_id: string }): Promise<boolean> | boolean;
  };
  starts: {
    existsForClinician(clinician_id: string): Promise<boolean> | boolean;
    listByClinician?(clinician_id: string): Promise<StartScopeRecord[]> | StartScopeRecord[];
    existsForScope?(scope: TrustStateScope & { clinician_id: string }): Promise<boolean> | boolean;
  };
  audit: {
    append(event: TrustStateAuditEvent): Promise<{ audit_packet_id: string }> | { audit_packet_id: string };
  };
  trust_graph?: {
    listEmployersForClinician?(clinician_id: string): Promise<EmployerLink[]> | EmployerLink[];
    listCliniciansForEmployer?(employer_id: string): Promise<string[]> | string[];
  };
  audit_timeline?: {
    buildTimeline(
      clinician_id: string,
      options?: {
        limit?: number;
      },
    ): Promise<readonly TrustTimelinePreviewEntry[]> | readonly TrustTimelinePreviewEntry[];
  };
  latency_histogram?: {
    record(latencyMs: number): {
      p50_ms: number;
      p90_ms: number;
      p99_ms: number;
      bucket_counts: {
        p50: number;
        p90: number;
        p99: number;
      };
    };
  };
  now?: () => Date;
};

export type EmployerLink = {
  employer_id: string;
  facility_id: string;
  role: string;
};
