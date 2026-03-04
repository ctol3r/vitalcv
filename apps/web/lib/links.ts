/**
 * Wave 67 — Bidirectional Link System
 *
 * Generates relationship links between entities in the VitalCV trust graph.
 * Each entity can link bidirectionally to related credentials, issuers,
 * decision capsules, employers, and clinicians.
 */

export type EntityType =
  | 'credential'
  | 'issuer'
  | 'clinician'
  | 'employer'
  | 'decision';

export interface EntityLink {
  id: string;
  type: EntityType;
  label: string;
  description?: string;
  href: string;
  /** Inverse relationship label */
  inverseLabel: string;
}

/**
 * Static relationship map — in production this would be API-driven.
 * Demonstrates the bidirectional linking topology.
 */
const ENTITY_GRAPH: Record<string, EntityLink[]> = {
  'cred-ca-license': [
    {
      id: 'issuer-ca-tmb',
      type: 'issuer',
      label: 'CA Medical Board',
      description: 'Primary source for CA physician license',
      href: '/network?entity=issuer-ca-tmb',
      inverseLabel: 'Issues CA License',
    },
    {
      id: 'clinician-001',
      type: 'clinician',
      label: 'Dr. Sarah Chen',
      description: 'Active license holder',
      href: '/holder?npi=1003000126',
      inverseLabel: 'Holds CA License',
    },
    {
      id: 'decision-start-001',
      type: 'decision',
      label: 'Start Attestation #A-7291',
      description: 'Decision capsule requiring this credential',
      href: '/network?entity=decision-start-001',
      inverseLabel: 'Requires CA License',
    },
  ],
  'issuer-ca-tmb': [
    {
      id: 'cred-ca-license',
      type: 'credential',
      label: 'CA Medical License',
      href: '/network?entity=cred-ca-license',
      inverseLabel: 'Issued by CA-TMB',
    },
  ],
  'clinician-001': [
    {
      id: 'cred-ca-license',
      type: 'credential',
      label: 'CA Medical License',
      href: '/network?entity=cred-ca-license',
      inverseLabel: 'Held by Dr. Chen',
    },
    {
      id: 'cred-board-im',
      type: 'credential',
      label: 'Board Cert — Internal Medicine',
      href: '/network?entity=cred-board-im',
      inverseLabel: 'Held by Dr. Chen',
    },
    {
      id: 'employer-mercy',
      type: 'employer',
      label: 'Mercy Health System',
      description: 'Current employer',
      href: '/network?entity=employer-mercy',
      inverseLabel: 'Employs Dr. Chen',
    },
  ],
  'employer-mercy': [
    {
      id: 'clinician-001',
      type: 'clinician',
      label: 'Dr. Sarah Chen',
      href: '/holder?npi=1003000126',
      inverseLabel: 'Employed by Mercy',
    },
    {
      id: 'decision-start-001',
      type: 'decision',
      label: 'Start Attestation #A-7291',
      href: '/network?entity=decision-start-001',
      inverseLabel: 'Initiated by Mercy',
    },
  ],
  'decision-start-001': [
    {
      id: 'cred-ca-license',
      type: 'credential',
      label: 'CA Medical License',
      href: '/network?entity=cred-ca-license',
      inverseLabel: 'Required by Decision',
    },
    {
      id: 'employer-mercy',
      type: 'employer',
      label: 'Mercy Health System',
      href: '/network?entity=employer-mercy',
      inverseLabel: 'Initiated Decision',
    },
    {
      id: 'clinician-001',
      type: 'clinician',
      label: 'Dr. Sarah Chen',
      href: '/holder?npi=1003000126',
      inverseLabel: 'Subject of Decision',
    },
  ],
};

/**
 * Get all bidirectional links for a given entity.
 */
export function generateLinks(entityId: string): EntityLink[] {
  return ENTITY_GRAPH[entityId] ?? [];
}

/**
 * Get links filtered by entity type.
 */
export function getLinksByType(
  entityId: string,
  type: EntityType,
): EntityLink[] {
  return generateLinks(entityId).filter((link) => link.type === type);
}

/**
 * Color mapping for entity types.
 */
export const ENTITY_COLORS: Record<EntityType, string> = {
  credential: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  issuer: 'bg-blue-100 text-blue-700 border-blue-200',
  clinician: 'bg-violet-100 text-violet-700 border-violet-200',
  employer: 'bg-amber-100 text-amber-700 border-amber-200',
  decision: 'bg-teal-100 text-teal-700 border-teal-200',
};

/**
 * Icon labels for entity types (used in UI).
 */
export const ENTITY_LABELS: Record<EntityType, string> = {
  credential: 'Credential',
  issuer: 'Issuer',
  clinician: 'Clinician',
  employer: 'Employer',
  decision: 'Decision',
};
