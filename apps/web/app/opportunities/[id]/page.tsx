/**
 * Public opportunity detail.
 *
 * This route presents the same source-attributed record as `/explore`. Feed
 * roles return to their original source. Only a VitalCV-integrated role may
 * enter the signed-in disclosure flow.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicOpportunityDetail } from '@/components/explore/PublicOpportunityDetail';
import { fetchLaunchOpportunity } from '@/lib/launch/marketplace';
import '@/styles/opportunity-detail.css';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: 'Clinical opportunity' };
  const opportunity = await fetchLaunchOpportunity(id);
  if (!opportunity) return { title: 'Clinical opportunity' };
  const title = `${opportunity.title} — ${opportunity.organizationName}`;
  const description = 'Review this clinical role with its source, observation time, availability, compensation source, and application path in view.';
  return {
    title: { absolute: `${title} | VitalCV` },
    description,
    alternates: { canonical: `https://vitalcv.com/opportunities/${opportunity.id}` },
    openGraph: {
      title,
      description,
      url: `https://vitalcv.com/opportunities/${opportunity.id}`,
    },
  };
}

export default async function PublicOpportunityPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const opportunity = await fetchLaunchOpportunity(id);
  if (!opportunity) notFound();
  return <PublicOpportunityDetail opportunity={opportunity} />;
}
