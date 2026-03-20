import type {
  InvestigatorFindingDetailResponse,
  ProviderDetailResponse,
  StorylineDetailResponse,
} from '@/lib/intelligence/detail-types';
import { buildWorkspacePageKey, type SpatialEntityType } from '@/lib/intelligence/spatial-workspace';

export interface BacklinkItem {
  key: string;
  type: SpatialEntityType;
  entityId: string;
  label: string;
  relationship: string;
}

function maybeProviderNpi(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/\b\d{10}\b/);
  return match ? match[0] : null;
}

/**
 * Provider → storylines + findings
 */
export function buildProviderBacklinks(detail: ProviderDetailResponse): BacklinkItem[] {
  const items: BacklinkItem[] = [];

  // Storylines linked to this provider
  for (const storyline of detail.storylines ?? []) {
    items.push({
      key: buildWorkspacePageKey('storyline', storyline.storylineId),
      type: 'storyline',
      entityId: storyline.storylineId,
      label: storyline.title,
      relationship: 'storyline',
    });
  }

  // Findings linked to this provider (from recentFeed)
  for (const feed of (detail.intelligence?.recentFeed ?? []).slice(0, 4)) {
    if (feed.id) {
      items.push({
        key: buildWorkspacePageKey('finding', feed.id),
        type: 'finding',
        entityId: feed.id,
        label: feed.headline ?? `Signal ${feed.id.slice(0, 8)}`,
        relationship: 'finding',
      });
    }
  }

  return items;
}

/**
 * Finding → provider entities + linked storyline + sibling findings
 */
export function buildFindingBacklinks(detail: InvestigatorFindingDetailResponse): BacklinkItem[] {
  const items: BacklinkItem[] = [];
  const deduped = new Map<string, BacklinkItem>();

  // Provider entities attached to this finding
  for (const entity of detail.finding.entities ?? []) {
    const npi = maybeProviderNpi(entity.entityId);
    if (npi && (entity.entityType === 'provider' || entity.entityType === 'clinician')) {
      deduped.set(npi, {
        key: buildWorkspacePageKey('provider', npi),
        type: 'provider',
        entityId: npi,
        label: entity.entityLabel ?? npi,
        relationship: 'provider',
      });
    }
  }

  items.push(...deduped.values());

  // Linked storyline
  if (detail.relatedStoryline?.storylineId) {
    items.push({
      key: buildWorkspacePageKey('storyline', detail.relatedStoryline.storylineId),
      type: 'storyline',
      entityId: detail.relatedStoryline.storylineId,
      label: detail.relatedStoryline.title ?? 'Linked case',
      relationship: 'storyline',
    });
  }

  // No relatedFindings available on finding detail; skip sibling signals

  return items;
}

/**
 * Storyline → linked findings + entities (providers in those findings)
 */
export function buildStorylineBacklinks(detail: StorylineDetailResponse): BacklinkItem[] {
  const items: BacklinkItem[] = [];

  // Finding links
  for (const findingLink of detail.findingLinks ?? []) {
    items.push({
      key: buildWorkspacePageKey('finding', findingLink.findingId),
      type: 'finding',
      entityId: findingLink.findingId,
      label: `${findingLink.findingSeverity.toUpperCase()} · ${findingLink.findingCategory.replace(/_/g, ' ')}`,
      relationship: 'finding',
    });
  }

  // Entity providers from storyline entityLinks (NPI-shaped entityKey)
  for (const link of (detail.entityLinks ?? []).slice(0, 2)) {
    const npi = maybeProviderNpi(link.entityKey);
    if (npi && (link.entityType === 'provider' || link.entityType === 'clinician')) {
      items.push({
        key: buildWorkspacePageKey('provider', npi),
        type: 'provider',
        entityId: npi,
        label: link.entityLabel ?? `NPI ${npi}`,
        relationship: 'entity',
      });
    }
  }

  return items;
}
