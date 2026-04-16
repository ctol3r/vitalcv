import * as React from 'react'

import { cn } from '@/lib/utils'

interface CardProps extends React.ComponentProps<'div'> {
  /** @deprecated No-op — depth removed in design system reset */
  interactive?: boolean;
}

function Card({ className, interactive: _, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col gap-[var(--vt-space-24)]',
        'rounded-[var(--vt-radius-lg)]',
        'border border-[var(--vt-border)]',
        'bg-[var(--vt-surface)] text-[var(--vt-text-primary)]',
        'p-[var(--vt-space-24)]',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-[var(--vt-space-4)] has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-[var(--vt-space-24)]',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        'text-[length:var(--vt-type-h3-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)]',
        className,
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        'text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]',
        className,
      )}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className,
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn(className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center gap-[var(--vt-space-12)] [.border-t]:pt-[var(--vt-space-24)]',
        className,
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
