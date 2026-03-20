import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildIntelligenceGraphHref } from '@/lib/intelligence/routes';

export const metadata: Metadata = {
  title: 'Relationship Graph | VitalCV',
  description: 'Dedicated trust and evidence relationship graph workspace.',
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
