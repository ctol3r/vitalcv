import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface RegInteropLayerData {
  region: string;
  mappings: {
    us: Record<string, any>;
    uk: Record<string, any>;
    au: Record<string, any>;
    sg: Record<string, any>;
    eu: Record<string, any>;
  };
  conflicts: Array<{
    field: string;
    usValue: any;
    foreignValue: any;
    country: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  harmonizedRules: Array<{
    field: string;
    unifiedRule: any;
    countries: string[];
  }>;
  lineage: Array<{
    timestamp: string;
    change: string;
    version: number;
  }>;
  lastUpdated: string;
}

/**
 * Get regulatory interop layer for a region
 */
export async function getRegInteropLayer(region: string): Promise<RegInteropLayerData | null> {
  const record = await prisma.regInteropLayer.findUnique({
    where: { region },
  });

  if (!record) {
    return null;
  }

  return record.layer as RegInteropLayerData;
}

/**
 * Update regulatory interop layer
 */
export async function updateRegInteropLayer(region: string, layer: RegInteropLayerData): Promise<void> {
  await prisma.regInteropLayer.upsert({
    where: { region },
    create: {
      region,
      layer: layer as any,
      updatedAt: new Date(),
    },
    update: {
      layer: layer as any,
      updatedAt: new Date(),
    },
  });
}

/**
 * Compare regulatory differences across countries
 */
export async function compareRegulatoryDiffs(requirements: {
  us: Record<string, any>;
  uk: Record<string, any>;
  au: Record<string, any>;
  sg: Record<string, any>;
  eu: Record<string, any>;
}): Promise<Array<{
  field: string;
  usValue: any;
  foreignValue: any;
  country: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}>> {
  const conflicts: Array<{
    field: string;
    usValue: any;
    foreignValue: any;
    country: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];

  const countries = ['uk', 'au', 'sg', 'eu'] as const;

  for (const country of countries) {
    const usFields = Object.keys(requirements.us);
    const foreignFields = Object.keys(requirements[country]);

    // Check for missing fields
    for (const field of usFields) {
      if (!(field in requirements[country])) {
        conflicts.push({
          field,
          usValue: requirements.us[field],
          foreignValue: null,
          country,
          severity: 'medium',
        });
      } else if (JSON.stringify(requirements.us[field]) !== JSON.stringify(requirements[country][field])) {
        conflicts.push({
          field,
          usValue: requirements.us[field],
          foreignValue: requirements[country][field],
          country,
          severity: field.includes('required') || field.includes('mandatory') ? 'high' : 'low',
        });
      }
    }

    // Check for extra fields in foreign
    for (const field of foreignFields) {
      if (!(field in requirements.us)) {
        conflicts.push({
          field,
          usValue: null,
          foreignValue: requirements[country][field],
          country,
          severity: 'low',
        });
      }
    }
  }

  return conflicts;
}

/**
 * Translate VitalCV evidence to foreign regulator formats
 */
export async function translateToForeignFormat(
  evidence: Record<string, any>,
  targetCountry: 'uk' | 'au' | 'sg' | 'eu',
): Promise<Record<string, any>> {
  const translations: Record<string, Record<string, string>> = {
    uk: {
      licenseNumber: 'gmcNumber',
      state: 'jurisdiction',
      expirationDate: 'expiryDate',
      boardCertification: 'specialistRegistration',
    },
    au: {
      licenseNumber: 'ahpraNumber',
      state: 'jurisdiction',
      expirationDate: 'expiryDate',
      boardCertification: 'specialistRegistration',
    },
    sg: {
      licenseNumber: 'smcNumber',
      state: 'jurisdiction',
      expirationDate: 'expiryDate',
      boardCertification: 'specialistRegistration',
    },
    eu: {
      licenseNumber: 'professionalId',
      state: 'memberState',
      expirationDate: 'validUntil',
      boardCertification: 'specialistQualification',
    },
  };

  const mapping = translations[targetCountry];
  const translated: Record<string, any> = {};

  for (const [usKey, foreignKey] of Object.entries(mapping)) {
    if (usKey in evidence) {
      translated[foreignKey] = evidence[usKey];
    }
  }

  // Copy unmapped fields
  for (const [key, value] of Object.entries(evidence)) {
    if (!(key in mapping)) {
      translated[key] = value;
    }
  }

  return translated;
}

/**
 * Restrict flows to regulator-approved schemas
 */
export async function validateRegulatorApproval(
  schema: Record<string, any>,
  regulator: string,
): Promise<{
  approved: boolean;
  issues: string[];
}> {
  const approvedSchemas: Record<string, string[]> = {
    us: ['fhir', 'hl7', 'ccda'],
    uk: ['fhir', 'hl7', 'gmc'],
    au: ['fhir', 'hl7', 'ahpra'],
    sg: ['fhir', 'hl7', 'smc'],
    eu: ['fhir', 'hl7', 'eudirective'],
  };

  const approved = approvedSchemas[regulator.toLowerCase()] || [];
  const schemaType = schema.type || schema.format || 'unknown';

  const issues: string[] = [];
  if (!approved.includes(schemaType.toLowerCase())) {
    issues.push(`Schema type ${schemaType} not approved for regulator ${regulator}`);
  }

  return {
    approved: issues.length === 0,
    issues,
  };
}

/**
 * Check regulatory conflicts between countries
 */
export async function checkRegulatoryConflicts(
  requirements: {
    us: Record<string, any>;
    foreign: Record<string, any>;
    country: string;
  },
): Promise<Array<{
  field: string;
  conflict: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}>> {
  const conflicts: Array<{
    field: string;
    conflict: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];

  for (const [field, usValue] of Object.entries(requirements.us)) {
    if (field in requirements.foreign) {
      const foreignValue = requirements.foreign[field];

      if (JSON.stringify(usValue) !== JSON.stringify(foreignValue)) {
        const conflict = `US requires ${JSON.stringify(usValue)} but ${requirements.country} requires ${JSON.stringify(foreignValue)}`;
        const severity = field.includes('required') || field.includes('mandatory') ? 'high' : 'low';

        conflicts.push({
          field,
          conflict,
          severity,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Harmonize equivalent requirements across countries
 */
export async function harmonizeRules(
  requirements: Array<{
    country: string;
    field: string;
    rule: any;
  }>,
): Promise<Array<{
  field: string;
  unifiedRule: any;
  countries: string[];
}>> {
  const harmonized: Array<{
    field: string;
    unifiedRule: any;
    countries: string[];
  }> = [];

  // Group by field
  const fieldMap = new Map<string, Array<{ country: string; rule: any }>>();

  for (const req of requirements) {
    if (!fieldMap.has(req.field)) {
      fieldMap.set(req.field, []);
    }
    fieldMap.get(req.field)!.push({ country: req.country, rule: req.rule });
  }

  // Harmonize each field
  for (const [field, rules] of fieldMap.entries()) {
    // Find common rule (if all rules are the same)
    const firstRule = rules[0].rule;
    const allSame = rules.every((r) => JSON.stringify(r.rule) === JSON.stringify(firstRule));

    if (allSame) {
      harmonized.push({
        field,
        unifiedRule: firstRule,
        countries: rules.map((r) => r.country),
      });
    } else {
      // Use most permissive rule (if applicable)
      harmonized.push({
        field,
        unifiedRule: firstRule, // Default to first, could be improved with smarter logic
        countries: rules.map((r) => r.country),
      });
    }
  }

  return harmonized;
}

/**
 * Track regulatory rule lineage (how rules evolve over time)
 */
export async function trackRegulatoryLineage(
  currentRules: Record<string, any>,
  previousRules?: Record<string, any>,
): Promise<Array<{
  timestamp: string;
  change: string;
  version: number;
}>> {
  const lineage: Array<{
    timestamp: string;
    change: string;
    version: number;
  }> = [];

  if (!previousRules) {
    lineage.push({
      timestamp: new Date().toISOString(),
      change: 'Initial rule set',
      version: 1,
    });
    return lineage;
  }

  // Detect changes
  const currentFields = Object.keys(currentRules);
  const previousFields = Object.keys(previousRules);

  // New fields
  for (const field of currentFields) {
    if (!(field in previousRules)) {
      lineage.push({
        timestamp: new Date().toISOString(),
        change: `Added field: ${field}`,
        version: 2,
      });
    } else if (JSON.stringify(currentRules[field]) !== JSON.stringify(previousRules[field])) {
      lineage.push({
        timestamp: new Date().toISOString(),
        change: `Updated field: ${field}`,
        version: 2,
      });
    }
  }

  // Removed fields
  for (const field of previousFields) {
    if (!(field in currentRules)) {
      lineage.push({
        timestamp: new Date().toISOString(),
        change: `Removed field: ${field}`,
        version: 2,
      });
    }
  }

  return lineage;
}

/**
 * Export cross-border compliance evidence
 */
export async function exportComplianceEvidence(
  clinicianId: string,
  targetCountries: string[],
  evidence: Record<string, any>,
): Promise<{
  evidence: Record<string, any>;
  compliance: Array<{
    country: string;
    compliant: boolean;
    issues: string[];
  }>;
}> {
  const compliance: Array<{
    country: string;
    compliant: boolean;
    issues: string[];
  }> = [];

  for (const country of targetCountries) {
    const issues: string[] = [];
    const translated = await translateToForeignFormat(evidence, country as any);

    // Validate against country requirements
    const validation = await validateRegulatorApproval(translated, country);
    if (!validation.approved) {
      issues.push(...validation.issues);
    }

    compliance.push({
      country,
      compliant: issues.length === 0,
      issues,
    });
  }

  return {
    evidence,
    compliance,
  };
}

/**
 * Anchor regulatory interop layer snapshot
 */
export async function anchorRegInteropSnapshot(region: string): Promise<void> {
  const layer = await getRegInteropLayer(region);
  if (!layer) {
    return;
  }

  anchorEvent('regInteropLayerAnchored', {
    region,
    conflictCount: layer.conflicts.length,
    harmonizedRulesCount: layer.harmonizedRules.length,
    lineageVersion: layer.lineage.length > 0 ? layer.lineage[layer.lineage.length - 1].version : 1,
    timestamp: new Date().toISOString(),
  });
}

