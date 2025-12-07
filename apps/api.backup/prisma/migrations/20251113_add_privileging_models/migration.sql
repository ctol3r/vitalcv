-- CreateTable
CREATE TABLE "PrivilegeSet" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT NOT NULL,
    "procedures" JSONB NOT NULL,
    "requirements" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivilegeSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivilegeRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clinicianDid" TEXT NOT NULL,
    "privilegeSetId" TEXT NOT NULL,
    "evidenceIds" TEXT[],
    "evidenceBundle" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerDid" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivilegeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FppeOppe" (
    "id" TEXT NOT NULL,
    "privilegeRequestId" TEXT NOT NULL,
    "clinicianDid" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fppeStartDate" TIMESTAMP(3),
    "fppeEndDate" TIMESTAMP(3),
    "fppeStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "fppeMetrics" JSONB,
    "oppeStartDate" TIMESTAMP(3),
    "oppeIntervalMonths" INTEGER NOT NULL DEFAULT 12,
    "oppeNextReviewDue" TIMESTAMP(3),
    "oppeLastReviewDate" TIMESTAMP(3),
    "oppeMetrics" JSONB,
    "oppeStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FppeOppe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpdbOigMonitor" (
    "id" TEXT NOT NULL,
    "clinicianDid" TEXT NOT NULL,
    "npi" TEXT,
    "monitorType" TEXT NOT NULL,
    "checkDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "adverseActions" JSONB,
    "rawResponse" JSONB,
    "privilegeAction" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "orgIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NpdbOigMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivilegeSet_orgId_idx" ON "PrivilegeSet"("orgId");

-- CreateIndex
CREATE INDEX "PrivilegeSet_department_idx" ON "PrivilegeSet"("department");

-- CreateIndex
CREATE INDEX "PrivilegeSet_isActive_idx" ON "PrivilegeSet"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PrivilegeSet_orgId_name_key" ON "PrivilegeSet"("orgId", "name");

-- CreateIndex
CREATE INDEX "PrivilegeRequest_orgId_idx" ON "PrivilegeRequest"("orgId");

-- CreateIndex
CREATE INDEX "PrivilegeRequest_clinicianDid_idx" ON "PrivilegeRequest"("clinicianDid");

-- CreateIndex
CREATE INDEX "PrivilegeRequest_privilegeSetId_idx" ON "PrivilegeRequest"("privilegeSetId");

-- CreateIndex
CREATE INDEX "PrivilegeRequest_status_idx" ON "PrivilegeRequest"("status");

-- CreateIndex
CREATE INDEX "PrivilegeRequest_createdAt_idx" ON "PrivilegeRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FppeOppe_privilegeRequestId_key" ON "FppeOppe"("privilegeRequestId");

-- CreateIndex
CREATE INDEX "FppeOppe_clinicianDid_idx" ON "FppeOppe"("clinicianDid");

-- CreateIndex
CREATE INDEX "FppeOppe_orgId_idx" ON "FppeOppe"("orgId");

-- CreateIndex
CREATE INDEX "FppeOppe_oppeNextReviewDue_idx" ON "FppeOppe"("oppeNextReviewDue");

-- CreateIndex
CREATE INDEX "FppeOppe_fppeStatus_idx" ON "FppeOppe"("fppeStatus");

-- CreateIndex
CREATE INDEX "FppeOppe_oppeStatus_idx" ON "FppeOppe"("oppeStatus");

-- CreateIndex
CREATE INDEX "NpdbOigMonitor_clinicianDid_idx" ON "NpdbOigMonitor"("clinicianDid");

-- CreateIndex
CREATE INDEX "NpdbOigMonitor_npi_idx" ON "NpdbOigMonitor"("npi");

-- CreateIndex
CREATE INDEX "NpdbOigMonitor_status_idx" ON "NpdbOigMonitor"("status");

-- CreateIndex
CREATE INDEX "NpdbOigMonitor_checkDate_idx" ON "NpdbOigMonitor"("checkDate");

-- CreateIndex
CREATE INDEX "NpdbOigMonitor_privilegeAction_idx" ON "NpdbOigMonitor"("privilegeAction");

-- AddForeignKey
ALTER TABLE "PrivilegeRequest" ADD CONSTRAINT "PrivilegeRequest_privilegeSetId_fkey" FOREIGN KEY ("privilegeSetId") REFERENCES "PrivilegeSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FppeOppe" ADD CONSTRAINT "FppeOppe_privilegeRequestId_fkey" FOREIGN KEY ("privilegeRequestId") REFERENCES "PrivilegeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

