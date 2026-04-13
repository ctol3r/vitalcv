import { redirect, notFound } from 'next/navigation';

interface Props {
  params: Promise<{ npi: string }>;
}

export default async function VerifyNpiPage({ params }: Props) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) {
    notFound();
  }

  redirect(`/passport?npi=${encodeURIComponent(npi)}`);
}
