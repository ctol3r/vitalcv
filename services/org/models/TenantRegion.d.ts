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
import { z } from 'zod';
/**
 * Supported regions in the platform
 */
export declare enum Region {
    US = "us",// United States (us-east-1, us-west-2)
    EU = "eu",// European Union (eu-central-1, eu-west-1)
    AU = "au"
}
/**
 * Regional cluster endpoints
 */
export declare const REGION_ENDPOINTS: Record<Region, string>;
/**
 * Regional database endpoints (read-only for metadata)
 */
export declare const REGION_DB_ENDPOINTS: Record<Region, string>;
/**
 * Regulatory framework by region
 */
export declare enum RegulatoryFramework {
    HIPAA_TEFCA = "hipaa_tefca",// US: HIPAA + TEFCA
    GDPR_EUDI = "gdpr_eudi",// EU: GDPR + eIDAS/EUDI
    PRIVACY_ACT_AU = "privacy_act_au",// AU: Privacy Act 1988 + APPs
    PIPEDA = "pipeda"
}
/**
 * Region to regulatory framework mapping
 */
export declare const REGION_REGULATORY_FRAMEWORK: Record<Region, RegulatoryFramework>;
/**
 * Tenant regional configuration schema
 */
export declare const TenantRegionSchema: any;
export type TenantRegion = z.infer<typeof TenantRegionSchema>;
/**
 * Tenant region creation input
 */
export declare const TenantRegionCreateSchema: any;
export type TenantRegionCreate = z.infer<typeof TenantRegionCreateSchema>;
/**
 * Tenant region update input
 */
export declare const TenantRegionUpdateSchema: any;
export type TenantRegionUpdate = z.infer<typeof TenantRegionUpdateSchema>;
/**
 * Validate tenant region configuration
 */
export declare function validateTenantRegion(data: unknown): TenantRegion;
/**
 * Validate tenant region creation
 */
export declare function validateTenantRegionCreate(data: unknown): TenantRegion;
/**
 * Check if tenant is allowed to access a specific region
 */
export declare function canAccessRegion(tenant: TenantRegion, region: Region): boolean;
/**
 * Get regional endpoint for tenant
 */
export declare function getRegionalEndpoint(tenant: TenantRegion): string;
/**
 * Check if tenant requires EUDI compliance
 */
export declare function requiresEudiCompliance(tenant: TenantRegion): boolean;
/**
 * Check if tenant requires HIPAA compliance
 */
export declare function requiresHipaaCompliance(tenant: TenantRegion): boolean;
/**
 * Check if tenant can perform cross-region operations
 */
export declare function canPerformCrossRegionSync(tenant: TenantRegion): boolean;
/**
 * Default tenant region configurations for common scenarios
 */
export declare const DEFAULT_TENANT_REGIONS: {
    /**
     * US-only tenant (typical US healthcare provider)
     */
    US_ONLY: {
        homeRegion: Region;
        allowedRegions: Region[];
        dataResidencyEnforced: boolean;
        crossRegionSyncEnabled: boolean;
        regulatoryFramework: RegulatoryFramework;
        baaExecuted: boolean;
    };
    /**
     * EU-only tenant (typical EU healthcare provider)
     */
    EU_ONLY: {
        homeRegion: Region;
        allowedRegions: Region[];
        dataResidencyEnforced: boolean;
        crossRegionSyncEnabled: boolean;
        regulatoryFramework: RegulatoryFramework;
        dpiaCompleted: boolean;
    };
    /**
     * AU-only tenant (typical AU healthcare provider)
     */
    AU_ONLY: {
        homeRegion: Region;
        allowedRegions: Region[];
        dataResidencyEnforced: boolean;
        crossRegionSyncEnabled: boolean;
        regulatoryFramework: RegulatoryFramework;
    };
    /**
     * Multi-national tenant with US HQ
     */
    MULTI_NATIONAL_US: {
        homeRegion: Region;
        allowedRegions: Region[];
        dataResidencyEnforced: boolean;
        crossRegionSyncEnabled: boolean;
        regulatoryFramework: RegulatoryFramework;
        baaExecuted: boolean;
    };
    /**
     * Multi-national tenant with EU HQ
     */
    MULTI_NATIONAL_EU: {
        homeRegion: Region;
        allowedRegions: Region[];
        dataResidencyEnforced: boolean;
        crossRegionSyncEnabled: boolean;
        regulatoryFramework: RegulatoryFramework;
        dpiaCompleted: boolean;
    };
};
/**
 * Database migration helper
 * Generates SQL for tenant_regions table
 */
export declare function generateTenantRegionMigration(): string;
/**
 * Example usage documentation
 */
export declare const USAGE_EXAMPLES = "\n# Tenant Region Model Usage Examples\n\n## Create a US-only tenant\n\n```typescript\nimport { validateTenantRegionCreate, Region } from './TenantRegion';\n\nconst usOnlyTenant = validateTenantRegionCreate({\n  tenantId: '550e8400-e29b-41d4-a716-446655440000',\n  tenantName: 'Mayo Clinic',\n  homeRegion: Region.US,\n  // allowedRegions will default to [Region.US]\n  baaExecuted: true,\n  createdBy: 'admin@vitalcv.com',\n  notes: 'US healthcare system, TEFCA participant',\n});\n```\n\n## Create an EU-only tenant (GDPR compliant)\n\n```typescript\nconst euOnlyTenant = validateTenantRegionCreate({\n  tenantId: '660e8400-e29b-41d4-a716-446655440001',\n  tenantName: 'Charit\u00E9 Berlin',\n  homeRegion: Region.EU,\n  allowedRegions: [Region.EU],\n  dpoAssigned: 'dpo@charite.de',\n  dpiaCompleted: true,\n  createdBy: 'admin@vitalcv.com',\n  notes: 'German university hospital, strict GDPR interpretation',\n});\n```\n\n## Create a multi-national tenant\n\n```typescript\nconst multiNationalTenant = validateTenantRegionCreate({\n  tenantId: '770e8400-e29b-41d4-a716-446655440002',\n  tenantName: 'Teladoc International',\n  homeRegion: Region.US, // HQ in US\n  allowedRegions: [Region.US, Region.EU, Region.AU],\n  crossRegionSyncEnabled: true, // Enable directory sync\n  baaExecuted: true,\n  dpiaCompleted: true, // Also EU compliant\n  createdBy: 'admin@vitalcv.com',\n  notes: 'Global telehealth provider with regional subsidiaries',\n});\n```\n\n## Check region access\n\n```typescript\nimport { canAccessRegion, Region } from './TenantRegion';\n\nconst tenant = usOnlyTenant;\n\ncanAccessRegion(tenant, Region.US); // true\ncanAccessRegion(tenant, Region.EU); // false\ncanAccessRegion(tenant, Region.AU); // false\n```\n\n## Get regional endpoint\n\n```typescript\nimport { getRegionalEndpoint } from './TenantRegion';\n\nconst endpoint = getRegionalEndpoint(usOnlyTenant);\n// Returns: 'https://us.api.vitalcv.com'\n```\n\n## Check compliance requirements\n\n```typescript\nimport { requiresHipaaCompliance, requiresEudiCompliance } from './TenantRegion';\n\nrequiresHipaaCompliance(usOnlyTenant); // true\nrequiresEudiCompliance(usOnlyTenant); // false\n\nrequiresHipaaCompliance(multiNationalTenant); // true\nrequiresEudiCompliance(multiNationalTenant); // true (has EU in allowedRegions)\n```\n\n## Migrate tenant to different region\n\n```typescript\nimport { TenantRegionUpdate, validateTenantRegion } from './TenantRegion';\n\n// This is a complex operation requiring data export/import\n// Only update metadata after migration is complete\n\nconst migrationUpdate: TenantRegionUpdate = {\n  tenantId: tenant.tenantId,\n  // Note: homeRegion cannot be changed via update - requires full migration\n  notes: 'Migrated from US to EU on 2025-11-13',\n  updatedBy: 'migration-service@vitalcv.com',\n};\n\n// After data migration is complete, update tenant record:\nconst migratedTenant = {\n  ...tenant,\n  homeRegion: Region.EU, // Only after migration\n  allowedRegions: [Region.EU],\n  migratedFrom: Region.US,\n  migrationDate: new Date(),\n  migrationReason: 'Company relocated HQ to Berlin',\n  regulatoryFramework: RegulatoryFramework.GDPR_EUDI,\n  updatedAt: new Date(),\n};\n```\n\n## Query patterns for region-aware queries\n\n```typescript\n// In application code, always scope queries to homeRegion\n\n// CORRECT: Region-scoped query\nconst providers = await db.query(\n  'SELECT * FROM providers WHERE tenant_id = $1 AND region = $2',\n  [tenant.tenantId, tenant.homeRegion]\n);\n\n// INCORRECT: Cross-region query (blocked by regionGuard)\nconst allProviders = await db.query(\n  'SELECT * FROM providers WHERE tenant_id = $1',\n  [tenant.tenantId]\n);\n```\n";
