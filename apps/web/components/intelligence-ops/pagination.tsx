'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type PaginationItem = number | 'ellipsis';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function normalizePage(page: number, totalPages: number) {
  return Math.min(Math.max(Math.trunc(page) || 1, 1), Math.max(1, Math.trunc(totalPages) || 1));
}

export function buildPaginationItems(page: number, totalPages: number): PaginationItem[] {
  const currentPage = normalizePage(page, totalPages);
  const safeTotalPages = Math.max(1, Math.trunc(totalPages) || 1);

  if (safeTotalPages <= 7) {
    return Array.from({ length: safeTotalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 'ellipsis', safeTotalPages];
  }

  if (currentPage >= safeTotalPages - 2) {
    return [1, 'ellipsis', safeTotalPages - 3, safeTotalPages - 2, safeTotalPages - 1, safeTotalPages];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', safeTotalPages];
}

export function formatPaginationSummary({
  page,
  limit,
  total,
  label,
}: {
  page: number;
  limit: number;
  total: number;
  label: string;
}) {
  const safeTotal = Math.max(0, Math.trunc(total) || 0);
  if (safeTotal === 0) {
    return `Showing 0 of 0 ${label}`;
  }

  const safeLimit = Math.max(1, Math.trunc(limit) || 1);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const currentPage = normalizePage(page, totalPages);
  const start = ((currentPage - 1) * safeLimit) + 1;
  const end = Math.min(safeTotal, currentPage * safeLimit);

  return `Showing ${start}\u2013${end} of ${safeTotal} ${label}`;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const currentPage = normalizePage(page, totalPages);
  const items = buildPaginationItems(currentPage, totalPages);

  function goToPage(nextPage: number) {
    const normalizedNextPage = normalizePage(nextPage, totalPages);
    if (normalizedNextPage === currentPage) {
      return;
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    onPageChange(normalizedNextPage);
  }

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-3 py-2 text-sm transition',
          currentPage <= 1
            ? 'cursor-not-allowed border-[var(--vt-border-2)] bg-transparent text-[var(--vt-text-3)]'
            : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-1)] hover:bg-[var(--vt-surface-2)]',
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </button>

      {items.map((item, index) => (
        item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} aria-hidden="true" className="px-2 text-sm text-[var(--vt-text-3)]">
            ...
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => goToPage(item)}
            aria-current={item === currentPage ? 'page' : undefined}
            disabled={item === currentPage}
            className={cn(
              'min-w-10 rounded-full border px-3 py-2 text-sm transition',
              item === currentPage
                ? 'cursor-default border-cyan-400/30 bg-cyan-500/15 text-[var(--vt-accent)]'
                : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-1)] hover:bg-[var(--vt-surface-2)]',
            )}
          >
            {item}
          </button>
        )
      ))}

      <button
        type="button"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-3 py-2 text-sm transition',
          currentPage >= totalPages
            ? 'cursor-not-allowed border-[var(--vt-border-2)] bg-transparent text-[var(--vt-text-3)]'
            : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-1)] hover:bg-[var(--vt-surface-2)]',
        )}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
