import type { Metadata } from 'next';
import Link from 'next/link';
import { NotFoundTracker } from '@/lib/analytics/not-found-tracker';

export const metadata: Metadata = {
  title: { absolute: 'Page Not Found — VitalCV' },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-vt-surface-ops-base text-slate-200">
      <NotFoundTracker />
      <div className="max-w-md animate-fade-in-up px-6 text-center">
        <div className="text-6xl font-bold mb-4 text-muted-foreground/40">404</div>
        <h1 className="text-2xl font-semibold mb-3 text-foreground">
          Page not found
        </h1>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          This page doesn&apos;t exist or may have been moved. Head back to
          explore VitalCV.
        </p>
        <Link
          href="/"
          className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#080e1a] hover:bg-white/90 transition"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
