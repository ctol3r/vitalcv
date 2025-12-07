-- Batch 76: Database migrations for FHIR↔VC 2.0, EUDI Wallet, AI Governance, TEFCA

-- WalletEvent: EUDI Wallet mode tracking (remote/proximity)
CREATE TABLE IF NOT EXISTS "WalletEvent" (
  id SERIAL PRIMARY KEY,
  npi VARCHAR(10) NOT NULL,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('remote', 'proximity')),
  provider VARCHAR(255),
  certified_eudi BOOLEAN DEFAULT false,
  ts TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_wallet_event_npi ON "WalletEvent"(npi);
CREATE INDEX IF NOT EXISTS idx_wallet_event_ts ON "WalletEvent"(ts);
CREATE INDEX IF NOT EXISTS idx_wallet_event_mode ON "WalletEvent"(mode);

-- GovernanceEvent: AI governance monitoring (bias/accuracy metrics)
CREATE TABLE IF NOT EXISTS "GovernanceEvent" (
  id SERIAL PRIMARY KEY,
  model_id VARCHAR(255) NOT NULL,
  model_version VARCHAR(255) NOT NULL,
  accuracy NUMERIC(5,4),
  bias_score NUMERIC(5,4),
  owner VARCHAR(255),
  ts TIMESTAMP DEFAULT NOW(),
  metrics JSONB
);

CREATE INDEX IF NOT EXISTS idx_governance_event_model ON "GovernanceEvent"(model_id, model_version);
CREATE INDEX IF NOT EXISTS idx_governance_event_ts ON "GovernanceEvent"(ts);
CREATE INDEX IF NOT EXISTS idx_governance_event_owner ON "GovernanceEvent"(owner);

-- CredentialQA: Credential quality assurance data for AI governance
CREATE TABLE IF NOT EXISTS "CredentialQA" (
  id SERIAL PRIMARY KEY,
  npi VARCHAR(10),
  model_id VARCHAR(255) NOT NULL,
  model_version VARCHAR(255) NOT NULL,
  predicted_label TEXT,
  ground_truth_label TEXT,
  demographic_group VARCHAR(50),
  confidence NUMERIC(5,4),
  owner VARCHAR(255),
  ts TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_credential_qa_model ON "CredentialQA"(model_id, model_version);
CREATE INDEX IF NOT EXISTS idx_credential_qa_npi ON "CredentialQA"(npi);
CREATE INDEX IF NOT EXISTS idx_credential_qa_ts ON "CredentialQA"(ts);
CREATE INDEX IF NOT EXISTS idx_credential_qa_demographic ON "CredentialQA"(demographic_group);

-- TEFCADirectory: TEFCA directory entries with FHIR R6 resources
CREATE TABLE IF NOT EXISTS "TEFCADirectory" (
  npi VARCHAR(10) PRIMARY KEY,
  practitioner JSONB,
  endpoint JSONB,
  provenance JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tefca_directory_updated ON "TEFCADirectory"(updated_at);

-- CredentialOffer: OIDC4VCI credential offers (if not exists)
CREATE TABLE IF NOT EXISTS "CredentialOffer" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_type VARCHAR(255) NOT NULL,
  subject_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credential_offer_status ON "CredentialOffer"(status);
CREATE INDEX IF NOT EXISTS idx_credential_offer_subject ON "CredentialOffer"(subject_id);

-- IssuedCredential: OIDC4VCI issued credentials (if not exists)
CREATE TABLE IF NOT EXISTS "IssuedCredential" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES "CredentialOffer"(id),
  subject_id VARCHAR(255) NOT NULL,
  credential JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issued_credential_offer ON "IssuedCredential"(offer_id);
CREATE INDEX IF NOT EXISTS idx_issued_credential_subject ON "IssuedCredential"(subject_id);

