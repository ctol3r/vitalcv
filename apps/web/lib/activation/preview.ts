/**
 * The anonymous resolved preview — Wave 1076 B1.
 *
 * What a clinician sees BEFORE they have an account. It reads the same public
 * bootstrap the homepage reads, and it is deliberately a different thing from
 * the profile: nothing here is stored, nothing here is bound to anyone, and
 * nothing here becomes provenance. When the clinician signs in, the server
 * resolves its own snapshot — this preview is never sent to be persisted.
 *
 * That is the whole reason the preview is modelled separately from
 * `ProfileView` rather than pretending to be an early copy of one. They look
 * alike on screen and mean completely different things, and code that shared a
 * type between them would eventually share a value between them too.
 */

export interface PreviewBootstrap {
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
  npiType?: string;
  /** 'NPPES_API' when the registry actually answered. */
  identitySource?: string;
}

export interface PreviewItem {
  label: string;
  value: string;
}

export type PreviewOutcome =
  /** A registry answered for an individual clinician. */
  | { kind: 'individual'; npi: string; items: PreviewItem[]; source: string }
  /** A Type-2 NPI: an organization, which cannot hold a clinician profile. */
  | { kind: 'organization' }
  /** The lookup ran and returned nothing usable. A system state, not a finding. */
  | { kind: 'no_answer' };

const REGISTRY_LABEL = 'NPPES';

/**
 * What the preview is allowed to say it found.
 *
 * Only values the registry actually returned appear. An absent field is left
 * out entirely rather than rendered as "Not listed" — an empty row invites the
 * clinician to read a gap in a federal registry as a gap in themselves, and
 * this surface has not earned the right to comment on that yet.
 */
export function buildPreview(npi: string, boot: PreviewBootstrap | null): PreviewOutcome {
  if (!boot) return { kind: 'no_answer' };
  if (boot.npiType === 'TYPE_2') return { kind: 'organization' };
  if (boot.identitySource !== 'NPPES_API') return { kind: 'no_answer' };

  const name = [boot.firstName, boot.lastName].filter(Boolean).join(' ').trim();
  const items: PreviewItem[] = [];
  if (name) items.push({ label: 'Name', value: name });
  if (boot.specialty) items.push({ label: 'Specialty', value: boot.specialty });
  if (boot.state) items.push({ label: 'Practice location', value: boot.state });

  // A registry that answered with nothing usable is not a preview worth
  // showing. Say the lookup found nothing rather than rendering an empty card
  // under a heading that claims a find.
  if (items.length === 0) return { kind: 'no_answer' };

  return { kind: 'individual', npi, items, source: REGISTRY_LABEL };
}

/**
 * The disclosures the preview must carry, in the order they answer the
 * questions a clinician actually asks.
 *
 * These are requirements, not decoration: the preview has to say what was
 * found, that it came from a public source, that finding an NPI does not prove
 * the person looking at it owns that NPI, and that it can be corrected after
 * they claim it. Kept here so the wording is one thing a test can pin, rather
 * than four strings scattered through JSX.
 */
export const PREVIEW_DISCLOSURES = [
  `This came from ${REGISTRY_LABEL}, the public federal registry of healthcare providers.`,
  'Finding this NPI does not confirm it is yours. Anyone can look up any NPI here.',
  'Sign in to claim it, and you can correct anything that is wrong or out of date.',
] as const;
