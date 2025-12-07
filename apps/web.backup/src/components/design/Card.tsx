'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const cardVariants = cva(
  'bg-card text-card-foreground flex flex-col rounded-xl border transition-shadow',
  {
    variants: {
      elevation: {
        none: 'shadow-none',
        xs: 'shadow-xs',
        sm: 'shadow-sm',
        base: 'shadow',
        md: 'shadow-md',
        lg: 'shadow-lg',
        xl: 'shadow-xl',
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
      clickable: {
        true: 'cursor-pointer hover:shadow-md transition-shadow',
        false: '',
      },
    },
    defaultVariants: {
      elevation: 'base',
      padding: 'md',
      clickable: false,
    },
  },
)

export interface CardProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof cardVariants> {
  header?: React.ReactNode
  footer?: React.ReactNode
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      elevation,
      padding,
      clickable,
      header,
      footer,
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        data-slot="card"
        className={cn(cardVariants({ elevation, padding, clickable, className }))}
        onClick={clickable && onClick ? onClick : undefined}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable && onClick ? 0 : undefined}
        onKeyDown={
          clickable && onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClick(e as unknown as React.MouseEvent<HTMLDivElement>)
                }
              }
            : undefined
        }
        {...props}
      >
        {header && (
          <div
            data-slot="card-header"
            className={cn(
              'flex items-start justify-between gap-4 border-b pb-4',
              padding === 'none' && 'px-6 pt-6',
              padding === 'sm' && 'px-4 pt-4',
              padding === 'md' && 'px-6 pt-6',
              padding === 'lg' && 'px-8 pt-8',
            )}
          >
            {header}
          </div>
        )}

        <div
          data-slot="card-content"
          className={cn(
            'flex-1',
            padding === 'none' && (header || footer ? '' : 'p-6'),
            padding === 'sm' && (header || footer ? 'p-4' : ''),
            padding === 'md' && (header || footer ? 'p-6' : ''),
            padding === 'lg' && (header || footer ? 'p-8' : ''),
          )}
        >
          {children}
        </div>

        {footer && (
          <div
            data-slot="card-footer"
            className={cn(
              'flex items-center gap-2 border-t pt-4',
              padding === 'none' && 'px-6 pb-6',
              padding === 'sm' && 'px-4 pb-4',
              padding === 'md' && 'px-6 pb-6',
              padding === 'lg' && 'px-8 pb-8',
            )}
          >
            {footer}
          </div>
        )}
      </div>
    )
  },
)
Card.displayName = 'Card'

export { Card, cardVariants }

