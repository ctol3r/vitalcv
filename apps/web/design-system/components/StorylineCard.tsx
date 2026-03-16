import type React from 'react';
import { Badge } from './Badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SeverityBadge } from './SeverityBadge';

export interface StorylineCardProps {
  title: string;
  summary: string;
  severity: string;
  status: string;
  typeLabel: string;
  confidence: number;
  highlights?: React.ReactNode;
  footer?: React.ReactNode;
}

export function StorylineCard({
  confidence,
  footer,
  highlights,
  severity,
  status,
  summary,
  title,
  typeLabel,
}: StorylineCardProps) {
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
      {highlights ? <CardContent>{highlights}</CardContent> : null}
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
