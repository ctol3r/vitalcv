'use client';

/**
 * IssuerTrustScoresPanel — Phase 6: Operator Control Surface
 *
 * Displays issuer trust scores from the trust registry.
 *
 * API: GET /api/registry/issuers (or /api/analytics/issuers)
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Award } from 'lucide-react';
import { getApiBase } from '@/lib/api';

interface IssuerScore {
  issuerId: string;
  issuerName: string;
  trustScore: number;
  verificationCount: number;
  revocationCount: number;
  haipCompliant: boolean;
  status: string;
  type?: string;
}

const base = () => getApiBase();

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-500'
    : score >= 60 ? 'bg-blue-500'
    : score >= 40 ? 'bg-amber-500'
    : 'bg-red-500';
  return (
    <div className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
}

export function IssuerTrustScoresPanel({ pollIntervalMs = 60_000 }: { pollIntervalMs?: number }) {
  const [issuers, setIssuers] = useState<IssuerScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'verifications'>('score');

  const fetchIssuers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try analytics endpoint first, fall back to registry
      const endpoints = [
        `${base()}/api/registry/issuers`,
        `${base()}/api/analytics/issuers`,
      ];
      let data: IssuerScore[] = [];
      for (const url of endpoints) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const json = await r.json();
          data = Array.isArray(json) ? json : (json.issuers ?? json.registries ?? []);
          if (data.length > 0) break;
        } catch {
          // try next
        }
      }
      setIssuers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load issuers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssuers();
    const iv = setInterval(fetchIssuers, pollIntervalMs);
    return () => clearInterval(iv);
  }, [fetchIssuers, pollIntervalMs]);

  const sorted = [...issuers].sort((a, b) =>
    sortBy === 'score' ? b.trustScore - a.trustScore : b.verificationCount - a.verificationCount
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Issuer Trust Scores</p>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'score' | 'verifications')}
            className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 rounded px-1.5 py-0.5 focus:outline-none"
          >
            <option value="score">By Score</option>
            <option value="verifications">By Volume</option>
          </select>
          <button onClick={fetchIssuers} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 rounded-lg bg-red-500/[0.05] border border-red-500/20 p-2">{error}</div>
      )}

      {sorted.length === 0 && !loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Award className="h-3 w-3" />
          <span>No issuers in registry.</span>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800/60 max-h-64 overflow-y-auto">
          {sorted.map((issuer, idx) => (
            <div key={issuer.issuerId} className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-[10px] text-zinc-600 w-4 text-right shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-200 truncate">{issuer.issuerName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <ScoreBar score={issuer.trustScore} />
                  <span className={`text-[10px] font-bold ${
                    issuer.trustScore >= 80 ? 'text-emerald-400'
                    : issuer.trustScore >= 60 ? 'text-blue-400'
                    : issuer.trustScore >= 40 ? 'text-amber-400'
                    : 'text-red-400'
                  }`}>{issuer.trustScore}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-zinc-400">{issuer.verificationCount} verif.</p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  {issuer.haipCompliant && (
                    <span className="text-[9px] text-emerald-500">HAIP</span>
                  )}
                  {issuer.revocationCount > 0 && (
                    <span className="text-[9px] text-red-500">{issuer.revocationCount} rev.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
