/**
 * Types for the canonical Living Evidence Record faces (faces.mjs).
 *
 * The module stays plain ESM because the Z0 artifact builders import it
 * directly under node; this declaration is what the app's typecheck sees.
 */

export type ApertureState = 'closed' | 'opening' | 'returned' | 'limited' | 'unavailable';

/**
 * Each face renders the object at a width. `w` is UNITLESS (the object derives
 * px and its proportional unit from it) and may be a CSS var() expression for
 * faces that do not compute derived widths; TRAVELLING multiplies `w` and
 * requires a number.
 */
export type Face = (w: number | string, scale?: 'hero') => string;

export declare const HOLDER: string;
export declare const NPI_MASKED: string;
export declare const ILLUS: string;
export declare const LANES: readonly string[];
export declare const ROWS: ReadonlyArray<{ c: string; r: string; p: string; s: string; g: string; w: string }>;
export declare const LEDGER: ReadonlyArray<{ c: string; d: string; t: boolean }>;
export declare const S: Record<'closed' | 'opening' | 'returned', ApertureState[]>;
export declare function band(states: ApertureState[]): string;
export declare const FACES: Record<
  'BLANK' | 'WRITING' | 'RESOLVING' | 'RETURNED' | 'INSPECTED' | 'DECIDING' | 'TRAVELLING' | 'SEALED',
  Face
>;
