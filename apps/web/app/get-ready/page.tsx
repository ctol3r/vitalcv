import { redirect } from 'next/navigation';

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

export default async function GetReadyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnTo = firstParam(params?.returnTo);

  redirect(returnTo ? `/intake?returnTo=${encodeURIComponent(returnTo)}` : '/intake');
}
