import { redirect } from 'next/navigation';
import { buildIntelligenceGraphHref } from '@/lib/intelligence/routes';

function toSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item.length > 0) {
          params.append(key, item);
        }
      }
      continue;
    }

    if (value.length > 0) {
      params.set(key, value);
    }
  }

  return params;
}

export default async function LegacyGraphPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(buildIntelligenceGraphHref(toSearchParams(await searchParams)));
}
