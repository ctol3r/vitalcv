'use client';

/**
 * RevocationCascadePanel — Phase 6: Operator Control Surface
 *
 * Shows revocation ledger and allows triggering blast-radius analysis
 * for a specific credential ID.
 *
 * APIs:
 *   GET  /api/revocation             — list all revocations
 *   GET  /api/decisions/blast-radius/:credentialId
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { getApiBase } from '@/lib/api';

interface RevocationEntry {
  credentialId: string;
  npi?: string;
  reason?: string;
  revokedAt: string;
  permanent: boolean;
}

interface BlastRadius {
  credentialId: string;
  directImpact: { entityId: string; type: string; status: string }[];
  cascadeDepth: number;
  totalAffected: number;
  computedAt: string;
}

const base = () => getApiBase();

export function RevocationCascadePanel({ pollIntervalMs = 30_000 }: { pollIntervalMs?: number }) {
  const [revocations, setRevocations] = useState<RevocationEntry[]>([]);
  const [blast, setBlast] = useState<BlastRadius | null>(null);
  const [blastId, setBlastId] = useState('');
  const [loading, setLoading] = useState(false);
  const [blastLoading, setBlastLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRevocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${base()}/api/revocation`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setRevocations(Array.isArray(data) ? data : (data.revocations ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load revocations');
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerBlast = useCallback(async () => {
    if (!blastId.trim()) return;
    setBlastLoading(true);
    setBlast(null);
    try {
      const r = await fetch(`${base()}/api/decisions/blast-radius/${encodeURIComponent(blastId.trim())}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setBlast(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Blast radius failed');
    } finally {
      setBlastLoading(false);
    }
  }, [blastId]);

  useEffect(() => {
    fetchRevocations();
    const iv = setInterval(fetchRevocations, pollIntervalMs);
    return () => clearInterval(iv);
  }, [fetchRevocations, pollIntervalMs]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Revocation Ledger</p>
        <button onClick={fetchRevocations} className="text-zinc-600 hover:text-zinc-300 transition-colors">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 rounded-lg bg-red-500/[0.05] border border-red-500/20 p-2">{error}</div>
      )}

      {/* Revocation list */}
      {revocations.length === 0 && !loading ? (
        <p className="text-xs text-zinc-600 italic">No active revocations.</p>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800/60 max-h-48 overflow-y-auto">
          {revocations.map((r) => (
            <div
              key={r.credentialId}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] cursor-pointer"
              onClick={() => setBlastId(r.credentialId)}
            >
              <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-zinc-300 truncate">{r.credentialId}</p>
                <p className="text-[10px] text-zinc-600">{r.reason ?? 'No reason'} · {new Date(r.revokedAt).toLocaleDateString()}</p>
              </div>
              {r.permanent && (
                <span className="text-[9px] text-red-500 border border-red-500/30 rounded px-1">PERMANENT</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Blast radius trigger */}
      <div className="flex gap-2">
        <input
          type="text"
          value={blastId}
          onChange={(e) => setBlastId(e.target.value)}
          placeholder="Credential ID for blast-radius…"
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          onKeyDown={(e) => e.key === 'Enter' && triggerBlast()}
        />
        <button
          onClick={triggerBlast}
          disabled={blastLoading || !blastId.trim()}
          className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
        >
          <Zap className={`h-3 w-3 ${blastLoading ? 'animate-pulse' : ''}`} />
          Blast
        </button>
      </div>

      {/* Blast result */}
      {blast && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-2">
          <div className="flex justify-between text-[10px]">
            <span className="text-amber-400 font-medium">Blast Radius: {blast.credentialId}</span>
            <span className="text-zinc-600">{blast.totalAffected} affected · depth {blast.cascadeDepth}</span>
          </div>
          {blast.directImpact.slice(0, 5).map((i, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-400 truncate flex-1">{i.entityId}</span>
              <span className="text-[10px] text-zinc-600">{i.type}</span>
              <span className={`text-[9px] px-1 rounded ${i.status === 'INVALID' ? 'text-red-400 bg-red-500/10' : i.status === 'AT_RISK' ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400 bg-zinc-800'}`}>
                {i.status}
              </span>
            </div>
          ))}
          {blast.directImpact.length > 5 && (
            <p className="text-[10px] text-zinc-600">+{blast.directImpact.length - 5} more entities</p>
          )}
        </div>
      )}
    </div>
  );
}
