/**
 * B136A-EHR-005: FHIR Practitioner/PractitionerRole → VitalCV Provider Mapper
 *
 * Maps EHR FHIR R6 Practitioner and PractitionerRole resources to VitalCV provider records.
 * Supports common Epic/Cerner fields with null mapping for missing fields.
 */

/**
 * FHIR R6 Practitioner Resource (simplified)
 */
export interface FhirPractitioner {
  resourceType: 'Practitioner';
  id: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: { coding?: Array<{ system?: string; code?: string }> };
  }>;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  gender?: string;
  birthDate?: string;
  qualification?: Array<{
    identifier?: Array<{ system?: string; value?: string }>;
    code?: {
      coding?: Array<{ system?: string; code?: string; display?: string }>;
      text?: string;
    };
    period?: { start?: string; end?: string };
    issuer?: { display?: string };
  }>;
}

/**
 * FHIR R6 PractitionerRole Resource (simplified)
 */
export interface FhirPractitionerRole {
  resourceType: 'PractitionerRole';
  id: string;
  practitioner?: { reference?: string; display?: string };
  organization?: { reference?: string; display?: string };
  code?: Array<{
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  }>;
  specialty?: Array<{
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  }>;
  location?: Array<{ reference?: string; display?: string }>;
  period?: { start?: string; end?: string };
  active?: boolean;
}

/**
 * VitalCV Provider Record
 */
export interface VitalCVProvider {
  // Core identifiers
  npi?: string;
  ehrId: string;
  externalId?: string;

  // Name
  firstName?: string;
  lastName?: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
  displayName?: string;

  // Contact
  email?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };

  // Demographics
  gender?: string;
  birthDate?: string;

  // Professional
  specialty?: string;
  specialtyCode?: string;
  role?: string;
  roleCode?: string;
  organization?: string;
  organizationId?: string;

  // Qualifications
  qualifications?: Array<{
    type?: string;
    code?: string;
    display?: string;
    issuer?: string;
    startDate?: string;
    endDate?: string;
  }>;

  // Status
  active?: boolean;
  effectiveStart?: string;
  effectiveEnd?: string;

  // Metadata
  source: 'ehr';
  sourceSystem?: string;
  lastSynced: Date;
}

/**
 * Map FHIR Practitioner to VitalCV Provider
 */
export function mapPractitionerToProvider(
  practitioner: FhirPractitioner,
  sourceSystem?: string
): VitalCVProvider {
  // Extract NPI from identifiers
  const npi = extractNPI(practitioner.identifier);

  // Extract primary name
  const primaryName = practitioner.name?.find(n => n.use === 'official') || practitioner.name?.[0];

  // Extract primary telecom
  const email = practitioner.telecom?.find(t => t.system === 'email')?.value;
  const phone = practitioner.telecom?.find(t => t.system === 'phone')?.value;

  // Extract primary address
  const primaryAddress = practitioner.address?.find(a => a.use === 'work') || practitioner.address?.[0];

  // Extract qualifications
  const qualifications = practitioner.qualification?.map(qual => ({
    type: qual.code?.text,
    code: qual.code?.coding?.[0]?.code,
    display: qual.code?.coding?.[0]?.display,
    issuer: qual.issuer?.display,
    startDate: qual.period?.start,
    endDate: qual.period?.end,
  }));

  return {
    npi,
    ehrId: practitioner.id,
    externalId: practitioner.identifier?.find(id => id.system !== 'http://hl7.org/fhir/sid/us-npi')?.value,

    firstName: primaryName?.given?.[0],
    lastName: primaryName?.family,
    middleName: primaryName?.given?.[1],
    prefix: primaryName?.prefix?.[0],
    suffix: primaryName?.suffix?.[0],
    displayName: formatDisplayName(primaryName),

    email,
    phone,
    address: primaryAddress ? {
      line1: primaryAddress.line?.[0],
      line2: primaryAddress.line?.[1],
      city: primaryAddress.city,
      state: primaryAddress.state,
      zip: primaryAddress.postalCode,
      country: primaryAddress.country,
    } : undefined,

    gender: practitioner.gender,
    birthDate: practitioner.birthDate,

    qualifications,

    active: true, // Default to true for Practitioner
    source: 'ehr',
    sourceSystem,
    lastSynced: new Date(),
  };
}

/**
 * Map FHIR PractitionerRole to VitalCV Provider (enriched)
 */
export function mapPractitionerRoleToProvider(
  role: FhirPractitionerRole,
  practitioner?: FhirPractitioner,
  sourceSystem?: string
): VitalCVProvider {
  // Start with base practitioner mapping if available
  const base = practitioner ? mapPractitionerToProvider(practitioner, sourceSystem) : {
    ehrId: role.practitioner?.reference?.split('/')[1] || role.id,
    source: 'ehr' as const,
    sourceSystem,
    lastSynced: new Date(),
  };

  // Extract role and specialty
  const primaryRole = role.code?.[0];
  const primarySpecialty = role.specialty?.[0];

  return {
    ...base,

    // Role-specific fields
    role: primaryRole?.text || primaryRole?.coding?.[0]?.display,
    roleCode: primaryRole?.coding?.[0]?.code,
    specialty: primarySpecialty?.text || primarySpecialty?.coding?.[0]?.display,
    specialtyCode: primarySpecialty?.coding?.[0]?.code,

    organization: role.organization?.display,
    organizationId: role.organization?.reference?.split('/')[1],

    active: role.active,
    effectiveStart: role.period?.start,
    effectiveEnd: role.period?.end,
  };
}

/**
 * Extract NPI from FHIR identifiers
 */
function extractNPI(identifiers?: Array<{ system?: string; value?: string }>): string | undefined {
  const npiSystem = 'http://hl7.org/fhir/sid/us-npi';
  return identifiers?.find(id => id.system === npiSystem)?.value;
}

/**
 * Format display name from FHIR name
 */
function formatDisplayName(name?: { prefix?: string[]; given?: string[]; family?: string; suffix?: string[] }): string | undefined {
  if (!name) return undefined;

  const parts: string[] = [];
  if (name.prefix?.[0]) parts.push(name.prefix[0]);
  if (name.given?.[0]) parts.push(name.given[0]);
  if (name.family) parts.push(name.family);
  if (name.suffix?.[0]) parts.push(name.suffix[0]);

  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Epic-specific field mappings
 */
export function mapEpicPractitioner(practitioner: FhirPractitioner): VitalCVProvider {
  const base = mapPractitionerToProvider(practitioner, 'epic');

  // Epic-specific extensions or identifiers
  // Example: Epic uses specific identifier systems
  const epicId = practitioner.identifier?.find(id =>
    id.system?.includes('epic') || id.type?.coding?.[0]?.code === 'EPIC'
  )?.value;

  return {
    ...base,
    externalId: epicId || base.externalId,
  };
}

/**
 * Cerner-specific field mappings
 */
export function mapCernerPractitioner(practitioner: FhirPractitioner): VitalCVProvider {
  const base = mapPractitionerToProvider(practitioner, 'cerner');

  // Cerner-specific extensions or identifiers
  const cernerId = practitioner.identifier?.find(id =>
    id.system?.includes('cerner')
  )?.value;

  return {
    ...base,
    externalId: cernerId || base.externalId,
  };
}

