'use client';

import { ShieldCheck, Info } from 'lucide-react';
import { TrustStateCardData } from '../trust-state/types';

export function TrustWidget({ data, npi = '1003000126' }: { data: TrustStateCardData, npi?: string }) {
  const isGreen = data.band === 'GREEN';

  return (
    <div className={`p-4 rounded-xl border max-w-sm flex items-start gap-4 shadow-sm bg-white ${isGreen ? 'border-emerald-200' : 'border-amber-200'}`}>
       <div className={`p-2 rounded-full mt-1 ${isGreen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          <ShieldCheck className="w-5 h-5" />
       </div>
       <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-bold text-slate-800">VitalCV Trust State</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-widest ${isGreen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isGreen ? 'Clear to Start' : 'Needs Review'}
              </span>
          </div>
          <p className="text-xs text-slate-500 font-mono mb-3">NPI: {npi}</p>

          <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-100 pt-3">
              <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Source Verified</span>
              <span>Expires in {data.daysRemaining}d</span>
          </div>
       </div>
    </div>
  );
}
