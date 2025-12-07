'use client';

import { useEffect, useState } from 'react';

export default function HeaderBadges({ npi }: { npi: string }) {
  const [d, setD] = useState<any>();

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/clinician/behavioral-header?npi=' + encodeURIComponent(npi));
        setD(await r.json());
      } catch (e) {
        console.error('Failed to load behavioral header:', e);
      }
    })();
  }, [npi]);

  if (!d) return null;

  return (
    <div className="flex gap-2 text-[11px] flex-wrap">
      {/* PSYPACT Badge */}
      {(d.psypact?.apit || d.psypact?.tap || d.psypact?.epassport) && (
        <span
          className={
            'px-2 py-0.5 rounded border ' +
            (d.psypact?.apit ? 'bg-purple-100 border-purple-300' : 'bg-gray-100 border-gray-300')
          }
        >
          PSYPACT
          {d.psypact?.apit && ' • APIT'}
          {d.psypact?.tap && ' • TAP'}
          {d.psypact?.epassport && ` • E.Passport: ${d.psypact.epassport}`}
        </span>
      )}

      {/* Counseling Compact Badge */}
      {d.counseling && (
        <span
          className={
            'px-2 py-0.5 rounded border ' +
            (d.counseling?.privilege_required
              ? 'bg-amber-100 border-amber-300'
              : 'bg-green-100 border-green-300')
          }
        >
          Counseling: {d.counseling?.privilege_required ? 'Privilege required' : 'Eligible'}
        </span>
      )}
    </div>
  );
}
