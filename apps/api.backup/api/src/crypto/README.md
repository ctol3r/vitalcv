# Ed25519 Cryptography Migration

**Tagged:** `run: next-batch-20251031-2` | **Agent:** `CURSOR • AGENT`

This module replaces all RSA/JWT operations with Ed25519 signatures.

## What Changed

### Before (RSA/HMAC)
- **Auth:** `jsonwebtoken` with HS256/RS256
- **Credentials:** HMAC-SHA512 placeholder
- **Signatures:** Various RSA implementations

### After (Ed25519)
- **Auth:** EdDSA tokens (JWT-compatible)
- **Credentials:** Ed25519Signature2020 (W3C spec)
- **Signatures:** TweetNaCl Ed25519

## Migration Guide

### 1. Replace JWT Auth

**Old (`backend/src/auth/jwt.ts`):**
```typescript
import jwt from 'jsonwebtoken';

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}
```

**New:**
```typescript
import { createToken, verifyToken } from '../crypto/ed25519';

const keyPair = generateKeyPair(); // Store securely

export function generateToken(payload: AuthPayload): string {
  return createToken(payload, keyPair.secretKey, 3600);
}

export function verifyTokenAuth(token: string): AuthPayload {
  const result = verifyToken(token, keyPair.publicKey);
  if (!result.valid) {
    throw new Error(result.error || 'Invalid token');
  }
  return result.payload;
}
```

### 2. Replace Credential Signing

**Old (`backend/src/blockchain/post_quantum_signing.ts`):**
```typescript
export function signCredential(credential: VerifiableCredential, secret: string) {
  const data = JSON.stringify(credential);
  const hash = crypto.createHmac('sha512', secret).update(data).digest('hex');
  return {
    credential,
    signature: hash,
    algorithm: 'HMAC-SHA512 (PQ placeholder)'
  };
}
```

**New:**
```typescript
import { signVerifiableCredential } from '../crypto/ed25519';

export function signCredential(
  credential: VerifiableCredential,
  secretKey: string,
  verificationMethod: string
) {
  return signVerifiableCredential(credential, secretKey, verificationMethod);
}
```

### 3. Update Verification

**Old:**
```typescript
export function verifyCredential(signed: SignedCredential, secret: string): boolean {
  const expected = signCredential(signed.credential, secret);
  return expected.signature === signed.signature;
}
```

**New:**
```typescript
import { verifyVerifiableCredential } from '../crypto/ed25519';

export function verifyCredential(
  signedVC: SignedVerifiableCredential,
  publicKey: string
): boolean {
  const result = verifyVerifiableCredential(signedVC, publicKey);
  return result.valid;
}
```

## Key Management

### Generate Keys

```typescript
import { generateKeyPair } from './crypto/ed25519';

const keyPair = generateKeyPair();

console.log('Public Key:', keyPair.publicKey);
console.log('Secret Key:', keyPair.secretKey); // KEEP SECURE!
```

### Deterministic Keys (from seed)

```typescript
import { generateKeyPairFromSeed } from './crypto/ed25519';

const seed = new Uint8Array(32); // From secure source
const keyPair = generateKeyPairFromSeed(seed);
```

### Store Keys Securely

**Environment Variables:**
```bash
ED25519_PUBLIC_KEY=a1b2c3...
ED25519_SECRET_KEY=x9y8z7...  # Vault/AWS Secrets Manager in production
```

**In Code:**
```typescript
const PUBLIC_KEY = process.env.ED25519_PUBLIC_KEY!;
const SECRET_KEY = process.env.ED25519_SECRET_KEY!;
```

## API Reference

### `generateKeyPair()`
Generate new random Ed25519 key pair.

**Returns:** `{ publicKey: string, secretKey: string }`

### `sign(message, secretKey)`
Sign a message with Ed25519.

**Parameters:**
- `message` (string | object): Message to sign
- `secretKey` (string): Hex-encoded secret key

**Returns:** `SignedMessage`

### `verify(signedMessage)`
Verify an Ed25519 signature.

**Parameters:**
- `signedMessage` (SignedMessage): Signed message object

**Returns:** `VerificationResult`

### `createToken(payload, secretKey, expiresIn)`
Create EdDSA JWT token.

**Parameters:**
- `payload` (object): Token payload
- `secretKey` (string): Signing key
- `expiresIn` (number): Expiry in seconds

**Returns:** JWT string

### `verifyToken(token, publicKey)`
Verify EdDSA JWT token.

**Parameters:**
- `token` (string): JWT to verify
- `publicKey` (string): Verification key

**Returns:** `{ valid: boolean, payload?: any, error?: string }`

### `signVerifiableCredential(credential, secretKey, verificationMethod)`
Sign W3C Verifiable Credential.

**Returns:** `SignedVerifiableCredential` with Ed25519Signature2020 proof

### `verifyVerifiableCredential(signedVC, publicKey)`
Verify W3C Verifiable Credential signature.

**Returns:** `VerificationResult`

## Testing

```bash
# Run tests
npm test -- ed25519.test.ts

# Run with coverage
npm test -- --coverage ed25519.test.ts
```

## Cross-Language Compatibility

Ed25519 is widely supported. Use these libraries for verification:

**Python:**
```python
from nacl.signing import VerifyKey
from nacl.encoding import HexEncoder

public_key = VerifyKey(public_key_hex, encoder=HexEncoder)
public_key.verify(message.encode(), signature_bytes)
```

**Go:**
```go
import "golang.org/x/crypto/ed25519"

publicKey, _ := hex.DecodeString(publicKeyHex)
signature, _ := hex.DecodeString(signatureHex)
valid := ed25519.Verify(publicKey, message, signature)
```

**Rust:**
```rust
use ed25519_dalek::{PublicKey, Signature, Verifier};

let public_key = PublicKey::from_bytes(&public_key_bytes)?;
let signature = Signature::from_bytes(&signature_bytes)?;
public_key.verify(message, &signature)?;
```

## Performance

**Signing:** ~0.5ms per signature
**Verification:** ~1ms per signature

Much faster than RSA:
- RSA-2048 sign: ~5-10ms
- RSA-2048 verify: ~0.5-1ms
- Ed25519 sign: ~0.5ms ✅
- Ed25519 verify: ~1ms ✅

## Security Notes

1. **Never expose secret keys** - Use environment variables or Vault
2. **Rotate keys regularly** - Implement key rotation every 90 days
3. **Use deterministic seeds carefully** - Only from cryptographically secure sources
4. **Validate public keys** - Check length and hex encoding
5. **Check token expiry** - Always validate `exp` claim

## Migration Checklist

- [ ] Replace `jsonwebtoken` with Ed25519 tokens
- [ ] Update credential signing to use `signVerifiableCredential`
- [ ] Update all verification to use Ed25519 public keys
- [ ] Generate and securely store Ed25519 key pairs
- [ ] Update environment variable documentation
- [ ] Run full test suite
- [ ] Update API documentation
- [ ] Deploy with gradual rollout (verify both old + new during transition)

## Rollback Plan

If issues occur:

1. Keep old JWT code alongside new Ed25519 code
2. Accept both token types during transition period
3. Monitor verification failure rates
4. Rollback by reverting to JWT if failures > 5%

## Support

- **Ed25519 Spec:** [RFC 8032](https://tools.ietf.org/html/rfc8032)
- **TweetNaCl:** [GitHub](https://github.com/dchest/tweetnacl-js)
- **W3C VC:** [Data Model](https://www.w3.org/TR/vc-data-model/)

