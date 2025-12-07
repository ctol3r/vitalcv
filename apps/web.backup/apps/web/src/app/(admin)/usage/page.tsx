'use client';

import React, { useEffect, useState } from 'react';

interface UsageData {
  byType: Record<string, number>;
  totalUnits: number;
  costEstimate: number;
  period: string;
}

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        // In a real app, we would handle auth token here
        // The backend expects an authenticated user (via cookie or header)
        const res = await fetch('/api/billing/usage');
        if (!res.ok) throw new Error('Failed to fetch usage data');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  if (loading) return <div className="p-8">Loading usage data...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Usage Summary</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Billable Units</h3>
          </div>
          <div className="p-0">
            <div className="text-2xl font-bold">{data.totalUnits}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Estimated Cost</h3>
          </div>
          <div className="p-0">
            <div className="text-2xl font-bold">${data.costEstimate.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Stubbed ($0.10/unit)</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="font-semibold leading-none tracking-tight">Event Breakdown</h3>
        </div>
        <div className="p-6 pt-0">
          <div className="space-y-4">
            {Object.entries(data.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                <span className="font-mono font-bold">{count}</span>
              </div>
            ))}
            {Object.keys(data.byType).length === 0 && (
              <p className="text-muted-foreground">No usage recorded in this period.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}















