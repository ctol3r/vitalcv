import { fetchBackendJson } from '@/app/api/intelligence/_shared';

export interface FindingStorylineLink {
  storylineId: string;
  storylineTitle: string | null;
}

interface StorylineLookupPayload {
  storylines?: Array<{
    storylineId: string;
    title?: string | null;
    findingIds?: string[];
  }>;
}

async function fetchStorylineLinks(params: URLSearchParams): Promise<Map<string, FindingStorylineLink>> {
  const upstream = await fetchBackendJson<StorylineLookupPayload>('/api/storylines', params);
  if (!upstream.ok) {
    return new Map();
  }

  const links = new Map<string, FindingStorylineLink>();
  for (const storyline of upstream.payload.storylines ?? []) {
    for (const findingId of storyline.findingIds ?? []) {
      if (!links.has(findingId)) {
        links.set(findingId, {
          storylineId: storyline.storylineId,
          storylineTitle: storyline.title ?? null,
        });
      }
    }
  }

  return links;
}

export async function loadFindingStorylineLinks(
  providerNpis: Iterable<string>,
  includeGlobalFallback = false,
): Promise<Map<string, FindingStorylineLink>> {
  const links = new Map<string, FindingStorylineLink>();
  const uniqueProviders = [...new Set([...providerNpis].filter((providerNpi) => providerNpi.trim().length > 0))];

  const providerLookups = await Promise.all(uniqueProviders.map(async (providerNpi) => {
    const params = new URLSearchParams({
      provider: providerNpi,
      limit: '100',
      sync: 'false',
    });

    return fetchStorylineLinks(params);
  }));

  for (const lookup of providerLookups) {
    for (const [findingId, link] of lookup) {
      if (!links.has(findingId)) {
        links.set(findingId, link);
      }
    }
  }

  if (includeGlobalFallback) {
    const fallback = await fetchStorylineLinks(new URLSearchParams({
      limit: '100',
      sync: 'false',
    }));

    for (const [findingId, link] of fallback) {
      if (!links.has(findingId)) {
        links.set(findingId, link);
      }
    }
  }

  return links;
}

export async function loadFindingStorylineLink(
  findingId: string,
  providerNpi?: string | null,
): Promise<FindingStorylineLink | null> {
  if (providerNpi) {
    const scopedLinks = await loadFindingStorylineLinks([providerNpi], false);
    const scopedMatch = scopedLinks.get(findingId);
    if (scopedMatch) {
      return scopedMatch;
    }
  }

  const fallbackLinks = await loadFindingStorylineLinks([], true);
  return fallbackLinks.get(findingId) ?? null;
}
