import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ProofDrawer, type ProofPayload } from './ProofDrawer';

interface ProofPageProps {
  params: {
    id: string;
  };
}

const API_BASE =
  process.env.VERIFIER_API_BASE || process.env.NEXT_PUBLIC_VERIFIER_API_BASE || '';

export default async function ProofPage({ params }: ProofPageProps) {
  const proof = await fetchProof(params.id);
  if (!proof) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <ProofDrawer proof={proof} />
    </div>
  );
}

async function fetchProof(id: string): Promise<ProofPayload | null> {
  let target = API_BASE ? `${API_BASE.replace(/\/$/, '')}/api/verify/export/${id}` : '';

  if (!target) {
    const requestHeaders = headers();
    const protocol = requestHeaders.get('x-forwarded-proto') || 'http';
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
    if (!host) {
      return null;
    }
    target = `${protocol}://${host}/api/verify/export/${id}`;
  }

  const response = await fetch(target, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as ProofPayload;
}

