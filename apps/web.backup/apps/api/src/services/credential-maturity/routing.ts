export interface MaturityRouting {
  orgId: string;
  clinicianId: string;
  preferred: boolean;
  reason: string;
  score: number;
}

export function maturityRouting(orgId: string, clinicianId: string): MaturityRouting {
  const score = Math.random() * 0.3 + 0.7; // 0.7-1.0
  const preferred = score > 0.8;

  return {
    orgId,
    clinicianId,
    preferred,
    reason: preferred
      ? 'High maturity organization with automated verification'
      : 'Standard maturity organization',
    score: Math.round(score * 100) / 100,
  };
}








