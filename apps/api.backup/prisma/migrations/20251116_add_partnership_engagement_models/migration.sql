-- B248B-PARTNER-011: Add PartnershipOpportunity table
-- B248B-PARTNER-013: Add PartnershipProposal table
-- B248B-PARTNER-014: Add CoMarketingCampaign table
-- B248B-PARTNER-015: Add CollaborationTask table

-- Create PartnershipOpportunity table
CREATE TABLE IF NOT EXISTS "PartnershipOpportunity" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "potentialValue" INTEGER,
    "assignedTo" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnershipOpportunity_pkey" PRIMARY KEY ("id")
);

-- Create PartnershipProposal table
CREATE TABLE IF NOT EXISTS "PartnershipProposal" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "proposalDocId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnershipProposal_pkey" PRIMARY KEY ("id")
);

-- Create CoMarketingCampaign table
CREATE TABLE IF NOT EXISTS "CoMarketingCampaign" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" INTEGER,
    "metrics" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoMarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- Create CollaborationTask table
CREATE TABLE IF NOT EXISTS "CollaborationTask" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "assignedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborationTask_pkey" PRIMARY KEY ("id")
);

-- Create indexes for PartnershipOpportunity
CREATE INDEX IF NOT EXISTS "PartnershipOpportunity_partnerId_idx" ON "PartnershipOpportunity"("partnerId");
CREATE INDEX IF NOT EXISTS "PartnershipOpportunity_status_idx" ON "PartnershipOpportunity"("status");
CREATE INDEX IF NOT EXISTS "PartnershipOpportunity_assignedTo_idx" ON "PartnershipOpportunity"("assignedTo");
CREATE INDEX IF NOT EXISTS "PartnershipOpportunity_createdBy_idx" ON "PartnershipOpportunity"("createdBy");
CREATE INDEX IF NOT EXISTS "PartnershipOpportunity_createdAt_idx" ON "PartnershipOpportunity"("createdAt");
CREATE INDEX IF NOT EXISTS "PartnershipOpportunity_partnerId_status_idx" ON "PartnershipOpportunity"("partnerId", "status");

-- Create indexes for PartnershipProposal
CREATE INDEX IF NOT EXISTS "PartnershipProposal_opportunityId_idx" ON "PartnershipProposal"("opportunityId");
CREATE INDEX IF NOT EXISTS "PartnershipProposal_status_idx" ON "PartnershipProposal"("status");
CREATE INDEX IF NOT EXISTS "PartnershipProposal_submittedAt_idx" ON "PartnershipProposal"("submittedAt");

-- Create indexes for CoMarketingCampaign
CREATE INDEX IF NOT EXISTS "CoMarketingCampaign_partnerId_idx" ON "CoMarketingCampaign"("partnerId");
CREATE INDEX IF NOT EXISTS "CoMarketingCampaign_status_idx" ON "CoMarketingCampaign"("status");
CREATE INDEX IF NOT EXISTS "CoMarketingCampaign_startDate_idx" ON "CoMarketingCampaign"("startDate");
CREATE INDEX IF NOT EXISTS "CoMarketingCampaign_endDate_idx" ON "CoMarketingCampaign"("endDate");

-- Create indexes for CollaborationTask
CREATE INDEX IF NOT EXISTS "CollaborationTask_partnerId_idx" ON "CollaborationTask"("partnerId");
CREATE INDEX IF NOT EXISTS "CollaborationTask_opportunityId_idx" ON "CollaborationTask"("opportunityId");
CREATE INDEX IF NOT EXISTS "CollaborationTask_assignedTo_idx" ON "CollaborationTask"("assignedTo");
CREATE INDEX IF NOT EXISTS "CollaborationTask_status_idx" ON "CollaborationTask"("status");
CREATE INDEX IF NOT EXISTS "CollaborationTask_dueDate_idx" ON "CollaborationTask"("dueDate");

-- Add foreign key constraints
ALTER TABLE "PartnershipProposal" ADD CONSTRAINT "PartnershipProposal_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "PartnershipOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollaborationTask" ADD CONSTRAINT "CollaborationTask_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "PartnershipOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

