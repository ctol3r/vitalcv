/**
 * Grid.tsx — Wave 173: Layout Grid System
 *
 * Data-dense responsive grid components for operator surfaces.
 * Inspired by Material Design 3 adaptive layouts + Vercel dashboard grids.
 *
 * Components:
 *   <Grid>       — root grid container with gap + breakpoints
 *   <GridRow>    — horizontal row, stacks on mobile
 *   <GridCol>    — column with responsive span (1–12 + auto)
 *   <GridArea>   — named area shortcuts (sidebar | main | aside | full)
 *   <DataGrid>   — compact data table with sortable columns
 *
 * Usage:
 *   <Grid cols={12} gap="md">
 *     <GridCol span={3} lg={2}>sidebar</GridCol>
 *     <GridCol span={9} lg={10}>main</GridCol>
 *   </Grid>
 *
 *   <DataGrid columns={[...]} rows={[...]} />
 *
 * Token integration: uses --space-* from design-tokens.css
 */

import type React from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

type GridCols = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type GridSpan = GridCols | 'auto' | 'full';
type GridGap  = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const GAP_CLASS: Record<GridGap, string> = {
  none: 'gap-0',
  xs:   'gap-1',
  sm:   'gap-2',
  md:   'gap-4',
  lg:   'gap-6',
  xl:   'gap-8',
};

const COL_CLASS: Record<GridCols, string> = {
  1:  'grid-cols-1',
  2:  'grid-cols-2',
  3:  'grid-cols-3',
  4:  'grid-cols-4',
  5:  'grid-cols-5',
  6:  'grid-cols-6',
  7:  'grid-cols-7',
  8:  'grid-cols-8',
  9:  'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
};

function spanClass(span: GridSpan, prefix = ''): string {
  if (span === 'auto') return prefix ? `${prefix}:col-auto`      : 'col-auto';
  if (span === 'full') return prefix ? `${prefix}:col-span-full`  : 'col-span-full';
  return prefix ? `${prefix}:col-span-${span}` : `col-span-${span}`;
}

// ── Grid (root) ───────────────────────────────────────────────────────────────

interface GridProps {
  /** Number of columns at base (mobile). Default: 1 */
  cols?: GridCols;
  /** Columns at sm breakpoint */
  sm?: GridCols;
  /** Columns at md breakpoint */
  md?: GridCols;
  /** Columns at lg breakpoint */
  lg?: GridCols;
  /** Columns at xl breakpoint */
  xl?: GridCols;
  /** Gap between cells */
  gap?: GridGap;
  /** Row gap (if different from col gap) */
  rowGap?: GridGap;
  /** Align items (stretch by default) */
  align?: 'start' | 'center' | 'end' | 'stretch';
  className?: string;
  children: React.ReactNode;
}

export function Grid({
  cols = 1,
  sm,
  md,
  lg,
  xl,
  gap = 'md',
  rowGap,
  align,
  className = '',
  children,
}: GridProps) {
  const classes = [
    'grid',
    COL_CLASS[cols],
    sm   ? `sm:${COL_CLASS[sm]}`   : '',
    md   ? `md:${COL_CLASS[md]}`   : '',
    lg   ? `lg:${COL_CLASS[lg]}`   : '',
    xl   ? `xl:${COL_CLASS[xl]}`   : '',
    GAP_CLASS[gap],
    rowGap ? `row-gap-${rowGap}` : '',
    align  ? `items-${align}` : '',
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
}

// ── GridRow ───────────────────────────────────────────────────────────────────

interface GridRowProps {
  /** Stack direction (default: row, stacks to col on mobile) */
  stack?: boolean;
  gap?: GridGap;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function GridRow({
  stack = true,
  gap = 'md',
  align = 'stretch',
  justify,
  wrap = false,
  className = '',
  children,
}: GridRowProps) {
  const classes = [
    'flex',
    stack ? 'flex-col sm:flex-row' : 'flex-row',
    GAP_CLASS[gap],
    `items-${align}`,
    justify ? `justify-${justify}` : '',
    wrap ? 'flex-wrap' : '',
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
}

// ── GridCol ───────────────────────────────────────────────────────────────────

interface GridColProps {
  /** Base span */
  span?: GridSpan;
  /** Span at sm breakpoint */
  sm?: GridSpan;
  /** Span at md breakpoint */
  md?: GridSpan;
  /** Span at lg breakpoint */
  lg?: GridSpan;
  /** Span at xl breakpoint */
  xl?: GridSpan;
  /** Column start position */
  start?: number;
  /** Min-width: 0 to prevent overflow (default: true) */
  minW?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function GridCol({
  span = 'auto',
  sm,
  md,
  lg,
  xl,
  start,
  minW = true,
  className = '',
  children,
}: GridColProps) {
  const classes = [
    spanClass(span),
    sm  ? spanClass(sm,  'sm')  : '',
    md  ? spanClass(md,  'md')  : '',
    lg  ? spanClass(lg,  'lg')  : '',
    xl  ? spanClass(xl,  'xl')  : '',
    start ? `col-start-${start}` : '',
    minW ? 'min-w-0' : '',
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
}

// ── GridArea (named layout shortcuts) ─────────────────────────────────────────

type GridAreaName = 'sidebar' | 'main' | 'aside' | 'full' | 'header' | 'panel';

interface GridAreaProps {
  area: GridAreaName;
  className?: string;
  children: React.ReactNode;
}

const AREA_SPANS: Record<GridAreaName, { span: GridSpan; lg: GridSpan }> = {
  sidebar: { span: 'full', lg: 3  },
  main:    { span: 'full', lg: 9  },
  aside:   { span: 'full', lg: 4  },
  full:    { span: 'full', lg: 'full' },
  header:  { span: 'full', lg: 'full' },
  panel:   { span: 'full', lg: 6  },
};

export function GridArea({ area, className = '', children }: GridAreaProps) {
  const { span, lg } = AREA_SPANS[area];
  return (
    <GridCol span={span} lg={lg} className={className}>
      {children}
    </GridCol>
  );
}

// ── DataGrid ──────────────────────────────────────────────────────────────────

export interface DataGridColumn<T> {
  key: keyof T;
  header: string;
  /** Custom render function */
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  /** Column width class (e.g. 'w-24', 'w-48') */
  width?: string;
  /** Text alignment (default: 'left') */
  align?: 'left' | 'center' | 'right';
}

interface DataGridProps<T extends Record<string, unknown>> {
  columns: DataGridColumn<T>[];
  rows: T[];
  /** Row key extractor */
  keyExtractor?: (row: T, index: number) => string | number;
  /** Empty state content */
  empty?: React.ReactNode;
  /** Striped rows */
  striped?: boolean;
  /** Compact row height */
  compact?: boolean;
  className?: string;
}

export function DataGrid<T extends Record<string, unknown>>({
  columns,
  rows,
  keyExtractor,
  empty,
  striped = true,
  compact = false,
  className = '',
}: DataGridProps<T>) {
  const cellPad = compact ? 'px-3 py-1.5' : 'px-4 py-2.5';
  const alignClass = (align?: 'left' | 'center' | 'right') =>
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  return (
    <div className={`overflow-x-auto rounded-xl border border-zinc-800 ${className}`}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={[
                  cellPad,
                  'font-medium text-zinc-500 uppercase tracking-wider type-tag',
                  alignClass(col.align),
                  col.width ?? '',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-zinc-600">
                {empty ?? 'No data'}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={keyExtractor ? keyExtractor(row, i) : i}
                className={[
                  'border-b border-zinc-800/50 last:border-0 transition-colors',
                  striped && i % 2 === 1 ? 'bg-zinc-900/20' : '',
                  'hover:bg-zinc-800/30',
                ].join(' ')}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={[cellPad, 'text-zinc-300', alignClass(col.align), col.width ?? ''].join(' ')}
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Preset operator layouts ───────────────────────────────────────────────────

/**
 * OperatorLayout: standard 2-column ops layout.
 * 3-col on lg+: sidebar (narrow) | main (wide) | aside (optional)
 */
export function OperatorLayout({
  sidebar,
  main,
  aside,
  gap = 'md',
  className = '',
}: {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  aside?: React.ReactNode;
  gap?: GridGap;
  className?: string;
}) {
  if (aside) {
    return (
      <Grid cols={1} md={12} gap={gap} className={className}>
        <GridCol span="full" md={3} lg={2}>{sidebar}</GridCol>
        <GridCol span="full" md={6} lg={7}>{main}</GridCol>
        <GridCol span="full" md={3} lg={3}>{aside}</GridCol>
      </Grid>
    );
  }
  return (
    <Grid cols={1} md={12} gap={gap} className={className}>
      <GridCol span="full" md={3} lg={2}>{sidebar}</GridCol>
      <GridCol span="full" md={9} lg={10}>{main}</GridCol>
    </Grid>
  );
}

/**
 * MetricStrip: horizontal row of equal-width metric cards.
 * 1-col mobile → 2-col tablet → 4-col desktop.
 */
export function MetricStrip({
  children,
  cols = 4,
  gap = 'sm',
  className = '',
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5 | 6;
  gap?: GridGap;
  className?: string;
}) {
  const lgCols = cols as GridCols;
  const mdCols = Math.min(cols, 3) as GridCols;
  return (
    <Grid cols={2} md={mdCols} lg={lgCols} gap={gap} className={className}>
      {children}
    </Grid>
  );
}
