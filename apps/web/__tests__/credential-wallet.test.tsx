import { describe, expect, it } from 'vitest';
import { walletDeletePath, walletFetchPath } from '../lib/wallet/credential-wallet-paths';

// W250 wallet hardening: the credential wallet had no tests on main. These cover
// the security fix — URL-encoded identifiers in the wallet API paths, so a hostile
// subject/credentialId can never escape its path segment. (The a11y fix — aria-label
// on the icon-only refresh/remove buttons — is a static change validated by the
// jsx-a11y ESLint rules enforced at build time.)

describe('wallet API path builders (security)', () => {
  it('encodes the subject in the fetch path', () => {
    expect(walletFetchPath('http://x', '1003000126')).toBe('http://x/api/credentials/wallet/1003000126');
  });

  it('encodes the credentialId in the delete path (path-injection defense)', () => {
    expect(walletDeletePath('http://x', 'abc-123')).toBe('http://x/api/credentials/abc-123');
    // a hostile id can never escape the path segment
    expect(walletDeletePath('http://x', '../../admin')).toBe('http://x/api/credentials/..%2F..%2Fadmin');
    expect(walletDeletePath('http://x', 'a/b?c')).toBe('http://x/api/credentials/a%2Fb%3Fc');
  });
});
