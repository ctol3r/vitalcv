CREATE TABLE "investigator_findings" (
    "id" UUID NOT NULL,
    "finding_id" TEXT NOT NULL,
    "investigator_id" TEXT NOT NULL,
    "finding_type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "priority_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trust_impact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freshness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "novelty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entity_importance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "graph_centrality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entity_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audience_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supporting_evidence" JSONB NOT NULL DEFAULT '[]',
    "rank_breakdown" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "storyline_key" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investigator_findings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finding_evidence_links" (
    "id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "source_id" TEXT,
    "source_label" TEXT,
    "record_type" TEXT,
    "record_id" TEXT,
    "url" TEXT,
    "snippet" TEXT,
    "observed_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_evidence_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finding_entity_links" (
    "id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_label" TEXT,
    "relationship" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_entity_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finding_status_events" (
    "id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_id" TEXT,
    "note" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_status_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "investigator_run_logs" (
    "id" UUID NOT NULL,
    "run_id" TEXT NOT NULL,
    "investigator_id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "entity_type" TEXT,
    "target_entity_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "entities_scanned" INTEGER NOT NULL DEFAULT 0,
    "findings_generated" INTEGER NOT NULL DEFAULT 0,
    "findings_created" INTEGER NOT NULL DEFAULT 0,
    "findings_updated" INTEGER NOT NULL DEFAULT 0,
    "findings_resolved" INTEGER NOT NULL DEFAULT 0,
    "findings_suppressed" INTEGER NOT NULL DEFAULT 0,
    "storylines_merged" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investigator_run_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "investigator_findings_finding_id_key" ON "investigator_findings"("finding_id");
CREATE UNIQUE INDEX "investigator_findings_dedupe_key_key" ON "investigator_findings"("dedupe_key");
CREATE INDEX "investigator_findings_investigator_id_last_seen_at_idx" ON "investigator_findings"("investigator_id", "last_seen_at");
CREATE INDEX "investigator_findings_finding_type_last_seen_at_idx" ON "investigator_findings"("finding_type", "last_seen_at");
CREATE INDEX "investigator_findings_severity_status_last_seen_at_idx" ON "investigator_findings"("severity", "status", "last_seen_at");
CREATE INDEX "investigator_findings_scope_last_seen_at_idx" ON "investigator_findings"("scope", "last_seen_at");
CREATE INDEX "investigator_findings_status_priority_score_last_seen_at_idx" ON "investigator_findings"("status", "priority_score", "last_seen_at");
CREATE INDEX "investigator_findings_last_seen_at_idx" ON "investigator_findings"("last_seen_at");

CREATE INDEX "finding_evidence_links_finding_id_idx" ON "finding_evidence_links"("finding_id");
CREATE INDEX "finding_evidence_links_record_type_record_id_idx" ON "finding_evidence_links"("record_type", "record_id");
CREATE INDEX "finding_evidence_links_source_id_observed_at_idx" ON "finding_evidence_links"("source_id", "observed_at");

CREATE INDEX "finding_entity_links_finding_id_idx" ON "finding_entity_links"("finding_id");
CREATE INDEX "finding_entity_links_entity_type_entity_id_idx" ON "finding_entity_links"("entity_type", "entity_id");
CREATE INDEX "finding_entity_links_entity_type_entity_label_idx" ON "finding_entity_links"("entity_type", "entity_label");

CREATE INDEX "finding_status_events_finding_id_created_at_idx" ON "finding_status_events"("finding_id", "created_at");
CREATE INDEX "finding_status_events_to_status_created_at_idx" ON "finding_status_events"("to_status", "created_at");

CREATE UNIQUE INDEX "investigator_run_logs_run_id_key" ON "investigator_run_logs"("run_id");
CREATE INDEX "investigator_run_logs_investigator_id_started_at_idx" ON "investigator_run_logs"("investigator_id", "started_at");
CREATE INDEX "investigator_run_logs_status_started_at_idx" ON "investigator_run_logs"("status", "started_at");
CREATE INDEX "investigator_run_logs_trigger_started_at_idx" ON "investigator_run_logs"("trigger", "started_at");

ALTER TABLE "finding_evidence_links"
ADD CONSTRAINT "finding_evidence_links_finding_id_fkey"
FOREIGN KEY ("finding_id") REFERENCES "investigator_findings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "finding_entity_links"
ADD CONSTRAINT "finding_entity_links_finding_id_fkey"
FOREIGN KEY ("finding_id") REFERENCES "investigator_findings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "finding_status_events"
ADD CONSTRAINT "finding_status_events_finding_id_fkey"
FOREIGN KEY ("finding_id") REFERENCES "investigator_findings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
