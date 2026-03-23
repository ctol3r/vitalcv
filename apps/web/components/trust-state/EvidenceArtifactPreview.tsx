'use client';

import { FileText, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function EvidenceArtifactPreview({
  artifactName,
  fieldsDisclosed,
  fieldsRedacted,
}: {
  artifactName: string;
  fieldsDisclosed: string[];
  fieldsRedacted: string[];
}) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500" />
          <span className="font-medium text-sm text-slate-800">{artifactName}</span>
        </div>
        <Badge className="text-[10px] uppercase font-mono tracking-wider bg-white text-slate-600 border-slate-200 shadow-none hover:bg-white">
          Portable Trust Artifact
        </Badge>
      </div>
      <div className="p-4 space-y-5">
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Disclosed Elements</h4>
          <ul className="grid grid-cols-2 gap-2.5">
            {fieldsDisclosed.map(f => (
              <li key={f} className="text-sm text-slate-700 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        
        {fieldsRedacted.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <EyeOff className="h-3.5 w-3.5" /> Minimum Necessary Policy Applied
            </h4>
            <div className="flex flex-wrap gap-2">
              {fieldsRedacted.map(f => (
                <div key={f} className="relative group">
                  <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded cursor-not-allowed border border-slate-200/50 blur-[1px] select-none block transition duration-300 group-hover:blur-sm overflow-hidden truncate max-w-[120px]">
                    xxxxxxxxxxxxxx
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] font-semibold tracking-wider uppercase text-slate-500 bg-white/80 px-1 rounded shadow-sm">Redacted</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
              Certain fields in this artifact have been selectively disclosed — only the claims required for this context are shown (SD-JWT, salted SHA-256 commitments).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
