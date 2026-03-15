import type {
  StorylineCluster,
  StorylineEngineConfig,
  StorylineEvidenceItem,
  StorylineSnapshot,
  StorylineType,
} from './storylineEngine';
import type { StorylineRanking } from './storylineRanker';

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stripEntityPrefix(value: string): string {
  const [, rawValue] = value.split(':');
  return rawValue ?? value;
}

function displayEntity(cluster: StorylineCluster): string {
  if (cluster.providerIds.length === 1) {
    return `provider ${stripEntityPrefix(cluster.providerIds[0]!)}`;
  }

  if (cluster.institutionIds.length === 1) {
    return `institution ${titleCaseWords(stripEntityPrefix(cluster.institutionIds[0]!).replace(/[-_]+/g, ' '))}`;
  }

  return `${cluster.entityIds.length} linked entities`;
}

function storylineLead(type: StorylineType, subject: string): string {
  switch (type) {
    case 'trust decline':
      return `Trust pressure is building around ${subject}.`;
    case 'rising investigator':
      return `Research momentum is accelerating for ${subject}.`;
    case 'network emergence':
      return `A new relationship pattern is emerging across ${subject}.`;
    case 'compliance risk':
      return `Compliance exposure is concentrating around ${subject}.`;
    case 'workforce opportunity':
      return `A workforce opportunity is opening around ${subject}.`;
    case 'institution shift':
      return `An institutional shift is underway for ${subject}.`;
    case 'industry influence':
      return `Industry influence is expanding across ${subject}.`;
    default:
      return `A storyline is developing around ${subject}.`;
  }
}

function storylineWhyItMatters(type: StorylineType, subject: string): string {
  switch (type) {
    case 'trust decline':
      return `This matters because repeated trust degradation can change credential acceptance decisions, trigger watchtower escalation, and weaken explainability for ${subject}.`;
    case 'rising investigator':
      return `This matters because growing research momentum can change network centrality, grant attractiveness, and investigator prioritization for ${subject}.`;
    case 'network emergence':
      return `This matters because a new network pattern can reveal hidden concentration risk, influence flows, or collaboration pathways around ${subject}.`;
    case 'compliance risk':
      return `This matters because unresolved compliance signals can become launch-blocking trust failures for ${subject}.`;
    case 'workforce opportunity':
      return `This matters because converging hiring and readiness signals can indicate a near-term placement or deployment path for ${subject}.`;
    case 'institution shift':
      return `This matters because institution movement changes affiliation confidence, referral routing, and network explainability for ${subject}.`;
    case 'industry influence':
      return `This matters because funding or sponsor concentration can change conflict-of-interest review and influence assessment for ${subject}.`;
    default:
      return `This matters because fragmented findings become more actionable once they are tracked as a single narrative for ${subject}.`;
  }
}

function storylineTitle(type: StorylineType, subject: string): string {
  switch (type) {
    case 'trust decline':
      return `Trust risk rising for ${subject}`;
    case 'rising investigator':
      return `Research momentum building for ${subject}`;
    case 'network emergence':
      return `Network pattern emerging across ${subject}`;
    case 'compliance risk':
      return `Compliance pressure forming around ${subject}`;
    case 'workforce opportunity':
      return `Workforce opportunity forming around ${subject}`;
    case 'institution shift':
      return `Institution shift detected for ${subject}`;
    case 'industry influence':
      return `Industry influence expanding across ${subject}`;
    default:
      return `Storyline developing for ${subject}`;
  }
}

function collectSupportingEvidence(
  cluster: StorylineCluster,
  config: StorylineEngineConfig,
): StorylineEvidenceItem[] {
  const items = cluster.findings.flatMap((finding) => finding.evidence.map((evidence) => ({
    findingId: finding.findingId,
    bullet: `${finding.title}: ${evidence.claim}`,
    source: evidence.source,
    confidence: clamp(evidence.confidence),
    observedAt: evidence.timestamp,
    artifactId: evidence.artifactId,
  })));

  return items
    .sort((left, right) => right.confidence - left.confidence || Date.parse(right.observedAt) - Date.parse(left.observedAt))
    .slice(0, config.maxEvidenceItems);
}

function recommendedActions(
  cluster: StorylineCluster,
  existingStoryline: StorylineSnapshot | undefined,
): string[] {
  const labels = new Set<string>();

  for (const finding of cluster.findings) {
    for (const action of finding.actions) {
      labels.add(action.label);
    }
  }

  switch (cluster.storylineType) {
    case 'trust decline':
      labels.add('Open provider investigation');
      labels.add('Re-verify stale or contradictory source data');
      break;
    case 'compliance risk':
      labels.add('Escalate to compliance review');
      labels.add('Capture resolution notes before launch');
      break;
    case 'rising investigator':
      labels.add('Validate new research signals');
      labels.add('Save storyline into investigator brief');
      break;
    case 'network emergence':
      labels.add('Inspect graph neighbors and shared institutions');
      break;
    case 'workforce opportunity':
      labels.add('Route to workforce or placement review');
      break;
    case 'institution shift':
      labels.add('Verify institution affiliation changes');
      break;
    case 'industry influence':
      labels.add('Review sponsor and payment concentration');
      break;
    default:
      break;
  }

  if (existingStoryline?.status === 'quiet') {
    labels.add('Review whether quiet storyline should reactivate');
  }

  return [...labels].slice(0, 5);
}

export interface StorylineExplanation {
  title: string;
  summary: string;
  supportingEvidence: StorylineEvidenceItem[];
  whyItMatters: string;
  recommendedActions: string[];
}

export function explainStoryline(input: {
  cluster: StorylineCluster;
  ranking: StorylineRanking;
  existingStoryline?: StorylineSnapshot;
  config: StorylineEngineConfig;
}): StorylineExplanation {
  const { cluster, ranking, existingStoryline, config } = input;
  const subject = displayEntity(cluster);
  const evidence = collectSupportingEvidence(cluster, config);
  const title = storylineTitle(cluster.storylineType, subject);
  const lead = storylineLead(cluster.storylineType, subject);
  const timespanDays = Math.max(
    0,
    Math.round((Date.parse(cluster.lastObservedAt) - Date.parse(cluster.firstObservedAt)) / (1000 * 60 * 60 * 24)),
  );
  const summary = [
    lead,
    `${cluster.findings.length} finding${cluster.findings.length === 1 ? '' : 's'} were grouped into this storyline`,
    timespanDays > 0 ? `over ${timespanDays} day${timespanDays === 1 ? '' : 's'}` : 'in the current review window',
    `with ${Math.round(ranking.confidence * 100)}% confidence`,
    `and ${ranking.severity} severity.`,
    evidence.length > 0 ? `The evidence chain is led by ${evidence[0]!.bullet}.` : '',
  ].join(' ').replace(/\s+/g, ' ').trim();

  return {
    title,
    summary,
    supportingEvidence: evidence,
    whyItMatters: storylineWhyItMatters(cluster.storylineType, subject),
    recommendedActions: recommendedActions(cluster, existingStoryline),
  };
}
