import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { IntelligenceRouteClient } from '@/components/intelligence-ops/intelligence-route-client';
import { OpsLoadingScreen } from '@/components/shell/OpsLoadingScreen';
import {
  normalizeIntelligenceHref,
  resolveIntelligenceView,
} from '@/lib/intelligence/routes';

export const metadata = {
  title: 'Operator Workbench | VitalCV',
  description: 'Live trust intelligence across findings, providers, graph, storylines, and investigations.',
};

function toSearchParams(searchParams: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item.trim().length > 0) {
          params.append(key, item.trim());
        }
      }
      continue;
    }

    if (value.trim().length > 0) {
      params.set(key, value.trim());
    }
  }

  return params;
}

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentParams = toSearchParams(resolvedSearchParams);
  const currentHref = `/intelligence${currentParams.toString() ? `?${currentParams.toString()}` : ''}`;
  const canonicalHref = normalizeIntelligenceHref(currentHref);

  if (canonicalHref !== currentHref) {
    redirect(canonicalHref);
  }

  const view = resolveIntelligenceView(currentParams.get('view'));

  return (
    <Suspense fallback={<OpsLoadingScreen label="Preparing intelligence workspace" />}>
      <IntelligenceRouteClient view={view} />
    </Suspense>
  );
}
