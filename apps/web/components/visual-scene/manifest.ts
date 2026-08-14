/**
 * VisualScene asset manifest — CC-06 / VIS-05.
 *
 * One registry for every public visual scene. The approved scene ids are the
 * approved first-release inventory (Experience Constitution EC-28); a scene
 * outside this list cannot be rendered, and a new one requires an EC-22
 * amendment. Budgets and metadata obligations are EC-29 law: every asset
 * carries source / license / origin, posters stay ≤ 250 KB, desktop motion
 * ≤ 1.5 MB per format.
 *
 * The inventory contains both original in-repo SVG placeholders and the
 * provenance-bound WO-12 documentary commission. Motion sources land
 * per-scene in later waves and must pass the same validation.
 */

export const SCENE_IDS = [
  'journey_film',
  'npi_reveal',
  'profile_layers',
  'choice_gate',
  'opportunity_field',
  'employer_desk',
  'continuity_ribbon',
  'quiet_source_constellation',
  'workbench_window',
  'decision_trail',
] as const;
export type SceneId = (typeof SCENE_IDS)[number];

/** EC-26: the three scene kinds, distinguished at the type level. */
export type SceneKind = 'decorative' | 'process' | 'stateful';

/**
 * A route variant changes presentation, never the scene's truth or kind. It
 * may select a separately provenance-bound documentary poster for that route;
 * keeping both crop and asset here prevents route CSS from becoming an
 * undocumented second media system.
 */
export type SceneRouteVariantId = 'home_documentary' | 'explore_documentary';

export interface SceneRouteVariant {
  id: SceneRouteVariantId;
  route: '/' | '/explore' | '/employers' | '/pilot' | '/onboarding' | '/trust';
  aspect: { w: number; h: number };
  objectPosition?: string;
  /**
   * A route-owned documentary frame from the same scene family. The manifest,
   * rather than route CSS, owns its provenance and budget.
   */
  poster?: SceneAsset;
}

/** EC-29 budgets, in bytes. Measured by the asset validation test. */
export const POSTER_BUDGET_BYTES = 250_000;
export const MOTION_BUDGET_BYTES = 1_500_000;

export interface SceneAsset {
  /** Path under apps/web/public (leading slash). */
  path: string;
  format: 'svg' | 'avif' | 'webp' | 'png' | 'jpeg' | 'webm' | 'mp4';
  /** Provenance metadata — required on every asset (EC-29). */
  source: string;
  license: string;
  origin: string;
}

export interface SceneManifestEntry {
  scene: SceneId;
  kind: SceneKind;
  title: string;
  /** Intrinsic aspect ratio; the component reserves this box (no CLS). */
  aspect: { w: number; h: number };
  poster: SceneAsset;
  /** Motion sources, best-format-first. Empty until a motion wave lands. */
  motion: SceneAsset[];
  /**
   * Adjacent textual equivalent (EC-26/EC-29): required for process and
   * stateful scenes; never present on decorative ones.
   */
  transcript?: string;
  /** Alt text: empty string for decorative crops, meaningful otherwise. */
  altText: string;
  /** Optional route-authorized crops of the same provenance-bound asset. */
  routeVariants?: readonly SceneRouteVariant[];
}

/**
 * Manifest entries are truth-reviewed compositions: none may imply a real
 * clinician identity, employer, source response, credential, or outcome.
 */
export const SCENE_MANIFEST: readonly SceneManifestEntry[] = [
  {
    scene: 'journey_film',
    kind: 'process',
    title: 'A clinician moving toward the next role',
    aspect: { w: 2, h: 3 },
    poster: {
      path: '/scenes/home-career-forward-portrait.jpg',
      format: 'jpeg',
      source: 'Original generated commission for VitalCV',
      license: 'VitalCV proprietary',
      origin: 'WO-12, 2026-08-14; generated adult, no real clinician or patient',
    },
    motion: [],
    transcript:
      'An art-directed image of an anonymous clinician moving through a quiet clinical setting. No real clinician, patient, employer, credential, or outcome is represented.',
    altText: 'Art-directed view from behind of a clinician walking through a quiet hospital corridor',
    routeVariants: [
      {
        id: 'home_documentary',
        route: '/',
        aspect: { w: 4, h: 5 },
        objectPosition: '52% 46%',
      },
      {
        id: 'explore_documentary',
        route: '/explore',
        aspect: { w: 16, h: 9 },
        objectPosition: 'center center',
        poster: {
          path: '/scenes/explore-clinician-horizon.jpg',
          format: 'jpeg',
          source: 'Original generated commission for VitalCV',
          license: 'VitalCV proprietary',
          origin: 'WO-13, 2026-08-14; generated adult, no real clinician or patient',
        },
      },
    ],
  },
  {
    scene: 'continuity_ribbon',
    kind: 'decorative',
    title: 'Continuity ribbon (placeholder)',
    aspect: { w: 8, h: 3 },
    poster: {
      path: '/scenes/continuity-ribbon-placeholder.svg',
      format: 'svg',
      source: 'original',
      license: 'VitalCV proprietary',
      origin: 'CC-06 placeholder, drawn in-repo',
    },
    motion: [],
    altText: '',
  },
  {
    scene: 'workbench_window',
    kind: 'process',
    title: 'Workbench window (placeholder)',
    aspect: { w: 4, h: 3 },
    poster: {
      path: '/scenes/workbench-window-placeholder.svg',
      format: 'svg',
      source: 'original',
      license: 'VitalCV proprietary',
      origin: 'CC-06 placeholder, drawn in-repo',
    },
    motion: [],
    transcript:
      'A private note sits beside a role. The clinician writes, links the note to the role, and — only when ready — chooses to create a reviewable draft. Nothing leaves the workspace without that explicit step.',
    altText: 'Abstract illustration of a private note pane beside a role pane, connected by a drawn link',
  },
  {
    scene: 'quiet_source_constellation',
    kind: 'stateful',
    title: 'Quiet source constellation (placeholder)',
    aspect: { w: 3, h: 2 },
    poster: {
      path: '/scenes/quiet-source-constellation-placeholder.svg',
      format: 'svg',
      source: 'original',
      license: 'VitalCV proprietary',
      origin: 'CC-06 placeholder, drawn in-repo',
    },
    motion: [],
    transcript:
      'A sparse, orderly set of source objects, each linked to one fact. Sources that were actually read are marked read with their age; sources that were not are visibly open — never implied.',
    altText: 'Abstract illustration of a small set of labeled source shapes linked to a record',
  },
] as const;

export function sceneEntry(scene: SceneId): SceneManifestEntry | undefined {
  return SCENE_MANIFEST.find((e) => e.scene === scene);
}

export function sceneRouteVariant(
  entry: SceneManifestEntry,
  variant: SceneRouteVariantId | undefined,
): SceneRouteVariant | undefined {
  if (!variant) return undefined;
  return entry.routeVariants?.find((candidate) => candidate.id === variant);
}

export function scenePoster(
  entry: SceneManifestEntry,
  variant: SceneRouteVariant | undefined,
): SceneAsset {
  return variant?.poster ?? entry.poster;
}
