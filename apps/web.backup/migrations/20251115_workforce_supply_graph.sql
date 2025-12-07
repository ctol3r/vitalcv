-- Migration: Workforce supply graph primitives
-- Created: 2025-11-15

CREATE TYPE workforce_supply_node_type AS ENUM (
  'CLINICIAN',
  'LICENSE',
  'PRIVILEGE',
  'ORG',
  'STATE',
  'COMPACT',
  'ENROLLMENT',
  'PAYER',
  'EHR_ROLE'
);

CREATE TYPE workforce_supply_relation_type AS ENUM (
  'CAN_PRACTICE_IN',
  'CAN_PERFORM',
  'ELIGIBLE_VIA_COMPACT',
  'COVERED_BY_PAYER',
  'APPROVED_AT_ORG',
  'EHR_ROLE_GRANTED'
);

CREATE TABLE workforce_supply_nodes (
  node_id TEXT PRIMARY KEY,
  node_type workforce_supply_node_type NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workforce_supply_edges (
  source_node_id TEXT NOT NULL REFERENCES workforce_supply_nodes(node_id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES workforce_supply_nodes(node_id) ON DELETE CASCADE,
  relation_type workforce_supply_relation_type NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_node_id, target_node_id, relation_type)
);

CREATE INDEX idx_workforce_supply_nodes_type ON workforce_supply_nodes(node_type);
CREATE INDEX idx_workforce_supply_edges_relation ON workforce_supply_edges(relation_type);
CREATE INDEX idx_workforce_supply_edges_source ON workforce_supply_edges(source_node_id);
CREATE INDEX idx_workforce_supply_edges_target ON workforce_supply_edges(target_node_id);

COMMENT ON TABLE workforce_supply_nodes IS 'Workforce supply graph nodes representing clinicians, licenses, compacts, privileges, enrollments, and EHR roles';
COMMENT ON TABLE workforce_supply_edges IS 'Typed relationships describing how supply nodes connect (practice states, coverage, privileges, and EHR roles)';

