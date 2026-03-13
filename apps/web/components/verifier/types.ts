export interface PASCredential {
  type: string;
  issuer: { id: string; name: string };
  issuance_date: string;
  expiration_date: string;
  credential_subject: Record<string, any>;
  evidence: Array<{
    type: string;
    psv_source?: string;
    verified_at?: string;
    raw_hash?: string;
  }>;
}

export interface PASPsvReceipt {
  source_type: string;
  source_name: string;
  retrieved_at: string;
  signature: {
    algorithm: string;
    payload_hash: string;
  };
  key_id: string;
}

export interface PASObject {
  schema: string;
  generated_at: string;
  npi_checksum: string;
  subject: { npi: string; name: string };
  authority_state: {
    status: 'GREEN' | 'YELLOW' | 'RED';
    as_of: string;
    score: number;
    band: 'GREEN' | 'YELLOW' | 'RED';
    changes_since_last: 'NONE' | 'SCORE_CHANGE' | 'STATUS_CHANGE' | 'NEW_CREDENTIALS';
  };
  credentials: PASCredential[];
  psv_receipts: PASPsvReceipt[];
  audit_trail_pointer: {
    merkle_root: string | null;
    latest_artifact_id: string;
    snapshot_count: number;
    generated_at: string;
  };
}
