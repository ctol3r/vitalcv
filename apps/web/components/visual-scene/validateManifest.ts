import {
  MOTION_BUDGET_BYTES,
  POSTER_BUDGET_BYTES,
  SCENE_IDS,
  type SceneManifestEntry,
} from './manifest';

/**
 * Pure manifest validation — CC-06 / VIS-05, enforcing EC-29.
 *
 * Runs inside the Web Quality vitest suite (a required CI context), so an
 * oversized, unlabeled, missing, or fallback-less asset fails CI. Pure so
 * the test can also prove the guard by injecting deliberately broken
 * entries: a validator nobody has seen fail is not a gate.
 */

export interface AssetStat {
  /** Byte size of the file at a public path, or null when it does not exist. */
  (publicPath: string): number | null;
}

export function validateSceneEntry(entry: SceneManifestEntry, stat: AssetStat): string[] {
  const errors: string[] = [];
  const label = `scene "${entry.scene}"`;

  if (!(SCENE_IDS as readonly string[]).includes(entry.scene)) {
    errors.push(`${label}: not in the approved EC-28 inventory`);
  }

  // Aspect box is what prevents CLS — it must be a real ratio.
  if (!(entry.aspect.w > 0 && entry.aspect.h > 0)) {
    errors.push(`${label}: aspect ratio must be positive`);
  }

  const variantIds = new Set<string>();
  for (const variant of entry.routeVariants ?? []) {
    if (variantIds.has(variant.id)) {
      errors.push(`${label}: route variant ${variant.id} appears twice`);
    }
    variantIds.add(variant.id);
    if (!(variant.aspect.w > 0 && variant.aspect.h > 0)) {
      errors.push(`${label}: route variant ${variant.id} aspect ratio must be positive`);
    }
    if (variant.poster) {
      const bytes = stat(variant.poster.path);
      if (bytes === null) {
        errors.push(`${label}: route variant ${variant.id} poster ${variant.poster.path} does not exist`);
      } else if (bytes > POSTER_BUDGET_BYTES) {
        errors.push(`${label}: route variant ${variant.id} poster is ${bytes} bytes, over the ${POSTER_BUDGET_BYTES} budget`);
      }
    }
  }

  // Poster: exists, within budget, fully labeled.
  const posterBytes = stat(entry.poster.path);
  if (posterBytes === null) {
    errors.push(`${label}: poster ${entry.poster.path} does not exist`);
  } else if (posterBytes > POSTER_BUDGET_BYTES) {
    errors.push(`${label}: poster is ${posterBytes} bytes, over the ${POSTER_BUDGET_BYTES} budget`);
  }
  for (const asset of [
    entry.poster,
    ...(entry.routeVariants ?? []).flatMap((variant) => variant.poster ? [variant.poster] : []),
    ...entry.motion,
  ]) {
    if (!asset.source.trim() || !asset.license.trim() || !asset.origin.trim()) {
      errors.push(`${label}: asset ${asset.path} is missing source/license/origin metadata`);
    }
  }

  // Motion: every source exists and stays under the motion budget.
  for (const m of entry.motion) {
    const bytes = stat(m.path);
    if (bytes === null) {
      errors.push(`${label}: motion asset ${m.path} does not exist`);
    } else if (bytes > MOTION_BUDGET_BYTES) {
      errors.push(`${label}: motion asset ${m.path} is ${bytes} bytes, over the ${MOTION_BUDGET_BYTES} budget`);
    }
  }

  // EC-26: meaningful scenes carry their textual equivalent; decorative
  // crops carry empty alt text and no transcript.
  if (entry.kind === 'decorative') {
    if (entry.altText !== '') errors.push(`${label}: decorative scenes carry empty alt text`);
    if (entry.transcript !== undefined) errors.push(`${label}: decorative scenes carry no transcript`);
  } else {
    if (!entry.altText.trim()) errors.push(`${label}: ${entry.kind} scenes need meaningful alt text`);
    if (!entry.transcript?.trim()) errors.push(`${label}: ${entry.kind} scenes need a transcript`);
  }

  return errors;
}

export function validateManifest(entries: readonly SceneManifestEntry[], stat: AssetStat): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.scene)) errors.push(`scene "${entry.scene}" appears twice in the manifest`);
    seen.add(entry.scene);
    errors.push(...validateSceneEntry(entry, stat));
  }
  return errors;
}
