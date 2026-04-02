'use client';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp } from 'lucide-react';
import React, { KeyboardEvent, useMemo, useState } from 'react';

export interface ColumnDef<T = Record<string, unknown>> {
  key: string;
  label: string;
  width?: number | string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface Props<T extends Record<string, unknown>> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  selectedRow?: T | null;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({ columns, data, onRowClick, selectedRow, className }: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [focusIdx, setFocusIdx] = useState(-1);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleKeyDown = (e: KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(Math.min(idx + 1, sorted.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(Math.max(idx - 1, 0));
    } else if (e.key === 'Enter' && onRowClick) {
      e.preventDefault();
      onRowClick(sorted[idx]);
    }
  };

  return (
    <div className={cn("w-full h-full flex flex-col bg-[#0a0a0f]", className)}>
      <div className="flex-1 overflow-auto overscroll-contain">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-[#0f1115] z-10 shadow-[0_1px_0_rgba(255,255,255,0.1)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    "py-2 px-3 text-[10px] font-semibold tracking-wider uppercase text-foreground/70 select-none",
                    col.sortable && "cursor-pointer hover:bg-white/[0.03] transition-colors",
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  )}
                  onClick={() => {
                    if (!col.sortable) return;
                    if (sortKey === col.key) {
                      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortKey(col.key);
                      setSortDir('asc');
                    }
                  }}
                >
                  <div className={cn("flex items-center gap-1", col.align === 'right' && "justify-end", col.align === 'center' && "justify-center")}>
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground/80" /> : <ArrowDown className="w-3 h-3 text-foreground/80" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {sorted.map((row, idx) => {
              const isSelected = selectedRow === row;
              const isFocused = focusIdx === idx;

              return (
                <tr
                  key={idx}
                  tabIndex={0}
                  ref={(el) => { if (isFocused && el) el.focus(); }}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onClick={() => {
                    setFocusIdx(idx);
                    onRowClick?.(row);
                  }}
                  className={cn(
                    "group h-9 text-xs transition-colors outline-none cursor-pointer",
                    isSelected ? "bg-vt-info/10 text-foreground" : "text-foreground/80 hover:bg-white/[0.02]",
                    isFocused && !isSelected && "bg-white/[0.04] ring-1 ring-inset ring-white/10"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "py-1 px-3 truncate max-w-[200px]",
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                        isSelected ? "text-white" : "text-foreground/70 group-hover:text-foreground/90"
                      )}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-12 px-3 text-center">
                  <span className="text-xs text-muted-foreground/60">No relative data available</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
