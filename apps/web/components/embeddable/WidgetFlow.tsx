'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Check, Activity, MoveRight, UserCheck } from 'lucide-react';
import { ApplyWithVitalCVWidget, ApplyWithVitalCVResult } from './ApplyWithVitalCVWidget';

export function WidgetDemoFlow() {
  const [state, setState] = useState<'idle' | 'popup' | 'processing' | 'success'>('idle');

  return (
    <div className="flex flex-col gap-12 max-w-lg mx-auto p-12 bg-slate-50 min-h-screen">
      
      {state === 'idle' && (
        <div className="flex justify-center">
          <ApplyWithVitalCVWidget onInitiate={() => setState('popup')} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {state === 'popup' && (
          <motion.div
            key="popup"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-8 border border-slate-200 rounded-3xl bg-white shadow-2xl max-w-sm mx-auto"
          >
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-serif text-slate-900 mb-2">Acme Health</h3>
                <p className="text-sm font-mono text-slate-500">Requesting verification for Registered Nurse application</p>
              </div>

              <div className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Trust Level</span>
                  <span className="text-sm font-bold text-slate-900">L3 Verified</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Share Auth</span>
                  <span className="text-xs text-slate-500">1 Time Use</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setState('processing');
                  setTimeout(() => setState('success'), 2000);
                }}
                className="w-full bg-black text-white font-mono text-sm py-4 rounded-xl hover:bg-slate-800 transition-colors focus:ring-4 focus:ring-slate-200 outline-none"
              >
                Confirm & Apply
              </button>
            </div>
          </motion.div>
        )}

        {state === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-12 border border-slate-200 rounded-3xl bg-white shadow-2xl max-w-sm mx-auto flex flex-col items-center justify-center text-center gap-6"
          >
            <Activity className="w-8 h-8 text-black animate-pulse" />
            <p className="text-sm font-mono text-slate-500">Generating cryptographic proof...</p>
          </motion.div>
        )}

        {state === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            <div className="mx-auto flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full border border-emerald-200">
              <Check className="w-8 h-8" />
            </div>

            <ApplyWithVitalCVResult 
              candidateName="Dr. Sarah Chen"
              readinessScore={98}
              trustLevel="L3"
            />

            <button
               onClick={() => setState('idle')}
               className="text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-black mt-8 text-center"
            >
              Reset Demo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
