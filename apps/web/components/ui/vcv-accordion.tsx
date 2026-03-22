'use client';

/**
 * vcv-accordion.tsx — Headless accordion primitive
 *
 * Animation: CSS grid-rows 0fr → 1fr transition.
 * No max-height guessing. No JS measurement. No deps.
 * Works in all modern browsers (Chromium, Firefox, Safari 16+).
 *
 * Usage:
 *   <Accordion items={[{ id, trigger, content, status }]} />
 *
 * status controls the right-side chip:
 *   'verified' | 'clear' | 'pending' | 'action'
 */

import { useState } from 'react';

export type AccordionStatus = 'verified' | 'clear' | 'pending' | 'action';

export interface AccordionItem {
  id:      string;
  trigger: string;          // section label
  status:  AccordionStatus;
  content: React.ReactNode;
}

interface AccordionProps {
  items:        AccordionItem[];
  defaultOpen?: string;     // id of item open by default (none by default)
}

const STATUS_STYLES: Record<AccordionStatus, { label: string; cls: string }> = {
  verified: { label: 'Verified', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  clear:    { label: 'Clear',    cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  pending:  { label: 'Pending',  cls: 'text-amber-400  bg-amber-500/10  border-amber-500/20'  },
  action:   { label: 'Action required', cls: 'text-red-400 bg-red-500/10 border-red-500/20'   },
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
      className="text-white/30 transition-transform duration-200 shrink-0"
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
  const s = STATUS_STYLES[item.status];

  return (
    <div className="border-b border-white/6 last:border-0">
      {/* Trigger */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronIcon open={open} />
          <span className="text-xs font-semibold text-white/70 truncate">{item.trigger}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${s.cls}`}>
          {s.label}
        </span>
      </button>

      {/* Collapsible body — grid-rows trick for smooth height animation */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-3 pt-0.5">
            {item.content}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Accordion({ items, defaultOpen }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpen ?? null);

  function toggle(id: string) {
    setOpenId(prev => (prev === id ? null : id));
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
      {items.map(item => (
        <AccordionRow
          key={item.id}
          item={item}
          open={openId === item.id}
          onToggle={() => toggle(item.id)}
        />
      ))}
    </div>
  );
}
