import Link from 'next/link';

import { PageFrame } from '@/components/layout/PageFrame';
import {
  GARDEN_PRIVACY_LINE,
  GARDEN_SAMPLE_NOTICE,
} from '@/lib/career-garden/demoData';
import { navLinksFor, type GardenMount, type GardenSection } from '@/lib/career-garden/nav';

/**
 * The Career Garden frame: header with the persistent privacy line, the
 * three-layer orientation strip, and section navigation. Server-rendered so
 * the whole workspace reads correctly with JavaScript off; the Cursor and
 * session state are progressive enhancements mounted by the layout.
 *
 * Visual language is the existing Calm Wave island (`.mz` comes from the
 * holder shell) — paper, ink, hairline rules. No new stylesheet, no new
 * tokens, no new island.
 */
export function GardenShell({
  active,
  mount,
  children,
}: {
  active: GardenSection;
  mount: GardenMount;
  children: React.ReactNode;
}) {
  const links = navLinksFor(mount);
  return (
    <div data-garden-root>
      <PageFrame as="main" mode="product" className="pb-24">
      <header className="border-b border-[var(--rule)] pb-6">
        <p className="mz-eyebrow">Career Garden</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="mz-h1">A place to cultivate your professional life</h1>
        </div>
        <p
          className="mz-small mt-4 border-l-2 pl-3"
          style={{ borderColor: 'var(--ink-300)' }}
        >
          {GARDEN_PRIVACY_LINE}
        </p>
        <p className="mz-small mt-2 pl-3" style={{ color: 'var(--vt-text-muted)' }}>
          {GARDEN_SAMPLE_NOTICE}
        </p>

        <p className="mz-mono mt-5 text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--ink-500)' }} aria-label="Where this workspace sits">
          <span style={{ color: 'var(--ink-900)' }}>Garden · private</span>
          <span aria-hidden="true"> → </span>
          <Link href="/holder" className="underline decoration-[var(--rule)] underline-offset-4" style={{ color: 'var(--ink-500)' }}>
            CV Wallet · yours to control
          </Link>
          <span aria-hidden="true"> → </span>
          <Link href="/holder/applications" className="underline decoration-[var(--rule)] underline-offset-4" style={{ color: 'var(--ink-500)' }}>
            Application packets · explicit shares
          </Link>
        </p>
      </header>

      <nav aria-label="Career Garden sections" className="mt-6 flex flex-wrap gap-2">
        {links.map((link) => {
          const isActive = link.key === active;
          return (
            <Link
              key={link.key}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? 'mz-btn mz-btn-sm' : 'mz-btn-ghost mz-btn-sm'}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">{children}</div>

      <footer className="mt-16 border-t border-[var(--rule)] pt-4">
        <p className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
          The Cursor is one keystroke away — press <kbd className="mz-mono">⌘K</kbd> (or{' '}
          <kbd className="mz-mono">Ctrl+K</kbd>) anywhere in the garden, or use the round
          button in the corner.
        </p>
      </footer>
      </PageFrame>
    </div>
  );
}
