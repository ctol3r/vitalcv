-- Migration: Create ExamAdoption table for Uniform MPJE tracking
-- Date: 2025-11-03
-- Batch: 42

CREATE TABLE IF NOT EXISTS "ExamAdoption" (
  state VARCHAR(2) PRIMARY KEY,
  uniform BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Create index for querying by adoption status
CREATE INDEX IF NOT EXISTS idx_exam_adoption_uniform ON "ExamAdoption"(uniform);

-- Insert all 50 states + DC with default non-adopted status
INSERT INTO "ExamAdoption" (state, uniform, updated_at) VALUES
  ('AL', false, NOW()),
  ('AK', false, NOW()),
  ('AZ', false, NOW()),
  ('AR', false, NOW()),
  ('CA', false, NOW()),
  ('CO', false, NOW()),
  ('CT', false, NOW()),
  ('DE', false, NOW()),
  ('DC', false, NOW()),
  ('FL', false, NOW()),
  ('GA', false, NOW()),
  ('HI', false, NOW()),
  ('IA', false, NOW()),
  ('ID', false, NOW()),
  ('IL', false, NOW()),
  ('IN', false, NOW()),
  ('KS', false, NOW()),
  ('KY', false, NOW()),
  ('LA', false, NOW()),
  ('MA', false, NOW()),
  ('MD', false, NOW()),
  ('ME', false, NOW()),
  ('MI', false, NOW()),
  ('MN', false, NOW()),
  ('MO', false, NOW()),
  ('MS', false, NOW()),
  ('MT', false, NOW()),
  ('NC', false, NOW()),
  ('ND', false, NOW()),
  ('NE', false, NOW()),
  ('NH', false, NOW()),
  ('NJ', false, NOW()),
  ('NM', false, NOW()),
  ('NV', false, NOW()),
  ('NY', false, NOW()),
  ('OH', false, NOW()),
  ('OK', false, NOW()),
  ('OR', false, NOW()),
  ('PA', false, NOW()),
  ('RI', false, NOW()),
  ('SC', false, NOW()),
  ('SD', false, NOW()),
  ('TN', false, NOW()),
  ('TX', false, NOW()),
  ('UT', false, NOW()),
  ('VA', false, NOW()),
  ('VT', false, NOW()),
  ('WA', false, NOW()),
  ('WI', false, NOW()),
  ('WV', false, NOW()),
  ('WY', false, NOW())
ON CONFLICT (state) DO NOTHING;

COMMENT ON TABLE "ExamAdoption" IS 'Tracks state-by-state adoption of Uniform MPJE (target: June 2026)';
COMMENT ON COLUMN "ExamAdoption".uniform IS 'true if state has adopted Uniform MPJE';
COMMENT ON COLUMN "ExamAdoption".notes IS 'Optional notes about adoption timeline or special conditions';

