'use client';

import { useStorylines, useStorylineStats } from '@/lib/hooks/useIntelligence';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useState, useMemo } from 'react';

const STAGE_BADGE: Record<string, { bg: string; text: string; icon: string }> = {
  EMERGING:   { bg: 'bg-cyan-500/20', text: 'text-cyan-400', icon: '🌱' },
  DEVELOPING: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '📊' },
  MATURE:     { bg: 'bg-violet-500/20', text: 'text-violet-400', icon: '🔍' },
  RESOLVED:   { bg: 'bg-green-500/20', text: 'text-green-400', icon: '✅' },
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-400', HIGH: 'text-orange-400', MEDIUM: 'text-yellow-400',
  LOW: 'text-blue-400', INFO: 'text-slate-400',
};

const STAGES = ['ALL', 'EMERGING', 'DEVELOPING', 'MATURE', 'RESOLVED'] as const;

interface Storyline {
  id: string;
  type: string;
  stage: string;
  severity: string;
  title: string;
  narrative: string;
  npis: string[];
  eventCount: number;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export default function StorylinesPage() {
  const { data, loading, error, refetch } = useStorylines(100);
  const { data: statsData } = useStorylineStats();
  const allStorylines = (data?.storylines ?? []) as Storyline[];
  const stats = statsData?.stats as Record<string, number> | undefined;
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const storylines = useMemo(() => {
    let filtered = allStorylines;
    if (stageFilter !== 'ALL') {
      filtered = filtered.filter(s => s.stage === stageFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.narrative.toLowerCase().includes(q) ||
        s.npis.some(npi => npi.includes(q))
      );
    }
    return filtered;
  }, [allStorylines, stageFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <nav className="text-xs text-slate-500 mb-2">
              <Link href="/intelligence" className="hover:text-slate-300">Intelligence</Link>
              <span className="mx-2">/</span>
              <span className="text-slate-400">Storylines</span>
            </nav>
            <h1 className="text-2xl font-semibold tracking-tight">Storylines</h1>
            <p className="text-sm text-slate-400 mt-1">
              Evolving intelligence narratives • findings clustered into stories
            </p>
          </div>
          <button onClick={refetch}
            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
            Refresh
          </button>
        </div>

        {/* Stage counters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STAGES.map(stage => {
            const badge = STAGE_BADGE[stage];
            const count = stage === 'ALL'
              ? allStorylines.length
              : allStorylines.filter(s => s.stage === stage).length;
            return (
              <button key={stage} onClick={() => setStageFilter(stage)}
                className={`px-3 py-2 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                  stageFilter === stage
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/[0.02] border-white/10 text-slate-500 hover:text-slate-300'
                }`}>
                {badge && <span>{badge.icon}</span>}
                <span>{stage === 'ALL' ? 'All' : stage}</span>
                <span className="text-slate-600">({count})</span>
              </button>
            );
          })}
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search storylines…"
            className="flex-1 min-w-[180px] px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-white/20"
          />
        </div>

        {/* Loading */}
        {loading && !allStorylines.length && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-5 animate-pulse">
                <div className="h-3 w-28 bg-white/10 rounded mb-3" />
                <div className="h-4 w-3/4 bg-white/5 rounded mb-2" />
                <div className="h-3 w-full bg-white/5 rounded" />
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">Error: {error}</p>}

        {/* Storyline cards */}
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {storylines.map((s, i) => {
              const stage = STAGE_BADGE[s.stage] ?? STAGE_BADGE.EMERGING;
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link href={`/storylines/${s.id}`}
                    className="block bg-white/[0.03] border border-white/10 rounded-xl p-5 hover:bg-white/[0.06] transition-colors group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${stage.bg} ${stage.text}`}>
                          {stage.icon} {s.stage}
                        </span>
                        <span className={`text-xs font-medium ${SEVERITY_COLOR[s.severity] ?? 'text-slate-400'}`}>
                          {s.severity}
                        </span>
                        <span className="text-xs text-slate-600">•</span>
                        <span className="text-xs text-slate-500">{s.type}</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {s.eventCount} event{s.eventCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <h3 className="text-base font-medium text-white group-hover:text-blue-400 transition-colors mb-1.5">
                      {s.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{s.narrative}</p>

                    {s.npis.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {s.npis.slice(0, 5).map(npi => (
                          <span key={npi} className="px-2 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded font-mono">
                            {npi}
                          </span>
                        ))}
                        {s.npis.length > 5 && <span className="text-[10px] text-slate-600">+{s.npis.length - 5}</span>}
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-600">
                      <span>Created {new Date(s.createdAt).toLocaleDateString()}</span>
                      <span>Updated {new Date(s.updatedAt).toLocaleDateString()}</span>
                      <span>Score {s.score}</span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>

        {!loading && storylines.length === 0 && allStorylines.length > 0 && (
          <div className="text-center py-16 text-slate-500">
            <p>No storylines match the current filter.</p>
            <button onClick={() => { setStageFilter('ALL'); setSearchTerm(''); }}
              className="text-sm text-blue-400 hover:text-blue-300 mt-2">
              Clear filters
            </button>
          </div>
        )}

        {!loading && allStorylines.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg">No storylines yet</p>
            <p className="text-sm mt-2">Storylines emerge when investigators produce related findings. They cluster automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
