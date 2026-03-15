'use client';

import { useFindings, useFindingStats } from '@/lib/hooks/useIntelligence';
import { motion } from 'framer-motion';

const SEVERITY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'CRITICAL' },
  HIGH:     { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'HIGH' },
  MEDIUM:   { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'MEDIUM' },
  LOW:      { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'LOW' },
  INFO:     { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'INFO' },
};

interface Finding {
  id: string;
  investigator: string;
  category: string;
  severity: string;
  title: string;
  summary: string;
  npis: string[];
  score: number;
  createdAt: string;
}

export default function FindingsPage() {
  const { data, loading, error, refetch } = useFindings(100);
  const { data: statsData } = useFindingStats();
  const findings = (data?.findings ?? []) as Finding[];
  const stats = statsData?.stats as Record<string, unknown> | undefined;

  return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Findings</h1>
            <p className="text-sm text-slate-400 mt-1">
              Autonomous investigator discoveries across monitored providers
            </p>
          </div>
          <button
            onClick={refetch}
            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total', value: (stats as Record<string, number>).total ?? 0 },
              { label: 'Critical', value: (stats as Record<string, number>).critical ?? 0, color: 'text-red-400' },
              { label: 'High', value: (stats as Record<string, number>).high ?? 0, color: 'text-orange-400' },
              { label: 'Active', value: (stats as Record<string, number>).active ?? 0, color: 'text-blue-400' },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-semibold mt-1 ${s.color ?? 'text-white'}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Loading / Error */}
        {loading && <p className="text-slate-400">Loading findings…</p>}
        {error && <p className="text-red-400">Error: {error}</p>}

        {/* Findings list */}
        <div className="space-y-3">
          {findings.map((f, i) => {
            const badge = SEVERITY_BADGE[f.severity] ?? SEVERITY_BADGE.INFO;
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white/[0.03] border border-white/10 rounded-lg p-4 hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-500">{f.investigator}</span>
                      <span className="text-xs text-slate-600">•</span>
                      <span className="text-xs text-slate-500">{f.category}</span>
                    </div>
                    <h3 className="text-sm font-medium text-white truncate">{f.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{f.summary}</p>
                    {f.npis.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        NPIs: {f.npis.slice(0, 5).join(', ')}{f.npis.length > 5 ? ` (+${f.npis.length - 5})` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-xs text-slate-500">{new Date(f.createdAt).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-600 mt-1">score: {f.score}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {!loading && findings.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg">No findings yet</p>
            <p className="text-sm mt-2">Investigators haven&apos;t generated any findings. They run automatically on schedule.</p>
          </div>
        )}
      </div>
    </div>
  );
}
