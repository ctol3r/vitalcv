-- Wave 272: Durable graph runtime, snapshots, and AI link review substrate.

CREATE TABLE IF NOT EXISTS "graph_nodes" (
  "id" TEXT NOT NULL,
  "canonical_key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "color_group" TEXT NOT NULL,
  "group_key" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "degree" INTEGER NOT NULL DEFAULT 0,
  "in_degree" INTEGER NOT NULL DEFAULT 0,
  "out_degree" INTEGER NOT NULL DEFAULT 0,
  "source_refs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "source_checksum" TEXT,
  "source_updated_at" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_nodes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "graph_nodes_canonical_key_key" UNIQUE ("canonical_key")
);

CREATE INDEX IF NOT EXISTS "graph_nodes_type_idx" ON "graph_nodes"("type");
CREATE INDEX IF NOT EXISTS "graph_nodes_color_group_idx" ON "graph_nodes"("color_group");
CREATE INDEX IF NOT EXISTS "graph_nodes_group_key_idx" ON "graph_nodes"("group_key");
CREATE INDEX IF NOT EXISTS "graph_nodes_active_idx" ON "graph_nodes"("active");
CREATE INDEX IF NOT EXISTS "graph_nodes_source_updated_at_idx" ON "graph_nodes"("source_updated_at");

CREATE TABLE IF NOT EXISTS "graph_edges" (
  "id" TEXT NOT NULL,
  "canonical_key" TEXT NOT NULL,
  "pair_key" TEXT NOT NULL,
  "source_node_id" TEXT NOT NULL,
  "target_node_id" TEXT NOT NULL,
  "edge_type" TEXT NOT NULL,
  "directed" BOOLEAN NOT NULL DEFAULT true,
  "reciprocal" BOOLEAN NOT NULL DEFAULT false,
  "reverse_edge_id" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_by" TEXT NOT NULL,
  "provenance" JSONB NOT NULL DEFAULT '{}',
  "explanation" TEXT,
  "material_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "graph_edges_canonical_key_key" UNIQUE ("canonical_key"),
  CONSTRAINT "graph_edges_source_node_id_fkey"
    FOREIGN KEY ("source_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "graph_edges_target_node_id_fkey"
    FOREIGN KEY ("target_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "graph_edges_reverse_edge_id_fkey"
    FOREIGN KEY ("reverse_edge_id") REFERENCES "graph_edges"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "graph_edges_source_node_id_idx" ON "graph_edges"("source_node_id");
CREATE INDEX IF NOT EXISTS "graph_edges_target_node_id_idx" ON "graph_edges"("target_node_id");
CREATE INDEX IF NOT EXISTS "graph_edges_edge_type_idx" ON "graph_edges"("edge_type");
CREATE INDEX IF NOT EXISTS "graph_edges_status_idx" ON "graph_edges"("status");
CREATE INDEX IF NOT EXISTS "graph_edges_pair_key_idx" ON "graph_edges"("pair_key");
CREATE INDEX IF NOT EXISTS "graph_edges_source_node_id_edge_type_idx" ON "graph_edges"("source_node_id", "edge_type");

CREATE TABLE IF NOT EXISTS "graph_build_runs" (
  "id" TEXT NOT NULL,
  "build_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "requested_by" TEXT,
  "request_fingerprint" TEXT,
  "graph_mode" TEXT,
  "scope_type" TEXT,
  "scope_key" TEXT,
  "target_node_id" TEXT,
  "filter_signature" TEXT,
  "invalidation_reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "summary" JSONB NOT NULL DEFAULT '{}',
  "error_text" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_build_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "graph_build_runs_status_started_at_idx" ON "graph_build_runs"("status", "started_at");
CREATE INDEX IF NOT EXISTS "graph_build_runs_build_type_created_at_idx" ON "graph_build_runs"("build_type", "created_at");
CREATE INDEX IF NOT EXISTS "graph_build_runs_graph_mode_status_idx" ON "graph_build_runs"("graph_mode", "status");
CREATE INDEX IF NOT EXISTS "graph_build_runs_request_fingerprint_status_idx" ON "graph_build_runs"("request_fingerprint", "status");

CREATE TABLE IF NOT EXISTS "graph_snapshots" (
  "id" TEXT NOT NULL,
  "query_signature" TEXT NOT NULL,
  "scope_type" TEXT NOT NULL,
  "scope_key" TEXT NOT NULL,
  "graph_mode" TEXT NOT NULL,
  "focus_node_id" TEXT,
  "depth" INTEGER,
  "filter_signature" TEXT NOT NULL,
  "schema_version" TEXT NOT NULL,
  "node_count" INTEGER NOT NULL DEFAULT 0,
  "edge_count" INTEGER NOT NULL DEFAULT 0,
  "payload_bytes" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB NOT NULL,
  "stats" JSONB NOT NULL DEFAULT '{}',
  "invalidated_at" TIMESTAMP(3),
  "last_invalidation_reason" TEXT,
  "last_invalidation_scope" JSONB,
  "built_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_accessed_at" TIMESTAMP(3),
  "build_run_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "graph_snapshots_query_signature_key" UNIQUE ("query_signature"),
  CONSTRAINT "graph_snapshots_build_run_id_fkey"
    FOREIGN KEY ("build_run_id") REFERENCES "graph_build_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "graph_snapshots_graph_mode_invalidated_at_idx" ON "graph_snapshots"("graph_mode", "invalidated_at");
CREATE INDEX IF NOT EXISTS "graph_snapshots_scope_type_scope_key_idx" ON "graph_snapshots"("scope_type", "scope_key");
CREATE INDEX IF NOT EXISTS "graph_snapshots_focus_node_id_depth_idx" ON "graph_snapshots"("focus_node_id", "depth");
CREATE INDEX IF NOT EXISTS "graph_snapshots_build_run_id_idx" ON "graph_snapshots"("build_run_id");
CREATE INDEX IF NOT EXISTS "graph_snapshots_payload_bytes_idx" ON "graph_snapshots"("payload_bytes");

CREATE TABLE IF NOT EXISTS "graph_presets" (
  "id" TEXT NOT NULL,
  "owner_key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "graph_mode" TEXT NOT NULL,
  "focus_node_id" TEXT,
  "depth" INTEGER NOT NULL DEFAULT 2,
  "filter_schema_version" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "display" JSONB NOT NULL,
  "physics" JSONB NOT NULL,
  "camera" JSONB NOT NULL,
  "pinned_nodes" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_presets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "graph_presets_owner_key_name_key" UNIQUE ("owner_key", "name")
);

CREATE INDEX IF NOT EXISTS "graph_presets_owner_key_status_idx" ON "graph_presets"("owner_key", "status");
CREATE INDEX IF NOT EXISTS "graph_presets_graph_mode_idx" ON "graph_presets"("graph_mode");

CREATE TABLE IF NOT EXISTS "graph_layout_states" (
  "id" TEXT NOT NULL,
  "owner_key" TEXT NOT NULL,
  "scope_type" TEXT NOT NULL,
  "scope_key" TEXT NOT NULL,
  "graph_mode" TEXT NOT NULL,
  "filter_signature" TEXT NOT NULL,
  "positions" JSONB NOT NULL DEFAULT '{}',
  "pinned_nodes" JSONB NOT NULL DEFAULT '{}',
  "frozen_node_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "camera" JSONB NOT NULL,
  "display" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_layout_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "graph_layout_states_owner_key_scope_type_scope_key_graph_mode_filter_signature_key"
    UNIQUE ("owner_key", "scope_type", "scope_key", "graph_mode", "filter_signature")
);

CREATE INDEX IF NOT EXISTS "graph_layout_states_owner_key_graph_mode_idx" ON "graph_layout_states"("owner_key", "graph_mode");
CREATE INDEX IF NOT EXISTS "graph_layout_states_scope_type_scope_key_idx" ON "graph_layout_states"("scope_type", "scope_key");

CREATE TABLE IF NOT EXISTS "graph_reject_memory" (
  "id" TEXT NOT NULL,
  "pair_key" TEXT NOT NULL,
  "source_node_id" TEXT NOT NULL,
  "target_node_id" TEXT NOT NULL,
  "edge_type" TEXT NOT NULL,
  "reviewer_id" TEXT,
  "rationale" TEXT,
  "evidence_hash" TEXT NOT NULL,
  "reconsider_after" TIMESTAMP(3),
  "last_rejected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_suggested_at" TIMESTAMP(3),
  "last_suppressed_at" TIMESTAMP(3),
  "suppression_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_reject_memory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "graph_reject_memory_pair_key_key" UNIQUE ("pair_key"),
  CONSTRAINT "graph_reject_memory_source_node_id_fkey"
    FOREIGN KEY ("source_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "graph_reject_memory_target_node_id_fkey"
    FOREIGN KEY ("target_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "graph_reject_memory_source_node_id_target_node_id_idx"
  ON "graph_reject_memory"("source_node_id", "target_node_id");
CREATE INDEX IF NOT EXISTS "graph_reject_memory_edge_type_last_rejected_at_idx"
  ON "graph_reject_memory"("edge_type", "last_rejected_at");
CREATE INDEX IF NOT EXISTS "graph_reject_memory_suppression_count_idx"
  ON "graph_reject_memory"("suppression_count");

CREATE TABLE IF NOT EXISTS "graph_cluster_assignments" (
  "id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "snapshot_id" TEXT,
  "cluster_mode" TEXT NOT NULL,
  "cluster_key" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_cluster_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "graph_cluster_assignments_node_id_snapshot_id_cluster_mode_key"
    UNIQUE ("node_id", "snapshot_id", "cluster_mode"),
  CONSTRAINT "graph_cluster_assignments_node_id_fkey"
    FOREIGN KEY ("node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "graph_cluster_assignments_snapshot_id_fkey"
    FOREIGN KEY ("snapshot_id") REFERENCES "graph_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "graph_cluster_assignments_cluster_mode_cluster_key_idx"
  ON "graph_cluster_assignments"("cluster_mode", "cluster_key");
CREATE INDEX IF NOT EXISTS "graph_cluster_assignments_snapshot_id_idx"
  ON "graph_cluster_assignments"("snapshot_id");

CREATE TABLE IF NOT EXISTS "graph_suggestion_batches" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "request_fingerprint" TEXT,
  "graph_mode" TEXT NOT NULL,
  "target_node_id" TEXT,
  "filter_signature" TEXT NOT NULL,
  "max_suggestions_per_node" INTEGER NOT NULL DEFAULT 10,
  "min_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  "apply_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
  "summary" JSONB NOT NULL DEFAULT '{}',
  "error_text" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "graph_suggestion_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "graph_suggestion_batches_status_created_at_idx"
  ON "graph_suggestion_batches"("status", "created_at");
CREATE INDEX IF NOT EXISTS "graph_suggestion_batches_graph_mode_target_node_id_idx"
  ON "graph_suggestion_batches"("graph_mode", "target_node_id");
CREATE INDEX IF NOT EXISTS "graph_suggestion_batches_request_fingerprint_status_idx"
  ON "graph_suggestion_batches"("request_fingerprint", "status");

CREATE TABLE IF NOT EXISTS "graph_link_suggestions" (
  "id" TEXT NOT NULL,
  "suggestion_key" TEXT NOT NULL,
  "batch_id" TEXT,
  "source_node_id" TEXT NOT NULL,
  "target_node_id" TEXT NOT NULL,
  "edge_type" TEXT NOT NULL,
  "directed" BOOLEAN NOT NULL DEFAULT true,
  "reciprocal" BOOLEAN NOT NULL DEFAULT false,
  "confidence" DOUBLE PRECISION NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "explanation" JSONB NOT NULL,
  "signal_breakdown" JSONB NOT NULL DEFAULT '{}',
  "material_change_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMP(3),
  CONSTRAINT "graph_link_suggestions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "graph_link_suggestions_suggestion_key_material_change_hash_key"
    UNIQUE ("suggestion_key", "material_change_hash"),
  CONSTRAINT "graph_link_suggestions_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "graph_suggestion_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "graph_link_suggestions_source_node_id_fkey"
    FOREIGN KEY ("source_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "graph_link_suggestions_target_node_id_fkey"
    FOREIGN KEY ("target_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "graph_link_suggestions_state_created_at_idx"
  ON "graph_link_suggestions"("state", "created_at");
CREATE INDEX IF NOT EXISTS "graph_link_suggestions_batch_id_idx"
  ON "graph_link_suggestions"("batch_id");
CREATE INDEX IF NOT EXISTS "graph_link_suggestions_source_node_id_state_idx"
  ON "graph_link_suggestions"("source_node_id", "state");
CREATE INDEX IF NOT EXISTS "graph_link_suggestions_target_node_id_state_idx"
  ON "graph_link_suggestions"("target_node_id", "state");

CREATE TABLE IF NOT EXISTS "graph_link_decisions" (
  "id" TEXT NOT NULL,
  "suggestion_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "decided_by" TEXT,
  "rationale" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_link_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "graph_link_decisions_suggestion_id_fkey"
    FOREIGN KEY ("suggestion_id") REFERENCES "graph_link_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "graph_link_decisions_suggestion_id_created_at_idx"
  ON "graph_link_decisions"("suggestion_id", "created_at");
CREATE INDEX IF NOT EXISTS "graph_link_decisions_action_created_at_idx"
  ON "graph_link_decisions"("action", "created_at");

CREATE TABLE IF NOT EXISTS "reciprocal_edge_rules" (
  "id" TEXT NOT NULL,
  "edge_type" TEXT NOT NULL,
  "reverse_edge_type" TEXT NOT NULL,
  "relationship_mode" TEXT NOT NULL,
  "directed" BOOLEAN NOT NULL DEFAULT true,
  "reciprocal" BOOLEAN NOT NULL DEFAULT false,
  "auto_create" BOOLEAN NOT NULL DEFAULT false,
  "explanation" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reciprocal_edge_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reciprocal_edge_rules_edge_type_key" UNIQUE ("edge_type")
);

CREATE INDEX IF NOT EXISTS "reciprocal_edge_rules_relationship_mode_auto_create_idx"
  ON "reciprocal_edge_rules"("relationship_mode", "auto_create");

INSERT INTO "reciprocal_edge_rules"
  ("id", "edge_type", "reverse_edge_type", "relationship_mode", "directed", "reciprocal", "auto_create", "explanation", "metadata")
VALUES
  ('recrule_explicit_link', 'explicit_link', 'backlink', 'BACKLINK', true, true, true, 'Explicit links create durable backlink mirrors.', '{}'),
  ('recrule_backlink', 'backlink', 'explicit_link', 'MIRROR_ONLY', true, true, false, 'Backlinks are reverse mirrors of explicit links.', '{}'),
  ('recrule_ai_accepted_link', 'ai_accepted_link', 'ai_accepted_link', 'MIRROR', false, true, true, 'Accepted AI links create durable mirror edges.', '{}'),
  ('recrule_ai_suggested_link', 'ai_suggested_link', 'ai_suggested_link', 'MIRROR', false, true, false, 'Pending AI suggestions remain inspectable without auto-materializing accepted edges.', '{}'),
  ('recrule_semantic_similarity', 'semantic_similarity', 'semantic_similarity', 'MIRROR', false, true, true, 'Semantic similarity is symmetric and durable.', '{}'),
  ('recrule_related_to', 'related_to', 'related_to', 'MIRROR', false, true, true, 'Related-to edges are symmetric.', '{}'),
  ('recrule_same_as', 'same_as', 'same_as', 'MIRROR', false, true, true, 'Same-as edges are symmetric identity assertions.', '{}'),
  ('recrule_tagged_with', 'tagged_with', 'tagged_with', 'ONE_WAY', true, false, false, 'Tag relationships preserve direction from item to tag.', '{}'),
  ('recrule_attached_to', 'attached_to', 'attached_to', 'ONE_WAY', true, false, false, 'Attachment relationships preserve direction from attachment to owner.', '{}'),
  ('recrule_verified_by', 'verified_by', 'verified_by', 'ONE_WAY', true, false, false, 'Verification provenance is directional.', '{}'),
  ('recrule_accepted_by', 'accepted_by', 'accepted_by', 'ONE_WAY', true, false, false, 'Acceptance relationships preserve direction.', '{}')
ON CONFLICT ("edge_type") DO NOTHING;
