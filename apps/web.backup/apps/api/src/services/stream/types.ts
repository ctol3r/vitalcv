export const STREAM_TOPICS = [
  {
    id: 'clinician-updates',
    label: 'Clinician updates',
    description: 'Issued credentials, wallet updates, and enrollment diffs.',
  },
  {
    id: 'revocations',
    label: 'Revocations',
    description: 'Credential suspensions, revocations, and remediation context.',
  },
  {
    id: 'status-changes',
    label: 'Status changes',
    description: 'Monitoring, readiness, and privilege state transitions.',
  },
] as const;

export type StreamTopic = (typeof STREAM_TOPICS)[number]['id'];

export const STREAM_EVENT_TYPES = [
  'credentialIssued',
  'credentialRevoked',
  'statusUpdated',
  'streamSubscriptionRegistered',
] as const;

export type StreamEventType = (typeof STREAM_EVENT_TYPES)[number];

export interface StreamChainAnchor {
  hash: string;
  network: string;
  anchoredAt: string;
  proof?: string[];
}

export interface StreamEvent {
  id: string;
  orgId: string;
  topic: StreamTopic;
  eventType: StreamEventType;
  payload: Record<string, any>;
  chainAnchor: StreamChainAnchor;
  timestamp: string;
}

export interface StreamEventEnvelope extends StreamEvent {
  deliverTo?: string;
  attempt?: number;
}

export function isStreamTopic(topic: string): topic is StreamTopic {
  return STREAM_TOPICS.some((item) => item.id === topic);
}

export function getTopicMetadata(topic: StreamTopic) {
  return STREAM_TOPICS.find((item) => item.id === topic);
}









