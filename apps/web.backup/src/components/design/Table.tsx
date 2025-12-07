'use client'

import * as React from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface TableColumn<T = unknown> {
  key: string
  label: string
  sortable?: boolean
  render?: (value: T, row: T) => React.ReactNode
}

export interface TableProps<T = unknown> extends React.ComponentProps<'table'> {
  columns: TableColumn<T>[]
  data: T[]
  selectable?: boolean
  sortable?: boolean
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (column: string, direction: 'asc' | 'desc') => void
  onRowSelect?: (row: T, selected: boolean) => void
  selectedRows?: Set<T>
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
  }
}

function TableRoot({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  sortable,
  sorted,
  onSort,
  children,
  ...props
}: React.ComponentProps<'th'> & {
  sortable?: boolean
  sorted?: 'asc' | 'desc' | null
  onSort?: () => void
}) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        sortable && 'cursor-pointer select-none hover:bg-muted/50',
        className,
      )}
      onClick={sortable && onSort ? onSort : undefined}
      {...props}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortable && (
          <span className="inline-flex flex-col">
            <ChevronUp
              className={cn(
                'h-3 w-3',
                sorted === 'asc' ? 'text-foreground' : 'text-muted-foreground opacity-50',
              )}
            />
            <ChevronDown
              className={cn(
                'h-3 w-3 -mt-1',
                sorted === 'desc' ? 'text-foreground' : 'text-muted-foreground opacity-50',
              )}
            />
          </span>
        )}
      </div>
    </th>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

function Table<T extends Record<string, unknown>>({
  columns,
  data,
  selectable = false,
  sortable = false,
  sortColumn,
  sortDirection,
  onSort,
  onRowSelect,
  selectedRows = new Set(),
  pagination,
  ...props
}: TableProps<T>) {
  const handleSort = (columnKey: string) => {
    if (!onSort || !sortable) return

    const column = columns.find((col) => col.key === columnKey)
    if (!column?.sortable) return

    const newDirection =
      sortColumn === columnKey && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort(columnKey, newDirection)
  }

  const handleRowSelect = (row: T) => {
    if (!onRowSelect) return
    const isSelected = selectedRows.has(row)
    onRowSelect(row, !isSelected)
  }

  return (
    <div className="flex flex-col gap-4" data-slot="data-table">
      <TableRoot {...props}>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={data.length > 0 && data.every((row) => selectedRows.has(row))}
                  onChange={(e) => {
                    data.forEach((row) => {
                      onRowSelect?.(row, e.target.checked)
                    })
                  }}
                  className="h-4 w-4 rounded border-input"
                  aria-label="Select all rows"
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead
                key={column.key}
                sortable={sortable && column.sortable}
                sorted={sortColumn === column.key ? sortDirection || null : null}
                onSort={() => handleSort(column.key)}
                aria-sort={
                  sortColumn === column.key
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                No data available
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, index) => (
              <TableRow
                key={index}
                data-state={selectedRows.has(row) ? 'selected' : undefined}
              >
                {selectable && (
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row)}
                      onChange={() => handleRowSelect(row)}
                      className="h-4 w-4 rounded border-input"
                      aria-label={`Select row ${index + 1}`}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    {column.render
                      ? column.render((row as Record<string, unknown>)[column.key] as T, row)
                      : String((row as Record<string, unknown>)[column.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </TableRoot>

      {pagination && (
        <div
          data-slot="table-pagination"
          className="flex items-center justify-between"
        >
          <div className="text-muted-foreground text-sm">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="disabled:opacity-50 disabled:cursor-not-allowed rounded-md border px-3 py-1 text-sm transition-colors hover:bg-accent"
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="text-sm">
              Page {pagination.page} of{' '}
              {Math.ceil(pagination.total / pagination.pageSize)}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={
                pagination.page >= Math.ceil(pagination.total / pagination.pageSize)
              }
              className="disabled:opacity-50 disabled:cursor-not-allowed rounded-md border px-3 py-1 text-sm transition-colors hover:bg-accent"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export {
  Table,
  TableRoot,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

