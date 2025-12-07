import { createHash } from 'crypto';

import type {
  RegulatoryRuleSet,
  RequirementDelta,
  RenewalDelta,
  RuleDiffSummary,
} from './types';

export function computeRuleDiff(
  previous: RegulatoryRuleSet | null | undefined,
  next: RegulatoryRuleSet,
): RuleDiffSummary {
  const prevRequirements = buildRequirementIndex(previous);
  const nextRequirements = buildRequirementIndex(next);

  const newRequirements: RequirementDelta[] = [];
  const removedRequirements: RequirementDelta[] = [];

  for (const [key, detail] of nextRequirements.entries()) {
    if (!prevRequirements.has(key)) {
      newRequirements.push(detail);
    }
  }

  if (previous) {
    for (const [key, detail] of prevRequirements.entries()) {
      if (!nextRequirements.has(key)) {
        removedRequirements.push(detail);
      }
    }
  }

  const changedRenewalWindows = computeRenewalWindowChanges(previous, next);
  const hasChanges =
    newRequirements.length > 0 || removedRequirements.length > 0 || changedRenewalWindows.length > 0;

  const headline = buildHeadline(newRequirements.length, removedRequirements.length, changedRenewalWindows.length, next.authorityCode);
  const tags = buildTags({ newRequirements, removedRequirements, changedRenewalWindows });
  const impactScore = calculateImpactScore(newRequirements.length, removedRequirements.length, changedRenewalWindows.length);

  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        authorityCode: next.authorityCode,
        fetchedAt: next.fetchedAt,
        newRequirements,
        removedRequirements,
        changedRenewalWindows,
      }),
    )
    .digest('hex');

  return {
    hasChanges,
    newRequirements,
    removedRequirements,
    changedRenewalWindows,
    headline,
    tags,
    hash,
    generatedAt: new Date().toISOString(),
    impactScore,
    metadata: {
      newRequirementCount: newRequirements.length,
      removedRequirementCount: removedRequirements.length,
      changedRenewalWindows: changedRenewalWindows.length,
    },
  };
}

function buildRequirementIndex(ruleSet: RegulatoryRuleSet | null | undefined) {
  const map = new Map<string, RequirementDelta>();
  if (!ruleSet) return map;

  for (const category of ruleSet.cme.categories) {
    const key = `cme:${category.code}`;
    map.set(key, {
      label: category.label,
      detail: `${category.minimumHours} hrs / ${category.renewalPeriodMonths} mo`,
      requirementType: 'cme',
    });
  }

  for (const specialty of ruleSet.cme.specialtyRules) {
    const key = `specialty:${specialty.specialty}`;
    map.set(key, {
      label: `${specialty.specialty} CME`,
      detail: `${specialty.minimumHours} hrs (${specialty.enforcementLevel})`,
      requirementType: 'cme',
      specialty: specialty.specialty,
    });
  }

  map.set('mateAct', {
    label: 'MATE Act hours',
    detail: `${ruleSet.controlledSubstances.mateActHours} hrs`,
    requirementType: 'mate',
  });

  ruleSet.controlledSubstances.attestationFields.forEach((field) => {
    map.set(`attestation:${field.field}`, {
      label: field.field,
      detail: field.description,
      requirementType: 'attestation',
    });
  });

  return map;
}

function computeRenewalWindowChanges(
  previous: RegulatoryRuleSet | null | undefined,
  next: RegulatoryRuleSet,
): RenewalDelta[] {
  if (!previous) return [];

  const prevStateIndex = new Map(
    previous.stateRules.states.map((stateRule) => [stateRule.state, stateRule]),
  );

  const deltas: RenewalDelta[] = [];
  for (const stateRule of next.stateRules.states) {
    const baseline = prevStateIndex.get(stateRule.state);
    if (!baseline) continue;

    if (baseline.renewalWindowMonths !== stateRule.renewalWindowMonths) {
      deltas.push({
        state: stateRule.state,
        previousWindow: baseline.renewalWindowMonths,
        currentWindow: stateRule.renewalWindowMonths,
        boardName: stateRule.boardName,
      });
    }
  }

  return deltas;
}

function buildHeadline(
  newCount: number,
  removedCount: number,
  renewalChanges: number,
  authorityCode: string,
) {
  if (newCount > 0 && renewalChanges > 0) {
    return `${authorityCode}: New CME categories and renewal windows updated`;
  }
  if (newCount > 0) {
    return `${authorityCode}: ${newCount} CME requirement${newCount === 1 ? '' : 's'} added`;
  }
  if (renewalChanges > 0) {
    return `${authorityCode}: Renewal windows shifted in ${renewalChanges} jurisdiction${renewalChanges === 1 ? '' : 's'}`;
  }
  if (removedCount > 0) {
    return `${authorityCode}: ${removedCount} requirement${removedCount === 1 ? '' : 's'} removed`;
  }
  return `${authorityCode}: No regulatory deltas detected`;
}

function buildTags(input: {
  newRequirements: RequirementDelta[];
  removedRequirements: RequirementDelta[];
  changedRenewalWindows: RenewalDelta[];
}) {
  const tags = new Set<string>();
  if (input.newRequirements.length) tags.add('new-requirement');
  if (input.removedRequirements.length) tags.add('retired-requirement');
  if (input.changedRenewalWindows.length) tags.add('renewal-shift');
  for (const delta of input.newRequirements) {
    if (delta.specialty) {
      tags.add(`specialty:${delta.specialty.toLowerCase().replace(/\s+/g, '-')}`);
    }
  }
  return Array.from(tags);
}

function calculateImpactScore(newCount: number, removedCount: number, renewalChanges: number) {
  return newCount * 2 + removedCount + renewalChanges * 1.5;
}









