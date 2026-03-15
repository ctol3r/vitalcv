-- Waves C18-C20: intelligence engine core, graph insights, and predictive query learning.

CREATE TABLE IF NOT EXISTS "learning_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dedupe_key" TEXT,
  "event_type" TEXT NOT NULL,
  "loop_type" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "source_id" TEXT,
  "related_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "confidence" DOUBLE PRECISION,
  "score_delta" DOUBLE PRECISION,
  "signal_strength" DOUBLE PRECISION,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learning_events_dedupe_key_key" UNIQUE ("dedupe_key")
);

CREATE INDEX IF NOT EXISTS "learning_events_event_type_occurred_at_idx"
  ON "learning_events"("event_type", "occurred_at");
CREATE INDEX IF NOT EXISTS "learning_events_loop_type_occurred_at_idx"
  ON "learning_events"("loop_type", "occurred_at");
CREATE INDEX IF NOT EXISTS "learning_events_subject_type_subject_id_occurred_at_idx"
  ON "learning_events"("subject_type", "subject_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "learning_events_source_id_occurred_at_idx"
  ON "learning_events"("source_id", "occurred_at");

CREATE TABLE IF NOT EXISTS "anomaly_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "anomaly_key" TEXT NOT NULL,
  "anomaly_type" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "source_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "occurrence_count" INTEGER NOT NULL DEFAULT 1,
  "confirmation_count" INTEGER NOT NULL DEFAULT 0,
  "rejection_count" INTEGER NOT NULL DEFAULT 0,
  "last_fingerprint" TEXT NOT NULL,
  "first_detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anomaly_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "anomaly_history_anomaly_key_key" UNIQUE ("anomaly_key")
);

CREATE INDEX IF NOT EXISTS "anomaly_history_anomaly_type_last_detected_at_idx"
  ON "anomaly_history"("anomaly_type", "last_detected_at");
CREATE INDEX IF NOT EXISTS "anomaly_history_subject_type_subject_id_last_detected_at_idx"
  ON "anomaly_history"("subject_type", "subject_id", "last_detected_at");
CREATE INDEX IF NOT EXISTS "anomaly_history_status_severity_idx"
  ON "anomaly_history"("status", "severity");

CREATE TABLE IF NOT EXISTS "source_reliability_scores" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_id" TEXT NOT NULL,
  "contradiction_frequency" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "freshness_consistency" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "coverage_reliability" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "verification_accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "source_reliability_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "evidence_count" INTEGER NOT NULL DEFAULT 0,
  "explanation" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "last_computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "source_reliability_scores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "source_reliability_scores_source_id_key" UNIQUE ("source_id")
);

CREATE INDEX IF NOT EXISTS "source_reliability_scores_source_reliability_score_idx"
  ON "source_reliability_scores"("source_reliability_score");
CREATE INDEX IF NOT EXISTS "source_reliability_scores_last_computed_at_idx"
  ON "source_reliability_scores"("last_computed_at");

CREATE TABLE IF NOT EXISTS "suggestion_outcomes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "suggestion_type" TEXT NOT NULL,
  "suggestion_key" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "accepted" BOOLEAN NOT NULL,
  "confidence" DOUBLE PRECISION,
  "feedback_source" TEXT,
  "graph_suggestion_id" TEXT,
  "source_node_id" TEXT,
  "target_node_id" TEXT,
  "outcome_score" DOUBLE PRECISION,
  "rationale" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "suggestion_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "suggestion_outcomes_suggestion_type_created_at_idx"
  ON "suggestion_outcomes"("suggestion_type", "created_at");
CREATE INDEX IF NOT EXISTS "suggestion_outcomes_suggestion_key_created_at_idx"
  ON "suggestion_outcomes"("suggestion_key", "created_at");
CREATE INDEX IF NOT EXISTS "suggestion_outcomes_subject_type_subject_id_created_at_idx"
  ON "suggestion_outcomes"("subject_type", "subject_id", "created_at");

CREATE TABLE IF NOT EXISTS "trust_score_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "previous_score" DOUBLE PRECISION,
  "new_score" DOUBLE PRECISION NOT NULL,
  "score_delta" DOUBLE PRECISION NOT NULL,
  "trigger_event" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "band" TEXT,
  "methodology_version" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trust_score_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trust_score_history_subject_type_subject_id_recorded_at_idx"
  ON "trust_score_history"("subject_type", "subject_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "trust_score_history_trigger_event_recorded_at_idx"
  ON "trust_score_history"("trigger_event", "recorded_at");

CREATE TABLE IF NOT EXISTS "query_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "query_hash" TEXT NOT NULL,
  "normalized_query" TEXT,
  "query_template" TEXT NOT NULL,
  "prefix_key" TEXT,
  "intent_type" TEXT,
  "entity_type" TEXT,
  "organization_id" UUID,
  "acl_level" TEXT,
  "actor_id_hash" TEXT,
  "contains_sensitive_tokens" BOOLEAN NOT NULL DEFAULT false,
  "result_count" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "query_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "query_history_query_hash_idx"
  ON "query_history"("query_hash");
CREATE INDEX IF NOT EXISTS "query_history_normalized_query_idx"
  ON "query_history"("normalized_query");
CREATE INDEX IF NOT EXISTS "query_history_query_template_created_at_idx"
  ON "query_history"("query_template", "created_at");
CREATE INDEX IF NOT EXISTS "query_history_prefix_key_created_at_idx"
  ON "query_history"("prefix_key", "created_at");
CREATE INDEX IF NOT EXISTS "query_history_organization_id_created_at_idx"
  ON "query_history"("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "graph_insights" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "node_id" TEXT NOT NULL,
  "insight_type" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "explanation" TEXT NOT NULL,
  "insight_score" DOUBLE PRECISION,
  "related_node_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "graph_insights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "graph_insights_node_id_timestamp_idx"
  ON "graph_insights"("node_id", "timestamp");
CREATE INDEX IF NOT EXISTS "graph_insights_insight_type_timestamp_idx"
  ON "graph_insights"("insight_type", "timestamp");
