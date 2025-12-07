'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { keys, isKey } from '@/lib/accessibility'

export interface AccordionItem {
  id: string
  header: React.ReactNode
  content: React.ReactNode
  disabled?: boolean
}

export interface AccessibleAccordionProps {
  items: AccordionItem[]
  allowMultiple?: boolean
  defaultOpenIds?: string[]
  className?: string
  onItemToggle?: (id: string, isOpen: boolean) => void
}

/**
 * AccessibleAccordion component
 *
 * An accordion that:
 * - Respects ARIA guidelines (aria-expanded, aria-controls)
 * - Uses button elements for headers
 * - Supports keyboard navigation (UP/DOWN arrows)
 * - Ensures heading semantics
 */
export function AccessibleAccordion({
  items,
  allowMultiple = false,
  defaultOpenIds = [],
  className,
  onItemToggle,
}: AccessibleAccordionProps) {
  const [openIds, setOpenIds] = React.useState<Set<string>>(
    new Set(defaultOpenIds)
  )
  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map())

  const toggleItem = (id: string) => {
    const item = items.find((i) => i.id === id)
    if (item?.disabled) return

    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        onItemToggle?.(id, false)
      } else {
        if (!allowMultiple) {
          next.clear()
        }
        next.add(id)
        onItemToggle?.(id, true)
      }
      return next
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (isKey(e.nativeEvent, keys.ENTER) || isKey(e.nativeEvent, keys.SPACE)) {
      e.preventDefault()
      toggleItem(items[currentIndex].id)
      return
    }

    if (isKey(e.nativeEvent, keys.ARROW_DOWN)) {
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % items.length
      const nextItem = items[nextIndex]
      if (!nextItem.disabled) {
        itemRefs.current.get(nextItem.id)?.focus()
      }
      return
    }

    if (isKey(e.nativeEvent, keys.ARROW_UP)) {
      e.preventDefault()
      const prevIndex = (currentIndex - 1 + items.length) % items.length
      const prevItem = items[prevIndex]
      if (!prevItem.disabled) {
        itemRefs.current.get(prevItem.id)?.focus()
      }
      return
    }

    if (isKey(e.nativeEvent, keys.HOME)) {
      e.preventDefault()
      const firstItem = items.find((item) => !item.disabled)
      if (firstItem) {
        itemRefs.current.get(firstItem.id)?.focus()
      }
      return
    }

    if (isKey(e.nativeEvent, keys.END)) {
      e.preventDefault()
      const lastItem = [...items].reverse().find((item) => !item.disabled)
      if (lastItem) {
        itemRefs.current.get(lastItem.id)?.focus()
      }
      return
    }
  }

  return (
    <div className={cn('space-y-2', className)} role="region" aria-label="Accordion">
      {items.map((item, index) => {
        const isOpen = openIds.has(item.id)
        const contentId = `accordion-content-${item.id}`
        const headerId = `accordion-header-${item.id}`

        return (
          <div key={item.id} className="border rounded-md">
            <h3>
              <button
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(item.id, el)
                  } else {
                    itemRefs.current.delete(item.id)
                  }
                }}
                id={headerId}
                type="button"
                disabled={item.disabled}
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => toggleItem(item.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-3 text-left font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'hover:bg-accent',
                  item.disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <span>{item.header}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    isOpen && 'transform rotate-180'
                  )}
                  aria-hidden="true"
                />
              </button>
            </h3>
            <div
              id={contentId}
              role="region"
              aria-labelledby={headerId}
              className={cn(
                'overflow-hidden transition-all',
                isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="px-4 py-3">{item.content}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

