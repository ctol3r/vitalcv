'use client';

/**
 * vcv-accordion.tsx — Headless accordion primitive
 *
 * Mobile-first touch targets: trigger min-height 44px.
 * Animation: Radix height variable + CSS keyframes (180ms ease-out).
 * Color rule: no green badges. Status language comes from the shared
 * truth vocabulary so demo / access-required states remain explicit.
 */

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import * as React from 'react';
import type { ReactNode } from 'react';
import { trackUxEvent } from '@/lib/telemetry/ux-tracker';
import { cn } from '@/lib/utils';
import type { TrustUiStatus } from '@/lib/trust/status-language';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';

void React;

export type AccordionStatus = TrustUiStatus;

export interface AccordionItem {
  id: string;
  trigger: ReactNode;
  status?: AccordionStatus;
  triggerRight?: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpen?: string;
  className?: string;
  telemetryComponentId?: string;
  onValueChange?: (value: string | null) => void;
}

function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-muted-foreground/50 transition-transform duration-[180ms] ease-out group-data-[state=open]:rotate-180"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function Accordion({
  items,
  defaultOpen,
  className,
  telemetryComponentId,
  onValueChange,
}: AccordionProps) {
  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      defaultValue={defaultOpen}
      onValueChange={(value) => {
        const nextValue = value || null;

        if (telemetryComponentId && nextValue) {
          trackUxEvent({
            event_name: 'accordion_expand',
            component_id: telemetryComponentId,
            metadata: {
              section_id: nextValue,
            },
          });
        }

        onValueChange?.(nextValue);
      }}
      className={cn('overflow-hidden bg-transparent', className)}
    >
      {items.map(item => (
        <AccordionPrimitive.Item
          key={item.id}
          value={item.id}
          disabled={item.disabled}
          className="border-b border-[color:var(--vt-border)] bg-transparent last:border-b-0"
        >
          <AccordionPrimitive.Header>
            <AccordionPrimitive.Trigger
              className="group flex min-h-11 w-full items-center gap-3 bg-transparent py-3.5 text-left text-[color:var(--vt-text-primary)] transition-colors duration-150 ease-out hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronIcon />
              <span className="min-w-0 flex-1 truncate pr-2 text-sm font-medium text-[color:var(--vt-text-primary)]">
                {item.trigger}
              </span>
              <span className="ml-auto flex max-w-[55%] items-center gap-2">
                {item.triggerRight && (
                  <span className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--vt-text-secondary)]">
                    {item.triggerRight}
                  </span>
                )}
                {item.status && <TrustStatusBadge status={item.status} size="sm" />}
              </span>
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>

          <AccordionPrimitive.Content
            forceMount
            className="overflow-hidden text-[color:var(--vt-text-secondary)] data-[state=closed]:animate-[vcv-accordion-up_180ms_ease-out] data-[state=open]:animate-[vcv-accordion-down_180ms_ease-out]"
          >
            <div className="pb-4 pl-8 pr-1 text-sm sm:pl-9">
              {item.content}
            </div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
}
