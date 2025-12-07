"use client";

interface CompactFlags {
  imlc?: boolean;
  aprn?: boolean;
  psypact?: boolean;
}

interface CompactLegendProps {
  flags: CompactFlags;
  onToggle: (key: keyof CompactFlags) => void;
}

export default function CompactLegend({ flags, onToggle }: CompactLegendProps) {
  return (
    <div className='flex gap-2 text-[11px] mt-2'>
      <label
        className={
          'px-2 py-1 border rounded cursor-pointer transition-colors ' +
          (flags.imlc ? 'bg-blue-100 border-blue-300' : 'bg-white hover:bg-gray-50')
        }
      >
        <input
          type='checkbox'
          className='mr-1'
          checked={!!flags.imlc}
          onChange={() => onToggle('imlc')}
        />
        <span className='font-semibold'>IMLC</span>
        <span className='ml-1 opacity-70'>(Interstate Medical)</span>
      </label>

      <label
        className={
          'px-2 py-1 border rounded cursor-pointer transition-colors ' +
          (flags.aprn ? 'bg-teal-100 border-teal-300' : 'bg-white hover:bg-gray-50')
        }
      >
        <input
          type='checkbox'
          className='mr-1'
          checked={!!flags.aprn}
          onChange={() => onToggle('aprn')}
        />
        <span className='font-semibold'>APRN</span>
        <span className='ml-1 opacity-70'>(Nurse Compact)</span>
      </label>

      <label
        className={
          'px-2 py-1 border rounded cursor-pointer transition-colors ' +
          (flags.psypact ? 'bg-purple-100 border-purple-300' : 'bg-white hover:bg-gray-50')
        }
      >
        <input
          type='checkbox'
          className='mr-1'
          checked={!!flags.psypact}
          onChange={() => onToggle('psypact')}
        />
        <span className='font-semibold'>PSYPACT</span>
        <span className='ml-1 opacity-70'>(Psychology)</span>
      </label>
    </div>
  );
}
