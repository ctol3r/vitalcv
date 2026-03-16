import type React from 'react';
import { Badge } from './Badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SeverityBadge } from './SeverityBadge';

export interface ActionCardProps {
  title: string;
  explanation: string;
  priority: string;
  status: string;
  typeLabel: string;
  confidence: number;
  detail?: React.ReactNode;
  footer?: React.ReactNode;
}

export function ActionCard({
  confidence,
  detail,
  explanation,
  footer,
  priority,
  status,
  title,
  typeLabel,
}: ActionCardProps) {
  return (
    <Card interactive>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-[var(--vt-space-8)]">
          <SeverityBadge severity={priority} />
          <Badge variant="neutral">{status}</Badge>
          <Badge variant="outline">{typeLabel}</Badge>
          <ConfidenceBadge confidence={confidence} />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{explanation}</CardDescription>
      </CardHeader>
      {detail ? <CardContent>{detail}</CardContent> : null}
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
