import { linkDidToUser } from '../identity/models/DidUserLink';

export interface SsoDidClaims {
  idToken?: Record<string, unknown>;
  userInfo?: Record<string, unknown>;
}

function extractDid(record: Record<string, unknown> | undefined): string | undefined {
  if (!record) {
    return undefined;
  }

  const candidates = [
    record['did'],
    record['wallet_did'],
    record['walletDid'],
    (record['vc'] as Record<string, unknown> | undefined)?.['holder'],
  ];

  return candidates.find(
    (value) => typeof value === 'string' && value.startsWith('did:')
  ) as string | undefined;
}

export async function linkDidFromSso(
  userId: string,
  claims: SsoDidClaims
): Promise<boolean> {
  const did =
    extractDid(claims.userInfo as Record<string, unknown>) ||
    extractDid(claims.idToken as Record<string, unknown>);

  if (!did) {
    return false;
  }

  await linkDidToUser({ userId, did });
  return true;
}

