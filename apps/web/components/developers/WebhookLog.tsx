'use client';

/**
 * WebhookLog — Wave 30: Developer Sandbox
 *
 * Simulates a live webhook event stream. After a short delay, events
 * arrive every 3–5 s and slide into the list via framer-motion AnimatePresence.
 * Mirrors the UX of Stripe's event log — dark glass, mono timestamps, coloured badges.
 *
 * setInterval is started on mount (useEffect) and torn down on unmount.
 * No SSR-divergent state: list starts empty on both server and client.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Radio, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

type EventKind =
  | 'verification.completed'
  | 'credential.revoked'
  | 'audit.anchored'
  | 'crs.updated'
  | 'psv.received';

interface WebhookEvent {
  id: string;
  kind: EventKind;
  timestamp: string;       // e.g. "07:42:11.320"
  payload: Record<string, unknown>;
  status: 200 | 422;
}

// ── Mock data ─────────────────────────────────────────────────────────────

const EVENT_TEMPLATES: Array<{ kind: EventKind; status: 200 | 422; payload: Record<string, unknown> }> = [
  {
    kind: 'verification.completed',
    status: 200,
    payload: { npi: '1234567890', trust_state: 'verified_monitoring', crs_score: 95 },
  },
  {
    kind: 'audit.anchored',
    status: 200,
    payload: { npi: '9876543210', merkle_root: '0xab3f…c991', block: 18_922_411 },
  },
  {
    kind: 'crs.updated',
    status: 200,
    payload: { npi: '1234567890', previous_score: 88, new_score: 95, band: 'GREEN' },
  },
  {
    kind: 'psv.received',
    status: 200,
    payload: { npi: '5551234567', source: 'NURSYS', license_status: 'ACTIVE' },
  },
  {
    kind: 'credential.revoked',
    status: 200,
    payload: { npi: '9876543210', credential_type: 'DEA', reason: 'voluntary_surrender' },
  },
];

function randomTemplate() {
  return EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
}

function nowTimestamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function buildEvent(): WebhookEvent {
  const tpl = randomTemplate();
  return {
    id: `evt_${Math.random().toString(36).slice(2, 11)}`,
    kind: tpl.kind,
    status: tpl.status,
    timestamp: nowTimestamp(),
    payload: { ...tpl.payload },
  };
}

// ── Badge colours ─────────────────────────────────────────────────────────

const KIND_STYLE: Record<EventKind, { dot: string; badge: string; label: string }> = {
  'verification.completed': {
    dot:   'bg-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
    label: 'verification.completed',
  },
  'credential.revoked': {
    dot:   'bg-red-400',
    badge: 'bg-red-500/10 text-red-400 ring-red-500/30',
    label: 'credential.revoked',
  },
  'audit.anchored': {
    dot:   'bg-violet-400',
    badge: 'bg-violet-500/10 text-violet-400 ring-violet-500/30',
    label: 'audit.anchored',
  },
  'crs.updated': {
    dot:   'bg-sky-400',
    badge: 'bg-sky-500/10 text-sky-400 ring-sky-500/30',
    label: 'crs.updated',
  },
  'psv.received': {
    dot:   'bg-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
    label: 'psv.received',
  },
};

const MAX_EVENTS = 12;

// ── Component ─────────────────────────────────────────────────────────────

export function WebhookLog() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [listening, setListening] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addEvent = useCallback(() => {
    setEvents((prev) => [buildEvent(), ...prev].slice(0, MAX_EVENTS));
  }, []);

  const startListening = useCallback(() => {
    setListening(true);
    // First event fires quickly to feel "live"
    const t = setTimeout(() => {
      addEvent();
      intervalRef.current = setInterval(() => {
        addEvent();
      }, 3500 + Math.random() * 1500);
    }, 800);
    return t;
  }, [addEvent]);

  const stopListening = useCallback(() => {
    setListening(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearLog = useCallback(() => {
    setEvents([]);
  }, []);

  // Auto-start on mount, auto-stop on unmount
  useEffect(() => {
    const t = startListening();
    return () => {
      clearTimeout(t);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      aria-label="Live Webhook Log"
      className="flex flex-col rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/8 px-6 py-4">
        <Activity className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-white">Webhook Event Log</h2>

        {/* Live pulse badge */}
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              listening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600',
            ].join(' ')}
          />
          {listening ? 'Listening' : 'Paused'}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Toggle */}
          <button
            onClick={listening ? stopListening : startListening}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label={listening ? 'Pause listener' : 'Start listener'}
          >
            <Radio className="h-4 w-4" />
          </button>
          {/* Clear */}
          <button
            onClick={clearLog}
            disabled={events.length === 0}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
            aria-label="Clear log"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Endpoint banner */}
      <div className="border-b border-white/5 bg-slate-900/40 px-6 py-2.5">
        <p className="font-mono text-[11px] text-slate-500">
          <span className="text-slate-600">POST </span>
          <span className="text-slate-400">https://hospital.com/webhooks/vitalcv</span>
        </p>
      </div>

      {/* Event list */}
      <div className="relative flex-1 min-h-[280px] overflow-auto">
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-slate-900/60">
                <Radio className="h-5 w-5 text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Listening for events…
              </p>
              <p className="max-w-xs text-xs text-slate-600">
                Webhook events will appear here in real time as VitalCV processes verifications
                for clinicians on your roster.
              </p>
            </motion.div>
          ) : (
            events.map((evt) => {
              const style = KIND_STYLE[evt.kind];
              return (
                <motion.div
                  key={evt.id}
                  layout
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex items-start gap-4 border-b border-white/5 px-6 py-3 last:border-b-0 hover:bg-white/[0.015]"
                >
                  {/* Dot */}
                  <div className="mt-1.5 shrink-0">
                    <span className={`block h-2 w-2 rounded-full ${style.dot}`} />
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ring-1 ${style.badge}`}>
                        {evt.kind}
                      </span>
                      <span className="font-mono text-[10px] text-slate-600">{evt.id}</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-600">
                      {JSON.stringify(evt.payload)}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="shrink-0 text-right">
                    <span className="font-mono text-[10px] text-slate-600">{evt.timestamp}</span>
                    <p className="mt-0.5 font-mono text-[10px] text-emerald-400">{evt.status}</p>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
