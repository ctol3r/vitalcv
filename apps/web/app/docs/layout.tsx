import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Docs | VitalCV',
  description: 'VitalCV developer documentation — API reference, SDKs, and webhook guides.',
};

const DOC_NAV = [
  { href: '/docs',          label: 'Overview' },
  { href: '/docs/api',      label: 'API Reference' },
  { href: '/docs/sdk',      label: 'SDKs' },
  { href: '/docs/webhooks', label: 'Webhooks' },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0c10] text-white pt-14">
      <div className="border-b border-white/5 bg-[#0d1117]/80 backdrop-blur-md sticky top-14 z-40">
        <div className="mx-auto max-w-7xl px-6 flex items-center gap-1 h-11 overflow-x-auto">
          {DOC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-mono whitespace-nowrap px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-3 text-xs text-zinc-600">
            <span>API v1</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-emerald-400">Stable</span>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-12">
        {children}
      </div>
    </div>
  );
}
