import { PecosEnrollmentType } from './models/PECOSProvider.js';

export type DiscrepancyField = 'ENROLLMENT_TYPE' | 'SPECIALTY' | 'PRACTICE_LOCATION';

export interface PracticeLocation {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface DiscrepancyContext {
  expectedEnrollmentType?: PecosEnrollmentType;
  specialties?: string[];
  practiceLocations?: PracticeLocation[];
}

export interface PecosSnapshotForComparison {
  enrollmentType: PecosEnrollmentType;
  specialties?: string[];
  practiceLocations?: PracticeLocation[];
}

export interface PecosDiscrepancy {
  field: DiscrepancyField;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
  expected?: string | string[];
  observed?: string | string[];
}

export function detectPecosDiscrepancies(
  snapshot: PecosSnapshotForComparison,
  context: DiscrepancyContext
): PecosDiscrepancy[] {
  const discrepancies: PecosDiscrepancy[] = [];

  if (
    context.expectedEnrollmentType &&
    snapshot.enrollmentType !== context.expectedEnrollmentType
  ) {
    discrepancies.push({
      field: 'ENROLLMENT_TYPE',
      severity: 'CRITICAL',
      message: `Enrollment type mismatch (expected ${context.expectedEnrollmentType}, observed ${snapshot.enrollmentType})`,
      expected: context.expectedEnrollmentType,
      observed: snapshot.enrollmentType,
    });
  }

  if (context.specialties?.length) {
    const observedSpecialties = snapshot.specialties ?? [];
    const missing = context.specialties.filter(
      (spec) => !observedSpecialties.includes(spec)
    );
    if (missing.length === context.specialties.length) {
      discrepancies.push({
        field: 'SPECIALTY',
        severity: 'WARN',
        message: 'No expected specialties found in PECOS snapshot',
        expected: context.specialties,
        observed: observedSpecialties,
      });
    }
  }

  if (context.practiceLocations?.length) {
    const observed = new Set((snapshot.practiceLocations ?? []).map(normalizeLocation));
    const missing = context.practiceLocations.filter(
      (location) => !observed.has(normalizeLocation(location))
    );
    if (missing.length > 0) {
      discrepancies.push({
        field: 'PRACTICE_LOCATION',
        severity: 'WARN',
        message: `${missing.length} practice location(s) missing from PECOS snapshot`,
        expected: context.practiceLocations.map(normalizeLocation),
        observed: Array.from(observed),
      });
    }
  }

  return discrepancies;
}

function normalizeLocation(location: PracticeLocation): string {
  const parts = [location.street, location.city, location.state, location.zip]
    .filter((value) => Boolean(value))
    .map((value) => value?.toString().trim().toUpperCase());
  return parts.join('|') || 'UNKNOWN';
}
import { PecosEnrollmentType } from './models/PECOSProvider.js';

export type DiscrepancyField = 'ENROLLMENT_TYPE' | 'SPECIALTY' | 'PRACTICE_LOCATION';

export interface PracticeLocation {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface DiscrepancyContext {
  expectedEnrollmentType?: PecosEnrollmentType;
  specialties?: string[];
  practiceLocations?: PracticeLocation[];
}

export interface PecosSnapshotForComparison {
  enrollmentType: PecosEnrollmentType;
  specialties?: string[];
  practiceLocations?: PracticeLocation[];
}

export interface PecosDiscrepancy {
  field: DiscrepancyField;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
  expected?: string | string[];
  observed?: string | string[];
}

export function detectPecosDiscrepancies(
  snapshot: PecosSnapshotForComparison,
  context: DiscrepancyContext
): PecosDiscrepancy[] {
  const discrepancies: PecosDiscrepancy[] = [];

  if (
    context.expectedEnrollmentType &&
    snapshot.enrollmentType !== context.expectedEnrollmentType
  ) {
    discrepancies.push({
      field: 'ENROLLMENT_TYPE',
      severity: 'CRITICAL',
      message: `Enrollment type mismatch (expected ${context.expectedEnrollmentType}, observed ${snapshot.enrollmentType})`,
      expected: context.expectedEnrollmentType,
      observed: snapshot.enrollmentType,
    });
  }

  if (context.specialties?.length) {
    const observedSpecialties = snapshot.specialties ?? [];
    const missing = context.specialties.filter(
      (spec) => !observedSpecialties.includes(spec)
    );
    if (missing.length === context.specialties.length) {
      discrepancies.push({
        field: 'SPECIALTY',
        severity: 'WARN',
        message: 'No expected specialties found in PECOS snapshot',
        expected: context.specialties,
        observed: observedSpecialties,
      });
    }
  }

  if (context.practiceLocations?.length) {
    const observed = new Set((snapshot.practiceLocations ?? []).map(normalizeLocation));
    const missing = context.practiceLocations.filter(
      (location) => !observed.has(normalizeLocation(location))
    );
    if (missing.length > 0) {
      discrepancies.push({
        field: 'PRACTICE_LOCATION',
        severity: 'WARN',
        message: `${missing.length} practice location(s) missing from PECOS snapshot`,
        expected: context.practiceLocations.map(normalizeLocation),
        observed: Array.from(observed),
      });
    }
  }

  return discrepancies;
}

function normalizeLocation(location: PracticeLocation): string {
  const parts = [location.street, location.city, location.state, location.zip]
    .filter((value) => Boolean(value))
    .map((value) => value?.toString().trim().toUpperCase());
  return parts.join('|') || 'UNKNOWN';
}


