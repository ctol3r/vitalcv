'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, FileText, TrendingUp, Users } from 'lucide-react';
import { useMemo } from 'react';
import type { CausalPath } from '../causal/PathDiagram';

export interface CausalSummaryProps {
  path: CausalPath;
  eventTitle: string;
  eventDescription?: string;
  eventType: 'privilege-restriction' | 'oppe-dip' | 'risk-spike' | 'compliance-issue';
  clinicianId?: string;
  clinicianName?: string;
  committeeType?: 'medical-staff' | 'quality' | 'peer-review' | 'credentials';
  compact?: boolean;
  className?: string;
}

type RootCauseSummary = {
  id: string;
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: Array<{ type: string; label: string }>;
};

const EVENT_TYPE_LABELS: Record<CausalSummaryProps['eventType'], string> = {
  'privilege-restriction': 'Privilege Restriction',
  'oppe-dip': 'OPPE Performance Decline',
  'risk-spike': 'Risk Score Spike',
  'compliance-issue': 'Compliance Issue',
};

const EVENT_TYPE_COLORS: Record<CausalSummaryProps['eventType'], string> = {
  'privilege-restriction': 'bg-rose-100 text-rose-800 border-rose-300',
  'oppe-dip': 'bg-amber-100 text-amber-800 border-amber-300',
  'risk-spike': 'bg-orange-100 text-orange-800 border-orange-300',
  'compliance-issue': 'bg-blue-100 text-blue-800 border-blue-300',
};

const CONFIDENCE_COLORS: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-rose-100 text-rose-800 border-rose-300',
};

export function CausalSummary({
  path,
  eventTitle,
  eventDescription,
  eventType,
  clinicianId,
  clinicianName,
  committeeType = 'medical-staff',
  compact = false,
  className,
}: CausalSummaryProps) {
  const rootCauses = useMemo(() => {
    const causes: RootCauseSummary[] = [];
    const rootCauseNode = path.nodes.find((n) => n.id === path.rootCauseId);

    if (rootCauseNode) {
      causes.push({
        id: rootCauseNode.id,
        title: rootCauseNode.label,
        description: rootCauseNode.description || 'Root cause identified in causal analysis.',
        confidence: rootCauseNode.confidence || 'medium',
        evidence: rootCauseNode.evidence || [],
      });
    }

    // Find other high-confidence intermediate nodes that might be secondary causes
    path.nodes
      .filter(
        (n) => n.type === 'intermediate' && n.confidence === 'high' && n.id !== path.rootCauseId,
      )
      .slice(0, 2) // Limit to top 2 secondary causes
      .forEach((node) => {
        causes.push({
          id: node.id,
          title: node.label,
          description: node.description || 'Contributing factor in causal chain.',
          confidence: node.confidence || 'medium',
          evidence: node.evidence || [],
        });
      });

    return causes;
  }, [path]);

  const eventNode = useMemo(() => {
    return path.nodes.find((n) => n.id === path.eventId);
  }, [path]);

  const causalChainLength = useMemo(() => {
    // Count nodes in the chain from root cause to event
    const visited = new Set<string>();
    const queue: string[] = [path.rootCauseId];
    let depth = 0;

    while (queue.length > 0 && depth < 10) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      if (current === path.eventId) break;

      path.edges
        .filter((e) => e.source === current)
        .forEach((e) => {
          if (!visited.has(e.target)) {
            queue.push(e.target);
          }
        });
      depth++;
    }

    return visited.size;
  }, [path]);

  if (compact) {
    return (
      <Card className={cn('border-l-4 border-l-primary', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Root Cause Analysis
              </CardTitle>
              <CardDescription className="text-xs mt-1">{eventTitle}</CardDescription>
            </div>
            <Badge variant="outline" className={EVENT_TYPE_COLORS[eventType]}>
              {EVENT_TYPE_LABELS[eventType]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rootCauses.slice(0, 2).map((cause) => (
            <div key={cause.id} className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className={cn('text-xs', CONFIDENCE_COLORS[cause.confidence])}
                >
                  {cause.confidence.toUpperCase()}
                </Badge>
                <span className="font-semibold">{cause.title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{cause.description.slice(0, 120)}...</p>
            </div>
          ))}
          {rootCauses.length > 2 && (
            <p className="text-xs text-muted-foreground italic">
              +{rootCauses.length - 2} additional root causes
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-l-4 border-l-primary', className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              Causal Analysis Summary
            </CardTitle>
            <CardDescription>
              Root cause explanations for committee packet review and decision-making.
            </CardDescription>
          </div>
          <Badge variant="outline" className={EVENT_TYPE_COLORS[eventType]}>
            {EVENT_TYPE_LABELS[eventType]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Event Overview */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">{eventTitle}</h3>
              {eventDescription && (
                <p className="text-sm text-muted-foreground mb-2">{eventDescription}</p>
              )}
              {clinicianName && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">Clinician:</span>
                  <span className="font-medium">{clinicianName}</span>
                  {clinicianId && (
                    <span className="text-muted-foreground font-mono text-xs">({clinicianId})</span>
                  )}
                </div>
              )}
            </div>
            {eventNode && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Event Type</p>
                <Badge variant="outline" className="mt-1">
                  {eventNode.type.replace('-', ' ').toUpperCase()}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Causal Chain Summary */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Causal Chain Overview
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Chain Length
              </p>
              <p className="text-2xl font-bold">{causalChainLength}</p>
              <p className="text-xs text-muted-foreground">nodes in path</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Root Causes
              </p>
              <p className="text-2xl font-bold">{rootCauses.length}</p>
              <p className="text-xs text-muted-foreground">identified</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                High Confidence
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {rootCauses.filter((c) => c.confidence === 'high').length}
              </p>
              <p className="text-xs text-muted-foreground">root causes</p>
            </div>
          </div>
        </div>

        {/* Root Causes */}
        <div className="space-y-4">
          <h3 className="font-semibold mb-3">Root Causes</h3>
          {rootCauses.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <AlertTriangle className="mx-auto h-6 w-6 mb-2 opacity-50" aria-hidden="true" />
              No root causes identified in the causal path.
            </div>
          ) : (
            rootCauses.map((cause, idx) => (
              <div
                key={cause.id}
                className="rounded-lg border bg-card p-4 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <h4 className="font-semibold text-base">{cause.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {cause.description}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('font-semibold shrink-0', CONFIDENCE_COLORS[cause.confidence])}
                  >
                    {cause.confidence === 'high' ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                    )}
                    {cause.confidence.toUpperCase()}
                  </Badge>
                </div>

                {cause.evidence && cause.evidence.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Supporting Evidence
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {cause.evidence.map((ev, evIdx) => (
                        <Badge key={evIdx} variant="outline" className="text-xs">
                          {ev.type}: {ev.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Committee Context */}
        {committeeType && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="font-semibold mb-2 text-sm">Committee Context</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This causal analysis summary is provided for {committeeType.replace('-', ' ')}{' '}
              committee review. Root causes have been identified through automated causal analysis
              of credentialing, privileging, and quality data. Evidence supporting each root cause
              is documented for committee decision-making.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
