'use client';

/**
 * The decorative pointer lens was removed from the product experience.
 *
 * VitalCV now relies on the operating-system cursor and native browser
 * affordances everywhere. A delayed visual follower made precise controls
 * feel unstable and added motion without helping a clinician complete work.
 *
 * Keep this no-op export temporarily so the global layout does not require a
 * coupled import removal in the same release. The component mounts no markup,
 * listeners, animation frame, or pointer tracking.
 */
export function GlassCursor() {
  return null;
}
