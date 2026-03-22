'use client';

/**
 * vcv-accordion.tsx — Headless accordion primitive
 *
 * Mobile-first touch targets: trigger min-height 44px (py-3.5 + text).
 * Animation: CSS grid-rows 0fr → 1fr — no max-height guessing, no deps.
 * Color rule: status chips use white opacity only, no colour tinting.
 */

import { useState } from 'react';

export type AccordionStatus = 'verified' | 'clear' | 'pending' | 'action';

export interface AccordionItem {
  id:      string;
  trigger: string;
  status:  AccordionStatus;
  content: React.ReactNode;
}

interface AccordionProps {
  items:        AccordionItem[];
  defaultOpen?: string;
}

const STATUS_LABEL: Record<AccordionStatus, string> = {
  verified: 'Verified',
  clear:    'Clear',
  pending:  'Pending',
  action:   'Action required',
};

// Neutral opacity — no colour tinting on non-CTA elements
const STATUS_CLS: Record<AccordionStatus, string> = {
  verified: 'text-white/55 bg-white/5  border-white/10',
  clear:    'text-white/55 bg-white/5  border-white/10',
  pending:  'text-white/45 bg-white/4  border-white/8',
  action:   'text-white/40 bg-white/3  border-white/6',
};

function ChevronIcon({ open }: { open: boolean }) {
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
      className="text-white/25 shrink-0 transition-transform duration-200"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function AccordionRow({ item, open, onToggle }: {
  item:     AccordionItem;
  open:     boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-white/6 last:border-0">

      {/* Trigger — py-3.5 ensures ≥44px touch target */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/3 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronIcon open={open} />
          <span className="text-sm text-white/65 truncate">{item.trigger}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${STATUS_CLS[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
      </button>

      {/* Body — grid-rows height animation */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 py-3">
            {item.content}
          </div>
        </div>
      </div>

    </div>
  );
}

export function Accordion({ items, defaultOpen }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpen ?? null);

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
      {items.map(item => (
        <AccordionRow
          key={item.id}
          item={item}
          open={openId === item.id}
          onToggle={() => setOpenId(prev => prev === item.id ? null : item.id)}
        />
      ))}
    </div>
  );
}
