import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, HelpCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TrustOutcome =
  | 'valid'
  | 'revoked'
  | 'uncheckable'
  | 'unknown'
  | 'VALID'
  | 'REVOKED'
  | 'UNCHECKABLE'
  | 'UNKNOWN';

interface TrustOutcomeBadgeProps {
  status: TrustOutcome;
  className?: string;
}

export function TrustOutcomeBadge({ status, className }: TrustOutcomeBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  let variant: 'default' | 'destructive' | 'secondary' | 'outline' = 'default';
  let Icon = HelpCircle;
  let text = 'UNCHECKABLE';
  let colorClass = '';

  switch (normalizedStatus) {
    case 'valid':
      variant = 'default'; // usually black or primary
      colorClass = 'bg-green-500 hover:bg-green-600 border-transparent text-white';
      Icon = CheckCircle2;
      text = 'VALID';
      break;
    case 'revoked':
      variant = 'destructive';
      Icon = XCircle;
      text = 'REVOKED';
      break;
    case 'uncheckable':
      variant = 'secondary';
      Icon = AlertTriangle;
      text = 'UNCHECKABLE';
      break;
    case 'unknown':
    default:
      variant = 'outline';
      Icon = AlertTriangle;
      text = 'UNCHECKABLE';
      break;
  }

  return (
    <Badge variant={variant} className={cn('gap-1', colorClass, className)}>
      <Icon className="h-3 w-3" />
      {text}
    </Badge>
  );
}
