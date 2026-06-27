/**
 * Workspace navigation (Wave 600, C1/C2/C4) — the ONE canonical, grouped map of
 * the clinician workspace surfaces, so every surface shares the same navigation
 * and VitalCV reads as a single product. Pure (entityId → links); no I/O.
 *
 * Groups mirror the product portfolio (C2): Career · Trust · Growth · Organizations
 * · Platform. Labels use the normalized terminology (C4): Professional Identity /
 * Trust / Evidence / Growth / Mobility.
 */

export type WorkspaceGroup = 'Career' | 'Trust' | 'Growth' | 'Organizations' | 'Platform';

export interface WorkspaceLink {
  label: string;
  href: string;
  /** The surface's id, for active-state detection. */
  id: string;
}

export interface WorkspaceNavGroup {
  group: WorkspaceGroup;
  links: WorkspaceLink[];
}

interface SurfaceDef {
  id: string;
  label: string;
  group: WorkspaceGroup;
  path: (id: string) => string;
}

/** Single source of truth for the workspace surfaces (de-duplicated concept, C3). */
export const WORKSPACE_SURFACES: readonly SurfaceDef[] = [
  { id: 'ecosystem', label: 'Career Ecosystem', group: 'Career', path: (id) => `/ecosystem/${id}` },
  { id: 'activity', label: 'Professional Timeline', group: 'Career', path: (id) => `/activity/${id}` },
  { id: 'career-map', label: 'Professional Evidence', group: 'Trust', path: (id) => `/career-map/${id}` },
  { id: 'career-intelligence', label: 'Professional Trust', group: 'Trust', path: (id) => `/career-intelligence/${id}` },
  { id: 'professional-growth', label: 'Professional Growth', group: 'Growth', path: (id) => `/professional-growth/${id}` },
  { id: 'network', label: 'Organizations', group: 'Organizations', path: (id) => `/network/${id}` },
  { id: 'search', label: 'Search', group: 'Platform', path: (id) => `/search/${id}` },
] as const;

const GROUP_ORDER: WorkspaceGroup[] = ['Career', 'Trust', 'Growth', 'Organizations', 'Platform'];

export function workspaceNavLinks(entityId: string): WorkspaceNavGroup[] {
  const id = encodeURIComponent(entityId);
  return GROUP_ORDER.map((group) => ({
    group,
    links: WORKSPACE_SURFACES.filter((s) => s.group === group).map((s) => ({ id: s.id, label: s.label, href: s.path(id) })),
  })).filter((g) => g.links.length > 0);
}
