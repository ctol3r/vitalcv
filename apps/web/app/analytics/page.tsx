'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface OverviewData {
  credentialsIssued: number;
  activeVerifiers: number;
  networkNodes: number;
  apiRequests: number;
  revocationRate: number;
  federatedNetworks: number;
}

interface DayCount { date: string; count: number; }

// Minimal SVG line chart — no external deps
function SparkLine({ data, color = '#10b981' }: { data: DayCount[]; color?: string }) {
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const W = 240, H = 48;
  const pts = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * W;
    const y = H - (d.count / maxVal) * (H - 4) - 2;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const area = `0,${H} ${pts.join(' ')} ${W},${H}`;

  return (
    <svg width={W} height={H} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({
  label, value, sub, trend, color, sparkData,
}: {
  label: string; value: string; sub?: string; trend?: string; color: string; sparkData?: DayCount[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border p-5 shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            trend.startsWith('+') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>{trend}</span>
        )}
      </div>
      <p className={`text-3xl font-bold mb-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {sparkData && sparkData.length > 1 && (
        <div className="mt-3 -mx-1">
          <SparkLine data={sparkData} />
        </div>
      )}
    </motion.div>
  );
}

const DEMO_OVERVIEW: OverviewData = {
  credentialsIssued: 12847,
  activeVerifiers: 284,
  networkNodes: 1923,
  apiRequests: 94231,
  revocationRate: 0.8,
  federatedNetworks: 2,
};

function makeDemoSpark(base: number, days: number = 30): DayCount[] {
  const result: DayCount[] = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result.push({
      date: d.toISOString().split('T')[0],
      count: Math.max(0, base + Math.floor(Math.random() * base * 0.4 - base * 0.2)),
    });
  }
  return result;
}

const DEMO_TOP_ISSUERS = [
  { name: 'CA Medical Board', credentialsIssued: 4231, trustScore: 98 },
  { name: 'ABIM', credentialsIssued: 2847, trustScore: 97 },
  { name: 'NPI Registry', credentialsIssued: 1923, trustScore: 95 },
  { name: 'DEA Office', credentialsIssued: 1204, trustScore: 94 },
  { name: 'NY Medical Board', credentialsIssued: 987, trustScore: 92 },
];

function TrustScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-8 text-right">{score}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewData>(DEMO_OVERVIEW);
  const [credSpark] = useState<DayCount[]>(() => makeDemoSpark(420, 30));
  const [apiSpark] = useState<DayCount[]>(() => makeDemoSpark(3140, 30));
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetch('/api/analytics/overview')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setOverview(d); })
      .catch(() => { /* use demo data */ });
  }, []);

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Platform Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">Live metrics across the VitalCV trust network.</p>
          </div>
          <div className="flex bg-card border border-border rounded-lg overflow-hidden text-xs font-medium">
            {(['7d', '30d', '90d'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-2 transition-colors ${range === r ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="Credentials Issued"
            value={overview.credentialsIssued.toLocaleString()}
            sub="All time"
            trend="+12.4%"
            color="text-emerald-600"
            sparkData={credSpark}
          />
          <KpiCard
            label="Active Verifiers"
            value={overview.activeVerifiers.toLocaleString()}
            sub="Last 30 days"
            trend="+8.1%"
            color="text-sky-600"
          />
          <KpiCard
            label="Network Nodes"
            value={overview.networkNodes.toLocaleString()}
            sub={`${overview.federatedNetworks} federated networks`}
            trend="+3.2%"
            color="text-violet-600"
          />
          <KpiCard
            label="API Requests"
            value={overview.apiRequests.toLocaleString()}
            sub="Last 30 days"
            trend="+19.7%"
            color="text-amber-600"
            sparkData={apiSpark}
          />
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">Revocation Rate</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-foreground">{overview.revocationRate}<span className="text-xl text-muted-foreground">%</span></span>
              <span className="text-xs text-emerald-600 mb-1">↓ industry avg 2.1%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Low revocation = high issuer quality</p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">Federated Networks</p>
            <div className="space-y-2">
              {['Nursys (Nurse Licensing)', 'CAQH (Provider Credentialing)'].map(n => (
                <div key={n} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-teal-400" />
                  <span className="text-sm text-muted-foreground">{n}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">250k+ credentialed clinicians</p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">Compliance Coverage</p>
            {[['HIPAA', 100], ['HITRUST', 94], ['SOC 2 Type II', 87], ['ONC/TEFCA', 76]].map(([label, pct]) => (
              <div key={String(label)} className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Issuers */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Top Issuers by Trust Score</h2>
          </div>
          <div className="divide-y divide-border">
            {DEMO_TOP_ISSUERS.map((issuer, i) => (
              <motion.div
                key={issuer.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="px-6 py-4 flex items-center gap-4"
              >
                <span className="text-sm text-muted-foreground w-4 font-mono">#{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{issuer.name}</p>
                  <p className="text-xs text-muted-foreground">{issuer.credentialsIssued.toLocaleString()} credentials issued</p>
                </div>
                <div className="w-48">
                  <TrustScoreBar score={issuer.trustScore} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
