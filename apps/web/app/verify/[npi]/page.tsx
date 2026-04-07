import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ npi: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { npi } = await params;
  return {
    title: `Verify NPI ${npi}`,
    description: `Source-backed readiness verification for NPI ${npi}. Check credentialing status against NPPES, OIG/LEIE, PECOS, and FSMB.`,
    openGraph: {
      title: `Verify NPI ${npi}`,
      description: `Source-backed readiness verification for NPI ${npi}.`,
    },
  };
}

export default async function VerifyNpiPage({ params }: Props) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
        Verification
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        NPI: {npi}
      </p>

      <div className="mt-8 rounded-lg border border-neutral-200 p-6">
        <p className="text-sm text-neutral-600">
          Verification results will appear here.
        </p>
      </div>
    </main>
  );
}
