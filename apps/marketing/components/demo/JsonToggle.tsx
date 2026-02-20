'use client';

import { useState } from 'react';

export function JsonToggle({ data, label }: { data: unknown; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="text-sm font-medium text-muted underline underline-offset-4 decoration-border transition-theme hover:text-foreground hover:decoration-foreground"
      >
        {open ? 'Hide' : 'Show'} {label ?? 'raw JSON'}
      </button>

      {open && (
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
