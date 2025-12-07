import { randomUUID } from 'node:crypto';
import type { RecruiterAlert } from '../alerts/recruiter';

export type SurgeTemplateId = 'flu-season-rn' | 'ed-staffing' | 'summer-trauma';

export interface SurgeTemplate {
  id: SurgeTemplateId;
  title: string;
  description: string;
  season: string;
  defaultRegions: string[];
  specialties: string[];
  compactRecommended: boolean;
  readinessGate: number;
}

export interface SurgeJobGroup {
  id: string;
  templateId: SurgeTemplateId;
  specialty: string;
  headcount: number;
  regions: string[];
  readinessGate: number;
  compactMultiplier: number;
  alertMessage: string;
}

export interface SurgePlan {
  template: SurgeTemplate;
  jobGroups: SurgeJobGroup[];
  alerts: RecruiterAlert[];
}

export const SURGE_TEMPLATES: SurgeTemplate[] = [
  {
    id: 'flu-season-rn',
    title: 'Flu Season RN Surge',
    description: 'High-volume respiratory triage and infusion coverage for Q4 peaks.',
    season: 'Oct–Feb',
    defaultRegions: ['NY', 'IL', 'WA'],
    specialties: ['RN', 'Urgent Care', 'Respiratory'],
    compactRecommended: true,
    readinessGate: 0.78,
  },
  {
    id: 'ed-staffing',
    title: 'Emergency Department Staffing',
    description: 'ED float pool to absorb 18% visit spikes across coastal metros.',
    season: 'Year-round',
    defaultRegions: ['CA', 'TX', 'FL'],
    specialties: ['Emergency Medicine', 'Trauma', 'Critical Care'],
    compactRecommended: true,
    readinessGate: 0.82,
  },
  {
    id: 'summer-trauma',
    title: 'Summer Trauma Surge',
    description: 'Supports level-one trauma centers during peak travel season.',
    season: 'May–Aug',
    defaultRegions: ['AZ', 'NV', 'CO'],
    specialties: ['Trauma Surgery', 'Ortho Trauma', 'Anesthesiology'],
    compactRecommended: false,
    readinessGate: 0.8,
  },
];

export function buildSurgePlan(templateId: SurgeTemplateId, orgId: string, regions?: string[]): SurgePlan {
  const template = SURGE_TEMPLATES.find((entry) => entry.id === templateId);
  if (!template) {
    throw new Error(`Unknown surge template ${templateId}`);
  }

  const targetRegions = regions && regions.length ? regions : template.defaultRegions;
  const jobGroups: SurgeJobGroup[] = template.specialties.map((specialty, index) => ({
    id: `${template.id}-${orgId}-${index}`,
    templateId: template.id,
    specialty,
    headcount: specialty.toLowerCase().includes('rn') ? 18 : 8,
    regions: targetRegions,
    readinessGate: template.readinessGate,
    compactMultiplier: template.compactRecommended ? 2.5 : 1,
    alertMessage: `${specialty} surge group ready for ${targetRegions.join(', ')}`,
  }));

  const alerts: RecruiterAlert[] = jobGroups.map((group) => ({
    id: randomUUID(),
    clinicianId: 'surge-pool',
    type: 'surgePoolMatch',
    severity: group.compactMultiplier > 2 ? 'info' : 'warning',
    message: `${group.specialty} surge group created (${group.headcount} seats, readiness ≥ ${Math.round(group.readinessGate * 100)}%)`,
    metadata: {
      templateId: template.id,
      regions: group.regions,
      compactMultiplier: group.compactMultiplier,
    },
    createdAt: new Date().toISOString(),
  }));

  return {
    template,
    jobGroups,
    alerts,
  };
}


