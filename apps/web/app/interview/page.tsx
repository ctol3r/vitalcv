import { redirect } from 'next/navigation';

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ npi?: string; entityId?: string }>;
}) {
  const { npi, entityId } = await searchParams;
  if (npi) {
    redirect(`/passport/${npi}`);
  }
  if (entityId) {
    redirect(`/review/${entityId}`);
  }
  redirect('/');
}
