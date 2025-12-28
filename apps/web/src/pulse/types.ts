export type PulseSeverity = 'info' | 'success' | 'warning' | 'critical';

export type PulseEventType =
  | 'credential'
  | 'verification'
  | 'network'
  | 'profile'
  | 'compliance';

export type PulseDestination = 'profile' | 'graph' | 'inspect';

export interface PulseLink {
  label: string;
  href: string;
  destination: PulseDestination;
}

export interface PulseEvent {
  id: string;
  type: PulseEventType;
  title: string;
  summary: string;
  timestamp: string;
  severity: PulseSeverity;
  source?: string;
  relatedEntity?: {
    type: 'credential' | 'profile' | 'network' | 'workflow';
    id?: string;
    label?: string;
  };
  tags?: string[];
  links: PulseLink[];
}
