'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Calculator,
  Info,
  RefreshCcw,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type RemediationAction =
  | 'renew-dea'
  | 'renew-license'
  | 'fix-pecos'
  | 'update-ehr-privileges'
  | 'pass-fppe'
  | 'complete-oppe';

interface Remediation {
  id: RemediationAction;
  label: string;
  description: string;
  category: 'credentialing' | 'privileging' | 'compliance' | 'quality';
  estimatedDays: number;
  cost?: number;
}

interface OutcomePrediction {
  eventId: string;
  currentScore: number;
  predictedScore: number;
  scoreChange: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  impactAreas: Array<{ area: string; before: string; after: string }>;
  timeline: string;
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];
}

const REMEDIATIONS: Remediation[] = [
  {
    id: 'renew-dea',
    label: 'Renew DEA Registration',
    description:
      'Submit DEA registration renewal application and documentation. Typically processed within 7-14 business days.',
    category: 'credentialing',
    estimatedDays: 10,
    cost: 731, // Standard DEA renewal fee
  },
  {
    id: 'renew-license',
    label: 'Renew State License',
    description:
      'Complete state medical board license renewal with continuing education credits and fees.',
    category: 'credentialing',
    estimatedDays: 21,
    cost: 500, // Varies by state
  },
  {
    id: 'fix-pecos',
    label: 'Fix PECOS Enrollment',
    description:
      'Reactivate or update CMS PECOS enrollment status. May require additional documentation verification.',
    category: 'compliance',
    estimatedDays: 14,
    cost: 0, // No fee, but time cost
  },
  {
    id: 'update-ehr-privileges',
    label: 'Update EHR Privileges',
    description:
      'Review and update electronic health record system privileges based on current clinical privileges.',
    category: 'privileging',
    estimatedDays: 3,
    cost: 0,
  },
  {
    id: 'pass-fppe',
    label: 'Pass FPPE Evaluation',
    description:
      'Complete focused professional practice evaluation with satisfactory outcomes per Joint Commission standards.',
    category: 'quality',
    estimatedDays: 60,
    cost: 0,
  },
  {
    id: 'complete-oppe',
    label: 'Complete OPPE Review',
    description:
      'Complete ongoing professional practice evaluation cycle with performance metrics meeting thresholds.',
    category: 'quality',
    estimatedDays: 30,
    cost: 0,
  },
];

const CATEGORY_COLORS: Record<Remediation['category'], string> = {
  credentialing: 'bg-blue-100 text-blue-800 border-blue-300',
  privileging: 'bg-purple-100 text-purple-800 border-purple-300',
  compliance: 'bg-amber-100 text-amber-800 border-amber-300',
  quality: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const RISK_LEVEL_COLORS: Record<OutcomePrediction['riskLevel'], string> = {
  critical: 'bg-rose-100 text-rose-800 border-rose-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

function buildMockPrediction(actions: RemediationAction[]): OutcomePrediction {
  const baseScore = 85; // Starting risk score
  let predictedScore = baseScore;

  // Calculate score reduction based on actions
  if (actions.includes('renew-dea')) predictedScore -= 30;
  if (actions.includes('renew-license')) predictedScore -= 20;
  if (actions.includes('fix-pecos')) predictedScore -= 15;
  if (actions.includes('update-ehr-privileges')) predictedScore -= 10;
  if (actions.includes('pass-fppe')) predictedScore -= 25;
  if (actions.includes('complete-oppe')) predictedScore -= 15;

  predictedScore = Math.max(0, Math.min(100, predictedScore));

  const riskLevel: OutcomePrediction['riskLevel'] =
    predictedScore >= 80
      ? 'critical'
      : predictedScore >= 60
      ? 'high'
      : predictedScore >= 40
      ? 'medium'
      : 'low';

  const maxDays = Math.max(
    ...actions.map((action) => REMEDIATIONS.find((r) => r.id === action)?.estimatedDays ?? 0),
  );

  return {
    eventId: 'evt-2024-001',
    currentScore: baseScore,
    predictedScore,
    scoreChange: predictedScore - baseScore,
    riskLevel,
    impactAreas: [
      {
        area: 'Credentialing Status',
        before: 'Non-compliant',
        after: predictedScore < 60 ? 'Compliant' : 'In Review',
      },
      {
        area: 'Privilege Access',
        before: 'Restricted',
        after: predictedScore < 50 ? 'Active' : 'Limited',
      },
      {
        area: 'Medicare Billing',
        before: 'Blocked',
        after: actions.includes('fix-pecos') ? 'Active' : 'Blocked',
      },
    ],
    timeline: `${maxDays} days`,
    confidence: actions.length > 0 ? (actions.length >= 3 ? 'high' : 'medium') : 'low',
    warnings:
      actions.length === 0
        ? ['No remediation actions selected. Current risk level will persist.']
        : predictedScore >= 70
        ? ['Additional remediation actions may be required to fully resolve risk.']
        : undefined,
  };
}

export default function WhatIfSimulatorPage() {
  const [selectedActions, setSelectedActions] = useState<Set<RemediationAction>>(new Set());
  const [prediction, setPrediction] = useState<OutcomePrediction | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleAction = useCallback((actionId: RemediationAction) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  }, []);

  const calculatePrediction = useCallback(async () => {
    setLoading(true);
    try {
      // In a real implementation, this would call an API
      const response = await fetch('/api/demo/org/causal/what-if/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ actions: Array.from(selectedActions) }),
      });

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const payload = await response.json();
      setPrediction(payload as OutcomePrediction);
    } catch (err) {
      console.warn('What-if prediction falling back to demo calculation', err);
      const mockPrediction = buildMockPrediction(Array.from(selectedActions));
      setPrediction(mockPrediction);
    } finally {
      setLoading(false);
    }
  }, [selectedActions]);

  useEffect(() => {
    if (selectedActions.size > 0) {
      calculatePrediction();
    } else {
      setPrediction(null);
    }
  }, [selectedActions, calculatePrediction]);

  const selectedRemediations = useMemo(() => {
    return REMEDIATIONS.filter((r) => selectedActions.has(r.id));
  }, [selectedActions]);

  const totalCost = useMemo(() => {
    return selectedRemediations.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  }, [selectedRemediations]);

  const maxTimeline = useMemo(() => {
    if (selectedRemediations.length === 0) return 0;
    return Math.max(...selectedRemediations.map((r) => r.estimatedDays));
  }, [selectedRemediations]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Demo • Org • Causal Analysis
          </p>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calculator className="h-8 w-8 text-primary" aria-hidden="true" />
            What-If Simulator
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Toggle possible remediation actions to see predicted outcomes. Explore how different
            combinations of remediations affect risk scores and compliance status.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={calculatePrediction}
          disabled={loading || selectedActions.size === 0}
        >
          <RefreshCcw
            className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Recalculate
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Remediation Actions Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" aria-hidden="true" />
              Remediation Actions
            </CardTitle>
            <CardDescription>
              Select one or more remediation actions to simulate their impact on risk scores and
              outcomes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {REMEDIATIONS.map((remediation) => {
              const isSelected = selectedActions.has(remediation.id);
              return (
                <div
                  key={remediation.id}
                  className={cn(
                    'rounded-lg border p-4 transition-all hover:shadow-md',
                    isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={remediation.id}
                      checked={isSelected}
                      onCheckedChange={() => toggleAction(remediation.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Label htmlFor={remediation.id} className="font-semibold cursor-pointer">
                          {remediation.label}
                        </Label>
                        <Badge variant="outline" className={CATEGORY_COLORS[remediation.category]}>
                          {remediation.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{remediation.description}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Info className="h-3 w-3" aria-hidden="true" />
                          {remediation.estimatedDays} days
                        </span>
                        {remediation.cost !== undefined && remediation.cost > 0 && (
                          <span>${remediation.cost.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {selectedActions.size > 0 && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Total Cost:</span>
                  <span className="font-bold">${totalCost.toLocaleString()}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Estimated Timeline:</span>
                  <span className="font-bold">{maxTimeline} days</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outcome Prediction Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" aria-hidden="true" />
              Predicted Outcomes
            </CardTitle>
            <CardDescription>
              Risk score changes and impact analysis based on selected remediation actions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8">
                <Info className="h-4 w-4 animate-spin" aria-hidden="true" />
                Calculating predictions…
              </div>
            ) : prediction ? (
              <div className="space-y-6">
                {/* Score Comparison */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Current Risk Score</p>
                    <p className="text-4xl font-bold text-rose-600">{prediction.currentScore}</p>
                    <p className="text-xs text-muted-foreground mt-1">High risk</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Predicted Risk Score</p>
                    <p
                      className={cn(
                        'text-4xl font-bold',
                        prediction.scoreChange < 0 ? 'text-emerald-600' : 'text-rose-600',
                      )}
                    >
                      {prediction.predictedScore}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      {prediction.scoreChange < 0 ? (
                        <>
                          <TrendingDown className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                          <p className="text-xs text-emerald-600">
                            {Math.abs(prediction.scoreChange)} point reduction
                          </p>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-3 w-3 text-rose-600" aria-hidden="true" />
                          <p className="text-xs text-rose-600">
                            {prediction.scoreChange} point increase
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Risk Level */}
                <div>
                  <p className="text-sm font-medium mb-2">Predicted Risk Level</p>
                  <Badge className={RISK_LEVEL_COLORS[prediction.riskLevel]} variant="outline">
                    <Shield className="mr-1 h-3 w-3" aria-hidden="true" />
                    {prediction.riskLevel.toUpperCase()}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    Confidence:{' '}
                    <span className="font-semibold">{prediction.confidence.toUpperCase()}</span>
                  </p>
                </div>

                {/* Impact Areas */}
                <div>
                  <p className="text-sm font-medium mb-3">Impact by Area</p>
                  <div className="space-y-3">
                    {prediction.impactAreas.map((impact, idx) => (
                      <div key={idx} className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-sm font-semibold mb-2">{impact.area}</p>
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Before: </span>
                            <Badge variant="outline" className="border-rose-300 text-rose-700">
                              {impact.before}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-muted-foreground">After: </span>
                            <Badge
                              variant="outline"
                              className={
                                impact.after === 'Active' || impact.after === 'Compliant'
                                  ? 'border-emerald-300 text-emerald-700'
                                  : 'border-amber-300 text-amber-700'
                              }
                            >
                              {impact.after}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm font-medium mb-1">Estimated Timeline</p>
                  <p className="text-2xl font-bold">{prediction.timeline}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on selected remediation actions and typical processing times.
                  </p>
                </div>

                {/* Warnings */}
                {prediction.warnings && prediction.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-400/70 bg-amber-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" aria-hidden="true" />
                      <div className="space-y-1">
                        {prediction.warnings.map((warning, idx) => (
                          <p key={idx} className="text-sm text-amber-900">
                            {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                <Info className="mx-auto h-8 w-8 mb-2 opacity-50" aria-hidden="true" />
                Select one or more remediation actions to see predicted outcomes
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <span className="sr-only" aria-live="polite">
        {selectedActions.size > 0
          ? `${selectedActions.size} remediation action${
              selectedActions.size === 1 ? '' : 's'
            } selected`
          : 'No remediation actions selected'}
      </span>
    </div>
  );
}
