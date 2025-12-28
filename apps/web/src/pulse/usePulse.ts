import { useMemo, useState } from 'react';
import type { PulseEvent } from './types';

const seedEvents: PulseEvent[] = [
  {
    id: 'pulse-001',
    type: 'credential',
    title: 'California medical license verified',
    summary: 'CA license MD-12345 revalidated with state board and anchored to audit log.',
    timestamp: '2024-12-02T14:10:00Z',
    severity: 'success',
    tags: ['verification', 'state-board'],
    links: [
      { label: 'Open Profile', href: '/profile', destination: 'profile' },
      { label: 'Inspect event', href: '#', destination: 'inspect' },
    ],
    relatedEntity: {
      type: 'credential',
      id: 'MD-12345',
      label: 'CA License',
    },
    source: 'State Board • Audit trail',
  },
  {
    id: 'pulse-002',
    type: 'network',
    title: 'New verifier trust path available',
    summary: 'Cascadia Health joined the verifier network; your credentials now resolve with shorter trust path.',
    timestamp: '2024-12-02T12:45:00Z',
    severity: 'info',
    tags: ['network', 'trust-path'],
    links: [
      { label: 'View graph', href: '/graph', destination: 'graph' },
      { label: 'Inspect event', href: '#', destination: 'inspect' },
    ],
    relatedEntity: { type: 'network', label: 'Verifier mesh' },
    source: 'Trust graph monitor',
  },
  {
    id: 'pulse-003',
    type: 'profile',
    title: 'NPPES profile changes detected',
    summary: 'Updated practice location and taxonomy pulled from NPPES for NPI 1234567890.',
    timestamp: '2024-12-01T20:00:00Z',
    severity: 'warning',
    tags: ['nppes', 'profile-drift'],
    links: [
      { label: 'Review profile', href: '/profile', destination: 'profile' },
      { label: 'Inspect event', href: '#', destination: 'inspect' },
    ],
    relatedEntity: {
      type: 'profile',
      id: '1234567890',
      label: 'NPI 1234567890',
    },
    source: 'NPPES watcher',
  },
  {
    id: 'pulse-004',
    type: 'compliance',
    title: 'Audit trail remains clean',
    summary: 'Last 24h: no failed verifications, revocations, or tamper alerts across your credentials.',
    timestamp: '2024-12-01T16:30:00Z',
    severity: 'info',
    tags: ['audit', 'observability'],
    links: [
      { label: 'View profile', href: '/profile', destination: 'profile' },
      { label: 'Inspect event', href: '#', destination: 'inspect' },
    ],
    relatedEntity: { type: 'workflow', label: 'Audit log' },
    source: 'VitalCV Pulse',
  },
];

export function usePulse() {
  const [events, setEvents] = useState<PulseEvent[]>(seedEvents);

  const orderedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [events],
  );

  const refresh = () => setEvents(seedEvents);

  const addEvent = (event: PulseEvent) =>
    setEvents((prev) =>
      [...prev, event].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    );

  return {
    events: orderedEvents,
    refresh,
    addEvent,
  };
}
