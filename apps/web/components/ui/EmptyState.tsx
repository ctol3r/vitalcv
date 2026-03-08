import Link from 'next/link';
import type React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  cta?: { label: string; href: string };
  className?: string;
}

export default function EmptyState({ icon, title, description, cta, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/20 px-8 py-16 text-center ${className}`}>
      {icon && <div className="mb-4 text-vt-neutral-800">{icon}</div>}
      <p className="heading-md text-vt-neutral-100">{title}</p>
      <p className="body-sm mx-auto mt-2 max-w-sm text-vt-neutral-200">{description}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-vt-success px-6 py-2.5 text-sm font-semibold text-black hover:bg-vt-success/90 transition"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
