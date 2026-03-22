'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface Action {
  title: string;
  description: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
  icon?: string;
}

interface NextBestActionProps {
  actions: Action[];
  heading?: string;
}

const PRIORITY_STYLE: Record<Action['priority'], string> = {
  high:   'border-vt-success/30 bg-vt-success/5',
  medium: 'border-vt-warning/30 bg-vt-warning/5',
  low:    'border-vt-neutral-800 bg-vt-surface-ops-raised/20',
};

const DOT_STYLE: Record<Action['priority'], string> = {
  high:   'bg-vt-success shadow-[0_0_10px_rgba(16,185,129,0.5)]',
  medium: 'bg-vt-warning shadow-[0_0_10px_rgba(245,158,11,0.5)]',
  low:    'bg-vt-neutral-600',
};

export default function NextBestAction({ actions, heading = 'Next Best Action' }: NextBestActionProps) {
  if (!actions.length) return null;

  return (
    <aside className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-5 shadow-sm">
      <h2 className="text-[10px] font-semibold tracking-widest uppercase text-vt-neutral-400 mb-4">{heading}</h2>
      <ul className="space-y-3">
        {actions.map((action) => (
          <li key={action.href}>
            <Link
              href={action.href}
              className={`flex items-start sm:items-center min-h-[64px] gap-4 rounded-xl border p-4 transition-all hover:bg-black/20 active:scale-[0.98] ${PRIORITY_STYLE[action.priority]}`}
            >
              <span className={`mt-1.5 sm:mt-0 h-2 w-2 shrink-0 rounded-full ${DOT_STYLE[action.priority]}`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">{action.title}</p>
                <p className="mt-1 text-xs text-vt-neutral-300 leading-relaxed">{action.description}</p>
              </div>
              <ArrowRight className="mt-0.5 sm:mt-0 h-4 w-4 shrink-0 text-white/50" />
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
