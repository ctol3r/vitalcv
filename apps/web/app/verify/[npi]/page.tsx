import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

interface Props {
  params: Promise<{ npi: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { npi } = await params;
  return {
    title: `Verify NPI ${npi}`,
    description: `Source-backed readiness verification for NPI ${npi}. Check credentialing status against NPPES, OIG/LEIE, PECOS, and CMS PECOS.`,
    openGraph: {
      title: `Verify NPI ${npi}`,
      description: `Source-backed readiness verification for NPI ${npi}.`,
    },
  };
}

// This route was previously a dead shell that rendered "Verification results
// will appear here." and never fetched data. The real NPI ingest experience
// lives on /passport, which auto-starts the SSE stream when ?npi= is present.
// Forward there so deep-links show identity + sanctions + readiness
// immediately instead of a permanent empty state.
export default async function VerifyNpiPage({ params }: Props) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) {
    notFound();
  }

  redirect(`/passport?npi=${encodeURIComponent(npi)}`);
}
