/**
 * Wave 2B follow-up — transport-auth gate for GET /api/me/role.
 *
 * Verifies both the P0-safe default (enforcement off = no-op) and the
 * fail-closed behavior when armed. Pure unit test — no DB, no Express app.
 */
import { isInternalRoleCallAuthorized } from '../internalRoleAuth';

describe('isInternalRoleCallAuthorized', () => {
  const SECRET = 'super-secret-value';

  describe('enforcement OFF (default)', () => {
    it('authorizes regardless of the provided/expected secret (no-op)', () => {
      expect(isInternalRoleCallAuthorized(undefined, SECRET, false)).toBe(true);
      expect(isInternalRoleCallAuthorized('anything', SECRET, false)).toBe(true);
      expect(isInternalRoleCallAuthorized('anything', undefined, false)).toBe(true);
      expect(isInternalRoleCallAuthorized(undefined, undefined, false)).toBe(true);
    });
  });

  describe('enforcement ON (armed)', () => {
    it('accepts an exactly matching secret', () => {
      expect(isInternalRoleCallAuthorized(SECRET, SECRET, true)).toBe(true);
    });

    it('rejects a wrong secret', () => {
      expect(isInternalRoleCallAuthorized('nope', SECRET, true)).toBe(false);
    });

    it('rejects a missing secret (external caller)', () => {
      expect(isInternalRoleCallAuthorized(undefined, SECRET, true)).toBe(false);
      expect(isInternalRoleCallAuthorized(null, SECRET, true)).toBe(false);
      expect(isInternalRoleCallAuthorized('', SECRET, true)).toBe(false);
    });

    it('fails closed when armed but the server secret is unconfigured', () => {
      expect(isInternalRoleCallAuthorized('anything', undefined, true)).toBe(false);
      expect(isInternalRoleCallAuthorized('anything', null, true)).toBe(false);
      expect(isInternalRoleCallAuthorized('anything', '', true)).toBe(false);
    });
  });
});
