'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Users, Flame, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

interface WorkforceNode {
  region: string;
  specialty: string;
  supply: number;
  demand: number;
  readiness: number;
  readinessAdjustedSupply: number;
  risk: number;
}

interface WorkforceSnapshot {
  region: string;
  nodes: WorkforceNode[];
  suggestions: Array<{ id: string; specialty: string; recommendation: string; impact: string }>;
  riskIndex: number;
  heatmap: Array<{ region: string; specialty: string; severity: number }>;
  generatedAt: string;
}

export default function WorkforceGridPage() {
  const { formatError } = useRoleUX();
  const [snapshot, setSnapshot] = useState<WorkforceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ingestPayload, setIngestPayload] = useState({ region: '', specialty: '', supply: '', demand: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/workforce/grid`);
      if (!response.ok) {
        throw new Error(`Workforce API failed (${response.status})`);
      }
      const payload = (await response.json()) as WorkforceSnapshot;
      setSnapshot(payload);
    } catch (err) {
      console.error('[admin][workforce-grid] load failed', err);
      setError(formatError('workforce_fetch_failed', err instanceof Error ? err.message : 'Unable to load grid'));
    } finally {
      setLoading(false);
    }
  }, [formatError]);

  useEffect(() => {
    void load();
  }, [load]);

  const topRisks = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.nodes].sort((a, b) => b.risk - a.risk).slice(0, 5);
  }, [snapshot]);

  async function handleIngest() {
    try {
      await fetch(`${API_BASE}/api/workforce/grid/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            {
              region: ingestPayload.region || 'global',
              specialty: ingestPayload.specialty || 'General',
              supply: Number(ingestPayload.supply || 0),
              demand: Number(ingestPayload.demand || 0),
              readiness: 1,
            },
          ],
        }),
      });
      await load();
      setIngestPayload({ region: '', specialty: '', supply: '', demand: '' });
    } catch (err) {
      console.error('[admin][workforce-grid] ingest failed', err);
      setError(formatError('workforce_ingest_failed', err instanceof Error ? err.message : 'Unable to ingest node'));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-8">
      <header className="flex flex-col gap-3 px-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-2">
            <Users className="h-3.5 w-3.5" />
            Workforce grid v3
          </Badge>
          <Badge variant="outline">{snapshot ? new Date(snapshot.generatedAt).toLocaleString() : '—'}</Badge>
          <div className="ml-auto">
            <Button variant="outline" onClick={load} disabled={loading}>
              Refresh grid
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Supply chain intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Availability, readiness-adjusted supply, bottleneck detection, and optimization suggestions.
          </p>
        </div>
        {error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </div>
        )}
      </header>

      {snapshot && (
        <>
          <section className="grid gap-4 px-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Flame className="h-4 w-4 text-amber-500" />
                  Risk index
                </CardTitle>
                <CardDescription>Average unmet demand</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{snapshot.riskIndex.toFixed(1)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-emerald-500" />
                  Suggestions
                </CardTitle>
                <CardDescription>Optimization candidates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{snapshot.suggestions.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-blue-500" />
                  Regions tracked
                </CardTitle>
                <CardDescription>Distinct supply nodes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{snapshot.nodes.length}</div>
              </CardContent>
            </Card>
          </section>

          <Card className="mx-4">
            <CardHeader>
              <CardTitle>High-risk specialties</CardTitle>
              <CardDescription>Prioritized by readiness-adjusted undersupply.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2">Region</th>
                    <th>Specialty</th>
                    <th>Supply</th>
                    <th>Demand</th>
                    <th>Readiness</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {topRisks.map((node) => (
                    <tr key={`${node.region}-${node.specialty}`} className="border-t">
                      <td className="py-2">{node.region}</td>
                      <td>{node.specialty}</td>
                      <td>{node.readinessAdjustedSupply.toFixed(1)}</td>
                      <td>{node.demand.toFixed(1)}</td>
                      <td>{(node.readiness * 100).toFixed(0)}%</td>
                      <td>
                        <Badge variant={node.risk > node.demand * 0.3 ? 'destructive' : 'secondary'}>
                          {node.risk.toFixed(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <section className="grid gap-4 px-4 lg:grid-cols-[1fr_0.6fr]">
            <Card>
              <CardHeader>
                <CardTitle>Optimization suggestions</CardTitle>
                <CardDescription>Training, hiring, or cross-privileging recommendations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {snapshot.suggestions.length === 0 && (
                  <p className="text-muted-foreground">No active suggestions.</p>
                )}
                {snapshot.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-md border p-3"
                  >
                    <p className="font-semibold">{suggestion.specialty}</p>
                    <p className="text-muted-foreground">{suggestion.recommendation}</p>
                    <Badge variant={suggestion.impact === 'high' ? 'destructive' : 'secondary'} className="mt-2">
                      {suggestion.impact} impact
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Ingest supply signal</CardTitle>
                <CardDescription>Drop workforce deltas directly into the grid.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Input
                  placeholder="Region"
                  value={ingestPayload.region}
                  onChange={(event) => setIngestPayload((prev) => ({ ...prev, region: event.target.value }))}
                />
                <Input
                  placeholder="Specialty"
                  value={ingestPayload.specialty}
                  onChange={(event) => setIngestPayload((prev) => ({ ...prev, specialty: event.target.value }))}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Supply"
                    value={ingestPayload.supply}
                    onChange={(event) => setIngestPayload((prev) => ({ ...prev, supply: event.target.value }))}
                  />
                  <Input
                    placeholder="Demand"
                    value={ingestPayload.demand}
                    onChange={(event) => setIngestPayload((prev) => ({ ...prev, demand: event.target.value }))}
                  />
                </div>
                <Button className="w-full" onClick={handleIngest}>
                  Ingest node
                </Button>
              </CardContent>
            </Card>
          </section>

          <Card className="mx-4">
            <CardHeader>
              <CardTitle>Heatmap</CardTitle>
              <CardDescription>Staffing shortage severity (0-1).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.heatmap.map((cell) => (
                <div key={`${cell.region}-${cell.specialty}`} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{cell.region}</p>
                  <p className="font-semibold">{cell.specialty}</p>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-rose-500"
                      style={{ width: `${cell.severity * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

