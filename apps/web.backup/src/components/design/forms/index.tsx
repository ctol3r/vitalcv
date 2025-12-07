'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as LabelPrimitive from '@radix-ui/react-label'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { CheckIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

// ============================================================================
// TextInput
// ============================================================================

export interface TextInputProps extends React.ComponentProps<'input'> {
  label?: string
  error?: string
  helperText?: string
  required?: boolean
}

const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      helperText,
      required,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || React.useId()
    const errorId = error ? `${inputId}-error` : undefined
    const helperId = helperText ? `${inputId}-helper` : undefined

    return (
      <div className="flex flex-col gap-2" data-slot="text-input">
        {label && (
          <LabelPrimitive.Root
            htmlFor={inputId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </LabelPrimitive.Root>
        )}
        <input
          ref={ref}
          type={type}
          id={inputId}
          data-slot="input"
          className={cn(
            'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            error &&
              'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border-destructive',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helperId}
          aria-required={required}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            className="text-destructive text-sm"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-muted-foreground text-sm">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)
TextInput.displayName = 'TextInput'

// ============================================================================
// TextArea
// ============================================================================

export interface TextAreaProps extends React.ComponentProps<'textarea'> {
  label?: string
  error?: string
  helperText?: string
  required?: boolean
}

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      required,
      id,
      ...props
    },
    ref,
  ) => {
    const textareaId = id || React.useId()
    const errorId = error ? `${textareaId}-error` : undefined
    const helperId = helperText ? `${textareaId}-helper` : undefined

    return (
      <div className="flex flex-col gap-2" data-slot="textarea">
        {label && (
          <LabelPrimitive.Root
            htmlFor={textareaId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </LabelPrimitive.Root>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          data-slot="textarea"
          className={cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-y',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            error &&
              'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border-destructive',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helperId}
          aria-required={required}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            className="text-destructive text-sm"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-muted-foreground text-sm">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)
TextArea.displayName = 'TextArea'

// ============================================================================
// Checkbox
// ============================================================================

export interface CheckboxProps
  extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
  label?: string
  error?: string
  helperText?: string
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, error, helperText, id, ...props }, ref) => {
  const checkboxId = id || React.useId()
  const errorId = error ? `${checkboxId}-error` : undefined
  const helperId = helperText ? `${checkboxId}-helper` : undefined

  return (
    <div className="flex flex-col gap-2" data-slot="checkbox">
      <div className="flex items-start gap-2">
        <CheckboxPrimitive.Root
          ref={ref}
          id={checkboxId}
          data-slot="checkbox"
          className={cn(
            'peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
            error && 'border-destructive',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helperId}
          {...props}
        >
          <CheckboxPrimitive.Indicator
            className={cn('flex items-center justify-center text-current')}
          >
            <CheckIcon className="h-4 w-4" />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        {label && (
          <LabelPrimitive.Root
            htmlFor={checkboxId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {label}
          </LabelPrimitive.Root>
        )}
      </div>
      {error && (
        <p
          id={errorId}
          className="text-destructive text-sm pl-6"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="text-muted-foreground text-sm pl-6">
          {helperText}
        </p>
      )}
    </div>
  )
})
Checkbox.displayName = 'Checkbox'

// ============================================================================
// RadioButton
// ============================================================================

export interface RadioButtonProps extends React.ComponentProps<'input'> {
  label?: string
  error?: string
  helperText?: string
}

const RadioButton = React.forwardRef<HTMLInputElement, RadioButtonProps>(
  ({ className, label, error, helperText, id, name, ...props }, ref) => {
    const radioId = id || React.useId()
    const errorId = error ? `${radioId}-error` : undefined
    const helperId = helperText ? `${radioId}-helper` : undefined

    return (
      <div className="flex flex-col gap-2" data-slot="radio">
        <div className="flex items-start gap-2">
          <input
            ref={ref}
            type="radio"
            id={radioId}
            name={name}
            data-slot="radio"
            className={cn(
              'h-4 w-4 cursor-pointer rounded-full border border-primary text-primary shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive',
              className,
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : helperId}
            {...props}
          />
          {label && (
            <LabelPrimitive.Root
              htmlFor={radioId}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {label}
            </LabelPrimitive.Root>
          )}
        </div>
        {error && (
          <p
            id={errorId}
            className="text-destructive text-sm pl-6"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-muted-foreground text-sm pl-6">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)
RadioButton.displayName = 'RadioButton'

// ============================================================================
// Switch
// ============================================================================

export interface SwitchProps
  extends React.ComponentProps<typeof SwitchPrimitives.Root> {
  label?: string
  error?: string
  helperText?: string
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, label, error, helperText, id, ...props }, ref) => {
  const switchId = id || React.useId()
  const errorId = error ? `${switchId}-error` : undefined
  const helperId = helperText ? `${switchId}-helper` : undefined

  return (
    <div className="flex flex-col gap-2" data-slot="switch">
      <div className="flex items-center gap-2">
        <SwitchPrimitives.Root
          ref={ref}
          id={switchId}
          data-slot="switch"
          className={cn(
            'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
            error && 'border-destructive',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helperId}
          {...props}
        >
          <SwitchPrimitives.Thumb
            className={cn(
              'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
            )}
          />
        </SwitchPrimitives.Root>
        {label && (
          <LabelPrimitive.Root
            htmlFor={switchId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {label}
          </LabelPrimitive.Root>
        )}
      </div>
      {error && (
        <p
          id={errorId}
          className="text-destructive text-sm pl-11"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="text-muted-foreground text-sm pl-11">
          {helperText}
        </p>
      )}
    </div>
  )
})
Switch.displayName = 'Switch'

export { TextInput, TextArea, Checkbox, RadioButton, Switch }

