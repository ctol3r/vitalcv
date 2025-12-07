'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CAPACITY_SCENARIO_TEMPLATES,
  type CapacityScenarioParams,
  type CapacityScenarioTemplate,
} from '@/src/capacity/scenario';

type DemandSimulationResult = {
  startDate: string;
  horizonMonths: number;
  aggregate: DemandPoint[];
};

type SupplySimulationResult = {
  startDate: string;
  horizonMonths: number;
  aggregate: SupplyPoint[];
  summary: {
    averageCoverage: number;
    averageAttrition: number;
    onboardingLagMonths: number;
    vitalCvAccelerationWeeks: number;
    vitalCvUnlockedFte: number;
  };
};

type GapResult = {
  points: GapPoint[];
  summary: {
    peakGap: number;
    averageGap: number;
    worstMonth: string;
    coverage: number;
    coverageWithVital: number;
    vitalCvLift: number;
    recommendedHires: number;
  };
  insights: string[];
  vitalCvOverlay: {
    coverageDelta: number;
    onboardingAccelerationWeeks: number;
    unlockedFte: number;
    message: string;
  };
  exports: {
    pngDataUrl: string;
    csv: string;
  };
};

type DemandPoint = {
  monthIndex: number;
  date: string;
  demand: number;
};

type SupplyPoint = {
  monthIndex: number;
  date: string;
  supply: number;
  supplyWithVitalCv: number;
};

type GapPoint = {
  monthIndex: number;
  date: string;
  demand: number;
  supply: number;
  supplyWithVital: number;
  gap: number;
  gapWithVital: number;
  severity: 'balanced' | 'monitor' | 'shortage' | 'crisis';
  action: string;
};

type ScenarioRunResponse = {
  scenarioId: string | null;
  orgId: string;
  name: string;
  source: 'template' | 'saved' | 'adhoc';
  templateKey: string | null;
  generatedAt: string;
  params: CapacityScenarioParams;
  demand: DemandSimulationResult;
  supply: SupplySimulationResult;
  gap: GapResult;
  exports: {
    pngDataUrl: string;
    csv: string;
  };
};

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');
const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_DEMO_ORG_ID ?? 'demo-org';

export default function CapacityScenarioPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [scenario, setScenario] = useState<ScenarioRunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTemplateKey, setActiveTemplateKey] = useState<string | null>(() =>
    CAPACITY_SCENARIO_TEMPLATES.some((template) => template.key === params.id) ? params.id : null,
  );

  const fetchScenario = useCallback(
    async (payload: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(buildApiUrl('/api/capacity/run-scenario'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-org-id': DEFAULT_ORG_ID,
          },
          body: JSON.stringify({ persist: false, ...payload }),
        });
        if (!response.ok) {
          throw new Error(`Scenario request failed (${response.status})`);
        }
        const data = (await response.json()) as ScenarioRunResponse;
        setScenario(data);
      } catch (err) {
        console.error('Capacity scenario fetch failed', err);
        setError(err instanceof Error ? err.message : 'Unable to load scenario');
        setScenario(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (CAPACITY_SCENARIO_TEMPLATES.some((template) => template.key === params.id)) {
      void fetchScenario({ templateKey: params.id, orgId: DEFAULT_ORG_ID });
      return;
    }

    if (params.id === 'new') {
      const fallbackTemplate = CAPACITY_SCENARIO_TEMPLATES[0];
      setActiveTemplateKey(fallbackTemplate.key);
      void fetchScenario({ templateKey: fallbackTemplate.key, orgId: DEFAULT_ORG_ID });
      return;
    }

    void fetchScenario({ scenarioId: params.id, orgId: DEFAULT_ORG_ID });
  }, [params.id, fetchScenario]);

  const demandSupplySeries = useMemo(() => {
    if (!scenario) return [];
    return scenario.demand.aggregate.map((point, idx) => {
      const supply = scenario.supply.aggregate[idx];
      return {
        month: formatMonth(point.date),
        demand: point.demand,
        supply: supply?.supply ?? 0,
        vital: supply?.supplyWithVitalCv ?? 0,
      };
    });
  }, [scenario]);

  const gapSeries = useMemo(() => {
    if (!scenario) return [];
    return scenario.gap.points.map((point) => ({
      month: formatMonth(point.date),
      gap: Math.max(0, point.gap),
      gapWithVital: Math.max(0, point.gapWithVital),
      severity: point.severity,
      action: point.action,
    }));
  }, [scenario]);

  const handleTemplateSelect = useCallback(
    (template: CapacityScenarioTemplate) => {
      setActiveTemplateKey(template.key);
      if (params.id === template.key) {
        void fetchScenario({ templateKey: template.key, orgId: DEFAULT_ORG_ID });
        return;
      }
      router.replace(`/capacity-scenarios/${template.key}`);
    },
    [fetchScenario, router, params.id],
  );

  const handleDownload = useCallback(
    (type: 'png' | 'csv') => {
      if (!scenario?.exports) return;
      if (type === 'png') {
        const link = document.createElement('a');
        link.href = scenario.exports.pngDataUrl;
        link.download = `${scenario.name.replace(/\s+/g, '-').toLowerCase()}-capacity.png`;
        link.click();
        return;
      }
      const blob = new Blob([scenario.exports.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${scenario?.name.replace(/\s+/g, '-').toLowerCase()}-capacity.csv`;
      link.click();
      URL.revokeObjectURL(url);
    },
    [scenario],
  );

  const activeTemplate = useMemo(() => {
    if (!activeTemplateKey) return null;
    return CAPACITY_SCENARIO_TEMPLATES.find((template) => template.key === activeTemplateKey) ?? null;
  }, [activeTemplateKey]);

  return (
    <div className="container max-w-6xl space-y-8 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Capacity scenarios</p>
          <h1 className="text-3xl font-bold tracking-tight">
            {scenario?.name ?? 'Scenario explorer'}
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Stress test demand, supply, and VitalCV impact for recruiting and strategic planning decks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleDownload('csv')} disabled={!scenario}>
            Export CSV
          </Button>
          <Button onClick={() => void handleDownload('png')} disabled={!scenario}>
            Export PNG
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Saved templates</p>
            <p className="text-lg font-semibold">Common baselines</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {CAPACITY_SCENARIO_TEMPLATES.map((template) => (
            <Card
              key={template.key}
              className={
                activeTemplateKey === template.key ? 'border-primary shadow-md' : 'border-muted'
              }
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {template.name}
                  {activeTemplateKey === template.key && <Badge>Active</Badge>}
                </CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{template.orgPersona}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {template.highlights.slice(0, 3).map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
                <Button
                  variant={activeTemplateKey === template.key ? 'default' : 'outline'}
                  onClick={() => handleTemplateSelect(template)}
                  disabled={loading && activeTemplateKey === template.key}
                >
                  Run scenario
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Peak capacity gap"
          value={scenario ? `${scenario.gap.summary.peakGap.toFixed(1)} FTE` : '--'}
          hint={scenario ? `Worst month: ${formatMonth(scenario.gap.summary.worstMonth)}` : ''}
        />
        <SummaryCard
          label="VitalCV lift"
          value={scenario ? `${scenario.gap.summary.vitalCvLift.toFixed(1)} FTE/mo` : '--'}
          hint="Average additional coverage unlocked"
        />
        <SummaryCard
          label="Recommended hires"
          value={scenario ? scenario.gap.summary.recommendedHires : '--'}
          hint="Headcount required to close peak gap"
        />
        <SummaryCard
          label="Coverage ratio"
          value={
            scenario
              ? `${(scenario.gap.summary.coverage * 100).toFixed(0)}% → ${(scenario.gap.summary.coverageWithVital * 100).toFixed(0)}%`
              : '--'
          }
          hint="Baseline vs VitalCV overlay"
        />
      </div>

      {scenario && scenario.gap.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key insights</CardTitle>
            <CardDescription>Highlights auto-generated from the simulator</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {scenario.gap.insights.map((insight) => (
                <li key={insight} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demand vs supply</CardTitle>
            <CardDescription>Aggregate headcount coverage per month</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {demandSupplySeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={demandSupplySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="demand" stroke="#f97316" strokeWidth={2} />
                  <Line type="monotone" dataKey="supply" stroke="#2563eb" strokeWidth={2} />
                  <Line type="monotone" dataKey="vital" stroke="#22c55e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No data available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capacity gap over time</CardTitle>
            <CardDescription>VitalCV overlay vs baseline shortage</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {gapSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={gapSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="gap"
                    stackId="1"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.35}
                    name="Gap"
                  />
                  <Area
                    type="monotone"
                    dataKey="gapWithVital"
                    stackId="1"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.3}
                    name="Gap w/ VitalCV"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No data available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {scenario && (
        <Card>
          <CardHeader>
            <CardTitle>VitalCV impact overlay</CardTitle>
            <CardDescription>Quantifies the lift from accelerated onboarding</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <OverlayStat
              label="Coverage delta"
              value={`${scenario.gap.vitalCvOverlay.coverageDelta.toFixed(1)} pts`}
              hint="Average improvement vs baseline"
            />
            <OverlayStat
              label="Acceleration"
              value={`${scenario.gap.vitalCvOverlay.onboardingAccelerationWeeks.toFixed(1)} wks`}
              hint="Faster onboarding window"
            />
            <OverlayStat
              label="Unlocked FTE"
              value={`${scenario.gap.vitalCvOverlay.unlockedFte.toFixed(1)} FTE`}
              hint="Additional supply arriving via VitalCV"
            />
            <p className="md:col-span-3 text-sm text-muted-foreground">
              {scenario.gap.vitalCvOverlay.message}
            </p>
          </CardContent>
        </Card>
      )}

      {scenario && (
        <Card>
          <CardHeader>
            <CardTitle>Operational playbook</CardTitle>
            <CardDescription>Month-by-month actions generated from the simulator</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 overflow-auto">
            {scenario.gap.points.slice(0, 12).map((point) => (
              <div
                key={point.date}
                className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">{formatMonth(point.date)}</p>
                  <p className="text-xs text-muted-foreground">{point.action}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={severityVariant(point.severity)}>
                    {point.severity === 'balanced'
                      ? 'Balanced'
                      : `${(Math.max(0, point.gap) || 0).toFixed(1)} FTE gap`}
                  </Badge>
                  {point.gapWithVital < point.gap && (
                    <Badge variant="outline">-{(point.gap - point.gapWithVital).toFixed(1)} FTE</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      )}
    </Card>
  );
}

function OverlayStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function severityVariant(severity: GapPoint['severity']) {
  switch (severity) {
    case 'crisis':
      return 'destructive';
    case 'shortage':
      return 'default';
    case 'monitor':
      return 'secondary';
    default:
      return 'outline';
  }
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

function formatMonth(date: string) {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}


