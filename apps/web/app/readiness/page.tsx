import { redirect } from 'next/navigation';

// Legacy route — marketing components still link to /readiness?npi=XXX.
// We must preserve the NPI so /passport can auto-start the ingest stream
// immediately. Dropping it leaves the user staring at an empty form.
export default async function ReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ npi?: string }>;
}) {
  const { npi } = await searchParams;
  const target = npi && /^\d{10}$/.test(npi)
    ? `/passport?npi=${encodeURIComponent(npi)}`
    : '/passport';
  redirect(target);
}
