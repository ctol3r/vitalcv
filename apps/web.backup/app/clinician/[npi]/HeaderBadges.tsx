"use client";
import { useEffect, useState } from 'react';

interface BehavioralHeaderData {
  psypact?: {
    apit?: boolean;
    tap?: boolean;
    epassport?: string;
  };
  counseling?: {
    privilege_required?: boolean;
    eligible?: boolean;
  };
}

interface CompactHeaderData {
  imlc?: {
    spl?: string;
    member?: boolean;
  };
  aprn?: {
    member?: boolean;
  };
}

export default function HeaderBadges({ npi }: { npi: string }) {
  const [data, setData] = useState<BehavioralHeaderData | null>(null);
  const [compactData, setCompactData] = useState<CompactHeaderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Fetch behavioral header (PSYPACT, Counseling)
        const r = await fetch('/api/clinician/behavioral-header?npi=' + encodeURIComponent(npi));
        if (r.ok) {
          setData(await r.json());
        }

        // Fetch compact header (IMLC, APRN)
        const c = await fetch('/api/clinician/compact-header?npi=' + encodeURIComponent(npi));
        if (c.ok) {
          setCompactData(await c.json());
        }
      } catch (err) {
        console.error('Failed to load header data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [npi]);

  if (loading) {
    return (
      <div className='flex gap-2 text-[11px] animate-pulse'>
        <div className='h-6 w-24 bg-gray-200 rounded'></div>
        <div className='h-6 w-32 bg-gray-200 rounded'></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className='flex gap-2 text-[11px] font-medium flex-wrap'>
      {/* PSYPACT Badge */}
      {data?.psypact && (
        <span
          className={
            'px-2 py-1 rounded border ' +
            (data.psypact.apit
              ? 'bg-purple-100 border-purple-300 text-purple-900'
              : 'bg-gray-100 border-gray-300 text-gray-600')
          }
        >
          <span className='font-semibold'>PSYPACT</span>
          {data.psypact.apit && <span className='ml-1'>✓ APIT</span>}
          {data.psypact.tap && <span className='ml-1'>• TAP</span>}
          {data.psypact.epassport && data.psypact.epassport !== 'DEMO' && (
            <span className='ml-1'>• E.Passport</span>
          )}
          {data.psypact.epassport === 'DEMO' && (
            <span className='ml-1 opacity-60'>• E.Passport Demo</span>
          )}
        </span>
      )}

      {/* Counseling Compact Badge */}
      {data?.counseling && (
        <span
          className={
            'px-2 py-1 rounded border ' +
            (data.counseling.privilege_required
              ? 'bg-amber-100 border-amber-300 text-amber-900'
              : 'bg-green-100 border-green-300 text-green-900')
          }
        >
          <span className='font-semibold'>Counseling</span>
          <span className='ml-1'>
            {data.counseling.privilege_required ? '⚠ Privilege Required' : '✓ Eligible'}
          </span>
        </span>
      )}

      {/* IMLC Badge (Interstate Medical Licensure Compact) */}
      {compactData?.imlc && (
        <span
          className={
            'px-2 py-1 rounded border ' +
            (compactData.imlc.member
              ? 'bg-blue-100 border-blue-300 text-blue-900'
              : 'bg-gray-100 border-gray-300 text-gray-600')
          }
        >
          <span className='font-semibold'>IMLC</span>
          {compactData.imlc.spl && <span className='ml-1'>SPL={compactData.imlc.spl}</span>}
          {compactData.imlc.member && <span className='ml-1'>✓ Member</span>}
        </span>
      )}

      {/* APRN Compact Badge (Advanced Practice Registered Nurse) */}
      {compactData?.aprn && (
        <span
          className={
            'px-2 py-1 rounded border ' +
            (compactData.aprn.member
              ? 'bg-teal-100 border-teal-300 text-teal-900'
              : 'bg-gray-100 border-gray-300 text-gray-600')
          }
        >
          <span className='font-semibold'>APRN Compact</span>
          <span className='ml-1'>
            {compactData.aprn.member ? '✓ Member' : '—'}
          </span>
        </span>
      )}
    </div>
  );
}

