import { redirect } from 'next/navigation';
import { buildIntelligenceHref } from '@/lib/intelligence/routes';

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ npi: string }>;
}) {
  const { npi } = await params;
  redirect(buildIntelligenceHref('dashboard', {
    npi,
    open: ['provider'],
  }));
}
