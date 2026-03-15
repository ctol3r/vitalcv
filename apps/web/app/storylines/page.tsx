'use client';

import { useStorylines, useStorylineStats } from '@/lib/hooks/useIntelligence';
import { motion } from 'framer-motion';

const STAGE_BADGE: Record<string, { bg: string; text: string; icon: string }> = {
  EMERGING:   { bg: 'bg-cyan-500/20', text: 'text-cyan-400', icon: '🌱' },
  DEVELOPING: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '📊' },
  MATURE:     { bg: 'bg-violet-500/20', text: 'text-violet-400', icon: '🔍' },
  RESOLVED:   { bg: 'bg-green-500/20', text: 'text-green-400', icon: '✅' },
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-yellow-400',
  LOW: 'text-blue-400',
  INFO: 'text-slate-400',
};

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
  const { data, loading, error, refetch } = useStorylines(50);
  const { data: statsData } = useStorylineStats();
  const storylines = (data?.storylines ?? []) as Storyline[];
  const stats = statsData?.stats as Record<string, number> | undefined;

  return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Storylines</h1>
            <p className="text-sm text-slate-400 mt-1">
              Evolving intelligence narratives — findings clustered into stories
            </p>
          </div>
          <button
            onClick={refetch}
            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Stage counters */}
        {stats && (
          <div className="flex gap-3 mb-8">
            {(['EMERGING', 'DEVELOPING', 'MATURE', 'RESOLVED'] as const).map((stage) => {
              const badge = STAGE_BADGE[stage];
              const count = stats[stage.toLowerCase()] ?? 0;
              return (
                <div key={stage} className={`${badge.bg} border border-white/10 rounded-lg px-4 py-3 flex items-center gap-2`}>
                  <span>{badge.icon}</span>
                  <span className={`text-sm font-medium ${badge.text}`}>{count}</span>
                  <span className="text-xs text-slate-500">{stage}</span>
                </div>
              );
            })}
          </div>
        )}

        {loading && <p className="text-slate-400">Loading storylines…</p>}
        {error && <p className="text-red-400">Error: {error}</p>}

        {/* Storyline cards */}
        <div className="space-y-4">
          {storylines.map((s, i) => {
            const stage = STAGE_BADGE[s.stage] ?? STAGE_BADGE.EMERGING;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white/[0.03] border border-white/10 rounded-xl p-5 hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
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

                <h3 className="text-base font-medium text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.narrative}</p>

                {s.npis.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {s.npis.slice(0, 6).map((npi) => (
                      <span key={npi} className="px-2 py-0.5 text-xs bg-white/5 border border-white/10 rounded font-mono">
                        {npi}
                      </span>
                    ))}
                    {s.npis.length > 6 && (
                      <span className="px-2 py-0.5 text-xs text-slate-500">+{s.npis.length - 6} more</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-3 text-xs text-slate-600">
                  <span>Created {new Date(s.createdAt).toLocaleDateString()}</span>
                  <span>Updated {new Date(s.updatedAt).toLocaleDateString()}</span>
                  <span>Score: {s.score}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {!loading && storylines.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg">No storylines yet</p>
            <p className="text-sm mt-2">Storylines emerge when investigators produce related findings.</p>
          </div>
        )}
      </div>
    </div>
  );
}
