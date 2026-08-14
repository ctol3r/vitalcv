'use client';

/**
 * BoardPagination — numbered pages with an elided middle, so a long result set
 * doesn't produce a hundred controls.
 */

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
      className="opf-pagination"
    >
      <PageButton disabled={page <= 1} onClick={() => onPage(page - 1)} label="Previous" />
      {items.map((item, index) => (
        item === 'gap'
          ? (
            <span
              key={`gap-${index}`}
              className="opf-pagination-gap"
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
              className="opf-page-button"
              data-current={item === page ? 'true' : undefined}
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
      className="opf-page-button opf-page-word"
    >
      {label}
    </button>
  );
}

export default BoardPagination;
