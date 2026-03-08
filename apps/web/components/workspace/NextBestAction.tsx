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
  high:   'bg-vt-success',
  medium: 'bg-vt-warning',
  low:    'bg-vt-neutral-800',
};

export default function NextBestAction({ actions, heading = 'Next Best Action' }: NextBestActionProps) {
  if (!actions.length) return null;

  return (
    <aside className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-5">
      <h2 className="heading-sm mb-4 text-vt-neutral-100">{heading}</h2>
      <ul className="space-y-3">
        {actions.map((action) => (
          <li key={action.href}>
            <Link
              href={action.href}
              className={`flex items-start gap-4 rounded-xl border p-4 transition-colors hover:brightness-110 ${PRIORITY_STYLE[action.priority]}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_STYLE[action.priority]}`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="heading-sm text-white">{action.title}</p>
                <p className="body-sm mt-0.5 text-vt-neutral-200">{action.description}</p>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-vt-neutral-800" />
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
