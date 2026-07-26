/**
 * nppesLicensureAndDoximity.test.ts
 *
 * Two honesty contracts:
 *  1. NPPES self-reported license numbers are extracted verbatim from the
 *     taxonomy payload (identity-grade), deduped, and never invented.
 *  2. A self-attested Doximity URL survives sanitize only when it is a
 *     well-formed https doximity.com link; anything else is dropped.
 */

import { resolveNppesLicensuresFromArtifact } from '../src/services/entity/passportService';
import { sanitizeSelfAttested } from '../src/services/intake/intakeService';

describe('resolveNppesLicensuresFromArtifact', () => {
  it('extracts license number + state from NPPES taxonomies (top-level shape)', () => {
    const licenses = resolveNppesLicensuresFromArtifact({
      taxonomies: [
        { code: '207Q00000X', desc: 'Family Medicine', license: 'G40046', state: 'CA', primary: true },
      ],
    });
    expect(licenses).toEqual([{ state: 'CA', licenseNumber: 'G40046' }]);
  });

  it('reads the nested results[].taxonomies shape (raw NPPES API envelope)', () => {
    const licenses = resolveNppesLicensuresFromArtifact({
      results: [{ taxonomies: [{ license: 'A12345', state: 'NY' }] }],
    });
    expect(licenses).toEqual([{ state: 'NY', licenseNumber: 'A12345' }]);
  });

  it('dedupes identical state+number across multiple taxonomies', () => {
    const licenses = resolveNppesLicensuresFromArtifact({
      taxonomies: [
        { license: 'G40046', state: 'CA' },
        { license: 'G40046', state: 'CA' },
        { license: 'B999', state: 'TX' },
      ],
    });
    expect(licenses).toEqual([
      { state: 'CA', licenseNumber: 'G40046' },
      { state: 'TX', licenseNumber: 'B999' },
    ]);
  });

  it('skips taxonomies with no license number and never fabricates one', () => {
    const licenses = resolveNppesLicensuresFromArtifact({
      taxonomies: [
        { code: '207Q00000X', desc: 'Family Medicine', state: 'CA' },
        { license: '', state: 'CA' },
      ],
    });
    expect(licenses).toEqual([]);
  });

  it('tolerates a missing/garbage payload without throwing', () => {
    expect(resolveNppesLicensuresFromArtifact(null)).toEqual([]);
    expect(resolveNppesLicensuresFromArtifact({ nonsense: true })).toEqual([]);
    expect(resolveNppesLicensuresFromArtifact('not an object')).toEqual([]);
  });

  it('keeps a license with an unknown state as state: null', () => {
    const licenses = resolveNppesLicensuresFromArtifact({ taxonomies: [{ license: 'X1' }] });
    expect(licenses).toEqual([{ state: null, licenseNumber: 'X1' }]);
  });
});

describe('sanitizeSelfAttested — Doximity URL', () => {
  it('keeps a well-formed https doximity.com profile URL', () => {
    const out = sanitizeSelfAttested({ doximityUrl: 'https://www.doximity.com/profiles/jane-doe' });
    expect(out.doximityUrl).toBe('https://www.doximity.com/profiles/jane-doe');
  });

  it('accepts the apex doximity.com host too', () => {
    const out = sanitizeSelfAttested({ doximityUrl: 'https://doximity.com/pub/jane-doe' });
    expect(out.doximityUrl).toBe('https://doximity.com/pub/jane-doe');
  });

  it('drops an off-Doximity host (no impersonating link-out)', () => {
    const out = sanitizeSelfAttested({ doximityUrl: 'https://doximity.com.evil.example/phish' });
    expect(out.doximityUrl).toBeUndefined();
  });

  it('drops a non-https link', () => {
    const out = sanitizeSelfAttested({ doximityUrl: 'http://www.doximity.com/profiles/jane-doe' });
    expect(out.doximityUrl).toBeUndefined();
  });

  it('drops a malformed / non-URL value', () => {
    expect(sanitizeSelfAttested({ doximityUrl: 'not a url' }).doximityUrl).toBeUndefined();
    expect(sanitizeSelfAttested({ doximityUrl: 42 }).doximityUrl).toBeUndefined();
  });

  it('does not require Doximity — other fields still sanitize normally', () => {
    const out = sanitizeSelfAttested({ subspecialty: 'Cardiology' });
    expect(out.subspecialty).toBe('Cardiology');
    expect(out.doximityUrl).toBeUndefined();
  });
});
