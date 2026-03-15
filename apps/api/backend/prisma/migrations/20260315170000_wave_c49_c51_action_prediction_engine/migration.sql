CREATE TABLE "action_recommendations" (
    "id" UUID NOT NULL,
    "action_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "storyline_key" TEXT,
    "source_finding_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prediction_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target_entity_type" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "target_entity_label" TEXT,
    "recommended_action" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "priority_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "executed_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "saved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "action_status_events" (
    "id" UUID NOT NULL,
    "action_recommendation_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_id" TEXT,
    "note" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_status_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prediction_insights" (
    "id" UUID NOT NULL,
    "prediction_id" TEXT NOT NULL,
    "prediction_type" TEXT NOT NULL,
    "target_entity_type" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "target_entity_label" TEXT,
    "probability" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "time_horizon" TEXT NOT NULL,
    "evidence_signals" JSONB NOT NULL DEFAULT '[]',
    "explanation" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prediction_insights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "action_recommendations_action_id_key" ON "action_recommendations"("action_id");
CREATE INDEX "action_recommendations_action_type_created_at_idx" ON "action_recommendations"("action_type", "created_at");
CREATE INDEX "action_recommendations_priority_status_created_at_idx" ON "action_recommendations"("priority", "status", "created_at");
CREATE INDEX "action_recommendations_target_entity_type_target_entity_id_idx" ON "action_recommendations"("target_entity_type", "target_entity_id");
CREATE INDEX "action_recommendations_storyline_key_created_at_idx" ON "action_recommendations"("storyline_key", "created_at");
CREATE INDEX "action_recommendations_status_updated_at_idx" ON "action_recommendations"("status", "updated_at");

CREATE INDEX "action_status_events_action_recommendation_id_created_at_idx" ON "action_status_events"("action_recommendation_id", "created_at");
CREATE INDEX "action_status_events_to_status_created_at_idx" ON "action_status_events"("to_status", "created_at");

CREATE UNIQUE INDEX "prediction_insights_prediction_id_key" ON "prediction_insights"("prediction_id");
CREATE INDEX "prediction_insights_prediction_type_created_at_idx" ON "prediction_insights"("prediction_type", "created_at");
CREATE INDEX "prediction_insights_target_entity_type_target_entity_id_idx" ON "prediction_insights"("target_entity_type", "target_entity_id");
CREATE INDEX "prediction_insights_probability_confidence_idx" ON "prediction_insights"("probability", "confidence");
CREATE INDEX "prediction_insights_time_horizon_created_at_idx" ON "prediction_insights"("time_horizon", "created_at");

ALTER TABLE "action_status_events"
ADD CONSTRAINT "action_status_events_action_recommendation_id_fkey"
FOREIGN KEY ("action_recommendation_id") REFERENCES "action_recommendations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
