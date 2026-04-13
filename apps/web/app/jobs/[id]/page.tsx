import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function JobDetailRedirect({ params, searchParams }: Props) {
  const { id } = await params;
  const resolved = await searchParams;
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(resolved)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v) qs.set(key, v);
  }

  const search = qs.toString();
  redirect(`/opportunities/${encodeURIComponent(id)}${search ? `?${search}` : ''}`);
}
