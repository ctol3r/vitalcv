import { PrismaClient, type ForeignCredential } from '@prisma/client';
import { anchorEquivalencyEvaluated } from '../audit/anchor';

const prisma = new PrismaClient();

export type EquivalencyLevel = 'FULL' | 'PARTIAL' | 'MANUAL';

export interface EquivalencyDecision {
  credentialId: string;
  country: string;
  foreignType: string;
  foreignDescriptor: string;
  usEquivalent?: string;
  equivalencyLevel: EquivalencyLevel;
  rationale: string;
}

export interface EquivalencySummary {
  clinicianId: string;
  evaluatedAt: string;
  accepted: EquivalencyDecision[];
  pendingManualReview: EquivalencyDecision[];
}

const EU_DIRECTIVE_SPECIALTIES: Record<string, string> = {
  ANAESTHETICS: 'Anesthesiology',
  ANESTHETICS: 'Anesthesiology',
  CARDIOLOGY: 'Cardiovascular Disease',
  CARDIOTHORACIC_SURGERY: 'Cardiothoracic Surgery',
  EMERGENCY_MEDICINE: 'Emergency Medicine',
  ENDOCRINOLOGY: 'Endocrinology',
  GASTROENTEROLOGY: 'Gastroenterology',
  GENERAL_PRACTICE: 'Family Medicine',
  INTERNAL_MEDICINE: 'Internal Medicine',
  NEONATOLOGY: 'Neonatology',
  NEUROLOGY: 'Neurology',
  NEUROSURGERY: 'Neurological Surgery',
  OBSTETRICS_GYNAECOLOGY: 'Obstetrics & Gynecology',
  OBSTETRICS_GYNECOLOGY: 'Obstetrics & Gynecology',
  ONCOLOGY: 'Medical Oncology',
  ORTHOPAEDICS: 'Orthopedic Surgery',
  ORTHOPEDICS: 'Orthopedic Surgery',
  OTOLARYNGOLOGY: 'Otolaryngology',
  PAEDIATRICS: 'Pediatrics',
  PEDIATRICS: 'Pediatrics',
  PLASTIC_SURGERY: 'Plastic Surgery',
  PSYCHIATRY: 'Psychiatry',
  RADIOLOGY: 'Diagnostic Radiology',
  RESPIRATORY_MEDICINE: 'Pulmonary Disease',
  RHEUMATOLOGY: 'Rheumatology',
  UROLOGY: 'Urology',
  VASCULAR_SURGERY: 'Vascular Surgery',
};

export async function evaluateInternationalEquivalency(
  clinicianId: string,
): Promise<EquivalencySummary> {
  const records = await prisma.foreignCredential.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
  });

  const accepted: EquivalencyDecision[] = [];
  const pendingManualReview: EquivalencyDecision[] = [];

  for (const record of records) {
    const decision = evaluateCredential(record);
    if (decision.equivalencyLevel === 'MANUAL') {
      pendingManualReview.push(decision);
    } else {
      accepted.push(decision);
    }

    anchorEquivalencyEvaluated({
      clinicianId,
      credentialId: record.id,
      country: record.country,
      equivalencyLevel: decision.equivalencyLevel,
      usEquivalent: decision.usEquivalent,
    });
  }

  return {
    clinicianId,
    evaluatedAt: new Date().toISOString(),
    accepted,
    pendingManualReview,
  };
}

function evaluateCredential(record: ForeignCredential): EquivalencyDecision {
  if (!record.data || typeof record.data !== 'object') {
    return buildManualDecision(record, 'Missing structured data for equivalency review.');
  }

  const payload = record.data as Record<string, unknown>;
  const descriptor = inferDescriptor(payload);
  const normalizedDescriptor = descriptor.toUpperCase();

  if (record.country === 'UK') {
    if (normalizedDescriptor.includes('GENERAL PRACTICE') || normalizedDescriptor.includes('GENERAL PRACTITIONER') || normalizedDescriptor === 'GP') {
      return {
        credentialId: record.id,
        country: record.country,
        foreignType: record.type,
        foreignDescriptor: descriptor,
        usEquivalent: 'Family Medicine',
        equivalencyLevel: 'FULL',
        rationale: 'GMC license indicates General Practice — aligns with US Family Medicine board.',
      };
    }

    if (normalizedDescriptor.includes('FY2') || normalizedDescriptor.includes('FOUNDATION YEAR 2')) {
      return {
        credentialId: record.id,
        country: record.country,
        foreignType: record.type,
        foreignDescriptor: descriptor,
        usEquivalent: 'PGY1',
        equivalencyLevel: 'PARTIAL',
        rationale: 'UK Foundation Year 2 maps to US PGY-1/Intern requirements.',
      };
    }
  }

  if (record.type === 'EU-Directive' || record.country === 'EU' || record.country === 'EEA') {
    const mapped = EU_DIRECTIVE_SPECIALTIES[normalizedDescriptor.replace(/\s+/g, '_')];
    if (mapped) {
      return {
        credentialId: record.id,
        country: record.country,
        foreignType: record.type,
        foreignDescriptor: descriptor,
        usEquivalent: mapped,
        equivalencyLevel: 'FULL',
        rationale: `EU Directive specialty mapped to US board category: ${mapped}.`,
      };
    }

    return buildManualDecision(
      record,
      'EU Directive specialty not recognized — requires manual board mapping.',
      descriptor,
    );
  }

  return buildManualDecision(record, 'No automated equivalency rule matched.', descriptor);
}

function inferDescriptor(payload: Record<string, unknown>): string {
  const metadata = asRecord(payload.metadata);
  const specialty =
    stringFrom(payload.specialty) ??
    stringFrom(metadata?.specialty) ??
    stringFrom(metadata?.title) ??
    stringFrom(metadata?.grade) ??
    stringFrom(metadata?.role);

  if (specialty) {
    return specialty;
  }

  if (Array.isArray(payload.identifiers) && payload.identifiers.length > 0) {
    return String(payload.identifiers[0]);
  }

  return 'Credential';
}

function stringFrom(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function buildManualDecision(
  record: ForeignCredential,
  rationale: string,
  descriptor?: string,
): EquivalencyDecision {
  return {
    credentialId: record.id,
    country: record.country,
    foreignType: record.type,
    foreignDescriptor: descriptor ?? inferDescriptor((record.data as Record<string, unknown>) ?? {}),
    equivalencyLevel: 'MANUAL',
    rationale,
  };
}

