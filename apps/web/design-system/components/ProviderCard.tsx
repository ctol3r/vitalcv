import type React from 'react';
import { Badge } from './Badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';
import { RiskScoreBadge } from './RiskScoreBadge';

export interface ProviderCardProps {
  name: string;
  summary: string;
  credentialHealth: string;
  trustScore: number;
  specialties?: string[];
  footer?: React.ReactNode;
  meta?: React.ReactNode;
}

export function ProviderCard({
  credentialHealth,
  footer,
  meta,
  name,
  specialties = [],
  summary,
  trustScore,
}: ProviderCardProps) {
  return (
    <Card interactive>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-[var(--vt-space-8)]">
          <Badge variant="neutral">{credentialHealth}</Badge>
          <RiskScoreBadge score={100 - trustScore} />
        </div>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{summary}</CardDescription>
      </CardHeader>
      {specialties.length > 0 || meta ? (
        <CardContent className="space-y-[var(--vt-space-12)]">
          {specialties.length > 0 ? (
            <div className="flex flex-wrap gap-[var(--vt-space-8)]">
              {specialties.map((specialty) => (
                <Badge key={specialty} variant="outline">
                  {specialty}
                </Badge>
              ))}
            </div>
          ) : null}
          {meta}
        </CardContent>
      ) : null}
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
