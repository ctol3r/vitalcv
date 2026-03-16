import { Badge } from './Badge';

function classifyRisk(score: number) {
  if (score >= 75) {
    return { label: 'High risk', color: 'critical' as const };
  }

  if (score >= 50) {
    return { label: 'Medium risk', color: 'warning' as const };
  }

  return { label: 'Low risk', color: 'success' as const };
}

export function RiskScoreBadge({ score }: { score: number }) {
  const risk = classifyRisk(score);

  return (
    <Badge variant={risk.color}>
      {risk.label} {score}
    </Badge>
  );
}
