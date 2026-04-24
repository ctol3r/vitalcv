import type { Metadata } from 'next';
import { BACKEND_URL } from '@/lib/backend-url';
import { CasesBoard, type ClinicalCase } from '@/components/admin/CasesBoard';

export const metadata: Metadata = {
  title: 'Cases — VitalCV Admin',
  description: 'Multi-case credentialing execution board.',
  robots: { index: false },
};

async function fetchCases(): Promise<ClinicalCase[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/cases`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return [];
    }
    const body = await res.json() as { cases?: ClinicalCase[] };
    return body.cases ?? [];
  } catch {
    return [];
  }
}

export default async function AdminCasesPage() {
  const cases = await fetchCases();

  const stats = {
    total: cases.length,
    critical: cases.filter((c) => c.priority === 'critical').length,
    high: cases.filter((c) => c.priority === 'high').length,
    avgProgress: cases.length > 0
      ? Math.round(cases.reduce((sum, c) => sum + c.progressPercent, 0) / cases.length)
      : 0,
  };

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
            Admin
          </p>
          <h1 className="text-2xl font-bold text-foreground">Credentialing Cases</h1>
          <p className="text-sm text-muted-foreground">
            All active clinician cases with blocker resolution, action tracking, and orchestration plans.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total cases" value={String(stats.total)} />
          <StatCard label="Critical" value={String(stats.critical)} accent="text-red-400" />
          <StatCard label="High priority" value={String(stats.high)} accent="text-orange-400" />
          <StatCard label="Avg. progress" value={`${stats.avgProgress}%`} accent="text-emerald-400" />
        </div>

        {/* Board */}
        <CasesBoard initialCases={cases} />

      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent = 'text-foreground',
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}
