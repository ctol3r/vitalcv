export interface DidHistory {
  clinicianId: string;
  timeline: Array<{
    timestamp: string;
    did: string;
    method: string;
    action: 'created' | 'updated' | 'synced' | 'revoked';
  }>;
}

export function historyViewer(clinicianId: string): DidHistory {
  const timeline = Array.from({ length: 5 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (4 - i));

    return {
      timestamp: date.toISOString(),
      did: `did:key:${Math.random().toString(36).substr(2, 9)}`,
      method: ['key', 'web', 'ion'][i % 3] as string,
      action: ['created', 'updated', 'synced', 'revoked'][i % 4] as DidHistory['timeline'][0]['action'],
    };
  });

  return {
    clinicianId,
    timeline,
  };
}








