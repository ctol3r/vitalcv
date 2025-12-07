'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCcw,
  Shield,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ConfidenceLevel = 'high' | 'medium' | 'low';

type RootCause = {
  id: string;
  title: string;
  description: string;
  confidence: ConfidenceLevel;
  score: number; // 0-100
  evidence: Array<{ type: string; label: string; timestamp?: string }>;
  eventType: 'risk' | 'safety' | 'compliance';
  impactedAreas: string[];
};

interface RootCauseAnalysis {
  eventId: string;
  eventType: 'risk' | 'safety' | 'compliance';
  eventTitle: string;
  eventDescription: string;
  timestamp: string;
  rootCauses: RootCause[];
  summary: {
    totalCauses: number;
    highConfidence: number;
    criticalScore: number;
  };
}

const CONFIDENCE_COLORS: Record<
  ConfidenceLevel,
  { bg: string; text: string; border: string; icon: typeof CheckCircle2 }
> = {
  high: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    icon: CheckCircle2,
  },
  medium: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    border: 'border-amber-300',
    icon: AlertTriangle,
  },
  low: {
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-700',
    border: 'border-rose-300',
    icon: XCircle,
  },
};

const EVENT_TYPE_COLORS: Record<'risk' | 'safety' | 'compliance', string> = {
  risk: 'bg-rose-100 text-rose-800 border-rose-300',
  safety: 'bg-amber-100 text-amber-800 border-amber-300',
  compliance: 'bg-blue-100 text-blue-800 border-blue-300',
};

function buildMockRootCauseAnalysis(): RootCauseAnalysis {
  return {
    eventId: 'evt-2024-001',
    eventType: 'risk',
    eventTitle: 'Privilege Restriction for Dr. Sarah Chen',
    eventDescription:
      'Cardiology privileges restricted due to expired DEA registration and missed FPPE deadline.',
    timestamp: new Date().toISOString(),
    rootCauses: [
      {
        id: 'rc-001',
        title: 'Expired DEA Registration',
        description:
          'DEA registration expired 45 days ago without renewal. This blocks controlled substance prescribing and triggered automatic privilege suspension.',
        confidence: 'high',
        score: 92,
        evidence: [
          { type: 'DEA', label: 'DEA registry lookup', timestamp: '2024-11-10' },
          { type: 'Credentialing', label: 'Privilege suspension log', timestamp: '2024-11-08' },
        ],
        eventType: 'risk',
        impactedAreas: ['Cardiology', 'Pain Management', 'Emergency Department'],
      },
      {
        id: 'rc-002',
        title: 'Missed FPPE Review Deadline',
        description:
          'FPPE evaluation deadline passed 30 days ago. Required for continued privilege maintenance per Joint Commission standards.',
        confidence: 'high',
        score: 88,
        evidence: [
          { type: 'FPPE', label: 'FPPE schedule', timestamp: '2024-10-15' },
          {
            type: 'Committee',
            label: 'Medical staff office notification',
            timestamp: '2024-10-20',
          },
        ],
        eventType: 'compliance',
        impactedAreas: ['Privileging', 'Quality Assurance'],
      },
      {
        id: 'rc-003',
        title: 'OPPE Performance Decline',
        description:
          'Recent OPPE metrics show declining case volume and quality indicators in interventional cardiology procedures over the past quarter.',
        confidence: 'medium',
        score: 65,
        evidence: [
          { type: 'OPPE', label: 'Q3 2024 OPPE report', timestamp: '2024-10-01' },
          { type: 'Metrics', label: 'Case volume analysis', timestamp: '2024-09-30' },
        ],
        eventType: 'safety',
        impactedAreas: ['Cardiology', 'Quality Metrics'],
      },
      {
        id: 'rc-004',
        title: 'PECOS Enrollment Status Change',
        description:
          'CMS PECOS enrollment status changed to "inactive" 60 days ago, which may affect Medicare billing privileges.',
        confidence: 'medium',
        score: 55,
        evidence: [
          { type: 'PECOS', label: 'PECOS status check', timestamp: '2024-09-15' },
          { type: 'Billing', label: 'Medicare claim rejections', timestamp: '2024-09-20' },
        ],
        eventType: 'compliance',
        impactedAreas: ['Billing', 'Medicare Enrollment'],
      },
    ],
    summary: {
      totalCauses: 4,
      highConfidence: 2,
      criticalScore: 92,
    },
  };
}

export default function RootCauseExplorerPage() {
  const [analysis, setAnalysis] = useState<RootCauseAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<
    'all' | 'risk' | 'safety' | 'compliance'
  >('all');

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // In a real implementation, this would fetch from an API
      const response = await fetch(`/api/demo/org/causal/root-cause?eventId=demo-event-001`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }
      const payload = await response.json();
      setAnalysis(payload as RootCauseAnalysis);
    } catch (err) {
      console.warn('Root cause analysis falling back to demo data', err);
      setAnalysis(buildMockRootCauseAnalysis());
      setError('Showing demo data until the causal analysis API is connected.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  const filteredCauses = useMemo(() => {
    if (!analysis) return [];
    if (selectedEventType === 'all') return analysis.rootCauses;
    return analysis.rootCauses.filter((cause) => cause.eventType === selectedEventType);
  }, [analysis, selectedEventType]);

  const sortedCauses = useMemo(() => {
    return [...filteredCauses].sort((a, b) => b.score - a.score);
  }, [filteredCauses]);

  if (loading && !analysis) {
    return (
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Info className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading root cause analysis…
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900">
          Unable to load root cause analysis.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Demo • Org • Causal Analysis
          </p>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" aria-hidden="true" />
            Root Cause Explorer
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Analyze root causes for risk, safety, and compliance events. Color-coded confidence
            levels help prioritize remediation efforts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAnalysis} disabled={loading}>
          <RefreshCcw
            className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </header>

      {error && (
        <div
          className="flex items-start gap-3 rounded-lg border border-amber-400/70 bg-amber-50 p-4 text-sm text-amber-900"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" aria-hidden="true" />
                Event Overview
              </CardTitle>
              <CardDescription>Primary event details and impact summary</CardDescription>
            </div>
            <Badge className={EVENT_TYPE_COLORS[analysis.eventType]}>
              {analysis.eventType.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg">{analysis.eventTitle}</h3>
            <p className="text-sm text-muted-foreground mt-1">{analysis.eventDescription}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Event ID: <span className="font-mono">{analysis.eventId}</span> •{' '}
              {new Date(analysis.timestamp).toLocaleString()}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Root Causes</p>
              <p className="text-3xl font-bold">{analysis.summary.totalCauses}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">High Confidence</p>
              <p className="text-3xl font-bold text-emerald-600">
                {analysis.summary.highConfidence}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Critical Score</p>
              <p className="text-3xl font-bold text-rose-600">{analysis.summary.criticalScore}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Root Causes</CardTitle>
            <CardDescription>Ranked by impact score with confidence indicators</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedEventType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEventType('all')}
            >
              All
            </Button>
            <Button
              variant={selectedEventType === 'risk' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEventType('risk')}
            >
              Risk
            </Button>
            <Button
              variant={selectedEventType === 'safety' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEventType('safety')}
            >
              Safety
            </Button>
            <Button
              variant={selectedEventType === 'compliance' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEventType('compliance')}
            >
              Compliance
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedCauses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No root causes found for the selected filter.
            </p>
          ) : (
            sortedCauses.map((cause, index) => {
              const confidenceStyle = CONFIDENCE_COLORS[cause.confidence];
              const ConfidenceIcon = confidenceStyle.icon;
              return (
                <div
                  key={cause.id}
                  className={cn(
                    'rounded-lg border p-5 transition-all hover:shadow-md',
                    confidenceStyle.bg,
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-semibold text-muted-foreground">
                          #{index + 1}
                        </span>
                        <h3 className="text-lg font-semibold">{cause.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{cause.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge
                        className={cn(
                          'font-semibold',
                          confidenceStyle.border,
                          confidenceStyle.text,
                        )}
                      >
                        <ConfidenceIcon className="mr-1 h-3 w-3" aria-hidden="true" />
                        {cause.confidence.toUpperCase()} CONFIDENCE
                      </Badge>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{cause.score}</p>
                        <p className="text-xs text-muted-foreground">Impact Score</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-current/20">
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                          Evidence
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {cause.evidence.map((ev, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {ev.type}: {ev.label}
                              {ev.timestamp && (
                                <span className="ml-1 text-muted-foreground">
                                  ({new Date(ev.timestamp).toLocaleDateString()})
                                </span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                          Impacted Areas
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {cause.impactedAreas.map((area) => (
                            <Badge key={area} variant="secondary" className="text-xs">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <span className="sr-only" aria-live="polite">
        {loading ? 'Loading root cause analysis' : `${sortedCauses.length} root causes displayed`}
      </span>
    </div>
  );
}
