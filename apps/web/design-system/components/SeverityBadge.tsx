import { Badge } from './Badge';

const SEVERITY_VARIANTS = {
  critical: 'critical',
  high: 'warning',
  medium: 'accent',
  low: 'success',
  info: 'neutral',
} as const;

export function SeverityBadge({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase() as keyof typeof SEVERITY_VARIANTS;
  const variant = SEVERITY_VARIANTS[normalized] ?? 'neutral';
  return <Badge variant={variant}>{severity}</Badge>;
}
