export interface BridgeAnomaly {
  clinicianId: string;
  anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

export function anomalyDetection(clinicianId: string): BridgeAnomaly {
  const hasAnomaly = Math.random() > 0.7;

  const anomalies = hasAnomaly ? [
    {
      type: 'credential_mismatch',
      severity: 'medium' as const,
      description: 'Credential meaning differs between countries',
    },
  ] : [];

  return {
    clinicianId,
    anomalies,
  };
}








