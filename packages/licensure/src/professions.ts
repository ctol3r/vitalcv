/**
 * Profession predicates.
 *
 * These live here rather than in `sourceRouter` to break a real module-init
 * cycle:
 *
 *   sourceRouter  → imports getRuntimeState from runtimeState
 *   runtimeState  → imported isPhysicianProfession from sourceRouter
 *
 * Whenever the graph was entered such that `runtimeState` initialised first, its
 * module body called `isPhysicianProfession` while `sourceRouter`'s
 * `PHYSICIAN_PROFESSIONS` const was still in the temporal dead zone, throwing
 *
 *   ReferenceError: Cannot access 'PHYSICIAN_PROFESSIONS' before initialization
 *
 * — which surfaces minified, as `Cannot access 'g' before initialization`, and so
 * reads like a bundler fault rather than a cycle in our own package.
 *
 * The cycle was latent: it only bit on import orders that reached
 * `runtimeState` first, so most callers never saw it. Importing `coverageLabel`
 * into a web component was one such order.
 *
 * These are pure data predicates with no dependencies of their own, so a leaf
 * module cannot participate in a cycle at all. `sourceRouter` and `runtimeState`
 * both re-export from here.
 */

import type { Profession } from './types';

const PHYSICIAN_PROFESSIONS: readonly Profession[] = [
  'PHYSICIAN_MD',
  'PHYSICIAN_DO',
  'PHYSICIAN_ASSISTANT',
];

const NURSING_PROFESSIONS: readonly Profession[] = ['RN', 'LPN_VN', 'APRN'];

export function isPhysicianProfession(profession: Profession): boolean {
  return PHYSICIAN_PROFESSIONS.includes(profession);
}

export function isNursingProfession(profession: Profession): boolean {
  return NURSING_PROFESSIONS.includes(profession);
}
