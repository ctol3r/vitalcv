'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFindingsForNpi } from '@/lib/hooks/useIntelligence';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const SEVERITY_BADGE: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400' },
  HIGH:     { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  MEDIUM:   { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  LOW:      { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  INFO:     { bg: 'bg-slate-500/20', text: 'text-slate-400' },
};

interface Finding {
  id: string;
  investigator: string;
  category: string;
  severity: string;
  title: string;
  summary: string;
  explanation: string;
  npis: string[];
  score: number;
  evidence: { source: string; claim: string; confidence: number; timestamp: string }[];
  actions: { id: string; label: string; type: string }[];
  createdAt: string;
  expiresAt: string | null;
}

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/findings/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.finding) setFinding(data.finding);
        else if (data.error) setError(data.error);
        else setError('Finding not found');
      })
      .catch(() => setError('Failed to load finding'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: string) => {
    try {
      const res = await fetch(`/api/findings/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) setActionFeedback(`${action} recorded`);
    } catch { setActionFeedback('Action failed'); }
    setTimeout(() => setActionFeedback(null), 3000);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6 flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading finding…</div>
    </div>
  );

  if (error || !finding) return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6">
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-red-400 text-lg">{error ?? 'Finding not found'}</p>
        <Link href="/findings" className="text-sm text-blue-400 hover:text-blue-300 mt-4 inline-block">
          ← Back to findings
        </Link>
      </div>
    </div>
  );

  const badge = SEVERITY_BADGE[finding.severity] ?? SEVERITY_BADGE.INFO;

  return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Link href="/findings" className="hover:text-slate-300">Findings</Link>
          <span>/</span>
          <span className="text-slate-400">{finding.id}</span>
        </nav>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${badge.bg} ${badge.text}`}>
                  {finding.severity}
                </span>
                <span className="text-xs text-slate-500">{finding.investigator}</span>
                <span className="text-xs text-slate-600">•</span>
                <span className="text-xs text-slate-500">{finding.category}</span>
              </div>
              <h1 className="text-xl font-semibold">{finding.title}</h1>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>{new Date(finding.createdAt).toLocaleString()}</p>
              {finding.expiresAt && <p className="mt-1">Expires: {new Date(finding.expiresAt).toLocaleDateString()}</p>}
              <p className="mt-1">Score: {finding.score}</p>
            </div>
          </div>

          {/* Summary + Explanation */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-4">
            <p className="text-sm text-slate-300 leading-relaxed">{finding.summary}</p>
            {finding.explanation && (
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">{finding.explanation}</p>
            )}
          </div>

          {/* NPIs */}
          {finding.npis.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">Affected Providers</h3>
              <div className="flex flex-wrap gap-2">
                {finding.npis.map(npi => (
                  <Link key={npi} href={`/verify/${npi}`}
                    className="px-3 py-1 text-xs bg-white/5 border border-white/10 rounded font-mono hover:bg-white/10 transition-colors">
                    {npi}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {finding.evidence?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">Evidence</h3>
              <div className="space-y-2">
                {finding.evidence.map((e, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-300">{e.claim}</span>
                      <span className="text-xs text-slate-500">{Math.round(e.confidence * 100)}%</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{e.source} • {new Date(e.timestamp).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/10">
            {(['acknowledge', 'dismiss', 'escalate'] as const).map(action => (
              <button key={action} onClick={() => handleAction(action)}
                className={`px-4 py-2 text-xs rounded-lg border transition-colors ${
                  action === 'escalate'
                    ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                    : action === 'dismiss'
                    ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                }`}>
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </button>
            ))}
            <Link href={`/investigations?npi=${finding.npis[0] ?? ''}`}
              className="px-4 py-2 text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg hover:bg-violet-500/20 transition-colors">
              Investigate
            </Link>
            {actionFeedback && (
              <span className="text-xs text-green-400 animate-pulse">{actionFeedback}</span>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
