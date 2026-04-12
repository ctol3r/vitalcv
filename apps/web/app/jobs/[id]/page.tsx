import type { Metadata } from 'next';
import { JobDetailClient } from './JobDetailClient';

/** Static demo job IDs for marketing preview */
const DEMO_JOBS = ['hospitalist-tx-001', 'er-physician-ca-002', 'internist-ny-003'];

export function generateStaticParams() {
  return DEMO_JOBS.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const title = id
    .replace(/-\d+$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${title} — Jobs`,
    description: `View role details, match criteria, and readiness requirements for ${title}.`,
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobDetailClient jobId={id} />;
}
