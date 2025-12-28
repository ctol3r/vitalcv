import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Activity, Gauge, TimerReset } from 'lucide-react';

async function loadSummary() {
  try {
    const resp = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/metrics/summary`, {
      cache: 'no-store',
    });
    return await resp.json();
  } catch {
    return null;
  }
}

export default async function MetricsPage() {
  const summary = await loadSummary();
  const counts = summary?.counts || {};
  const latency = summary?.latency || {};
  const completion = summary?.completion || {};

  const issued = counts.issued ?? 0;
  const verified = counts.verified ?? 0;
  const revoked = counts.revoked ?? 0;
  const matched = counts.matched ?? 0;

  const avgVerifyMs = latency.avgVerifyMs ?? '—';
  const p95VerifyMs = latency.p95VerifyMs ?? '—';
  const avgCompletion = completion.avgCompletionPct ?? '—';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-blue-600">Pilot metrics</p>
          <h1 className="text-4xl font-bold text-slate-900">VitalCV Metrics</h1>
          <p className="text-slate-600 max-w-2xl">
            Real-time counts and latency pulled from <code>/api/metrics/summary</code>. Use these
            numbers in pilot readouts without touching the database.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issued</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{issued}</div>
              <p className="text-xs text-muted-foreground">Credentials created</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <Gauge className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{verified}</div>
              <p className="text-xs text-muted-foreground">Presentation checks</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matched</CardTitle>
              <Activity className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{matched}</div>
              <p className="text-xs text-muted-foreground">Role matches logged</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revoked</CardTitle>
              <Activity className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{revoked}</div>
              <p className="text-xs text-muted-foreground">Credentials revoked</p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TimerReset className="h-4 w-4 text-blue-600" />
                Verification Latency
              </CardTitle>
              <CardDescription>Average and p95 for verifier flows</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Average</p>
                <p className="text-3xl font-semibold">{avgVerifyMs} ms</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">p95</p>
                <p className="text-3xl font-semibold">{p95VerifyMs} ms</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-emerald-600" />
                Completion
              </CardTitle>
              <CardDescription>Average completion across flows</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold">{avgCompletion}%</p>
              <p className="text-sm text-muted-foreground">Derived from reported match events.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
