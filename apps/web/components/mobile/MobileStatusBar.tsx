'use client';

/**
 * MobileStatusBar.tsx — Wave 56: Floating Mobile Status Bar
 *
 * Persistent top bar showing network status, verification activity,
 * and revocation alerts. Fixed position with glass backdrop.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRoute } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────

type NetworkState = 'connected' | 'degraded' | 'offline';

interface StatusBarProps {
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<NetworkState, { label: string; dot: string; text: string }> = {
  connected: { label: 'Connected', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  degraded: { label: 'Degraded', dot: 'bg-amber-400', text: 'text-amber-400' },
  offline: { label: 'Offline', dot: 'bg-red-400', text: 'text-red-400' },
};

const POLL_MS = 15_000;

// ── Component ─────────────────────────────────────────────────────────────

export function MobileStatusBar({ className = '' }: StatusBarProps) {
  const [state, setState] = useState<NetworkState>('connected');
  const [verificationCount, setVerificationCount] = useState<number | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(apiRoute('/metrics/public'));
      if (!res.ok) {
        setState('degraded');
        return;
      }
      const data = (await res.json()) as Record<string, unknown>;
      setState('connected');
      if (typeof data.verificationsPerformed === 'number') {
        setVerificationCount(data.verificationsPerformed as number);
      }
    } catch {
      setState('offline');
    }
  }, []);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll]);

  // Simulate a revocation alert clearing after 5s
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const cfg = STATE_CONFIG[state];

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${className}`}>
      {/* Status Bar */}
      <div className="glass border-b border-white/[0.06] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${state === 'connected' ? 'animate-pulse' : ''}`} />
          <span className={`text-[11px] font-medium ${cfg.text}`}>{cfg.label}</span>
        </div>

        <div className="flex items-center gap-3">
          {verificationCount !== null && (
            <span className="text-[10px] text-zinc-500">
              {verificationCount.toLocaleString()} verified
            </span>
          )}
          <span className="text-[10px] text-zinc-600">VitalCV</span>
        </div>
      </div>

      {/* Alert Banner */}
      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-xs">⚡</span>
              <p className="text-[11px] text-red-300 flex-1">{alert}</p>
              <button
                onClick={() => setAlert(null)}
                className="text-red-400/60 text-xs"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MobileStatusBar;
