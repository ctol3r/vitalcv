export interface ResponsivenessScore {
  orgId: string;
  score: number;
  metrics: {
    avgResponseTime: number;
    interviewRate: number;
    offerRate: number;
    timeToOffer: number;
  };
}

export function responsivenessEngine(orgId: string): ResponsivenessScore {
  return {
    orgId,
    score: Math.round((0.6 + Math.random() * 0.3) * 100) / 100, // 0.6-0.9
    metrics: {
      avgResponseTime: Math.round((1 + Math.random() * 2) * 10) / 10, // 1-3 days
      interviewRate: Math.round((0.3 + Math.random() * 0.4) * 100) / 100, // 30-70%
      offerRate: Math.round((0.2 + Math.random() * 0.3) * 100) / 100, // 20-50%
      timeToOffer: Math.round((7 + Math.random() * 14)), // 7-21 days
    },
  };
}








