'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown, Check } from 'lucide-react'
import { keys, isKey } from '@/lib/accessibility'

export interface DropdownOption {
  value: string
  label: string
  disabled?: boolean
}

export interface AccessibleDropdownProps {
  options: DropdownOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  id?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
}

/**
 * AccessibleDropdown component
 *
 * A custom dropdown with:
 * - Accessible focus handling
 * - Keyboard navigation (space/enter, arrow keys)
 * - Labelled by visible control
 * - Separate hidden listbox
 * - Collapses on blur
 * - Integrated with forms
 */
export function AccessibleDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  id,
  className,
  disabled = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: AccessibleDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [focusedIndex, setFocusedIndex] = React.useState(-1)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const listboxRef = React.useRef<HTMLUListElement>(null)
  const dropdownId = React.useId()
  const listboxId = `${dropdownId}-listbox`
  const labelId = label ? `${dropdownId}-label` : undefined

  const selectedOption = options.find((opt) => opt.value === value)

  const handleSelect = (option: DropdownOption) => {
    if (option.disabled) return
    onChange(option.value)
    setIsOpen(false)
    setFocusedIndex(-1)
    buttonRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (isKey(e.nativeEvent, keys.ESCAPE)) {
      setIsOpen(false)
      setFocusedIndex(-1)
      buttonRef.current?.focus()
      return
    }

    if (!isOpen) {
      if (isKey(e.nativeEvent, keys.ENTER) || isKey(e.nativeEvent, keys.SPACE)) {
        e.preventDefault()
        setIsOpen(true)
        setFocusedIndex(0)
        return
      }
      if (isKey(e.nativeEvent, keys.ARROW_DOWN) || isKey(e.nativeEvent, keys.ARROW_UP)) {
        e.preventDefault()
        setIsOpen(true)
        setFocusedIndex(isKey(e.nativeEvent, keys.ARROW_DOWN) ? 0 : options.length - 1)
        return
      }
      return
    }

    // Handle navigation when open
    if (isKey(e.nativeEvent, keys.ARROW_DOWN)) {
      e.preventDefault()
      const nextIndex = focusedIndex < options.length - 1 ? focusedIndex + 1 : 0
      setFocusedIndex(nextIndex)
      listboxRef.current?.children[nextIndex]?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (isKey(e.nativeEvent, keys.ARROW_UP)) {
      e.preventDefault()
      const prevIndex = focusedIndex > 0 ? focusedIndex - 1 : options.length - 1
      setFocusedIndex(prevIndex)
      listboxRef.current?.children[prevIndex]?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (isKey(e.nativeEvent, keys.HOME)) {
      e.preventDefault()
      setFocusedIndex(0)
      listboxRef.current?.children[0]?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (isKey(e.nativeEvent, keys.END)) {
      e.preventDefault()
      setFocusedIndex(options.length - 1)
      listboxRef.current?.children[options.length - 1]?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (isKey(e.nativeEvent, keys.ENTER) || isKey(e.nativeEvent, keys.SPACE)) {
      e.preventDefault()
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        handleSelect(options[focusedIndex])
      }
      return
    }
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Close if focus moves outside the dropdown
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOpen(false)
      setFocusedIndex(-1)
    }
  }

  return (
    <div className={cn('relative', className)} onBlur={handleBlur}>
      {label && (
        <label id={labelId} htmlFor={id || dropdownId} className="block text-sm font-medium mb-1">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        id={id || dropdownId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel || label || placeholder}
        aria-describedby={ariaDescribedBy}
        aria-labelledby={labelId ? `${labelId} ${id || dropdownId}` : undefined}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen)
            setFocusedIndex(0)
          }
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className={cn(!selectedOption && 'text-muted-foreground')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel || label || placeholder}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isFocused = index === focusedIndex
            const isDisabled = option.disabled

            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                  'focus:bg-accent focus:text-accent-foreground',
                  isSelected && 'bg-accent',
                  isDisabled && 'cursor-not-allowed opacity-50',
                  !isDisabled && 'hover:bg-accent hover:text-accent-foreground'
                )}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => !isDisabled && setFocusedIndex(index)}
              >
                {isSelected && <Check className="mr-2 h-4 w-4" />}
                <span className={cn(isSelected && 'ml-6')}>{option.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

