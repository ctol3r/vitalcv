"use client";

export default function EvidenceDrawer({ items = [] }: { items: any[] }) {
  return (
    <div className='p-3 border rounded text-xs'>
      {items.length ? (
        items.map((x: any, i: number) => (
          <div key={i} className='py-1'>
            <b>{x.label}</b> —{' '}
            <a className='underline' href={x.link} target='_blank' rel='noreferrer'>
              {x.type}
            </a>{' '}
            <span className='opacity-60'>{x.timestamp || ''}</span>
          </div>
        ))
      ) : (
        'No evidence yet'
      )}
    </div>
  );
}

