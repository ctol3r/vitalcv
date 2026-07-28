/**
 * Career Garden section navigation. One list, two href builders: the real
 * Clerk-gated routes under /holder/garden, and the /dev harness variant that
 * swaps sections via a ?view= param so local browsers can walk the prototype
 * without crossing the auth gate.
 */

export type GardenSection =
  | 'home'
  | 'cv'
  | 'research'
  | 'notes'
  | 'opportunities'
  | 'privacy';

export interface GardenNavLink {
  key: GardenSection;
  label: string;
  href: string;
}

const SECTIONS: Array<{ key: GardenSection; label: string; path: string }> = [
  { key: 'home', label: 'Garden', path: '' },
  { key: 'cv', label: 'Living CV', path: '/cv' },
  { key: 'research', label: 'Research', path: '/research' },
  { key: 'notes', label: 'Notes', path: '/notes' },
  { key: 'opportunities', label: 'Opportunities', path: '/opportunities' },
  { key: 'privacy', label: 'Privacy', path: '/privacy' },
];

export const GARDEN_BASE_PATH = '/holder/garden';

export function gardenNavLinks(): GardenNavLink[] {
  return SECTIONS.map((s) => ({ key: s.key, label: s.label, href: `${GARDEN_BASE_PATH}${s.path}` }));
}

export function gardenHarnessNavLinks(): GardenNavLink[] {
  return SECTIONS.map((s) => ({
    key: s.key,
    label: s.label,
    href: s.key === 'home' ? '/dev/career-garden' : `/dev/career-garden?view=${s.key}`,
  }));
}

/** Builds deep links into garden sections for either mount point. */
export type GardenHrefFor = (section: GardenSection, params?: Record<string, string>) => string;

export const holderGardenHrefFor: GardenHrefFor = (section, params) => {
  const base = `${GARDEN_BASE_PATH}${SECTIONS.find((s) => s.key === section)?.path ?? ''}`;
  const qs = params ? new URLSearchParams(params).toString() : '';
  return qs ? `${base}?${qs}` : base;
};

export const harnessGardenHrefFor: GardenHrefFor = (section, params) => {
  const qs = new URLSearchParams(section === 'home' ? { ...params } : { view: section, ...params }).toString();
  return qs ? `/dev/career-garden?${qs}` : '/dev/career-garden';
};

/**
 * Where the garden is mounted. Components take this serializable
 * discriminant (functions cannot cross the server→client prop boundary)
 * and resolve their href builder locally.
 */
export type GardenMount = 'holder' | 'harness';

export const GARDEN_HREF_FOR: Record<GardenMount, GardenHrefFor> = {
  holder: holderGardenHrefFor,
  harness: harnessGardenHrefFor,
};

export function navLinksFor(mount: GardenMount): GardenNavLink[] {
  return mount === 'holder' ? gardenNavLinks() : gardenHarnessNavLinks();
}
