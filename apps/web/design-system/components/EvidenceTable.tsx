import type React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from './Table';

export interface EvidenceColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
}

export interface EvidenceTableProps<T> {
  rows: T[];
  columns: Array<EvidenceColumn<T>>;
  emptyState?: React.ReactNode;
}

export function EvidenceTable<T>({
  columns,
  emptyState = 'No evidence rows are available.',
  rows,
}: EvidenceTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--vt-radius-md)] border border-dashed border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-[var(--vt-space-20)] py-[var(--vt-space-24)] text-[length:var(--vt-type-meta-size)] text-[var(--vt-text-muted)]">
        {emptyState}
      </div>
    );
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          {columns.map((column) => (
            <TableHeaderCell key={column.key}>{column.label}</TableHeaderCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {columns.map((column) => (
              <TableCell key={column.key}>{column.render(row)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
