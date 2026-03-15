import { createHash } from 'node:crypto';
import type {
  StorylineCluster,
  StorylineEngineConfig,
  StorylineFindingInput,
  StorylinePerspective,
  StorylineType,
} from './storylineEngine';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256Hex(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hoursBetween(left: string, right: string): number {
  return Math.abs(Date.parse(left) - Date.parse(right)) / (1000 * 60 * 60);
}

function intersectionSize(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right);
  let shared = 0;
  for (const entry of left) {
    if (rightSet.has(entry)) {
      shared += 1;
    }
  }

  return shared;
}

function normalizeWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

function topKeywords(findings: StorylineFindingInput[]): string[] {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    const words = new Set([
      ...normalizeWords(finding.title),
      ...normalizeWords(finding.summary),
      ...normalizeWords(finding.explanation),
    ]);
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([word]) => word);
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function recurrenceSignature(finding: StorylineFindingInput): string {
  const anchorEntities = finding.providerIds.length > 0
    ? finding.providerIds
    : finding.institutionIds.length > 0
      ? finding.institutionIds
      : finding.entityIds.slice(0, 3);
  return [finding.category, ...dedupe(anchorEntities)].join('|');
}

function recurrencePattern(count: number): StorylineCluster['recurrencePattern'] {
  if (count >= 4) {
    return 'persistent';
  }
  if (count === 3) {
    return 'recurring';
  }
  if (count === 2) {
    return 'emerging';
  }
  return 'isolated';
}

function hasKeyword(finding: StorylineFindingInput, pattern: RegExp): boolean {
  return pattern.test(`${finding.title} ${finding.summary} ${finding.explanation}`.toLowerCase());
}

function inferStorylineType(findings: StorylineFindingInput[]): StorylineType {
  const categories = new Set(findings.map((finding) => finding.category));
  const trustWeightedCluster =
    categories.has('TRUST_DECLINE')
    || categories.has('DIVERGENCE')
    || categories.has('FRESHNESS');

  if (findings.some((finding) => hasKeyword(finding, /\b(grant|nih|trial|publication|research|principal investigator)\b/))) {
    return 'rising investigator';
  }

  if (findings.some((finding) => hasKeyword(finding, /\b(move|moved|shift|affiliation|organization)\b/))) {
    return 'institution shift';
  }

  if (findings.some((finding) => hasKeyword(finding, /\b(payment|industry|sponsor|funding|manufacturer)\b/))) {
    return 'industry influence';
  }

  if (categories.has('WORKFORCE_PRESSURE') || findings.some((finding) => hasKeyword(finding, /\b(hiring|staffing|opportunity|open role)\b/))) {
    return 'workforce opportunity';
  }

  if (categories.has('NETWORK_EMERGENCE') || findings.some((finding) => hasKeyword(finding, /\b(network|cluster|collaboration|coauthor)\b/))) {
    return 'network emergence';
  }

  if (
    trustWeightedCluster
    && !categories.has('EXCLUSION')
    && findings.some((finding) => hasKeyword(finding, /\b(trust|freshness|stale|mismatch|decline)\b/))
  ) {
    return 'trust decline';
  }

  if (
    categories.has('COMPLIANCE')
    || categories.has('EXCLUSION')
    || findings.some((finding) => hasKeyword(finding, /\b(compliance|licensure|sanction|exclusion|board action|stale license)\b/))
  ) {
    return 'compliance risk';
  }

  if (trustWeightedCluster) {
    return 'trust decline';
  }

  return 'network emergence';
}

function inferPerspective(findings: StorylineFindingInput[], storylineType: StorylineType): StorylinePerspective {
  const providerIds = dedupe(findings.flatMap((finding) => finding.providerIds));
  const institutionIds = dedupe(findings.flatMap((finding) => finding.institutionIds));

  if (storylineType === 'network emergence' || storylineType === 'industry influence') {
    return 'network';
  }

  if (providerIds.length === 1 && institutionIds.length <= 1) {
    return 'provider';
  }

  if (providerIds.length === 0 && institutionIds.length >= 1) {
    return 'institution';
  }

  if (institutionIds.length > 1 || providerIds.length > 1) {
    return 'network';
  }

  return providerIds.length > 0 ? 'provider' : 'institution';
}

function normalizedEntityOverlap(left: StorylineFindingInput, right: StorylineFindingInput): number {
  const shared = intersectionSize(left.entityIds, right.entityIds);
  const denominator = Math.max(1, Math.min(left.entityIds.length, right.entityIds.length));
  return clamp(shared / denominator);
}

function normalizedGraphOverlap(left: StorylineFindingInput, right: StorylineFindingInput): number {
  const leftGraph = [...left.graphEntityIds, ...left.providerIds, ...left.institutionIds];
  const rightGraph = [...right.graphEntityIds, ...right.providerIds, ...right.institutionIds];
  const shared = intersectionSize(leftGraph, rightGraph);
  const denominator = Math.max(1, Math.min(leftGraph.length, rightGraph.length));
  return clamp(shared / denominator);
}

function normalizedTemporalProximity(
  left: StorylineFindingInput,
  right: StorylineFindingInput,
  config: StorylineEngineConfig,
): number {
  const deltaHours = hoursBetween(left.createdAt, right.createdAt);
  if (deltaHours <= 24) {
    return 1;
  }
  return clamp(1 - deltaHours / Math.max(1, config.temporalWindowHours));
}

function normalizedTypeAffinity(left: StorylineFindingInput, right: StorylineFindingInput): number {
  const sameCategory = left.category === right.category ? 1 : 0;
  const relatedFinding = left.relatedFindingIds.includes(right.findingId)
    || right.relatedFindingIds.includes(left.findingId);
  const keywordOverlap = intersectionSize(
    normalizeWords(`${left.title} ${left.summary}`),
    normalizeWords(`${right.title} ${right.summary}`),
  );

  return clamp(
    sameCategory * 0.55
      + (relatedFinding ? 0.3 : 0)
      + Math.min(keywordOverlap, 3) * 0.08,
  );
}

function normalizedRecurrence(
  left: StorylineFindingInput,
  right: StorylineFindingInput,
  recurrenceCounts: Map<string, number>,
): number {
  const leftKey = recurrenceSignature(left);
  const rightKey = recurrenceSignature(right);
  if (leftKey !== rightKey) {
    return 0;
  }

  return clamp(((recurrenceCounts.get(leftKey) ?? 1) - 1) / 3);
}

function pairSimilarity(
  left: StorylineFindingInput,
  right: StorylineFindingInput,
  config: StorylineEngineConfig,
  recurrenceCounts: Map<string, number>,
): {
  score: number;
  entityOverlap: number;
  temporalProximity: number;
  graphProximity: number;
  typeAffinity: number;
  recurrence: number;
} {
  const entityOverlap = normalizedEntityOverlap(left, right);
  const temporalProximity = normalizedTemporalProximity(left, right, config);
  const graphProximity = normalizedGraphOverlap(left, right);
  const typeAffinity = normalizedTypeAffinity(left, right);
  const recurrence = normalizedRecurrence(left, right, recurrenceCounts);

  const score = clamp(
    entityOverlap * 0.38
      + temporalProximity * 0.2
      + graphProximity * 0.18
      + typeAffinity * 0.16
      + recurrence * 0.08,
  );

  return {
    score,
    entityOverlap,
    temporalProximity,
    graphProximity,
    typeAffinity,
    recurrence,
  };
}

class UnionFind {
  private readonly parent = new Map<number, number>();

  constructor(size: number) {
    for (let index = 0; index < size; index += 1) {
      this.parent.set(index, index);
    }
  }

  find(index: number): number {
    const parent = this.parent.get(index);
    if (parent === undefined || parent === index) {
      return index;
    }

    const root = this.find(parent);
    this.parent.set(index, root);
    return root;
  }

  union(left: number, right: number): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) {
      this.parent.set(rightRoot, leftRoot);
    }
  }
}

function firstObservedAt(findings: StorylineFindingInput[]): string {
  return [...findings]
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))[0]?.createdAt
    ?? new Date().toISOString();
}

function lastObservedAt(findings: StorylineFindingInput[]): string {
  return [...findings]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]?.createdAt
    ?? new Date().toISOString();
}

function fingerprintForCluster(
  storylineType: StorylineType,
  perspective: StorylinePerspective,
  findings: StorylineFindingInput[],
): string {
  const providerIds = dedupe(findings.flatMap((finding) => finding.providerIds)).slice(0, 4);
  const institutionIds = dedupe(findings.flatMap((finding) => finding.institutionIds)).slice(0, 4);
  const entityIds = dedupe(findings.flatMap((finding) => finding.entityIds)).slice(0, 8);
  const recurrenceKeys = dedupe(findings.map(recurrenceSignature));

  return sha256Hex({
    storylineType,
    perspective,
    providerIds,
    institutionIds,
    entityIds,
    recurrenceKeys,
  }).slice(0, 24);
}

export function clusterFindings(input: {
  findings: StorylineFindingInput[];
  now: string;
  config: StorylineEngineConfig;
}): StorylineCluster[] {
  const findings = input.findings;
  if (findings.length === 0) {
    return [];
  }

  const recurrenceCounts = new Map<string, number>();
  for (const finding of findings) {
    const key = recurrenceSignature(finding);
    recurrenceCounts.set(key, (recurrenceCounts.get(key) ?? 0) + 1);
  }

  const unionFind = new UnionFind(findings.length);
  const pairScores = new Map<string, ReturnType<typeof pairSimilarity>>();

  for (let leftIndex = 0; leftIndex < findings.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < findings.length; rightIndex += 1) {
      const similarity = pairSimilarity(
        findings[leftIndex]!,
        findings[rightIndex]!,
        input.config,
        recurrenceCounts,
      );
      pairScores.set(`${leftIndex}:${rightIndex}`, similarity);
      if (similarity.score >= input.config.clusterThreshold) {
        unionFind.union(leftIndex, rightIndex);
      }
    }
  }

  const grouped = new Map<number, StorylineFindingInput[]>();
  for (let index = 0; index < findings.length; index += 1) {
    const root = unionFind.find(index);
    const group = grouped.get(root) ?? [];
    group.push(findings[index]!);
    grouped.set(root, group);
  }

  return [...grouped.values()].map((group) => {
    const storylineType = inferStorylineType(group);
    const perspective = inferPerspective(group, storylineType);
    const fingerprint = fingerprintForCluster(storylineType, perspective, group);
    let entityOverlap = group.length === 1 ? 1 : 0;
    let temporalProximity = group.length === 1 ? 1 : 0;
    let graphProximity = group.length === 1 ? 0.5 : 0;
    let typeAffinity = group.length === 1 ? 1 : 0;
    let recurrence = group.length === 1
      ? normalizedRecurrence(group[0]!, group[0]!, recurrenceCounts)
      : 0;
    let cohesion = group.length === 1 ? 1 : 0;
    let pairCount = 0;

    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const originalLeft = findings.indexOf(group[leftIndex]!);
        const originalRight = findings.indexOf(group[rightIndex]!);
        const similarity = pairScores.get(
          `${Math.min(originalLeft, originalRight)}:${Math.max(originalLeft, originalRight)}`,
        );
        if (!similarity) {
          continue;
        }
        pairCount += 1;
        entityOverlap += similarity.entityOverlap;
        temporalProximity += similarity.temporalProximity;
        graphProximity += similarity.graphProximity;
        typeAffinity += similarity.typeAffinity;
        recurrence += similarity.recurrence;
        cohesion += similarity.score;
      }
    }

    const normalizer = Math.max(1, pairCount);
    const recurrenceCount = Math.max(
      1,
      ...group.map((finding) => recurrenceCounts.get(recurrenceSignature(finding)) ?? 1),
    );

    return {
      clusterId: `stlcl_${fingerprint}`,
      fingerprint,
      storylineType,
      perspective,
      findings: [...group].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
      entityIds: dedupe(group.flatMap((finding) => finding.entityIds)),
      providerIds: dedupe(group.flatMap((finding) => finding.providerIds)),
      institutionIds: dedupe(group.flatMap((finding) => finding.institutionIds)),
      firstObservedAt: firstObservedAt(group),
      lastObservedAt: lastObservedAt(group),
      recurrencePattern: recurrencePattern(recurrenceCount),
      featureScores: {
        entityOverlap: clamp(entityOverlap / normalizer),
        temporalProximity: clamp(temporalProximity / normalizer),
        graphProximity: clamp(graphProximity / normalizer),
        typeAffinity: clamp(typeAffinity / normalizer),
        recurrence: clamp(recurrence / normalizer),
        cohesion: clamp(cohesion / normalizer),
      },
      dominantKeywords: topKeywords(group),
      metadata: {
        generatedAt: input.now,
        recurrenceCount,
        pairCount,
      },
    } satisfies StorylineCluster;
  });
}
