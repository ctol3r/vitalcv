"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Rocket, CheckCircle2 } from "lucide-react";
import { cn } from "@/components/sandbox/lib/utils";
import {
  DEMO_OPEN_REQUISITIONS,
  sortRequisitionsByVelocity,
  type OpenRequisition,
} from "@/components/sandbox/lib/acceptance-graph";

export interface VelocityLeaderboardModalProps {
  open: boolean;
  onClose: () => void;
  requisitions?: OpenRequisition[];
  onApply?: (req: OpenRequisition) => void;
}

/**
 * Optimize for Velocity — a right-side drawer that ranks open requisitions
 * strictly by time-to-start given the clinician's current evidence. The
 * table is intentionally terminal-styled (snake_case column keys, font-mono
 * values) so the drawer reads as an operations console, not a job board.
 */
export default function VelocityLeaderboardModal({
  open,
  onClose,
  requisitions = DEMO_OPEN_REQUISITIONS,
  onApply,
}: VelocityLeaderboardModalProps) {
  const ranked = useMemo(() => sortRequisitionsByVelocity(requisitions), [requisitions]);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleApply = (req: OpenRequisition) => {
    setApplied((prev) => {
      const next = new Set(prev);
      next.add(req.facilityId);
      return next;
    });
    onApply?.(req);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal
            aria-label="Velocity leaderboard"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.25, 1, 0.3, 1] }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[820px] flex flex-col bg-bg border-l border-line shadow-[0_0_60px_rgba(0,0,0,0.45)]"
          >
            <header className="border-b border-line px-8 py-6 flex items-start justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 opacity-40">
                  <Rocket className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                    Optimize for Velocity
                  </span>
                </div>
                <h3 className="text-3xl font-bold tracking-tighter uppercase">Time-to-Start Leaderboard</h3>
                <p className="text-xs opacity-60 font-mono max-w-lg">
                  Open requisitions ranked strictly by estimated days to start given your current
                  verified evidence. One-click apply sends a signed snapshot of the packet.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close leaderboard"
                className="p-2 border border-line hover:bg-ink/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              <div className="px-8 py-6">
                <table className="w-full border border-line" aria-label="Open requisitions ranked by time to start">
                  <thead>
                    <tr className="border-b border-line bg-ink/5">
                      <TerminalHeader>Rank</TerminalHeader>
                      <TerminalHeader>Facility_ID</TerminalHeader>
                      <TerminalHeader>Role</TerminalHeader>
                      <TerminalHeader>Required_Delta</TerminalHeader>
                      <TerminalHeader className="text-right">Est_Start_Velocity</TerminalHeader>
                      <TerminalHeader className="text-right">Action</TerminalHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((req, i) => {
                      const isApplied = applied.has(req.facilityId);
                      return (
                        <tr
                          key={req.facilityId}
                          className="border-b border-line/40 last:border-b-0 hover:bg-ink/5 transition-colors"
                        >
                          <td className="px-4 py-4 font-mono text-xs opacity-40 tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </td>
                          <td className="px-4 py-4 font-mono text-xs">
                            <div className="font-bold">{req.facilityId}</div>
                            <div className="opacity-50 text-[10px] mt-0.5">{req.facilityName}</div>
                          </td>
                          <td className="px-4 py-4 font-mono text-xs">{req.role}</td>
                          <td className="px-4 py-4 font-mono text-xs opacity-80">
                            {req.requiredDelta === "None" ? (
                              <span className="opacity-40">{'// none'}</span>
                            ) : (
                              req.requiredDelta
                            )}
                          </td>
                          <td className="px-4 py-4 font-mono text-lg font-bold tracking-tight tabular-nums text-right">
                            {req.estStartVelocity}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleApply(req)}
                              disabled={isApplied}
                              className={cn(
                                "inline-flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all",
                                isApplied
                                  ? "border border-green-600/40 text-green-600 dark:text-green-400 bg-green-600/5 cursor-default"
                                  : "bg-ink text-bg hover:opacity-90",
                              )}
                              aria-label={
                                isApplied
                                  ? `Application sent to ${req.facilityName}`
                                  : `Apply with 1-Click Snapshot to ${req.facilityName}`
                              }
                            >
                              {isApplied ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Snapshot Sent
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3 h-3" />
                                  Apply with 1-Click Snapshot
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mt-4 flex items-center justify-between text-[9px] font-mono uppercase tracking-widest opacity-30">
                  <span>
                    {ranked.length} requisition{ranked.length === 1 ? "" : "s"} · sorted by est_start_days asc
                  </span>
                  <span>snapshot: sd-jwt · detached-proofs</span>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function TerminalHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn("px-4 py-3 text-left text-[9px] font-bold uppercase tracking-widest font-mono opacity-60", className)}
    >
      {children}
    </th>
  );
}
