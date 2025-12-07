export interface DowngradeAlert {
  clinicianId: string;
  risk: 'low' | 'medium' | 'high';
  alerts: Array<{
    did: string;
    issue: string;
    severity: string;
  }>;
}

export function downgradeAlert(clinicianId: string): DowngradeAlert {
  const hasRisk = Math.random() > 0.8;

  const alerts = hasRisk ? [
    {
      did: `did:key:${Math.random().toString(36).substr(2, 9)}`,
      issue: 'DID method downgrade detected',
      severity: 'high',
    },
  ] : [];

  return {
    clinicianId,
    risk: hasRisk ? 'high' : 'low',
    alerts,
  };
}








