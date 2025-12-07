import nacl from 'tweetnacl';

export function busSign(payload: Uint8Array, secret: Uint8Array): string {
  const sig = nacl.sign.detached(payload, secret);
  return Buffer.from(sig).toString('base64');
}

export function busVerify(payload: Uint8Array, sigB64: string, pub: Uint8Array): boolean {
  try {
    return nacl.sign.detached.verify(payload, Buffer.from(sigB64, 'base64'), pub);
  } catch {
    return false;
  }
}

