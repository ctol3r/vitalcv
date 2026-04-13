'use client';

import { useEffect, useState } from 'react';

type ImpactData = {
  legacy_days: number;
  vitalcv_days: number;
  days_saved: number;
  revenue_per_day_assumption: number;
  estimated_revenue_recovered: number;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  '';

export default function ImpactPanel({ npi }: { npi: string }) {
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadImpact() {
      try {
        const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
        const res = await fetch(`${base}/impact/${npi}?specialty=cardiology`);
        if (cancelled) return;
        if (!res.ok) { setFailed(true); return; }
        const data = await res.json();
        if (!cancelled) setImpact(data);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadImpact();
    return () => { cancelled = true; };
  }, [npi]);

  if (loading) {
    return (
      <div className="p-10 rounded-3xl border bg-muted animate-pulse">
        Calculating onboarding acceleration...
      </div>
    );
  }

  if (failed || !impact) {
    return (
      <div className="p-10 rounded-3xl border bg-muted text-muted-foreground text-sm text-center">
        Impact data is not available right now.
      </div>
    );
  }

  return (
    <div className="p-12 rounded-3xl border bg-background shadow-lg space-y-6">
      <div className="text-3xl font-semibold">
        Onboarding Impact
      </div>

      <div className="grid md:grid-cols-3 gap-8 text-center">
        <div>
          <div className="text-4xl font-bold text-red-500">
            {impact.legacy_days} days
          </div>
          <div className="text-muted-foreground mt-2">
            Legacy onboarding
          </div>
        </div>

        <div>
          <div className="text-4xl font-bold text-green-600">
            {impact.vitalcv_days} days
          </div>
          <div className="text-muted-foreground mt-2">
            With VitalCV
          </div>
        </div>

        <div>
          <div className="text-4xl font-bold">
            {impact.days_saved} days saved
          </div>
          <div className="text-muted-foreground mt-2">
            Accelerated deployment
          </div>
        </div>
      </div>

      <div className="text-center text-2xl font-semibold mt-6">
        Estimated Revenue Recovered: $
        {(impact.estimated_revenue_recovered ?? 0).toLocaleString()}
      </div>
    </div>
  );
}
