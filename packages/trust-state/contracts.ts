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
};

export type PsvReceiptRecord = {
  receipt_id: string;
  fetched_at: string;
  ttl_seconds: number;
  revoked: boolean;
};

export type CrsResult = {
  clinician_id: string;
  score: number;
  band: TrustBand;
  blocking_reasons: string[];
  last_verified_at: string;
};

export type TrustStateAuditEvent = {
  event_type: 'TRUST_STATE_CHECK';
  clinician_id: string;
  occurred_at: string;
  metadata: {
    start_ready: boolean;
    score: number;
    band: TrustBand;
    blocking_reasons: BlockingReason[];
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
  };
  starts: {
    existsForClinician(clinician_id: string): Promise<boolean> | boolean;
  };
  audit: {
    append(event: TrustStateAuditEvent): Promise<{ audit_packet_id: string }> | { audit_packet_id: string };
  };
  now?: () => Date;
};
