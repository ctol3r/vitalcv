import { HttpError } from '../../../utils/httpError';
import {
  APPLICATION_DISCLOSURE_SECTIONS,
  resolveDisclosureSections,
} from '../applicationDisclosure';

describe('application disclosure selection', () => {
  it('keeps the compatibility default only when selection is absent', () => {
    expect(resolveDisclosureSections(undefined)).toEqual(APPLICATION_DISCLOSURE_SECTIONS);
  });

  it('preserves an explicit clinician choice without adding omitted sections', () => {
    expect(resolveDisclosureSections(['identity', 'licensure', 'identity']))
      .toEqual(['identity', 'licensure']);
  });

  it.each([
    { selection: [], message: /choose at least/i },
    { selection: ['licensure'], message: /identity is required/i },
    { selection: ['identity', 'npdb'], message: /unsupported section/i },
  ])('fails closed for $selection', ({ selection, message }) => {
    expect(() => resolveDisclosureSections(selection)).toThrow(HttpError);
    expect(() => resolveDisclosureSections(selection)).toThrow(message);
  });

  it('rejects malformed selections before they can become an internal error', () => {
    expect(() => resolveDisclosureSections('identity')).toThrow(HttpError);
    expect(() => resolveDisclosureSections(['identity', 42])).toThrow(HttpError);
  });
});
