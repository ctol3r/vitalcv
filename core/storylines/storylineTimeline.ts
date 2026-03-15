import { createHash } from 'node:crypto';
import type {
  StorylineCluster,
  StorylineEngineConfig,
  StorylineSnapshot,
  StorylineStatus,
  StorylineTimeline,
  StorylineTimelineEvent,
} from './storylineEngine';
import type { StorylineRanking } from './storylineRanker';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function makeEventKey(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 24);
}

function hoursSince(timestamp: string, now: string): number {
  return Math.max(0, (Date.parse(now) - Date.parse(timestamp)) / (1000 * 60 * 60));
}

function dedupeEvents(events: StorylineTimelineEvent[]): StorylineTimelineEvent[] {
  const seen = new Set<string>();
  const deduped: StorylineTimelineEvent[] = [];

  for (const event of events.sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))) {
    if (!seen.has(event.eventKey)) {
      deduped.push(event);
      seen.add(event.eventKey);
    }
  }

  return deduped;
}

function countEvents(events: StorylineTimelineEvent[], type: StorylineTimelineEvent['type']): number {
  return events.filter((event) => event.type === type).length;
}

function dormantStatus(
  currentStatus: StorylineStatus,
  lastActivityAt: string,
  now: string,
  config: StorylineEngineConfig,
): StorylineStatus {
  if (currentStatus === 'archived') {
    return 'archived';
  }

  const inactiveHours = hoursSince(lastActivityAt, now);
  if (inactiveHours >= config.archiveThresholdHours) {
    return 'archived';
  }
  if (inactiveHours >= config.resolveThresholdHours) {
    return 'resolved';
  }
  if (inactiveHours >= config.quietThresholdHours) {
    return 'quiet';
  }
  return currentStatus;
}

function buildLifecycleEvent(input: {
  type: StorylineTimelineEvent['type'];
  fromStatus?: StorylineStatus;
  toStatus?: StorylineStatus;
  occurredAt: string;
  findingIds: string[];
  summary: string;
  metadata?: Record<string, unknown>;
}): StorylineTimelineEvent {
  return {
    eventKey: makeEventKey({
      type: input.type,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      occurredAt: input.occurredAt,
      findingIds: input.findingIds,
    }),
    type: input.type,
    summary: input.summary,
    occurredAt: input.occurredAt,
    findingIds: input.findingIds,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    metadata: input.metadata ?? {},
  };
}

function nextStatusForActiveCluster(input: {
  priorStatus?: StorylineStatus;
  ranking: StorylineRanking;
  lastActivityAt: string;
  now: string;
  config: StorylineEngineConfig;
}): StorylineStatus {
  const inactiveHours = hoursSince(input.lastActivityAt, input.now);

  if (input.priorStatus === 'archived' && inactiveHours >= input.config.quietThresholdHours) {
    return 'archived';
  }
  if (input.ranking.shouldEscalate) {
    return 'escalated';
  }
  if (inactiveHours >= input.config.resolveThresholdHours) {
    return 'resolved';
  }
  if (inactiveHours >= input.config.quietThresholdHours) {
    return 'quiet';
  }
  return 'active';
}

function buildStatusTransitionEvent(input: {
  fromStatus?: StorylineStatus;
  toStatus: StorylineStatus;
  occurredAt: string;
  findingIds: string[];
  ranking: StorylineRanking;
}): StorylineTimelineEvent {
  if (input.toStatus === 'escalated') {
    return buildLifecycleEvent({
      type: 'escalated',
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      occurredAt: input.occurredAt,
      findingIds: input.findingIds,
      summary: 'Storyline escalated after progression score crossed the escalation threshold.',
      metadata: {
        progressionScore: input.ranking.progressionScore,
        escalationThreshold: input.ranking.escalationThreshold,
      },
    });
  }

  if (input.toStatus === 'quiet') {
    return buildLifecycleEvent({
      type: 'quiet_period',
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      occurredAt: input.occurredAt,
      findingIds: input.findingIds,
      summary: 'Storyline entered a quiet period because no fresh evidence arrived inside the activity window.',
    });
  }

  if (input.toStatus === 'resolved') {
    return buildLifecycleEvent({
      type: 'resolved',
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      occurredAt: input.occurredAt,
      findingIds: input.findingIds,
      summary: 'Storyline resolved after the evidence stream remained inactive beyond the resolution threshold.',
    });
  }

  if (input.toStatus === 'archived') {
    return buildLifecycleEvent({
      type: 'archived',
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      occurredAt: input.occurredAt,
      findingIds: input.findingIds,
      summary: 'Storyline archived after a prolonged inactive period.',
    });
  }

  return buildLifecycleEvent({
    type: input.fromStatus === 'quiet' || input.fromStatus === 'resolved' ? 'reactivated' : 'update',
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    occurredAt: input.occurredAt,
    findingIds: input.findingIds,
    summary:
      input.fromStatus === 'quiet' || input.fromStatus === 'resolved'
        ? 'Storyline reactivated with new supporting findings.'
        : 'Storyline status remained active with new findings.',
  });
}

export function advanceStorylineTimeline(input: {
  cluster: StorylineCluster;
  ranking: StorylineRanking;
  existingStoryline?: StorylineSnapshot;
  now: string;
  config: StorylineEngineConfig;
}): StorylineTimeline {
  const { cluster, ranking, existingStoryline, now, config } = input;
  const findingIds = cluster.findings.map((finding) => finding.findingId);
  const lastActivityAt = cluster.lastObservedAt;
  const nextStatus = nextStatusForActiveCluster({
    priorStatus: existingStoryline?.status,
    ranking,
    lastActivityAt,
    now,
    config,
  });
  const events = [...(existingStoryline?.timeline.events ?? [])];

  if (!existingStoryline) {
    events.push(buildLifecycleEvent({
      type: 'origin',
      toStatus: nextStatus,
      occurredAt: cluster.firstObservedAt,
      findingIds,
      summary: `Storyline originated from ${cluster.findings.length} related finding${cluster.findings.length === 1 ? '' : 's'}.`,
      metadata: {
        storylineType: cluster.storylineType,
        perspective: cluster.perspective,
      },
    }));
  } else {
    const existingFindingIds = new Set(existingStoryline.findingIds);
    const newFindingIds = findingIds.filter((findingId) => !existingFindingIds.has(findingId));
    if (newFindingIds.length > 0) {
      events.push(buildLifecycleEvent({
        type: 'update',
        occurredAt: cluster.lastObservedAt,
        findingIds: newFindingIds,
        summary: `${newFindingIds.length} new finding${newFindingIds.length === 1 ? '' : 's'} extended the storyline.`,
        metadata: {
          totalFindingCount: findingIds.length,
        },
      }));
    }
  }

  if (existingStoryline?.status !== nextStatus) {
    events.push(buildStatusTransitionEvent({
      fromStatus: existingStoryline?.status,
      toStatus: nextStatus,
      occurredAt: nextStatus === 'quiet' || nextStatus === 'resolved' || nextStatus === 'archived' ? now : cluster.lastObservedAt,
      findingIds,
      ranking,
    }));
  }

  const dedupedEvents = dedupeEvents(events);
  return {
    originEvent: dedupedEvents[0]!,
    events: dedupedEvents,
    quietPeriods: countEvents(dedupedEvents, 'quiet_period'),
    reactivations: countEvents(dedupedEvents, 'reactivated'),
    lastEventAt: dedupedEvents[dedupedEvents.length - 1]!.occurredAt,
    lastActivityAt,
    currentStatus: nextStatus,
  };
}

export function carryForwardStoryline(input: {
  storyline: StorylineSnapshot;
  now: string;
  config: StorylineEngineConfig;
}): StorylineSnapshot {
  const { storyline, now, config } = input;
  const nextStatus = dormantStatus(storyline.status, storyline.lastActivityAt, now, config);
  const events = [...storyline.timeline.events];

  if (nextStatus !== storyline.status) {
    events.push(buildLifecycleEvent({
      type:
        nextStatus === 'quiet'
          ? 'quiet_period'
          : nextStatus === 'resolved'
            ? 'resolved'
            : 'archived',
      fromStatus: storyline.status,
      toStatus: nextStatus,
      occurredAt: now,
      findingIds: storyline.findingIds,
      summary:
        nextStatus === 'quiet'
          ? 'Storyline entered a quiet period because no new findings arrived.'
          : nextStatus === 'resolved'
            ? 'Storyline resolved after prolonged inactivity.'
            : 'Storyline archived after prolonged inactivity.',
    }));
  }

  const dedupedEvents = dedupeEvents(events);
  return {
    ...storyline,
    status: nextStatus,
    updatedAt: nextStatus === storyline.status ? storyline.updatedAt : now,
    progressionScore: Math.max(0, storyline.progressionScore - 0.06),
    noveltyScore: Math.max(0, storyline.noveltyScore - 0.08),
    persistenceScore: Math.min(1, storyline.persistenceScore + 0.03),
    timeline: {
      originEvent: dedupedEvents[0]!,
      events: dedupedEvents,
      quietPeriods: countEvents(dedupedEvents, 'quiet_period'),
      reactivations: countEvents(dedupedEvents, 'reactivated'),
      lastEventAt: dedupedEvents[dedupedEvents.length - 1]!.occurredAt,
      lastActivityAt: storyline.lastActivityAt,
      currentStatus: nextStatus,
    },
  };
}
