"use client";

export default function ProgramEvidenceCard({ p }: { p: any }) {
  if (!p) return null;

  return (
    <div className='p-3 border rounded text-xs'>
      <div>
        <b>{p.name}</b> — {p.institution}
      </div>
      <div className='opacity-70'>
        {p.accreditor} • {p.country}
      </div>
      <div className='mt-1'>
        <a className='underline' href={p.url} target='_blank' rel='noreferrer'>
          View source
        </a>{' '}
        •{' '}
        <span className='opacity-60'>
          Verified: {p.last_verified ? new Date(p.last_verified).toLocaleDateString() : '-'}
        </span>
      </div>
    </div>
  );
}

