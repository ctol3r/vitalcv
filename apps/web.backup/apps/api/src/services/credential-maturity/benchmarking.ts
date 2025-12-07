export interface MaturityBenchmark {
  orgId: string;
  score: number;
  percentile: number;
  rank: number;
  totalOrgs: number;
}

export function benchmarkingEngine(orgId: string): MaturityBenchmark {
  const score = Math.random() * 0.4 + 0.5; // 0.5-0.9
  const percentile = Math.round(score * 100);
  const totalOrgs = 1000;
  const rank = Math.round(totalOrgs * (1 - score));

  return {
    orgId,
    score: Math.round(score * 100) / 100,
    percentile,
    rank,
    totalOrgs,
  };
}








