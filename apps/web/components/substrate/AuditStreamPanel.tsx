'use client';

/**
 * AuditStreamPanel — Phase 6: Operator Control Surface
 *
 * Live cursor-based audit event stream with category/severity filtering.
 *
 * API:
 *   GET /api/audit/events?after=<cursor>&limit=<n>
 *   GET /api/audit/health
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Activity, Download } from 'lucide-react';
import { getApiBase } from '@/lib/api';

interface AuditEntry {
  eventId: string;
  time: string;
  traceId: string;
  category: string[];
  actor: string;
  resource: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  requestFields: Record<string, unknown>;
  resultFields: Record<string, unknown>;
  receiptHash: string;
}

interface AuditPage {
  events: AuditEntry[];
  nextCursor: string | null;
  ledgerSize: number;
  totalReturned: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  INFO: 'text-zinc-400',
  WARNING: 'text-amber-400',
  CRITICAL: 'text-red-400',
  EMERGENCY: 'text-red-500',
};

const SEVERITY_BG: Record<string, string> = {
  INFO: '',
  WARNING: 'bg-amber-500/[0.03]',
  CRITICAL: 'bg-red-500/[0.05]',
  EMERGENCY: 'bg-red-500/[0.08]',
};

const base = () => getApiBase();

export function AuditStreamPanel({ pollIntervalMs = 15_000 }: { pollIntervalMs?: number }) {
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [ledgerSize, setLedgerSize] = useState(0);
  const [cursor, setCursor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async (after = '', append = false) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${base()}/api/audit/events?after=${encodeURIComponent(after)}&limit=50`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const page: AuditPage = await r.json();
      if (append) {
        setEvents((prev) => [...prev.slice(-150), ...page.events]);
      } else {
        setEvents(page.events);
      }
      if (page.nextCursor) setCursor(page.nextCursor);
      setLedgerSize(page.ledgerSize ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling for new events
  useEffect(() => {
    fetchEvents('', false);
  }, [fetchEvents]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (cursor) fetchEvents(cursor, true);
    }, pollIntervalMs);
    return () => clearInterval(iv);
  }, [fetchEvents, cursor, pollIntervalMs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const filtered = events.filter((e) => {
    if (filterSeverity && e.severity !== filterSeverity) return false;
    if (filterCategory && !e.category.includes(filterCategory)) return false;
    return true;
  });

  const handleExport = () => {
    const url = `${base()}/api/audit/stream?since=${new Date(Date.now() - 86400_000).toISOString()}&max=10000`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-3">
      {/* Header controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider flex-1">Audit Stream</p>
        <span className="text-[10px] text-zinc-600">{ledgerSize} total</span>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 rounded px-1.5 py-0.5 focus:outline-none"
        >
          <option value="">All severity</option>
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="EMERGENCY">EMERGENCY</option>
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 rounded px-1.5 py-0.5 focus:outline-none"
        >
          <option value="">All categories</option>
          {['ISSUANCE','PRESENTATION','VERIFICATION','REVOCATION','DECISION','MONITORING','FEDERATION','COMPLIANCE','AUTH','ADMIN','SYSTEM'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <button
          onClick={handleExport}
          title="Export NDJSON"
          className="text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <Download className="h-3 w-3" />
        </button>

        <button
          onClick={() => fetchEvents('', false)}
          className="text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 rounded-lg bg-red-500/[0.05] border border-red-500/20 p-2">{error}</div>
      )}

      {/* Event list */}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
        }}
        className="rounded-xl border border-zinc-800 overflow-y-auto max-h-72 font-mono divide-y divide-zinc-800/40"
      >
        {filtered.length === 0 && !loading ? (
          <div className="flex items-center gap-2 p-4 text-xs text-zinc-600">
            <Activity className="h-3 w-3" />
            <span>No audit events match current filters.</span>
          </div>
        ) : (
          filtered.map((e) => (
            <div key={e.eventId} className={`px-3 py-1.5 ${SEVERITY_BG[e.severity]}`}>
              <div className="flex items-start gap-2">
                <span className={`text-[9px] shrink-0 mt-0.5 ${SEVERITY_COLORS[e.severity]}`}>
                  {e.severity.padEnd(9)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-zinc-500">{new Date(e.time).toLocaleTimeString()}</span>
                    {e.category.map((c) => (
                      <span key={c} className="text-[9px] text-zinc-600 bg-zinc-800/60 rounded px-1">{c}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-300 truncate mt-0.5">
                    <span className="text-zinc-500">{e.actor}</span>
                    {' → '}
                    <span>{e.resource}</span>
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[9px] text-zinc-700">Showing {filtered.length} / {events.length} events</p>
        <label className="flex items-center gap-1 text-[10px] text-zinc-600 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="w-2.5 h-2.5"
          />
          Auto-scroll
        </label>
      </div>
    </div>
  );
}
