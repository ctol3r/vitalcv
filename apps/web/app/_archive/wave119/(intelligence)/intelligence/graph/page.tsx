import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildIntelligenceGraphHref } from '@/lib/intelligence/routes';

export const metadata: Metadata = {
  title: 'Global Intelligence Map',
  description: 'Dedicated geospatial intelligence workspace for shortage pressure, collaboration networks, and institutional momentum.',
};

/**
 * Intelligence graph page.
 *
 * Compatibility route: graph intent now lands inside the spatial `/intelligence`
 * workspace rather than a standalone page.
 */
export default function IntelligenceGraphPage() {
  redirect(buildIntelligenceGraphHref());
}
