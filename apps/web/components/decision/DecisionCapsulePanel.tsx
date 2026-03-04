'use client';

/**
 * DecisionCapsulePanel.tsx — Wave 57: Verifier Integration Panel
 *
 * Fetches and displays the last N decision capsules for a clinician.
 * Designed to sit below the audit terminal on verifier dashboards.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DecisionCapsule } from './DecisionCapsule';
import { DecisionTimeline } from './DecisionTimeline';
import type { DecisionCapsuleData } from './DecisionCapsule';

// ── Types ─────────────────────────────────────────────────────────────────

interface DecisionCapsulePanelProps {
  npi: string;
  maxCapsules?: number;
  view?: 'cards' | 'timeline';
  className?: string;
}

interface ApiResponse {
  npi: string;
  capsules: DecisionCapsuleData[];
  totalCount: number;
  statusCounts: { VALID: number; AT_RISK: number; INVALID: number };
}

// ── Component ─────────────────────────────────────────────────────────────

export function DecisionCapsulePanel({
  npi,
  maxCapsules = 5,
  view: initialView = 'cards',
  className = '',
}: DecisionCapsulePanelProps) {
  const [capsules, setCapsules] = useState<DecisionCapsuleData[]>([]);
  const [statusCounts, setStatusCounts] = useState({ VALID: 0, AT_RISK: 0, INVALID: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState(initialView);

  const fetchCapsules = useCallback(async () => {
    if (!npi || !/^\d{10}$/.test(npi)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/decisions/${npi}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      setCapsules(data.capsules.slice(0, maxCapsules));
      setStatusCounts(data.statusCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [npi, maxCapsules]);

  useEffect(() => {
    fetchCapsules();
  }, [fetchCapsules]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className={`glass rounded-xl p-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-300">Decision Capsules</h3>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {capsules.length > 0
              ? `${statusCounts.VALID} valid · ${statusCounts.AT_RISK} at risk · ${statusCounts.INVALID} invalid`
              : 'Institutional decision history'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setView('cards')}
            className={`px-2 py-1 rounded text-[10px] transition-colors ${
              view === 'cards' ? 'bg-white/[0.1] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setView('timeline')}
            className={`px-2 py-1 rounded text-[10px] transition-colors ${
              view === 'timeline' ? 'bg-white/[0.1] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="bg-white/[0.03] rounded-lg h-20 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-6">
          <p className="text-xs text-zinc-500">{error}</p>
          <button
            onClick={fetchCapsules}
            className="mt-2 text-[10px] text-zinc-400 hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && capsules.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-zinc-600">No decision capsules recorded for this NPI</p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && capsules.length > 0 && (
        <AnimatePresence mode="wait">
          {view === 'cards' ? (
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {capsules.map((capsule, i) => (
                <DecisionCapsule key={capsule.id} capsule={capsule} index={i} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="timeline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DecisionTimeline capsules={capsules} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

export default DecisionCapsulePanel;
