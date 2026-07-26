'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { DisclosureScopePanel } from '@/components/trust-state/DisclosureScopePanel';

type ConsentStep = 'REVIEW' | 'PROCESSING' | 'SUCCESS' | 'FAILURE';

export function TrustConsentModal({ requestingParty = 'Acme Health', purposes = ['Onboarding'] }: { requestingParty?: string, purposes?: string[] }) {
   const [step, setStep] = useState<ConsentStep>('REVIEW');

   const handleConsent = () => {
       setStep('PROCESSING');
       setTimeout(() => setStep('SUCCESS'), 2000);
   };

   return (
       <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
           <AnimatePresence mode="wait">
               {step === 'REVIEW' && (
                 <motion.div key="review" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Share Cryptographic Facts</h2>
                    <p className="text-sm text-slate-600 mb-6"><strong>{requestingParty}</strong> is requesting cryptographic proof of your credentials.</p>
                    
                    <div className="mb-6">
                        <DisclosureScopePanel purposes={purposes} expiresInDays={30} />
                    </div>

                    <div className="flex gap-3">
                        <button className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors">Decline</button>
                        <button onClick={handleConsent} className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-foreground font-medium hover:bg-indigo-700 transition-colors shadow-sm">Authorize</button>
                    </div>
                 </motion.div>
               )}
               {step === 'PROCESSING' && (
                 <motion.div key="processing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-xl flex flex-col items-center justify-center">
                    <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                    <h3 className="text-lg font-bold text-slate-800">Generating selective-disclosure proof...</h3>
                    <p className="text-xs text-slate-500 mt-2 text-center">Cryptographically signing your portable trust artifacts.</p>
                 </motion.div>
               )}
               {step === 'SUCCESS' && (
                 <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-xl flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Authorization Successful</h3>
                    <p className="text-sm text-slate-600 mt-2">Your portable trust artifact has been securely shared with {requestingParty}.</p>
                    <button onClick={() => window.parent.postMessage('vitalcv:auth-close', '*')} className="mt-6 w-full py-2.5 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors">Return to Application</button>
                 </motion.div>
               )}
           </AnimatePresence>
       </div>
   );
}
