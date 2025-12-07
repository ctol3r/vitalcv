export interface DidMethodMapping {
  did: string;
  method: 'key' | 'web' | 'ion' | 'polkadot' | 'unknown';
  parsed: {
    method: string;
    identifier: string;
  };
}

const DID_PATTERNS = {
  key: /^did:key:/,
  web: /^did:web:/,
  ion: /^did:ion:/,
  polkadot: /^did:polkadot:/,
};

export function didMethodMapper(did: string): DidMethodMapping {
  let method: DidMethodMapping['method'] = 'unknown';

  if (DID_PATTERNS.key.test(did)) method = 'key';
  else if (DID_PATTERNS.web.test(did)) method = 'web';
  else if (DID_PATTERNS.ion.test(did)) method = 'ion';
  else if (DID_PATTERNS.polkadot.test(did)) method = 'polkadot';

  const parts = did.split(':');
  const parsed = {
    method: parts[1] || '',
    identifier: parts.slice(2).join(':') || '',
  };

  return {
    did,
    method,
    parsed,
  };
}








