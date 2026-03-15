'use client';

import { useFindings, useFindingStats } from '@/lib/hooks/useIntelligence';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useState, useMemo } from 'react';

const SEVERITY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'CRITICAL' },
  HIGH:     { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'HIGH' },
  MEDIUM:   { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'MEDIUM' },
  LOW:      { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'LOW' },
  INFO:     { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'INFO' },
};

const SEVERITIES = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;

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
  const { data, loading, error, refetch } = useFindings(200);
  const { data: statsData } = useFindingStats();
  const allFindings = (data?.findings ?? []) as Finding[];
  const stats = statsData?.stats as Record<string, number> | undefined;
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const findings = useMemo(() => {
    let filtered = allFindings;
    if (severityFilter !== 'ALL') {
      filtered = filtered.filter(f => f.severity === severityFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.summary.toLowerCase().includes(q) ||
        f.npis.some(npi => npi.includes(q)) ||
        f.investigator.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allFindings, severityFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <nav className="text-xs text-slate-500 mb-2">
              <Link href="/intelligence" className="hover:text-slate-300">Intelligence</Link>
              <span className="mx-2">/</span>
              <span className="text-slate-400">Findings</span>
            </nav>
            <h1 className="text-2xl font-semibold tracking-tight">Findings</h1>
            <p className="text-sm text-slate-400 mt-1">
              Autonomous investigator discoveries • auto-refreshes every 30s
            </p>
          </div>
          <button onClick={refetch}
            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
            Refresh
          </button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total', value: stats.total ?? allFindings.length, color: undefined },
              { label: 'Critical', value: stats.critical ?? allFindings.filter(f => f.severity === 'CRITICAL').length, color: 'text-red-400' },
              { label: 'High', value: stats.high ?? allFindings.filter(f => f.severity === 'HIGH').length, color: 'text-orange-400' },
              { label: 'Showing', value: findings.length, color: 'text-blue-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
                <p className={`text-xl font-semibold mt-0.5 ${s.color ?? 'text-white'}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex gap-1">
            {SEVERITIES.map(sev => (
              <button key={sev} onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  severityFilter === sev
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/[0.02] border-white/10 text-slate-500 hover:text-slate-300'
                }`}>
                {sev}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search findings, NPIs, investigators…"
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-white/20"
          />
        </div>

        {/* Loading / Error */}
        {loading && !allFindings.length && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white/[0.03] border border-white/10 rounded-lg p-4 animate-pulse">
                <div className="h-3 w-24 bg-white/10 rounded mb-2" />
                <div className="h-4 w-2/3 bg-white/5 rounded mb-2" />
                <div className="h-3 w-full bg-white/5 rounded" />
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">Error: {error}</p>}

        {/* Findings list */}
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {findings.map((f, i) => {
              const badge = SEVERITY_BADGE[f.severity] ?? SEVERITY_BADGE.INFO;
              return (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <Link href={`/findings/${f.id}`}
                    className="block bg-white/[0.03] border border-white/10 rounded-lg p-4 hover:bg-white/[0.06] transition-colors group">
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
                        <h3 className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors truncate">
                          {f.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{f.summary}</p>
                        {f.npis.length > 0 && (
                          <div className="flex gap-1 mt-1.5">
                            {f.npis.slice(0, 3).map(npi => (
                              <span key={npi} className="text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                                {npi}
                              </span>
                            ))}
                            {f.npis.length > 3 && <span className="text-[10px] text-slate-600">+{f.npis.length - 3}</span>}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="text-xs text-slate-500">{new Date(f.createdAt).toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-600 mt-1">score {f.score}</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>

        {!loading && findings.length === 0 && allFindings.length > 0 && (
          <div className="text-center py-16 text-slate-500">
            <p>No findings match the current filter.</p>
            <button onClick={() => { setSeverityFilter('ALL'); setSearchTerm(''); }}
              className="text-sm text-blue-400 hover:text-blue-300 mt-2">
              Clear filters
            </button>
          </div>
        )}

        {!loading && allFindings.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg">No findings yet</p>
            <p className="text-sm mt-2">Investigators run automatically on schedule. Findings will appear here when anomalies are detected.</p>
          </div>
        )}
      </div>
    </div>
  );
}
