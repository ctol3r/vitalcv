'use client';

import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  events: { findingId: string; title: string; severity: string; timestamp: string }[];
  actions: { id: string; label: string; type: string }[];
  createdAt: string;
  updatedAt: string;
}

export default function StorylineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [storyline, setStoryline] = useState<Storyline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/storylines/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.storyline) setStoryline(data.storyline);
        else if (data.error) setError(data.error);
        else setError('Storyline not found');
      })
      .catch(() => setError('Failed to load storyline'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFeedback = async (action: string) => {
    try {
      const res = await fetch(`/api/storylines/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) setFeedbackMsg(`${action} recorded`);
    } catch { setFeedbackMsg('Action failed'); }
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6 flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading storyline…</div>
    </div>
  );

  if (error || !storyline) return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6">
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-red-400 text-lg">{error ?? 'Storyline not found'}</p>
        <Link href="/storylines" className="text-sm text-blue-400 hover:text-blue-300 mt-4 inline-block">
          ← Back to storylines
        </Link>
      </div>
    </div>
  );

  const stage = STAGE_BADGE[storyline.stage] ?? STAGE_BADGE.EMERGING;

  return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Link href="/storylines" className="hover:text-slate-300">Storylines</Link>
          <span>/</span>
          <span className="text-slate-400">{storyline.id}</span>
        </nav>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${stage.bg} ${stage.text}`}>
                  {stage.icon} {storyline.stage}
                </span>
                <span className={`text-xs font-medium ${SEVERITY_COLOR[storyline.severity] ?? 'text-slate-400'}`}>
                  {storyline.severity}
                </span>
                <span className="text-xs text-slate-600">•</span>
                <span className="text-xs text-slate-500">{storyline.type}</span>
              </div>
              <h1 className="text-xl font-semibold">{storyline.title}</h1>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>{storyline.eventCount} event{storyline.eventCount !== 1 ? 's' : ''}</p>
              <p className="mt-1">Score: {storyline.score}</p>
            </div>
          </div>

          {/* Narrative */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-4">
            <p className="text-sm text-slate-300 leading-relaxed">{storyline.narrative}</p>
          </div>

          {/* NPIs */}
          {storyline.npis.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">Providers</h3>
              <div className="flex flex-wrap gap-2">
                {storyline.npis.map(npi => (
                  <Link key={npi} href={`/verify/${npi}`}
                    className="px-3 py-1 text-xs bg-white/5 border border-white/10 rounded font-mono hover:bg-white/10 transition-colors">
                    {npi}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Event Timeline */}
          {storyline.events?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">Event Timeline</h3>
              <div className="space-y-2 relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
                {storyline.events.map((evt, i) => (
                  <div key={i} className="flex items-start gap-3 relative">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 z-10 ${
                      evt.severity === 'CRITICAL' ? 'border-red-400 bg-red-400/20' :
                      evt.severity === 'HIGH' ? 'border-orange-400 bg-orange-400/20' :
                      'border-slate-500 bg-slate-500/20'
                    }`} />
                    <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg p-3">
                      <Link href={`/findings/${evt.findingId}`}
                        className="text-sm text-white hover:text-blue-400 transition-colors">
                        {evt.title}
                      </Link>
                      <p className="text-xs text-slate-600 mt-1">
                        {new Date(evt.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex items-center gap-6 text-xs text-slate-600 mt-4 mb-4">
            <span>Created: {new Date(storyline.createdAt).toLocaleString()}</span>
            <span>Updated: {new Date(storyline.updatedAt).toLocaleString()}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-white/10">
            {(['acknowledge', 'escalate', 'archive', 'save'] as const).map(action => (
              <button key={action} onClick={() => handleFeedback(action)}
                className={`px-4 py-2 text-xs rounded-lg border transition-colors ${
                  action === 'escalate'
                    ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                    : action === 'archive'
                    ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                }`}>
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </button>
            ))}
            {feedbackMsg && (
              <span className="text-xs text-green-400 animate-pulse">{feedbackMsg}</span>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
