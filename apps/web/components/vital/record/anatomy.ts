/**
 * The Living Evidence Record — anatomy as data (ILL-03).
 *
 * The parts list is NOT invented here. It is the anatomy already ratified in
 * `docs/design/vitalcv-cinematic-storyboard.md` (issue #1069, Phase Z0) and
 * made narrative law by EC-27, which says the two names are one object:
 *
 *   "The Living Profile brief's 'profile object' and Z0's 'living evidence
 *    record' are the same protagonist under two names; shipping them as two
 *    objects would recreate exactly the multiple-competing-systems problem
 *    this constitution exists to end."
 *
 * So the ILL-03 brief's requested kit maps onto Z0 parts rather than adding a
 * second vocabulary:
 *
 *   brief's "LivingProfileFolio" → SILHOUETTE + FRONT + EDGE + SPINE
 *   brief's "SourceTile"         → CLAIM ROW (a filled row)
 *   brief's "OpenSlot"           → SOURCE APERTURE, closed
 *   brief's "PermissionTab"      → PERMISSION LAYER + CONSENT SEAL
 *   brief's "SelectedPacket"     → RECIPIENT FRAME
 *   brief's "VerifierDesk"       → REVIEW LENS + review checkpoint (face 10)
 *
 * Exporting the anatomy as data rather than burying it in JSX is deliberate:
 * it makes the invariants assertable, which is what
 * `__tests__/living-record-anatomy.test.tsx` does. A face that needs a part
 * outside this list means the face is wrong, not that the anatomy is short.
 */

/** The eleven faces from Z0 Part II. Identity never changes — only fill, layer and crop. */
export const RECORD_FACES = [
  'blank',
  'writing',
  'resolving',
  'recognized',
  'returned',
  'inspected',
  'deciding',
  'travelling',
  'arrived',
  'reviewed',
  'sealed',
] as const;
export type RecordFace = (typeof RECORD_FACES)[number];

/**
 * The subset ILL-03 implements — the faces the holder/issuer/verifier
 * relationship actually needs. The remaining faces belong to the NPI
 * resolution sequence (writing/resolving/recognized/inspected) and the
 * signature close (sealed); a later wave extends this union rather than
 * redefining the object.
 */
export const IMPLEMENTED_FACES = ['blank', 'returned', 'deciding', 'arrived', 'reviewed'] as const;
export type ImplementedFace = (typeof IMPLEMENTED_FACES)[number];

/**
 * Z0 PROPORTIONS. "The object never becomes landscape; a landscape record
 * reads as a dashboard panel, which is the thing it must not be." Expressed as
 * CSS aspect-ratio strings so the constraint is one value, not a guess per
 * call site.
 */
export const RECORD_PROPORTION = {
  desktop: '4 / 5',
  mobile: '5 / 6',
} as const;

/**
 * Z0 EDGE — the signature asymmetry. "1px hairline all round; 2px ink on the
 * top edge only … it is how a viewer tells the record from any other
 * rectangle on the page." This is the single most identity-bearing number in
 * the kit, which is why the test asserts it directly.
 */
export const RECORD_EDGE = { hairlinePx: 1, topEdgePx: 2 } as const;

/**
 * Z0 RADIUS SYSTEM, narrowed to what this kit draws, and reconciled with
 * EC-20 as amended A-2: an ACTION is square, and "any illustration that
 * DEPICTS an action" takes radius 0. So the permission tab — which depicts the
 * clinician's approval action — is 0, while a source NAME may keep the pill.
 */
export const RECORD_RADIUS = {
  /** Evidence facts: claim rows, apertures, the record front. */
  evidencePx: 2,
  /** Anything depicting an action (EC-20 A-2). */
  actionPx: 0,
  /** Word-labels only — source names, owner chips (EC-20 A-2). */
  labelPill: '9999px',
  /** Z0: "The one circular element in the entire system." */
  seal: '9999px',
} as const;

/** Z0 SOURCE APERTURES: "Six openings, one per lane, in registry order." */
export const APERTURE_COUNT = 6;

/**
 * Z0 RECIPIENT FRAME: "A smaller, lighter frame with the same silhouette
 * holding only the travelling subset. Same object, less of it."
 *
 * The widths live here, not at the call site, because "smaller" is a property
 * of the relationship rather than of one layout. Left to the composition, the
 * recipient inherited its column's width and rendered nearly twice the size of
 * the record it came from — which reads as the employer receiving something
 * MORE than the clinician holds, the precise inversion of what the scene is
 * for. Encoding it here means a future composition cannot reintroduce that by
 * choosing a wider column.
 */
export const RECORD_MAX_WIDTH_PX = { record: 168, recipient: 132 } as const;

/**
 * The label every composition in this kit carries, per the locked EC-20
 * illustration row ("abstracted, self-labeling product illustrations").
 * One constant so a copy pass cannot quietly drop it from one composition.
 */
export const ILLUSTRATION_LABEL = 'Illustration — not a live result';

/**
 * The illustrative state vocabulary.
 *
 * Deliberately NOT `StateChip`, and the reason is worth keeping. StateChip
 * resolves through the product register (`--vt-state-*`, `--vt-text-*`), which
 * `html.dark` re-declares; this object's front is warm paper in every theme
 * (Z0 FRONT, and EC-20's "light register required for evidence artifacts"), so
 * a dark-mode visitor would get `#6ee7b7` confirmed-green and `#A9A296`
 * secondary ink on `#F6F5F1` paper — around 1.5:1. A real chip in an
 * illustration would also assert a result about nobody.
 *
 * So these markers carry NO hue at all: glyph + word in paper ink. That
 * satisfies EC-4 (meaning never by colour) by construction, and it means the
 * marker cannot be mistaken for a StateChip — which is the same reasoning that
 * gave VitalPill no colour prop.
 *
 * The words are SHORT on purpose. The first draft used the sentence forms ("A
 * source answered", "Only you can tell") and they were wider than the claim
 * beside them, so inside a portrait record the claim truncated to "Ide…" and
 * "Re…" — the artwork's own labels crowded out the thing being labelled. The
 * long forms still exist where they belong: in the composition's prose, which
 * is where the meaning is required to live anyway (EC-26).
 */
export const ILLUSTRATIVE_STATES = {
  answered: { glyph: '●', word: 'Answered' },
  open: { glyph: '○', word: 'Open' },
  yours: { glyph: '◐', word: 'Yours' },
  held: { glyph: '—', word: 'Held' },
  reviewing: { glyph: '◇', word: 'In review' },
} as const;
export type IllustrativeState = keyof typeof ILLUSTRATIVE_STATES;
