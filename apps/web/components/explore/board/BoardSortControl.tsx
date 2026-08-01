'use client';

import { type BoardSort, SORT_LABEL, SORT_OPTIONS } from '@/lib/explore/board-filters';

export function BoardSortControl({
  value,
  onChange,
}: {
  value: BoardSort;
  onChange: (next: BoardSort) => void;
}) {
  return (
    <label className="mz-small inline-flex items-center gap-2" style={{ color: 'var(--vt-text-muted)' }}>
      Sort
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as BoardSort)}
        className="border px-2 py-1 text-[12.5px]"
        style={{
          borderRadius: 3,
          borderColor: 'var(--rule, #C9C3B6)',
          background: 'var(--card, #FBFAF6)',
          color: 'var(--vt-text-primary)',
        }}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>{SORT_LABEL[option]}</option>
        ))}
      </select>
    </label>
  );
}

export default BoardSortControl;
