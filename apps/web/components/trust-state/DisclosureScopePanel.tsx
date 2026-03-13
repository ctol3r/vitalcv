'use client';

import { Shield } from 'lucide-react';

export function DisclosureScopePanel({
  purposes,
  expiresInDays
}: {
  purposes: string[];
  expiresInDays: number;
}) {
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-5">
      <div className="flex gap-4">
        <div className="shrink-0">
          <div className="bg-indigo-100/80 p-2 rounded-full border border-indigo-200">
            <Shield className="h-5 w-5 text-indigo-600" />
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-sm text-indigo-950">Minimum-Necessary Disclosure Policy</h3>
          <p className="text-xs text-indigo-800/80 mt-1 max-w-prose leading-relaxed">
            Access to these credential facts is cryptographically scoped to the stated verification purposes. 
            The evidence artifacts will automatically decay from the verifier's perimeter in <strong className="font-semibold text-indigo-900">{expiresInDays} days</strong>.
          </p>
          
          <div className="mt-4">
            <h4 className="text-[10px] font-bold text-indigo-900/60 uppercase tracking-widest mb-2">Authorized Purposes</h4>
            <ul className="flex flex-wrap gap-2">
              {purposes.map(purpose => (
                <li key={purpose} className="text-xs bg-white text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md shadow-sm font-medium">
                  {purpose}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
