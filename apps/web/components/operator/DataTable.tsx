'use client';
import React from 'react';

export interface ColumnDef<T = Record<string, unknown>> { key: string; label: string; width?: number; sortable?: boolean; render?: (row: T) => React.ReactNode }
interface Props<T extends Record<string, unknown>> { columns: ColumnDef<T>[]; data: T[]; onRowClick?: (row: T) => void; selectedRow?: T | null }

export function DataTable<T extends Record<string, unknown>>({ columns, data, onRowClick, selectedRow }: Props<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [focusIdx, setFocusIdx] = React.useState(-1);

  const sorted = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(Math.min(idx + 1, sorted.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(Math.max(idx - 1, 0)); }
    else if (e.key === 'Enter' && onRowClick) onRowClick(sorted[idx]);
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}
                className={`text-left py-2 px-3 text-white/40 font-medium uppercase tracking-wider text-[10px] select-none ${col.sortable ? 'cursor-pointer hover:text-white/70' : ''}`}
                onClick={() => { if (!col.sortable) return; if (sortKey === col.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortKey(col.key); setSortDir('asc'); } }}>
                {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => (
            <tr key={idx} tabIndex={0} ref={(el) => { if (focusIdx === idx && el) el.focus(); }}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              onClick={() => onRowClick?.(row)}
              className={`h-10 border-b border-white/5 cursor-pointer transition-colors outline-none ${selectedRow === row ? 'bg-white/10' : 'hover:bg-white/5'} focus:bg-white/10`}>
              {columns.map((col) => (
                <td key={col.key} className="py-1.5 px-3 text-white/80">
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={columns.length} className="py-8 px-3 text-center text-white/30">No data</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
