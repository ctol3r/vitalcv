"use strict";
/**
 * B139A-INTL-002: Region-aware Tenant Model
 *
 * Defines tenant regional configuration for multi-region deployment:
 * - homeRegion: Primary region where tenant's data resides
 * - allowedRegions: Additional regions tenant can access (for multi-national orgs)
 *
 * Data residency enforcement:
 * - PHI data never crosses region boundaries
 * - All database queries scoped to homeRegion
 * - Cross-region access for non-PHI metadata only
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.USAGE_EXAMPLES = exports.DEFAULT_TENANT_REGIONS = exports.TenantRegionUpdateSchema = exports.TenantRegionCreateSchema = exports.TenantRegionSchema = exports.REGION_REGULATORY_FRAMEWORK = exports.RegulatoryFramework = exports.REGION_DB_ENDPOINTS = exports.REGION_ENDPOINTS = exports.Region = void 0;
exports.validateTenantRegion = validateTenantRegion;
exports.validateTenantRegionCreate = validateTenantRegionCreate;
exports.canAccessRegion = canAccessRegion;
exports.getRegionalEndpoint = getRegionalEndpoint;
exports.requiresEudiCompliance = requiresEudiCompliance;
exports.requiresHipaaCompliance = requiresHipaaCompliance;
exports.canPerformCrossRegionSync = canPerformCrossRegionSync;
exports.generateTenantRegionMigration = generateTenantRegionMigration;
const zod_1 = require("zod");
/**
 * Supported regions in the platform
 */
var Region;
(function (Region) {
    Region["US"] = "us";
    Region["EU"] = "eu";
    Region["AU"] = "au";
    // Future regions:
    // CA = 'ca',  // Canada (ca-central-1) - Planned Q3 2026
    // UK = 'uk',  // United Kingdom (eu-west-2) - Planned Q4 2026
    // JP = 'jp',  // Japan (ap-northeast-1) - Planned Q2 2027
})(Region || (exports.Region = Region = {}));
/**
 * Regional cluster endpoints
 */
exports.REGION_ENDPOINTS = {
    [Region.US]: process.env.US_CLUSTER_ENDPOINT || 'https://us.api.vitalcv.com',
    [Region.EU]: process.env.EU_CLUSTER_ENDPOINT || 'https://eu.api.vitalcv.com',
    [Region.AU]: process.env.AU_CLUSTER_ENDPOINT || 'https://au.api.vitalcv.com',
};
/**
 * Regional database endpoints (read-only for metadata)
 */
exports.REGION_DB_ENDPOINTS = {
    [Region.US]: process.env.US_DB_ENDPOINT || 'postgres://us-primary.rds.amazonaws.com:5432',
    [Region.EU]: process.env.EU_DB_ENDPOINT || 'postgres://eu-primary.rds.amazonaws.com:5432',
    [Region.AU]: process.env.AU_DB_ENDPOINT || 'postgres://au-primary.rds.amazonaws.com:5432',
};
/**
 * Regulatory framework by region
 */
var RegulatoryFramework;
(function (RegulatoryFramework) {
    RegulatoryFramework["HIPAA_TEFCA"] = "hipaa_tefca";
    RegulatoryFramework["GDPR_EUDI"] = "gdpr_eudi";
    RegulatoryFramework["PRIVACY_ACT_AU"] = "privacy_act_au";
    RegulatoryFramework["PIPEDA"] = "pipeda";
})(RegulatoryFramework || (exports.RegulatoryFramework = RegulatoryFramework = {}));
/**
 * Region to regulatory framework mapping
 */
exports.REGION_REGULATORY_FRAMEWORK = {
    [Region.US]: RegulatoryFramework.HIPAA_TEFCA,
    [Region.EU]: RegulatoryFramework.GDPR_EUDI,
    [Region.AU]: RegulatoryFramework.PRIVACY_ACT_AU,
};
/**
 * Tenant regional configuration schema
 */
exports.TenantRegionSchema = zod_1.z.object({
    tenantId: zod_1.z.string().uuid('Tenant ID must be a valid UUID'),
    tenantName: zod_1.z.string().min(1, 'Tenant name is required'),
    homeRegion: zod_1.z.nativeEnum(Region, {
        errorMap: () => ({ message: 'Invalid home region' }),
    }),
    allowedRegions: zod_1.z
        .array(zod_1.z.nativeEnum(Region))
        .min(1, 'At least one allowed region is required')
        .refine((regions) => {
        // homeRegion must be in allowedRegions
        return true; // Validated separately in parse function
    }, { message: 'Home region must be included in allowed regions' }),
    dataResidencyEnforced: zod_1.z.boolean().default(true),
    crossRegionSyncEnabled: zod_1.z.boolean().default(false), // For non-PHI directory sync
    // Compliance metadata
    regulatoryFramework: zod_1.z.nativeEnum(RegulatoryFramework),
    baaExecuted: zod_1.z.boolean().default(false), // Business Associate Agreement (US/HIPAA)
    dpoAssigned: zod_1.z.string().optional(), // Data Protection Officer (EU/GDPR)
    dpiaCompleted: zod_1.z.boolean().default(false), // Data Protection Impact Assessment (EU)
    // Migration tracking
    migratedFrom: zod_1.z.nativeEnum(Region).optional(), // If tenant was migrated
    migrationDate: zod_1.z.date().optional(),
    migrationReason: zod_1.z.string().optional(),
    // Metadata
    createdAt: zod_1.z.date().default(() => new Date()),
    updatedAt: zod_1.z.date().default(() => new Date()),
    createdBy: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
/**
 * Tenant region creation input
 */
exports.TenantRegionCreateSchema = exports.TenantRegionSchema.omit({
    createdAt: true,
    updatedAt: true,
}).extend({
    // Ensure homeRegion is in allowedRegions
    allowedRegions: zod_1.z
        .array(zod_1.z.nativeEnum(Region))
        .min(1)
        .optional(), // Will default to [homeRegion]
});
/**
 * Tenant region update input
 */
exports.TenantRegionUpdateSchema = zod_1.z.object({
    tenantId: zod_1.z.string().uuid(),
    allowedRegions: zod_1.z.array(zod_1.z.nativeEnum(Region)).optional(),
    crossRegionSyncEnabled: zod_1.z.boolean().optional(),
    baaExecuted: zod_1.z.boolean().optional(),
    dpoAssigned: zod_1.z.string().optional(),
    dpiaCompleted: zod_1.z.boolean().optional(),
    notes: zod_1.z.string().optional(),
    updatedBy: zod_1.z.string().optional(),
});
/**
 * Validate tenant region configuration
 */
function validateTenantRegion(data) {
    const parsed = exports.TenantRegionSchema.parse(data);
    // Ensure homeRegion is in allowedRegions
    if (!parsed.allowedRegions.includes(parsed.homeRegion)) {
        throw new Error(`Home region '${parsed.homeRegion}' must be included in allowed regions: [${parsed.allowedRegions.join(', ')}]`);
    }
    return parsed;
}
/**
 * Validate tenant region creation
 */
function validateTenantRegionCreate(data) {
    const input = exports.TenantRegionCreateSchema.parse(data);
    // Default allowedRegions to [homeRegion] if not provided
    if (!input.allowedRegions || input.allowedRegions.length === 0) {
        input.allowedRegions = [input.homeRegion];
    }
    // Ensure homeRegion is in allowedRegions
    if (!input.allowedRegions.includes(input.homeRegion)) {
        input.allowedRegions.push(input.homeRegion);
    }
    // Set regulatory framework based on homeRegion
    input.regulatoryFramework = exports.REGION_REGULATORY_FRAMEWORK[input.homeRegion];
    // Set timestamps
    input.createdAt = new Date();
    input.updatedAt = new Date();
    return validateTenantRegion(input);
}
/**
 * Check if tenant is allowed to access a specific region
 */
function canAccessRegion(tenant, region) {
    return tenant.allowedRegions.includes(region);
}
/**
 * Get regional endpoint for tenant
 */
function getRegionalEndpoint(tenant) {
    return exports.REGION_ENDPOINTS[tenant.homeRegion];
}
/**
 * Check if tenant requires EUDI compliance
 */
function requiresEudiCompliance(tenant) {
    return tenant.homeRegion === Region.EU || tenant.allowedRegions.includes(Region.EU);
}
/**
 * Check if tenant requires HIPAA compliance
 */
function requiresHipaaCompliance(tenant) {
    return tenant.homeRegion === Region.US || tenant.allowedRegions.includes(Region.US);
}
/**
 * Check if tenant can perform cross-region operations
 */
function canPerformCrossRegionSync(tenant) {
    return (tenant.crossRegionSyncEnabled &&
        tenant.allowedRegions.length > 1 &&
        tenant.dataResidencyEnforced // Paradoxically, must have enforcement to enable safe sync
    );
}
/**
 * Default tenant region configurations for common scenarios
 */
exports.DEFAULT_TENANT_REGIONS = {
    /**
     * US-only tenant (typical US healthcare provider)
     */
    US_ONLY: {
        homeRegion: Region.US,
        allowedRegions: [Region.US],
        dataResidencyEnforced: true,
        crossRegionSyncEnabled: false,
        regulatoryFramework: RegulatoryFramework.HIPAA_TEFCA,
        baaExecuted: true,
    },
    /**
     * EU-only tenant (typical EU healthcare provider)
     */
    EU_ONLY: {
        homeRegion: Region.EU,
        allowedRegions: [Region.EU],
        dataResidencyEnforced: true,
        crossRegionSyncEnabled: false,
        regulatoryFramework: RegulatoryFramework.GDPR_EUDI,
        dpiaCompleted: true,
    },
    /**
     * AU-only tenant (typical AU healthcare provider)
     */
    AU_ONLY: {
        homeRegion: Region.AU,
        allowedRegions: [Region.AU],
        dataResidencyEnforced: true,
        crossRegionSyncEnabled: false,
        regulatoryFramework: RegulatoryFramework.PRIVACY_ACT_AU,
    },
    /**
     * Multi-national tenant with US HQ
     */
    MULTI_NATIONAL_US: {
        homeRegion: Region.US,
        allowedRegions: [Region.US, Region.EU, Region.AU],
        dataResidencyEnforced: true,
        crossRegionSyncEnabled: true, // Enable directory sync
        regulatoryFramework: RegulatoryFramework.HIPAA_TEFCA,
        baaExecuted: true,
    },
    /**
     * Multi-national tenant with EU HQ
     */
    MULTI_NATIONAL_EU: {
        homeRegion: Region.EU,
        allowedRegions: [Region.EU, Region.US, Region.AU],
        dataResidencyEnforced: true,
        crossRegionSyncEnabled: true,
        regulatoryFramework: RegulatoryFramework.GDPR_EUDI,
        dpiaCompleted: true,
    },
};
/**
 * Database migration helper
 * Generates SQL for tenant_regions table
 */
function generateTenantRegionMigration() {
    return `
-- Migration: Add Tenant Regional Configuration
-- B139A-INTL-002
-- Generated: ${new Date().toISOString()}

-- Create enum types
CREATE TYPE region AS ENUM ('us', 'eu', 'au');
CREATE TYPE regulatory_framework AS ENUM ('hipaa_tefca', 'gdpr_eudi', 'privacy_act_au', 'pipeda');

-- Create tenant_regions table
CREATE TABLE IF NOT EXISTS tenant_regions (
  tenant_id UUID PRIMARY KEY,
  tenant_name VARCHAR(255) NOT NULL,
  home_region region NOT NULL,
  allowed_regions region[] NOT NULL DEFAULT ARRAY[]::region[],
  data_residency_enforced BOOLEAN NOT NULL DEFAULT TRUE,
  cross_region_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Compliance metadata
  regulatory_framework regulatory_framework NOT NULL,
  baa_executed BOOLEAN DEFAULT FALSE,
  dpo_assigned VARCHAR(255),
  dpia_completed BOOLEAN DEFAULT FALSE,

  -- Migration tracking
  migrated_from region,
  migration_date TIMESTAMP,
  migration_reason TEXT,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  notes TEXT,

  -- Constraints
  CONSTRAINT home_region_in_allowed_regions CHECK (home_region = ANY(allowed_regions)),
  CONSTRAINT allowed_regions_not_empty CHECK (array_length(allowed_regions, 1) > 0)
);

-- Indexes for efficient lookups
CREATE INDEX idx_tenant_regions_home_region ON tenant_regions(home_region);
CREATE INDEX idx_tenant_regions_allowed_regions ON tenant_regions USING GIN(allowed_regions);
CREATE INDEX idx_tenant_regions_tenant_name ON tenant_regions(tenant_name);

-- Index for cross-region sync queries
CREATE INDEX idx_tenant_regions_sync_enabled ON tenant_regions(cross_region_sync_enabled)
  WHERE cross_region_sync_enabled = TRUE;

-- Index for compliance queries
CREATE INDEX idx_tenant_regions_regulatory_framework ON tenant_regions(regulatory_framework);

-- Audit trigger for updated_at
CREATE OR REPLACE FUNCTION update_tenant_regions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_regions_updated_at_trigger
  BEFORE UPDATE ON tenant_regions
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_regions_updated_at();

-- Insert example tenant configurations
INSERT INTO tenant_regions (
  tenant_id,
  tenant_name,
  home_region,
  allowed_regions,
  regulatory_framework,
  baa_executed,
  notes
) VALUES
  (
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::uuid,
    'Example US Healthcare System',
    'us',
    ARRAY['us']::region[],
    'hipaa_tefca',
    TRUE,
    'Example US-only tenant with HIPAA/BAA compliance'
  ),
  (
    'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'::uuid,
    'Example EU Hospital Network',
    'eu',
    ARRAY['eu']::region[],
    'gdpr_eudi',
    FALSE,
    'Example EU-only tenant with GDPR compliance'
  ),
  (
    'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f'::uuid,
    'Example AU Medical Group',
    'au',
    ARRAY['au']::region[],
    'privacy_act_au',
    FALSE,
    'Example AU-only tenant with Privacy Act compliance'
  ),
  (
    'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a'::uuid,
    'Example Multi-National Telehealth',
    'us',
    ARRAY['us', 'eu', 'au']::region[],
    'hipaa_tefca',
    TRUE,
    'Multi-national tenant with cross-region directory sync enabled'
  )
ON CONFLICT (tenant_id) DO NOTHING;

-- Update the example multi-national tenant to enable cross-region sync
UPDATE tenant_regions
SET cross_region_sync_enabled = TRUE
WHERE tenant_id = 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a';

-- Grant permissions (adjust roles as needed)
-- GRANT SELECT, INSERT, UPDATE ON tenant_regions TO app_user;
-- GRANT SELECT ON tenant_regions TO readonly_user;

COMMENT ON TABLE tenant_regions IS 'Regional configuration for multi-region tenant deployment with data residency enforcement';
COMMENT ON COLUMN tenant_regions.home_region IS 'Primary region where tenant data resides (PHI must stay here)';
COMMENT ON COLUMN tenant_regions.allowed_regions IS 'Regions tenant can access (must include home_region)';
COMMENT ON COLUMN tenant_regions.data_residency_enforced IS 'Whether PHI data residency is enforced (should always be TRUE)';
COMMENT ON COLUMN tenant_regions.cross_region_sync_enabled IS 'Allow non-PHI metadata sync across regions for directory services';
COMMENT ON COLUMN tenant_regions.baa_executed IS 'Business Associate Agreement executed (US HIPAA requirement)';
COMMENT ON COLUMN tenant_regions.dpo_assigned IS 'Data Protection Officer assigned (EU GDPR requirement)';
COMMENT ON COLUMN tenant_regions.dpia_completed IS 'Data Protection Impact Assessment completed (EU GDPR requirement)';
`;
}
/**
 * Example usage documentation
 */
exports.USAGE_EXAMPLES = `
# Tenant Region Model Usage Examples

## Create a US-only tenant

\`\`\`typescript
import { validateTenantRegionCreate, Region } from './TenantRegion';

const usOnlyTenant = validateTenantRegionCreate({
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  tenantName: 'Mayo Clinic',
  homeRegion: Region.US,
  // allowedRegions will default to [Region.US]
  baaExecuted: true,
  createdBy: 'admin@vitalcv.com',
  notes: 'US healthcare system, TEFCA participant',
});
\`\`\`

## Create an EU-only tenant (GDPR compliant)

\`\`\`typescript
const euOnlyTenant = validateTenantRegionCreate({
  tenantId: '660e8400-e29b-41d4-a716-446655440001',
  tenantName: 'Charité Berlin',
  homeRegion: Region.EU,
  allowedRegions: [Region.EU],
  dpoAssigned: 'dpo@charite.de',
  dpiaCompleted: true,
  createdBy: 'admin@vitalcv.com',
  notes: 'German university hospital, strict GDPR interpretation',
});
\`\`\`

## Create a multi-national tenant

\`\`\`typescript
const multiNationalTenant = validateTenantRegionCreate({
  tenantId: '770e8400-e29b-41d4-a716-446655440002',
  tenantName: 'Teladoc International',
  homeRegion: Region.US, // HQ in US
  allowedRegions: [Region.US, Region.EU, Region.AU],
  crossRegionSyncEnabled: true, // Enable directory sync
  baaExecuted: true,
  dpiaCompleted: true, // Also EU compliant
  createdBy: 'admin@vitalcv.com',
  notes: 'Global telehealth provider with regional subsidiaries',
});
\`\`\`

## Check region access

\`\`\`typescript
import { canAccessRegion, Region } from './TenantRegion';

const tenant = usOnlyTenant;

canAccessRegion(tenant, Region.US); // true
canAccessRegion(tenant, Region.EU); // false
canAccessRegion(tenant, Region.AU); // false
\`\`\`

## Get regional endpoint

\`\`\`typescript
import { getRegionalEndpoint } from './TenantRegion';

const endpoint = getRegionalEndpoint(usOnlyTenant);
// Returns: 'https://us.api.vitalcv.com'
\`\`\`

## Check compliance requirements

\`\`\`typescript
import { requiresHipaaCompliance, requiresEudiCompliance } from './TenantRegion';

requiresHipaaCompliance(usOnlyTenant); // true
requiresEudiCompliance(usOnlyTenant); // false

requiresHipaaCompliance(multiNationalTenant); // true
requiresEudiCompliance(multiNationalTenant); // true (has EU in allowedRegions)
\`\`\`

## Migrate tenant to different region

\`\`\`typescript
import { TenantRegionUpdate, validateTenantRegion } from './TenantRegion';

// This is a complex operation requiring data export/import
// Only update metadata after migration is complete

const migrationUpdate: TenantRegionUpdate = {
  tenantId: tenant.tenantId,
  // Note: homeRegion cannot be changed via update - requires full migration
  notes: 'Migrated from US to EU on 2025-11-13',
  updatedBy: 'migration-service@vitalcv.com',
};

// After data migration is complete, update tenant record:
const migratedTenant = {
  ...tenant,
  homeRegion: Region.EU, // Only after migration
  allowedRegions: [Region.EU],
  migratedFrom: Region.US,
  migrationDate: new Date(),
  migrationReason: 'Company relocated HQ to Berlin',
  regulatoryFramework: RegulatoryFramework.GDPR_EUDI,
  updatedAt: new Date(),
};
\`\`\`

## Query patterns for region-aware queries

\`\`\`typescript
// In application code, always scope queries to homeRegion

// CORRECT: Region-scoped query
const providers = await db.query(
  'SELECT * FROM providers WHERE tenant_id = $1 AND region = $2',
  [tenant.tenantId, tenant.homeRegion]
);

// INCORRECT: Cross-region query (blocked by regionGuard)
const allProviders = await db.query(
  'SELECT * FROM providers WHERE tenant_id = $1',
  [tenant.tenantId]
);
\`\`\`
`;
