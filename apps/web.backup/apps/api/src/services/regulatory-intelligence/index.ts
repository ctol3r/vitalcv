import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface RegulatoryIntel {
  region: string;
  sources: string[];
  changes: Array<{
    authority: string;
    changeType: 'new' | 'updated' | 'removed';
    summary: string;
    impact: string[];
  }>;
  complianceMapping: Record<string, string[]>;
  driftFlags: Array<{
    orgId: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  crossBorderEquivalents: Record<string, string>;
  aiSummary: string;
  updatedAt: string;
}

export async function getRegulatoryIntelligence(region: string): Promise<RegulatoryIntel> {
  const existing = await prisma.regulatoryIntelligence.findFirst({
    where: { region },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing && isRecent(existing.updatedAt)) {
    return existing.intel as RegulatoryIntel;
  }

  const intel = await ingestRegulatoryChanges(region);

  const record = await prisma.regulatoryIntelligence.upsert({
    where: { id: existing?.id ?? 'new' },
    create: {
      region,
      intel,
    },
    update: {
      intel,
      updatedAt: new Date(),
    },
  });

  return record.intel as RegulatoryIntel;
}

async function ingestRegulatoryChanges(region: string): Promise<RegulatoryIntel> {
  // Monitor NCQA, JC, DEA, CMS, AMA, state boards
  const sources = ['NCQA', 'JC', 'DEA', 'CMS', 'AMA', 'STATE_BOARDS'];
  const changes = await detectRuleChanges(region, sources);
  const complianceMapping = await generateComplianceMapping(changes);
  const driftFlags = await detectDrift(region);
  const crossBorderEquivalents = await mapCrossBorderRules(region, changes);
  const aiSummary = await generateAISummary(changes);

  return {
    region,
    sources,
    changes,
    complianceMapping,
    driftFlags,
    crossBorderEquivalents,
    aiSummary,
    updatedAt: new Date().toISOString(),
  };
}

async function detectRuleChanges(region: string, sources: string[]): Promise<RegulatoryIntel['changes']> {
  // Compare old vs new rules
  const changes: RegulatoryIntel['changes'] = [];

  for (const source of sources) {
    // Simulated rule change detection
    const hasChanges = Math.random() > 0.7;
    if (hasChanges) {
      changes.push({
        authority: source,
        changeType: ['new', 'updated', 'removed'][Math.floor(Math.random() * 3)] as any,
        summary: `${source} updated requirements for ${region}`,
        impact: ['credentialing', 'renewal', 'compliance'],
      });
    }
  }

  return changes;
}

async function generateComplianceMapping(changes: RegulatoryIntel['changes']): Promise<Record<string, string[]>> {
  // Auto-compliance remapping
  const mapping: Record<string, string[]> = {};

  for (const change of changes) {
    mapping[change.authority] = change.impact;
  }

  return mapping;
}

async function detectDrift(region: string): Promise<RegulatoryIntel['driftFlags']> {
  // Flag orgs out-of-sync with newest rules
  const flags: RegulatoryIntel['driftFlags'] = [];

  // Simulated drift detection
  if (Math.random() > 0.8) {
    flags.push({
      orgId: `org-${Math.random().toString(36).substr(2, 9)}`,
      reason: 'Missing updated compliance steps',
      severity: 'medium',
    });
  }

  return flags;
}

async function mapCrossBorderRules(region: string, changes: RegulatoryIntel['changes']): Promise<Record<string, string>> {
  // Map rule changes → international equivalents
  const equivalents: Record<string, string> = {};

  for (const change of changes) {
    if (change.authority === 'DEA') {
      equivalents['DEA'] = 'EU_DEA_EQUIVALENT';
    }
  }

  return equivalents;
}

async function generateAISummary(changes: RegulatoryIntel['changes']): Promise<string> {
  // Plain-language summaries of new rules
  if (changes.length === 0) {
    return 'No regulatory changes detected in the monitoring period.';
  }

  return `Detected ${changes.length} regulatory change(s). Key updates include ${changes[0]?.summary ?? 'various compliance requirements'}.`;
}

function isRecent(updatedAt: Date): boolean {
  const hoursAgo = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
  return hoursAgo < 6;
}

export async function anchorRegulatoryIntelligence(region: string, intel: RegulatoryIntel) {
  const intelHash = createHash('sha256').update(JSON.stringify(intel)).digest('hex');

  return anchorEvent('regulatoryIntelligenceAnchored', {
    region,
    intelHash,
    changeCount: intel.changes.length,
    driftFlagCount: intel.driftFlags.length,
    timestamp: new Date().toISOString(),
  });
}








