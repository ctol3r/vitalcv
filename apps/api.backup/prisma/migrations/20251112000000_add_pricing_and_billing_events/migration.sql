-- B133C-PRICING-001: Add Pricing Plan tables and Organization-level assignments
-- B133C-PRICING-002: Add Billing Events tracking

-- Create PricingPlan table
CREATE TABLE "PricingPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "jobPostPricing" JSONB NOT NULL,
    "successfulHirePricing" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingPlan_pkey" PRIMARY KEY ("id")
);

-- Create OrganizationPricing table
CREATE TABLE "OrganizationPricing" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pricingPlanId" TEXT NOT NULL,
    "customOverrides" JSONB,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPricing_pkey" PRIMARY KEY ("id")
);

-- Create BillingEvent table
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partnerId" TEXT,
    "jobId" TEXT,
    "applicationId" TEXT,
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- Create indexes for PricingPlan
CREATE UNIQUE INDEX "PricingPlan_name_key" ON "PricingPlan"("name");
CREATE INDEX "PricingPlan_name_idx" ON "PricingPlan"("name");
CREATE INDEX "PricingPlan_isDefault_idx" ON "PricingPlan"("isDefault");

-- Create indexes for OrganizationPricing
CREATE UNIQUE INDEX "OrganizationPricing_organizationId_effectiveDate_key" ON "OrganizationPricing"("organizationId", "effectiveDate");
CREATE INDEX "OrganizationPricing_organizationId_idx" ON "OrganizationPricing"("organizationId");
CREATE INDEX "OrganizationPricing_pricingPlanId_idx" ON "OrganizationPricing"("pricingPlanId");
CREATE INDEX "OrganizationPricing_effectiveDate_idx" ON "OrganizationPricing"("effectiveDate");

-- Create indexes for BillingEvent
CREATE INDEX "BillingEvent_organizationId_idx" ON "BillingEvent"("organizationId");
CREATE INDEX "BillingEvent_partnerId_idx" ON "BillingEvent"("partnerId");
CREATE INDEX "BillingEvent_eventType_idx" ON "BillingEvent"("eventType");
CREATE INDEX "BillingEvent_createdAt_idx" ON "BillingEvent"("createdAt");
CREATE INDEX "BillingEvent_processedAt_idx" ON "BillingEvent"("processedAt");

-- Add foreign key constraints
ALTER TABLE "OrganizationPricing" ADD CONSTRAINT "OrganizationPricing_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES "PricingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert default pricing plans (Starter, Pro, Enterprise)
INSERT INTO "PricingPlan" ("id", "name", "description", "isDefault", "jobPostPricing", "successfulHirePricing", "createdAt", "updatedAt")
VALUES
(
    'starter',
    'Starter',
    'For small businesses and startups',
    true,
    '{"enabled": true, "flatRate": 9900, "tiers": []}'::jsonb,
    '{"enabled": true, "flatRate": 49900, "tiers": []}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'pro',
    'Pro',
    'For growing companies with volume hiring',
    false,
    '{"enabled": true, "tiers": [{"tierName": "First 10 jobs", "minVolume": 1, "maxVolume": 10, "pricePerUnit": 8900}, {"tierName": "11-50 jobs", "minVolume": 11, "maxVolume": 50, "pricePerUnit": 7900}, {"tierName": "51+ jobs", "minVolume": 51, "pricePerUnit": 6900}]}'::jsonb,
    '{"enabled": true, "tiers": [{"tierName": "First 5 hires", "minVolume": 1, "maxVolume": 5, "pricePerUnit": 44900}, {"tierName": "6-20 hires", "minVolume": 6, "maxVolume": 20, "pricePerUnit": 39900}, {"tierName": "21+ hires", "minVolume": 21, "pricePerUnit": 34900}]}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'enterprise',
    'Enterprise',
    'For large organizations with custom pricing',
    false,
    '{"enabled": true, "tiers": [{"tierName": "First 50 jobs", "minVolume": 1, "maxVolume": 50, "pricePerUnit": 5900}, {"tierName": "51-200 jobs", "minVolume": 51, "maxVolume": 200, "pricePerUnit": 4900}, {"tierName": "201+ jobs", "minVolume": 201, "pricePerUnit": 3900}]}'::jsonb,
    '{"enabled": true, "percentageOfSalary": 10, "tiers": [{"tierName": "First 20 hires", "minVolume": 1, "maxVolume": 20, "pricePerUnit": 29900}, {"tierName": "21+ hires", "minVolume": 21, "pricePerUnit": 24900}]}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (name) DO NOTHING;

