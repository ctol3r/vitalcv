'use client';

import { useInvestigation, useTrustScore } from '@/lib/hooks/useIntelligence';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function InvestigationsPage() {
  const [npi, setNpi] = useState('');
  const [activeNpi, setActiveNpi] = useState<string | null>(null);
  const { data: investigation, loading, error, post } = useInvestigation();
  const { data: trustScore } = useTrustScore(activeNpi);

  const handleInvestigate = async () => {
    const cleaned = npi.trim();
    if (!/^\d{10}$/.test(cleaned)) return;
    setActiveNpi(cleaned);
    await post('/api/copilot/ask', {
      query: `investigate ${cleaned}`,
      sessionId: `inv_${cleaned}_${Date.now()}`,
    });
  };

  const result = investigation as {
    answer?: string;
    intent?: string;
    confidence?: number;
    sources?: string[];
  } | null;

  return (
    <div className="min-h-screen bg-[#080e1a] text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Investigations</h1>
          <p className="text-sm text-slate-400 mt-1">
            Deep provider intelligence — trust state, conflicts, network, predictions
          </p>
        </div>

        {/* Search bar */}
        <div className="flex gap-3 mb-8">
          <input
            type="text"
            value={npi}
            onChange={(e) => setNpi(e.target.value)}
            placeholder="Enter NPI (10 digits)"
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleInvestigate()}
          />
          <button
            onClick={handleInvestigate}
            disabled={loading || !/^\d{10}$/.test(npi.trim())}
            className="px-6 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20 rounded-lg transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? 'Investigating…' : 'Investigate'}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-400">Error: {error}</p>
          </div>
        )}

        {/* Trust score card */}
        {trustScore && activeNpi && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Trust Score</p>
                <p className="text-4xl font-semibold mt-1">
                  {(trustScore as Record<string, unknown>).score as number}/100
                </p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  (trustScore as Record<string, unknown>).band === 'L3' ? 'bg-green-500/20 text-green-400' :
                  (trustScore as Record<string, unknown>).band === 'L2' ? 'bg-yellow-500/20 text-yellow-400' :
                  (trustScore as Record<string, unknown>).band === 'L1' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {(trustScore as Record<string, unknown>).bandLabel as string}
                </span>
                <p className="text-xs text-slate-500 mt-2 font-mono">NPI {activeNpi}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Investigation result */}
        {result?.answer && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.03] border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-500 uppercase tracking-wide">Investigation Report</span>
              {result.confidence && (
                <span className="text-xs text-slate-600">
                  {Math.round(result.confidence * 100)}% confidence
                </span>
              )}
            </div>

            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed font-sans">
                {result.answer}
              </pre>
            </div>

            {result.sources && result.sources.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
                {result.sources.map((s) => (
                  <span key={s} className="px-2 py-0.5 text-xs bg-white/5 border border-white/10 rounded text-slate-400">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {!result?.answer && !loading && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg">Enter an NPI to investigate</p>
            <p className="text-sm mt-2">
              Combines trust score, freshness, divergence, network analysis, findings, storylines, actions, and predictions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
