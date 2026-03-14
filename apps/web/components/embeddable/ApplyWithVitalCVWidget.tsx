'use client';

import { ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  ApplyWithVitalCVWidget — Final Interaction Flow                   */
/*                                                                    */
/*  Delivers extremely minimal UI, instant comprehension, and calm    */
/*  authority for candidates applying to employer positions.          */
/* ------------------------------------------------------------------ */

interface ApplyWithVitalCVWidgetProps {
  employerName?: string;
  onInitiate?: () => void;
}

export function ApplyWithVitalCVWidget({
  employerName = 'Acme Health',
  onInitiate
}: ApplyWithVitalCVWidgetProps) {
  return (
    <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm max-w-sm flex items-center justify-between hover:shadow-md transition-shadow group cursor-pointer" onClick={onInitiate}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">VitalCV Instant Apply</h4>
          <p className="text-xs font-mono text-slate-500 mt-0.5">Share trusted credentials.</p>
        </div>
      </div>
      <div className="text-slate-400 group-hover:text-black transition-colors px-2">
        <ArrowRight className="w-4 h-4" />
      </div>
    </div>
  );
}

// Result Screen / Final View
import { VerificationLatencyBadge } from '../onboarding/VerificationLatencyBadge';
import { VerifierConfidencePanel } from '../employer/VerifierConfidencePanel';

export function ApplyWithVitalCVResult({ candidateName = "Dr. Sarah Chen", readinessScore = 98, trustLevel = "L3" }) {
  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="p-6 border border-emerald-100 rounded-2xl bg-emerald-50/30 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded-full">
              <UserCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest font-bold text-emerald-800">
              Application Received & Verified
            </span>
          </div>

          <div className="pl-8 border-l border-emerald-200 ml-3 py-1 space-y-1">
            <h3 className="text-xl font-serif text-slate-900">{candidateName}</h3>
            <p className="text-sm font-mono text-slate-500">Identity & Credentials Confirmed</p>
          </div>
        </div>

        {/* Verification Result Banner (Wave 299) */}
        <div className="mt-4 sm:mt-0 px-4 sm:px-0">
          <VerificationLatencyBadge 
            latencyMs={142} 
            trustLevel={trustLevel} 
            timestamp={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
          />
        </div>
      </div>

      {/* Verifier Confidence Panel (Wave 300) */}
      <VerifierConfidencePanel
        trustLevel={trustLevel}
        readinessScore={readinessScore}
        artifactCount={4}
        latencyMs={142}
      />
    </div>
  );
}
