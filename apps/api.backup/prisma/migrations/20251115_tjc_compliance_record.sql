-- B191B-TJC-006: Introduce TJC enums + compliance record

CREATE TYPE "TJCStandard" AS ENUM ('MS01','MS03','MS05','MS06','MS08');
CREATE TYPE "TJCComplianceStatus" AS ENUM ('PASS','FAIL','WARN','PENDING');

CREATE TABLE IF NOT EXISTS "TJCComplianceRecord" (
  "id" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "orgId" TEXT,
  "evaluationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "windowStart" TIMESTAMP(3),
  "windowEnd" TIMESTAMP(3),
  "overallStatus" "TJCComplianceStatus" NOT NULL DEFAULT 'PENDING',
  "previousStatus" "TJCComplianceStatus",
  "standardResults" JSONB NOT NULL,
  "ruleEvaluations" JSONB,
  "signalSnapshot" JSONB,
  "issueCodes" TEXT[] NOT NULL DEFAULT '{}',
  "recommendations" JSONB,
  "driftContext" JSONB,
  "jobRunId" TEXT,
  "lastNotifiedAt" TIMESTAMP(3),
  "notificationCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TJCComplianceRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TJCComplianceRecord_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TJCComplianceRecord_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "PartnerConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TJCComplianceRecord_clinician_eval_idx"
  ON "TJCComplianceRecord" ("clinicianId", "evaluationDate");
CREATE INDEX IF NOT EXISTS "TJCComplianceRecord_org_eval_idx"
  ON "TJCComplianceRecord" ("orgId", "evaluationDate");
CREATE INDEX IF NOT EXISTS "TJCComplianceRecord_status_idx"
  ON "TJCComplianceRecord" ("overallStatus");
