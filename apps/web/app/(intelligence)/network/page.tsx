import { redirect } from 'next/navigation';
import { buildIntelligenceGraphHref } from '@/lib/intelligence/routes';

export default function LegacyNetworkPage() {
  redirect(buildIntelligenceGraphHref());
}
