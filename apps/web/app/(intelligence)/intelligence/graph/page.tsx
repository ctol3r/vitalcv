import type { Metadata } from 'next';
import { GraphWorkspacePage } from '../../graph/GraphWorkspacePage';

export const metadata: Metadata = {
  title: 'Relationship Graph | VitalCV',
  description: 'Dedicated trust and evidence relationship graph workspace.',
};

/**
 * Intelligence graph page.
 *
 * Previously required auth (session + org), but intelligence surfaces are now
 * public-read. The GraphWorkspacePage is client-side and fetches data through
 * the /api/intelligence/graph proxy which handles auth gracefully.
 */
export default function IntelligenceGraphPage() {
  return <GraphWorkspacePage />;
}
