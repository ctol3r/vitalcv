'use client';

/**
 * BoardPagination — numbered pages with an elided middle, so a long result set
 * doesn't produce a hundred controls. Page numbers are mono (CD-8).
 */

const RULE = 'var(--rule, #C9C3B6)';

/** 1 … 4 5 [6] 7 8 … 20 — always first, last, and a window around current. */
function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  const pages = new Set<number>([1, totalPages, page]);
  for (let offset = 1; offset <= 2; offset += 1) {
    if (page - offset > 0) pages.add(page - offset);
    if (page + offset <= totalPages) pages.add(page + offset);
  }

  const ordered = [...pages].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  let previous = 0;

  for (const value of ordered) {
    if (previous && value - previous > 1) out.push('gap');
    out.push(value);
    previous = value;
  }

  return out;
}

export function BoardPagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const items = pageWindow(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center gap-1.5 border-t pt-4"
      style={{ borderColor: RULE, marginTop: 8 }}
    >
      <PageButton disabled={page <= 1} onClick={() => onPage(page - 1)} label="Previous" />
      {items.map((item, index) => (
        item === 'gap'
          ? (
            <span
              key={`gap-${index}`}
              className="mz-mono px-1 text-[12px]"
              style={{ color: 'var(--vt-text-muted)' }}
              aria-hidden="true"
            >
              …
            </span>
          )
          : (
            <button
              key={item}
              type="button"
              onClick={() => onPage(item)}
              aria-current={item === page ? 'page' : undefined}
              aria-label={`Page ${item}`}
              className="mz-mono border px-2.5 py-1 text-[12px]"
              style={{
                borderRadius: 3,
                borderColor: item === page ? 'var(--vt-text-primary)' : RULE,
                background: item === page ? 'var(--vt-text-primary)' : 'transparent',
                color: item === page ? 'var(--paper, #F0EEE9)' : 'var(--vt-text-secondary)',
              }}
            >
              {item}
            </button>
          )
      ))}
      <PageButton disabled={page >= totalPages} onClick={() => onPage(page + 1)} label="Next" />
    </nav>
  );
}

function PageButton({
  disabled,
  onClick,
  label,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border px-2.5 py-1 text-[12px] disabled:opacity-40"
      style={{ borderRadius: 3, borderColor: RULE, color: 'var(--vt-text-secondary)' }}
    >
      {label}
    </button>
  );
}

export default BoardPagination;
