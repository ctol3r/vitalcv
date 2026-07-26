'use client';

/**
 * WorkspaceNav (Wave 600, C1/C5) — the shared, grouped navigation rendered at the
 * top of every clinician workspace surface, so VitalCV reads as one product.
 * Accessible: a labelled <nav> with the active surface marked aria-current.
 */

import Link from 'next/link';
import { workspaceNavLinks } from '@/lib/workspace/nav';

export function WorkspaceNav({ entityId, active }: { entityId: string; active?: string }) {
  const groups = workspaceNavLinks(entityId);
  return (
    <nav aria-label="Workspace" className="mx-auto w-full max-w-5xl px-4 pt-4">
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
        {groups.flatMap((g) =>
          g.links.map((l) => (
            <li key={l.id}>
              <Link
                href={l.href}
                aria-current={active === l.id ? 'page' : undefined}
                className={`rounded-full border px-3 py-1 transition-colors ${
                  active === l.id ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                {l.label}
              </Link>
            </li>
          )),
        )}
      </ul>
    </nav>
  );
}
