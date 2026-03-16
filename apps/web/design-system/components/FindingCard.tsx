import type React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SeverityBadge } from './SeverityBadge';
import { Badge } from './Badge';

export interface FindingCardProps {
  title: string;
  summary: string;
  severity: string;
  status: string;
  typeLabel: string;
  confidence: number;
  metadata?: React.ReactNode;
  links?: React.ReactNode;
  footer?: React.ReactNode;
}

export function FindingCard({
  confidence,
  footer,
  links,
  metadata,
  severity,
  status,
  summary,
  title,
  typeLabel,
}: FindingCardProps) {
  return (
    <Card interactive>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-[var(--vt-space-8)]">
          <SeverityBadge severity={severity} />
          <Badge variant="neutral">{status}</Badge>
          <Badge variant="outline">{typeLabel}</Badge>
          <ConfidenceBadge confidence={confidence} />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{summary}</CardDescription>
      </CardHeader>
      {(metadata || links) ? (
        <CardContent className="space-y-[var(--vt-space-12)]">
          {metadata}
          {links ? <div className="flex flex-wrap gap-[var(--vt-space-8)]">{links}</div> : null}
        </CardContent>
      ) : null}
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
