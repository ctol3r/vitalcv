import { Badge } from './Badge';

function classifyConfidence(value: number) {
  if (value >= 0.8) {
    return 'success' as const;
  }

  if (value >= 0.6) {
    return 'accent' as const;
  }

  if (value >= 0.4) {
    return 'warning' as const;
  }

  return 'critical' as const;
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  return <Badge variant={classifyConfidence(confidence)}>{pct}% confidence</Badge>;
}
