/**
 * Career-profile sharing — pure sanitization contract.
 *
 * The sharing key rides in the selfAttested JSON column (no migration).
 * sanitizeSelfAttested must accept exactly 'public' | 'private' and drop
 * everything else, so a hostile payload can never publish a profile with a
 * garbage visibility value.
 */
import { sanitizeSelfAttested } from '../intakeService';

describe('sanitizeSelfAttested — sharing', () => {
  it('accepts public and private', () => {
    expect(sanitizeSelfAttested({ sharing: { careerProfile: 'public' } }).sharing)
      .toEqual({ careerProfile: 'public' });
    expect(sanitizeSelfAttested({ sharing: { careerProfile: 'private' } }).sharing)
      .toEqual({ careerProfile: 'private' });
  });

  it('drops unknown visibility values entirely', () => {
    for (const bad of ['PUBLIC', 'shared', 1, true, null, { nested: true }, ['public']]) {
      const out = sanitizeSelfAttested({ sharing: { careerProfile: bad } });
      expect(out.sharing).toBeUndefined();
    }
  });

  it('drops a non-object sharing payload', () => {
    expect(sanitizeSelfAttested({ sharing: 'public' }).sharing).toBeUndefined();
    expect(sanitizeSelfAttested({ sharing: ['public'] }).sharing).toBeUndefined();
  });

  it('keeps sharing independent of content sections', () => {
    const out = sanitizeSelfAttested({
      subspecialty: 'Cardiology',
      sharing: { careerProfile: 'public', extraneous: 'dropped' },
    });
    expect(out.subspecialty).toBe('Cardiology');
    expect(out.sharing).toEqual({ careerProfile: 'public' });
  });
});
