import { createHash } from 'node:crypto';
import {
  DecisionState,
  getMissingCriticalFields,
  isDecisionReady,
  type DecisionProfile,
} from '@vitalcv/trust-state';
import {
  decisionStateLabel,
  safeTruncateText,
  summarizeItemLabels,
} from './pilotReadinessUtils';

export const PILOT_CRITICAL_ITEM_STATUSES = ['complete', 'missing', 'blocked'] as const;
export const DEMO_PATH_STEP_STATUSES = ['complete', 'current', 'pending', 'blocked'] as const;
export const PILOT_SNAPSHOT_LINK_KINDS = ['packet', 'metrics', 'proof', 'review', 'export'] as const;
export const PILOT_NEXT_ACTION_KINDS = [
  'resolve_blocker',
  'complete_critical_item',
  'advance_demo_path',
  'publish_snapshot',
  'share_packet',
] as const;
export const EMPLOYER_OBJECTION_KINDS = [
  'missing_critical_field',
  'snapshot_freshness',
  'source_trust',
  'timeline',
  'general',
] as const;

export type PilotCriticalItemStatus = (typeof PILOT_CRITICAL_ITEM_STATUSES)[number];
export type DemoPathStepStatus = (typeof DEMO_PATH_STEP_STATUSES)[number];
export type PilotSnapshotLinkKind = (typeof PILOT_SNAPSHOT_LINK_KINDS)[number];
export type PilotNextActionKind = (typeof PILOT_NEXT_ACTION_KINDS)[number];
export type EmployerObjectionKind = (typeof EMPLOYER_OBJECTION_KINDS)[number];

export interface PilotCriticalItem {
  id: string;
  label: string;
  status: PilotCriticalItemStatus;
  href: string | null;
  detail?: string | null;
}

export interface DemoPathStep {
  id: string;
  label: string;
  href: string | null;
  status: DemoPathStepStatus;
  required: boolean;
  detail?: string | null;
}

export interface PilotSnapshotLink {
  kind: PilotSnapshotLinkKind;
  label: string;
  href: string;
}

export interface EmployerObjection {
  kind: EmployerObjectionKind;
  label: string;
  text: string;
  normalizedText: string;
  matchedKeyword: string | null;
}

export interface PilotTarget {
  id: string;
  slug: string;
  label: string;
  generatedAt: string;
  decisionProfile: DecisionProfile;
  criticalItems: PilotCriticalItem[];
  demoPath: DemoPathStep[];
  snapshotLinks: PilotSnapshotLink[];
}

export interface PilotDecisionSummary {
  state: DecisionState;
  label: string;
  summary: string;
  missingDecisionFields: readonly string[];
  missingCriticalItems: PilotCriticalItem[];
  blockedCriticalItems: PilotCriticalItem[];
  completedDemoSteps: number;
  totalDemoSteps: number;
  completionPct: number;
  hasSnapshotLinks: boolean;
}

export interface RecommendedNextAction {
  kind: PilotNextActionKind;
  label: string;
  detail: string;
  href: string | null;
}

export type PilotNextAction = RecommendedNextAction;

export interface PilotPacket {
  packetId: string;
  targetId: string;
  targetSlug: string;
  label: string;
  generatedAt: string;
  decisionSummary: PilotDecisionSummary;
  recommendedNextAction: PilotNextAction;
  criticalItems: PilotCriticalItem[];
  demoPath: DemoPathStep[];
  snapshotLinks: PilotSnapshotLink[];
}

export interface PilotMetricsSnapshot {
  generatedAt: string;
  totalTargets: number;
  stateCounts: Record<DecisionState, number>;
  packetsWithSnapshotLinks: number;
  packetsMissingCriticalItems: number;
  blockedTargets: number;
  readyTargets: number;
  averageDemoPathCompletionPct: number;
  nextActionCounts: Record<PilotNextActionKind, number>;
}

export interface PilotReadinessMetrics {
  baseState: DecisionState;
  missingDecisionFields: readonly string[];
  missingCriticalItems: number;
  blockedCriticalItems: number;
  completedDemoSteps: number;
  totalDemoSteps: number;
  hasSnapshotLinks: boolean;
}

export interface PilotReadinessComputation {
  state: DecisionState;
  label: string;
  completionPct: number;
  missingDecisionFields: readonly string[];
  hasSnapshotLinks: boolean;
  isReady: boolean;
}

export interface PilotSnapshot {
  id: string;
  slug: string;
  label: string;
  generatedAt: string;
  decisionProfile: DecisionProfile;
  criticalItems?: readonly PilotCriticalItem[];
  snapshotLinks?: readonly PilotSnapshotLink[];
}

export interface PilotEmployerContext {
  criticalItems?: readonly PilotCriticalItem[];
  demoPath?: readonly DemoPathStep[];
  snapshotUrl?: string | null;
  snapshotLabel?: string | null;
  snapshotKind?: PilotSnapshotLinkKind;
}

export interface RecommendedNextActionInput {
  blockedCriticalItems: readonly PilotCriticalItem[];
  missingCriticalItems: readonly PilotCriticalItem[];
  demoPath: readonly DemoPathStep[];
  snapshotLinks: readonly PilotSnapshotLink[];
}

export interface SimulatedProviderScenario {
  id: string;
  label: string;
  count: number;
  decisionProfile: DecisionProfile;
  criticalItems: PilotCriticalItem[];
  demoPath: DemoPathStep[];
  snapshotLinks: PilotSnapshotLink[];
}

export interface DecisionDistribution {
  generatedAt: string;
  totalProviders: number;
  stateCounts: Record<DecisionState, number>;
  averageCompletionPct: number;
  providersWithSnapshotLinks: number;
  providersMissingCriticalItems: number;
}

const STEP_STATUS_PRIORITY: ReadonlyArray<DemoPathStepStatus> = ['current', 'pending', 'blocked'];
const EMPLOYER_OBJECTION_PATTERNS: ReadonlyArray<{
  kind: EmployerObjectionKind;
  label: string;
  pattern: RegExp;
}> = [
  {
    kind: 'missing_critical_field',
    label: 'Missing critical field',
    pattern: /\b(missing|incomplete|absent|blank|required)\b|\b(no|without)\s+(field|packet|snapshot|receipt|link|review)\b/i,
  },
  {
    kind: 'snapshot_freshness',
    label: 'Snapshot freshness',
    pattern: /\b(stale|expired|outdated|fresh|freshness|old)\b/i,
  },
  {
    kind: 'source_trust',
    label: 'Source trust',
    pattern: /\b(primary source|source-backed|source backed|receipt|proof|verify|verification|authority|trust)\b/i,
  },
  {
    kind: 'timeline',
    label: 'Timeline',
    pattern: /\b(day|days|week|weeks|month|months|slow|delay|delayed|timing|start date|start)\b/i,
  },
];

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function firstIncompleteRequiredStep(steps: readonly DemoPathStep[]): DemoPathStep | null {
  for (const status of STEP_STATUS_PRIORITY) {
    const match = steps.find((step) => step.required && step.status === status);
    if (match) {
      return match;
    }
  }

  return null;
}

function completionPct(completedSteps: number, totalSteps: number): number {
  if (totalSteps <= 0) {
    return 0;
  }

  return Number(((completedSteps / totalSteps) * 100).toFixed(2));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function toSlugSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'provider';
}

function cloneCriticalItem(item: PilotCriticalItem): PilotCriticalItem {
  return {
    ...item,
  };
}

function cloneDemoPathStep(step: DemoPathStep): DemoPathStep {
  return {
    ...step,
  };
}

function cloneSnapshotLink(link: PilotSnapshotLink): PilotSnapshotLink {
  return {
    ...link,
  };
}

function cloneDecisionProfile(profile: DecisionProfile): DecisionProfile {
  return {
    identity: profile.identity ? { ...profile.identity } : profile.identity ?? undefined,
    employment: profile.employment ? { ...profile.employment } : profile.employment ?? undefined,
  };
}

function getRequiredDemoPathStats(steps: readonly DemoPathStep[]): {
  completedDemoSteps: number;
  totalDemoSteps: number;
} {
  const requiredSteps = steps.filter((step) => step.required);
  return {
    completedDemoSteps: requiredSteps.filter((step) => step.status === 'complete').length,
    totalDemoSteps: requiredSteps.length,
  };
}

function isPilotTarget(value: PilotTarget | PilotSnapshot): value is PilotTarget {
  return 'demoPath' in value;
}

function isRecommendedNextActionInput(
  value: PilotTarget | RecommendedNextActionInput,
): value is RecommendedNextActionInput {
  return !('id' in value);
}

function appendSnapshotLink(
  links: readonly PilotSnapshotLink[],
  employerContext?: PilotEmployerContext,
): PilotSnapshotLink[] {
  const normalizedLinks = links.map((link) => cloneSnapshotLink(link));
  const snapshotUrl = employerContext?.snapshotUrl?.trim();

  if (!snapshotUrl) {
    return normalizedLinks;
  }

  if (normalizedLinks.some((link) => link.href === snapshotUrl)) {
    return normalizedLinks;
  }

  normalizedLinks.push({
    kind: employerContext?.snapshotKind ?? 'review',
    label: employerContext?.snapshotLabel?.trim() || 'Employer snapshot',
    href: snapshotUrl,
  });

  return normalizedLinks;
}

function normalizePilotTarget(
  targetOrSnapshot: PilotTarget | PilotSnapshot,
  employerContext?: PilotEmployerContext,
): PilotTarget {
  if (isPilotTarget(targetOrSnapshot)) {
    return {
      ...targetOrSnapshot,
      decisionProfile: cloneDecisionProfile(targetOrSnapshot.decisionProfile),
      criticalItems: targetOrSnapshot.criticalItems.map((item) => cloneCriticalItem(item)),
      demoPath: targetOrSnapshot.demoPath.map((step) => cloneDemoPathStep(step)),
      snapshotLinks: appendSnapshotLink(targetOrSnapshot.snapshotLinks, employerContext),
    };
  }

  return {
    id: targetOrSnapshot.id,
    slug: targetOrSnapshot.slug,
    label: targetOrSnapshot.label,
    generatedAt: targetOrSnapshot.generatedAt,
    decisionProfile: cloneDecisionProfile(targetOrSnapshot.decisionProfile),
    criticalItems: [
      ...(targetOrSnapshot.criticalItems ?? []).map((item) => cloneCriticalItem(item)),
      ...(employerContext?.criticalItems ?? []).map((item) => cloneCriticalItem(item)),
    ],
    demoPath: (employerContext?.demoPath ?? []).map((step) => cloneDemoPathStep(step)),
    snapshotLinks: appendSnapshotLink(targetOrSnapshot.snapshotLinks ?? [], employerContext),
  };
}

function normalizeNextActionInput(
  input: PilotTarget | RecommendedNextActionInput,
  summary?: PilotDecisionSummary,
): RecommendedNextActionInput {
  if (isRecommendedNextActionInput(input)) {
    return input;
  }

  return {
    blockedCriticalItems: summary?.blockedCriticalItems ?? input.criticalItems.filter((item) => item.status === 'blocked'),
    missingCriticalItems: summary?.missingCriticalItems ?? input.criticalItems.filter((item) => item.status === 'missing'),
    demoPath: input.demoPath,
    snapshotLinks: input.snapshotLinks,
  };
}

function buildDecisionSummaryText(input: {
  targetLabel: string;
  state: DecisionState;
  missingCriticalItems: readonly PilotCriticalItem[];
  blockedCriticalItems: readonly PilotCriticalItem[];
  nextStep: DemoPathStep | null;
}): string {
  const targetLabel = safeTruncateText(input.targetLabel, 72);

  if (input.blockedCriticalItems.length > 0) {
    return `${targetLabel} is blocked by ${summarizeItemLabels(input.blockedCriticalItems, {
      emptyLabel: 'a critical blocker',
    })}.`;
  }

  if (input.missingCriticalItems.length > 0) {
    return `${targetLabel} is waiting on ${summarizeItemLabels(input.missingCriticalItems, {
      emptyLabel: 'a critical item',
    })}.`;
  }

  if (input.state === DecisionState.CONDITIONAL && input.nextStep) {
    return `${targetLabel} is conditionally ready and still needs ${safeTruncateText(input.nextStep.label, 56)}.`;
  }

  if (input.state === DecisionState.READY) {
    return `${targetLabel} is ready for pilot review.`;
  }

  return `${targetLabel} needs operator action before pilot review.`;
}

function buildPacketId(target: PilotTarget, summary: PilotDecisionSummary): string {
  return createHash('sha256')
    .update(stableStringify({
      targetId: target.id,
      slug: target.slug,
      generatedAt: target.generatedAt,
      decisionProfile: target.decisionProfile,
      criticalItems: target.criticalItems,
      demoPath: target.demoPath,
      snapshotLinks: target.snapshotLinks,
      state: summary.state,
    }))
    .digest('hex')
    .slice(0, 16);
}

function emptyStateCounts(): Record<DecisionState, number> {
  return {
    [DecisionState.READY]: 0,
    [DecisionState.CONDITIONAL]: 0,
    [DecisionState.BLOCKED]: 0,
    [DecisionState.ACTION_REQUIRED]: 0,
  };
}

function emptyNextActionCounts(): Record<PilotNextActionKind, number> {
  return {
    resolve_blocker: 0,
    complete_critical_item: 0,
    advance_demo_path: 0,
    publish_snapshot: 0,
    share_packet: 0,
  };
}

export function categorizeObjection(text: string): EmployerObjection {
  const normalizedText = normalizeText(text);

  for (const candidate of EMPLOYER_OBJECTION_PATTERNS) {
    const match = normalizedText.match(candidate.pattern);
    if (match) {
      return {
        kind: candidate.kind,
        label: candidate.label,
        text,
        normalizedText,
        matchedKeyword: normalizeText(match[0] ?? ''),
      };
    }
  }

  return {
    kind: 'general',
    label: 'General',
    text,
    normalizedText,
    matchedKeyword: null,
  };
}

export function computePilotReadiness(metrics: PilotReadinessMetrics): PilotReadinessComputation {
  const state = metrics.blockedCriticalItems > 0 || metrics.baseState === DecisionState.BLOCKED
    ? DecisionState.BLOCKED
    : metrics.missingCriticalItems > 0 || metrics.baseState === DecisionState.ACTION_REQUIRED
      ? DecisionState.ACTION_REQUIRED
      : metrics.baseState === DecisionState.CONDITIONAL || metrics.completedDemoSteps < metrics.totalDemoSteps
        ? DecisionState.CONDITIONAL
        : DecisionState.READY;

  return {
    state,
    label: decisionStateLabel(state),
    completionPct: completionPct(metrics.completedDemoSteps, metrics.totalDemoSteps),
    missingDecisionFields: metrics.missingDecisionFields,
    hasSnapshotLinks: metrics.hasSnapshotLinks,
    isReady: state === DecisionState.READY,
  };
}

export function summarizeDecisionState(target: PilotTarget): PilotDecisionSummary {
  const baseState = isDecisionReady(target.decisionProfile);
  const missingDecisionFields = getMissingCriticalFields(target.decisionProfile);
  const missingCriticalItems = target.criticalItems.filter((item) => item.status === 'missing');
  const blockedCriticalItems = target.criticalItems.filter((item) => item.status === 'blocked');
  const { completedDemoSteps, totalDemoSteps } = getRequiredDemoPathStats(target.demoPath);
  const nextStep = firstIncompleteRequiredStep(target.demoPath);
  const readiness = computePilotReadiness({
    baseState,
    missingDecisionFields,
    missingCriticalItems: missingCriticalItems.length,
    blockedCriticalItems: blockedCriticalItems.length,
    completedDemoSteps,
    totalDemoSteps,
    hasSnapshotLinks: target.snapshotLinks.length > 0,
  });

  return {
    state: readiness.state,
    label: readiness.label,
    summary: buildDecisionSummaryText({
      targetLabel: target.label,
      state: readiness.state,
      missingCriticalItems,
      blockedCriticalItems,
      nextStep,
    }),
    missingDecisionFields: readiness.missingDecisionFields,
    missingCriticalItems,
    blockedCriticalItems,
    completedDemoSteps,
    totalDemoSteps,
    completionPct: readiness.completionPct,
    hasSnapshotLinks: readiness.hasSnapshotLinks,
  };
}

export function getRecommendedNextAction(
  target: PilotTarget,
  summary?: PilotDecisionSummary,
): RecommendedNextAction;
export function getRecommendedNextAction(
  input: RecommendedNextActionInput,
): RecommendedNextAction;
export function getRecommendedNextAction(
  targetOrInput: PilotTarget | RecommendedNextActionInput,
  summary?: PilotDecisionSummary,
): RecommendedNextAction {
  const input = normalizeNextActionInput(
    targetOrInput,
    !isRecommendedNextActionInput(targetOrInput)
      ? (summary ?? summarizeDecisionState(targetOrInput))
      : undefined,
  );
  const blockedItem = input.blockedCriticalItems[0] ?? null;
  if (blockedItem) {
    return {
      kind: 'resolve_blocker',
      label: `Resolve ${safeTruncateText(blockedItem.label, 56)}`,
      detail: safeTruncateText(
        blockedItem.detail ?? 'A blocked critical item is preventing the pilot path from progressing.',
        140,
      ),
      href: blockedItem.href,
    };
  }

  const missingItem = input.missingCriticalItems[0] ?? null;
  if (missingItem) {
    return {
      kind: 'complete_critical_item',
      label: `Complete ${safeTruncateText(missingItem.label, 56)}`,
      detail: safeTruncateText(
        missingItem.detail ?? 'This critical item must be completed before the pilot target is review-ready.',
        140,
      ),
      href: missingItem.href,
    };
  }

  const nextStep = firstIncompleteRequiredStep(input.demoPath);
  if (nextStep) {
    return {
      kind: 'advance_demo_path',
      label: `Open ${safeTruncateText(nextStep.label, 56)}`,
      detail: safeTruncateText(nextStep.detail ?? 'Advance the next required demo-path step.', 140),
      href: nextStep.href,
    };
  }

  if (input.snapshotLinks.length === 0) {
    return {
      kind: 'publish_snapshot',
      label: 'Publish pilot snapshot',
      detail: 'Add at least one packet or metrics snapshot before sharing this pilot target.',
      href: null,
    };
  }

  const preferredLink = input.snapshotLinks[0] ?? null;
  return {
    kind: 'share_packet',
    label: 'Share pilot packet',
    detail: 'Decision state is ready and the supporting snapshot links are present.',
    href: preferredLink?.href ?? null,
  };
}

export function buildPilotPacket(target: PilotTarget): PilotPacket;
export function buildPilotPacket(
  snapshot: PilotSnapshot,
  employerContext: PilotEmployerContext,
): PilotPacket;
export function buildPilotPacket(
  targetOrSnapshot: PilotTarget | PilotSnapshot,
  employerContext?: PilotEmployerContext,
): PilotPacket {
  const target = normalizePilotTarget(targetOrSnapshot, employerContext);
  const decisionSummary = summarizeDecisionState(target);

  return {
    packetId: buildPacketId(target, decisionSummary),
    targetId: target.id,
    targetSlug: target.slug,
    label: target.label,
    generatedAt: target.generatedAt,
    decisionSummary,
    recommendedNextAction: getRecommendedNextAction(target, decisionSummary),
    criticalItems: [...target.criticalItems],
    demoPath: [...target.demoPath],
    snapshotLinks: [...target.snapshotLinks],
  };
}

export function simulateProviderSet(input: {
  generatedAt: string;
  scenarios: readonly SimulatedProviderScenario[];
}): PilotTarget[] {
  const targets: PilotTarget[] = [];

  input.scenarios.forEach((scenario, scenarioIndex) => {
    if (!Number.isInteger(scenario.count) || scenario.count < 0) {
      throw new Error(`Scenario ${scenario.id} must declare a non-negative integer count.`);
    }

    const slugBase = toSlugSegment(scenario.id);
    for (let providerIndex = 0; providerIndex < scenario.count; providerIndex += 1) {
      const ordinal = providerIndex + 1;
      const sequencePrefix = `${scenarioIndex + 1}`;
      targets.push({
        id: `${sequencePrefix}-${slugBase}-${ordinal}`,
        slug: `${sequencePrefix}-${slugBase}-${ordinal}`,
        label: `${scenario.label} ${ordinal}`,
        generatedAt: input.generatedAt,
        decisionProfile: cloneDecisionProfile(scenario.decisionProfile),
        criticalItems: scenario.criticalItems.map((item) => cloneCriticalItem(item)),
        demoPath: scenario.demoPath.map((step) => cloneDemoPathStep(step)),
        snapshotLinks: scenario.snapshotLinks.map((link) => cloneSnapshotLink(link)),
      });
    }
  });

  return targets;
}

export function computeDecisionDistribution(
  targets: readonly PilotTarget[],
  generatedAt: string,
): DecisionDistribution {
  const stateCounts = emptyStateCounts();
  let completionTotal = 0;
  let providersWithSnapshotLinks = 0;
  let providersMissingCriticalItems = 0;

  for (const target of targets) {
    const summary = summarizeDecisionState(target);
    stateCounts[summary.state] += 1;
    completionTotal += summary.completionPct;

    if (summary.hasSnapshotLinks) {
      providersWithSnapshotLinks += 1;
    }

    if (summary.missingCriticalItems.length > 0) {
      providersMissingCriticalItems += 1;
    }
  }

  return {
    generatedAt,
    totalProviders: targets.length,
    stateCounts,
    averageCompletionPct: targets.length > 0
      ? Number((completionTotal / targets.length).toFixed(2))
      : 0,
    providersWithSnapshotLinks,
    providersMissingCriticalItems,
  };
}

export function computePilotMetrics(
  packets: readonly PilotPacket[],
  generatedAt = new Date().toISOString(),
): PilotMetricsSnapshot {
  const stateCounts = emptyStateCounts();
  const nextActionCounts = emptyNextActionCounts();

  let packetsWithSnapshotLinks = 0;
  let packetsMissingCriticalItems = 0;
  let blockedTargets = 0;
  let readyTargets = 0;
  let completionTotal = 0;

  for (const packet of packets) {
    stateCounts[packet.decisionSummary.state] += 1;
    nextActionCounts[packet.recommendedNextAction.kind] += 1;

    if (packet.snapshotLinks.length > 0) {
      packetsWithSnapshotLinks += 1;
    }

    if (packet.decisionSummary.missingCriticalItems.length > 0) {
      packetsMissingCriticalItems += 1;
    }

    if (packet.decisionSummary.state === DecisionState.BLOCKED) {
      blockedTargets += 1;
    }

    if (packet.decisionSummary.state === DecisionState.READY) {
      readyTargets += 1;
    }

    completionTotal += packet.decisionSummary.completionPct;
  }

  return {
    generatedAt,
    totalTargets: packets.length,
    stateCounts,
    packetsWithSnapshotLinks,
    packetsMissingCriticalItems,
    blockedTargets,
    readyTargets,
    averageDemoPathCompletionPct: packets.length > 0
      ? Number((completionTotal / packets.length).toFixed(2))
      : 0,
    nextActionCounts,
  };
}
