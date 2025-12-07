-- B192A-AIAGENT-001: Credential agent task tracking
CREATE TYPE "CredentialAgentTaskType" AS ENUM (
  'NPDB_QUERY',
  'LICENSE_CHECK',
  'BOARD_CHECK',
  'DEA_CHECK',
  'PECOS_CHECK',
  'MEDICAID_CHECK',
  'PAYER_CHECK',
  'PRIVILEGE_VALIDATION',
  'OPPE_REFRESH',
  'FPPE_EVAL',
  'TIMELINE_REFRESH',
  'COMPLIANCE_CALC'
);

CREATE TYPE "CredentialAgentTaskStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "CredentialAgentTask" (
  "id" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "taskType" "CredentialAgentTaskType" NOT NULL,
  "payload" JSONB,
  "status" "CredentialAgentTaskStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CredentialAgentTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CredentialAgentTask_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CredentialAgentTask_clinician_status_idx"
  ON "CredentialAgentTask"("clinicianId", "status");
CREATE INDEX "CredentialAgentTask_clinician_task_idx"
  ON "CredentialAgentTask"("clinicianId", "taskType");
CREATE INDEX "CredentialAgentTask_status_created_idx"
  ON "CredentialAgentTask"("status", "createdAt");
CREATE INDEX "CredentialAgentTask_task_idx"
  ON "CredentialAgentTask"("taskType");

