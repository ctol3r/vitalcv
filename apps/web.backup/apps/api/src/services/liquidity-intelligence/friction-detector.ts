export interface FrictionBottleneck {
  region: string;
  bottlenecks: Array<{
    stage: string;
    avgDelay: number;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export function frictionDetector(region: string): FrictionBottleneck {
  const stages = ['job_post', 'credential_verify', 'interview', 'offer', 'onboarding'];

  const bottlenecks = stages.map(stage => {
    const delay = Math.random() * 10 + 2; // 2-12 days
    let severity: 'low' | 'medium' | 'high';
    if (delay < 5) severity = 'low';
    else if (delay < 8) severity = 'medium';
    else severity = 'high';

    return {
      stage,
      avgDelay: Math.round(delay * 10) / 10,
      severity,
    };
  });

  return {
    region,
    bottlenecks,
  };
}








