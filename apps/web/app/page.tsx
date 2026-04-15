import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';
import { PassportPreviewCard } from '@/components/passport/PassportPreviewCard';

export const metadata: Metadata = {
  title: { absolute: 'VitalCV — Stop Starting Over. Start Ready.' },
  description:
    'Enter your NPI to see what\'s checked, what\'s missing, and what could delay your next role — using real federal sources. Credential readiness infrastructure for healthcare.',
  openGraph: {
    title: 'VitalCV — Stop Starting Over. Start Ready.',
    description:
      'Enter your NPI to see what\'s checked, what\'s missing, and what could delay your next role. Credential readiness infrastructure.',
    url: 'https://vitalcv.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Stop Starting Over. Start Ready.',
    description:
      'Enter your NPI to see what\'s checked, what\'s missing, and what could delay your next role. Credential readiness infrastructure.',
  },
};

export default function HomePage() {
  return (
    <div className="relative">
      <HomePageClient />
      {/* Right-side hero passport preview — desktop only, no data side-effects.
          Shows at lg breakpoint (≥1024px) where there is reliably whitespace
          next to the hero. Subtle entrance animation composes with the existing
          keyframe library. */}
      <aside
        aria-label="Sample passport preview"
        className="pointer-events-none absolute right-6 top-24 hidden w-[360px] animate-fade-in-up lg:block"
        style={{ animationDelay: '120ms' }}
      >
        <div className="pointer-events-auto">
          <PassportPreviewCard demo />
        </div>
      </aside>
    </div>
  );
}
