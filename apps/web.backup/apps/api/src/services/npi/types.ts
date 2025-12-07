export type DriftSeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface NppesAddress {
  addressType: 'LOCATION' | 'MAILING';
  address1: string;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface NppesTaxonomy {
  code: string;
  desc: string;
  primary: boolean;
  state?: string;
  license?: string;
}

export interface NppesRecord {
  npi: string;
  enumerationType: 'NPI-1' | 'NPI-2';
  createdEpoch?: number;
  lastUpdated?: string;
  enumerationDate?: string;
  status?: string;
  basic?: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    credential?: string;
    organizationName?: string;
    soleProprietor?: string;
    gender?: string;
    namePrefix?: string;
    nameSuffix?: string;
    status?: string;
    lastUpdated?: string;
    enumerationDate?: string;
    certificationDate?: string;
    birthDate?: string;
  };
  addresses: NppesAddress[];
  taxonomies: NppesTaxonomy[];
}

export interface IdentityFieldCheck {
  field: 'name' | 'address' | 'taxonomy' | 'enrollmentState';
  expected: string | null;
  observed: string | null;
  matchScore: number;
  drift?: number;
  status: 'match' | 'review' | 'mismatch';
}

export interface IdentityConsistencyReport {
  summaryScore: number;
  fields: IdentityFieldCheck[];
  notes: string[];
  mismatchedFields: string[];
}

export interface SpecialtyMismatch {
  source: 'taxonomy' | 'license' | 'board';
  expected: string | null;
  observed: string | null;
  severity: DriftSeverityLevel;
  details?: string;
}

export interface SpecialtyMismatchReport {
  taxonomy: {
    nppes: string | null;
    license: string | null;
    board: string | null;
  };
  mismatches: SpecialtyMismatch[];
  alignmentScore: number;
}

export interface FraudFlag {
  type: 'duplicateNpi' | 'stolenNpi' | 'dobProxyMismatch';
  severity: DriftSeverityLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface FraudSignalReport {
  flags: FraudFlag[];
  duplicateCount: number;
  riskScore: number;
  summary: string;
}

export interface NpdbCorrelationReport {
  matchedEvents: number;
  unmatchedEvents: number;
  coverageRatio: number;
  lastQueriedAt?: string | null;
  issues: string[];
}

export interface DisambiguationCandidate {
  clinicianId: string;
  clinicianName?: string | null;
  did?: string | null;
  confidence: number;
  reason?: string;
}

export interface DisambiguationReport {
  status: 'unique' | 'collision' | 'undetermined';
  canonicalClinicianId: string;
  canonicalDid?: string | null;
  candidates: DisambiguationCandidate[];
}

export interface ValidationSources {
  nppes: {
    payload: NppesRecord;
    fetchedAt: string;
  };
  license?: {
    id: string;
    state?: string | null;
    licenseNumber?: string | null;
    status?: string | null;
    specialty?: string | null;
    verifiedAt?: string | null;
    expiresAt?: string | null;
  } | null;
  board?: {
    id: string;
    name?: string | null;
    status?: string | null;
    expiresAt?: string | null;
    specialty?: string | null;
  } | null;
  enrollments?: Array<{
    id: string;
    payerName?: string | null;
    status?: string | null;
    states?: string[];
    updatedAt?: string | null;
  }>;
  npdbSignals?: Array<{
    id: string;
    detectedAt: string;
    matched: boolean;
    metadata?: Record<string, unknown> | null;
  }>;
}

export interface ValidationSnapshot {
  npi: string;
  score: number;
  status: 'pass' | 'review' | 'fail';
  summary: string;
  identityConsistency: IdentityConsistencyReport;
  specialty: SpecialtyMismatchReport;
  fraud: FraudSignalReport;
  npdbCorrelation: NpdbCorrelationReport;
  disambiguation: DisambiguationReport;
  sources: ValidationSources;
  generatedAt: string;
}

export interface NpiChangeDelta {
  field: string;
  before: unknown;
  after: unknown;
  delta?: number;
  notes?: string;
}

export interface NpiChangeRecord {
  id: string;
  clinicianId: string;
  npi: string;
  severity: DriftSeverityLevel;
  driftType: 'NPPES_DRIFT';
  summary: string;
  detectedAt: string;
  diffs: NpiChangeDelta[];
  source: string;
  reason?: string;
}

export interface AnchorSummary {
  id: string;
  txHash: string;
  network: string;
  timestamp: string;
}

export interface ClinicianSummary {
  id: string;
  name?: string | null;
  did?: string | null;
  state?: string | null;
  specialty?: string | null;
  email?: string | null;
}

export interface NpiValidationResponse extends ValidationSnapshot {
  clinicianId: string;
  clinician: ClinicianSummary;
  updatedAt: string;
  history: NpiChangeRecord[];
  anchor: AnchorSummary | null;
}









