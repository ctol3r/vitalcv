'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

interface EmergencySwitchProps {
  onDeclareEmergency: () => Promise<void>;
  isEmergencyActive: boolean;
}

export function EmergencySwitch({ onDeclareEmergency, isEmergencyActive }: EmergencySwitchProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTrigger = async () => {
    setLoading(true);
    await onDeclareEmergency();
    setLoading(false);
    setIsConfirming(false);
  };

  return (
    <div className="relative inline-flex items-center">
      {/* The main guarded switch */}
      <button
        onClick={() => !isEmergencyActive && setIsConfirming(true)}
        disabled={isEmergencyActive || loading}
        className={`relative flex items-center justify-center w-48 h-12 rounded-lg font-bold uppercase tracking-widest text-sm transition-all overflow-hidden border
          ${isEmergencyActive
            ? 'bg-rose-950/50 text-rose-500 border-rose-900/50 cursor-not-allowed shadow-[inset_0_0_20px_rgba(225,29,72,0.2)]'
            : 'bg-slate-900 text-rose-500 border-slate-700 hover:border-rose-500/50 hover:bg-slate-800'
          }`}
      >
        <span className="relative z-10 flex items-center gap-2">
          {isEmergencyActive ? (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              EMERGENCY ACTIVE
            </>
          ) : (
            <>
              ⚠️ DECLARE EMERGENCY
            </>
          )}
        </span>
      </button>

      {/* Confirmation Overlay */}
      <AnimatePresence>
        {isConfirming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute top-16 right-0 w-80 bg-slate-900 border border-rose-500/50 rounded-xl shadow-[0_10px_40px_-10px_rgba(225,29,72,0.3)] p-4 z-50 origin-top-right"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500 flex-shrink-0">
                🚨
              </div>
              <div>
                <h4 className="text-slate-100 font-bold mb-1">Confirm Emergency Declaration</h4>
                <p className="text-sm text-slate-400">
                  This action overrides standard trust parameters domain-wide. It escalates specific L2 credentials to L3 (72h TTL) and flags all transactions for mandatory post-event reconciliation.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsConfirming(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTrigger}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all flex justify-center items-center"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'CONFIRM DECLARATION'
                )}
              </button>
            </div>

            <div className="mt-3 text-[10px] text-slate-500 uppercase tracking-widest text-center">
              Action permanently logged to Audit Scrapbook
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
