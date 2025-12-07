'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { keys, isKey } from '@/lib/accessibility'

export interface TableColumn<T = any> {
  id: string
  header: string
  accessor?: (row: T) => React.ReactNode
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
}

export interface AccessibleDataTableProps<T = any> {
  data: T[]
  columns: TableColumn<T>[]
  caption?: string
  captionId?: string
  onRowSelect?: (row: T) => void
  selectedRows?: T[]
  getRowId?: (row: T) => string
  className?: string
  filterable?: boolean
  filterPlaceholder?: string
  onFilter?: (filterValue: string) => void
}

type SortDirection = 'asc' | 'desc' | null

/**
 * AccessibleDataTable component
 *
 * A data table with:
 * - Proper table semantics (thead, tbody, th)
 * - Sortable columns via keyboard
 * - Caption for screen readers
 * - Supports row selection
 * - Dynamic filtering
 * - Responsive design
 */
export function AccessibleDataTable<T extends Record<string, any>>({
  data,
  columns,
  caption,
  captionId,
  onRowSelect,
  selectedRows = [],
  getRowId,
  className,
  filterable = false,
  filterPlaceholder = 'Filter table...',
  onFilter,
}: AccessibleDataTableProps<T>) {
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null)
  const [filterValue, setFilterValue] = React.useState('')
  const tableId = React.useId()
  const tableCaptionId = captionId || `${tableId}-caption`

  const handleSort = (columnId: string) => {
    const column = columns.find((col) => col.id === columnId)
    if (!column?.sortable) return

    if (sortColumn === columnId) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      } else {
        setSortDirection('asc')
      }
    } else {
      setSortColumn(columnId)
      setSortDirection('asc')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, columnId: string) => {
    const column = columns.find((col) => col.id === columnId)
    if (!column?.sortable) return

    if (isKey(e.nativeEvent, keys.ENTER) || isKey(e.nativeEvent, keys.SPACE)) {
      e.preventDefault()
      handleSort(columnId)
    }
  }

  const sortedData = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return data

    const column = columns.find((col) => col.id === sortColumn)
    if (!column?.accessor) return data

    return [...data].sort((a, b) => {
      const aValue = column.accessor!(a)
      const bValue = column.accessor!(b)

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Compare values
      const comparison =
        typeof aValue === 'string' && typeof bValue === 'string'
          ? aValue.localeCompare(bValue)
          : aValue < bValue
            ? -1
            : aValue > bValue
              ? 1
              : 0

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data, sortColumn, sortDirection, columns])

  const filteredData = React.useMemo(() => {
    if (!filterable || !filterValue) return sortedData
    // Simple text-based filtering - can be enhanced
    return sortedData.filter((row) => {
      return columns.some((col) => {
        const value = col.accessor ? col.accessor(row) : row[col.id]
        return String(value).toLowerCase().includes(filterValue.toLowerCase())
      })
    })
  }, [sortedData, filterValue, filterable, columns])

  const handleFilterChange = (value: string) => {
    setFilterValue(value)
    onFilter?.(value)
  }

  const isRowSelected = (row: T) => {
    if (!getRowId || selectedRows.length === 0) return false
    const rowId = getRowId(row)
    return selectedRows.some((selected) => getRowId(selected) === rowId)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {filterable && (
        <div>
          <label htmlFor={`${tableId}-filter`} className="sr-only">
            {filterPlaceholder}
          </label>
          <input
            id={`${tableId}-filter`}
            type="text"
            value={filterValue}
            onChange={(e) => handleFilterChange(e.target.value)}
            placeholder={filterPlaceholder}
            aria-label={filterPlaceholder}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table
          id={tableId}
          role="table"
          aria-labelledby={caption ? tableCaptionId : undefined}
          className="w-full border-collapse"
        >
          {caption && (
            <caption id={tableCaptionId} className="mb-2 text-left text-sm font-medium">
              {caption}
            </caption>
          )}
          <thead>
            <tr>
              {columns.map((column) => {
                const isSorted = sortColumn === column.id
                const sortIcon =
                  isSorted && sortDirection === 'asc' ? (
                    <ArrowUp className="ml-2 h-4 w-4" aria-hidden="true" />
                  ) : isSorted && sortDirection === 'desc' ? (
                    <ArrowDown className="ml-2 h-4 w-4" aria-hidden="true" />
                  ) : column.sortable ? (
                    <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" aria-hidden="true" />
                  ) : null

                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      'border-b px-4 py-3 text-left text-sm font-medium',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.sortable && 'cursor-pointer select-none hover:bg-accent'
                    )}
                    onClick={() => column.sortable && handleSort(column.id)}
                    onKeyDown={(e) => column.sortable && handleKeyDown(e, column.id)}
                    tabIndex={column.sortable ? 0 : undefined}
                    aria-sort={
                      isSorted
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : column.sortable
                          ? 'none'
                          : undefined
                    }
                    role={column.sortable ? 'columnheader button' : 'columnheader'}
                    aria-label={
                      column.sortable
                        ? `${column.header}, sortable column. ${isSorted ? `Sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : 'Click to sort'}`
                        : column.header
                    }
                  >
                    <div
                      className={cn(
                        'flex items-center',
                        column.align === 'center' && 'justify-center',
                        column.align === 'right' && 'justify-end'
                      )}
                    >
                      {column.header}
                      {sortIcon}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No data available
                </td>
              </tr>
            ) : (
              filteredData.map((row, rowIndex) => {
                const rowId = getRowId ? getRowId(row) : `row-${rowIndex}`
                const isSelected = isRowSelected(row)

                return (
                  <tr
                    key={rowId}
                    className={cn(
                      'border-b transition-colors',
                      isSelected && 'bg-accent',
                      onRowSelect && 'cursor-pointer hover:bg-accent'
                    )}
                    onClick={() => onRowSelect?.(row)}
                    onKeyDown={(e) => {
                      if (onRowSelect && (isKey(e.nativeEvent, keys.ENTER) || isKey(e.nativeEvent, keys.SPACE))) {
                        e.preventDefault()
                        onRowSelect(row)
                      }
                    }}
                    tabIndex={onRowSelect ? 0 : undefined}
                    role={onRowSelect ? 'button' : 'row'}
                    aria-selected={onRowSelect ? isSelected : undefined}
                  >
                    {columns.map((column) => {
                      const value = column.accessor ? column.accessor(row) : row[column.id]

                      return (
                        <td
                          key={column.id}
                          className={cn(
                            'px-4 py-3 text-sm',
                            column.align === 'center' && 'text-center',
                            column.align === 'right' && 'text-right'
                          )}
                        >
                          {value}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

