import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Docs | VitalCV',
  description: 'VitalCV developer documentation — API reference, SDKs, and webhook guides.',
};

const DOC_SECTIONS = [
  {
    label: 'Getting Started',
    items: [
      { href: '/docs',           label: 'Overview' },
      { href: '/docs/api',       label: 'Quickstart' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { href: '/docs/api',       label: 'API Reference' },
      { href: '/docs/sdk',       label: 'SDKs' },
      { href: '/docs/webhooks',  label: 'Webhooks' },
    ],
  },
  {
    label: 'Concepts',
    items: [
      { href: '/docs/api#credentials', label: 'Credentials' },
      { href: '/docs/api#trust',       label: 'Trust State' },
      { href: '/docs/api#selective',   label: 'Selective Disclosure' },
      { href: '/docs/api#federation',  label: 'Federation' },
    ],
  },
] as const;

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--vt-bg,#0A0A0B)] text-[var(--vt-text-1,#F4F4F4)]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-[var(--vt-border,#2A2A2A)] bg-[var(--vt-surface,#141414)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-screen-xl items-center gap-4 px-6">
          <Link href="/" className="text-sm font-semibold text-[var(--vt-text-1)] opacity-80 hover:opacity-100 transition">
            VitalCV
          </Link>
          <span className="text-[var(--vt-border)] select-none">/</span>
          <Link href="/docs" className="text-sm font-medium text-[var(--vt-text-2)] hover:text-[var(--vt-text-1)] transition">
            Docs
          </Link>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-[var(--vt-text-3)]">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--vt-success)]" />
              API v1 · Stable
            </span>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="mx-auto flex max-w-screen-xl gap-0">
        {/* Sidebar */}
        <aside className="sticky top-12 h-[calc(100vh-3rem)] w-56 shrink-0 overflow-y-auto border-r border-[var(--vt-border)] py-8 pr-0 pl-6">
          <nav className="space-y-6">
            {DOC_SECTIONS.map((section) => (
              <div key={section.label}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={`${item.href}-${item.label}`}>
                      <Link
                        href={item.href}
                        className="block rounded-md px-2.5 py-1.5 text-sm text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="docs-content min-w-0 flex-1 px-12 py-10 pb-24">
          {children}
        </main>
      </div>
    </div>
  );
}
