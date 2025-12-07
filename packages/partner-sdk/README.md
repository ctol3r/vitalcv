# VitalCV Partner SDK

**Version:** 0.1.0-pilot | **Tagged:** `run: next-batch-20251031-2` | **Agent:** `CURSOR • AGENT`

Official SDK for partners to verify VitalCV credentials server-side.

## Features

- ✅ **Proof Verification:** Verify verifiable credentials and presentations
- ✅ **Signature Validation:** Ed25519/EdDSA signature verification
- ✅ **Revocation Checks:** Check credential revocation status
- ✅ **Multi-Language Support:** Node.js and Python examples
- ✅ **Type Safety:** TypeScript definitions included
- ✅ **Zero Dependencies:** Minimal external dependencies for security

## Quick Start

### Node.js

```bash
npm install @vitalcv/partner-sdk
```

```javascript
const { verifyCredential } = require('@vitalcv/partner-sdk');

const proof = {
  credentialId: 'vc:med-license:12345',
  holderDid: 'did:vitalcv:holder123',
  signature: '...',
  issuedAt: '2025-10-31T18:00:00Z',
  ...
};

const result = await verifyCredential(proof);

if (result.valid) {
  console.log('✅ Credential is valid');
  console.log('Holder:', result.holderDid);
  console.log('Issued:', result.issuedAt);
} else {
  console.error('❌ Verification failed:', result.error);
}
```

### Python

```bash
pip install vitalcv-partner-sdk
```

```python
from vitalcv_partner_sdk import verify_credential

proof = {
    "credentialId": "vc:med-license:12345",
    "holderDid": "did:vitalcv:holder123",
    "signature": "...",
    "issuedAt": "2025-10-31T18:00:00Z",
    ...
}

result = verify_credential(proof)

if result.valid:
    print(f"✅ Credential is valid")
    print(f"Holder: {result.holder_did}")
    print(f"Issued: {result.issued_at}")
else:
    print(f"❌ Verification failed: {result.error}")
```

## Installation

### Node.js

```bash
npm install @vitalcv/partner-sdk
# or
yarn add @vitalcv/partner-sdk
# or
pnpm add @vitalcv/partner-sdk
```

### Python

```bash
pip install vitalcv-partner-sdk
# or
poetry add vitalcv-partner-sdk
```

## API Reference

### Node.js API

#### `verifyCredential(proof, options?)`

Verifies a verifiable credential or presentation.

**Parameters:**
- `proof` (object): The credential proof to verify
  - `credentialId` (string): Unique credential identifier
  - `holderDid` (string): Decentralized identifier of holder
  - `signature` (string): Ed25519 signature (hex or base64)
  - `issuedAt` (string): ISO 8601 timestamp
  - `claims` (object): Credential claims/attributes
- `options` (object, optional):
  - `checkRevocation` (boolean): Check revocation status (default: true)
  - `verifierDid` (string): Your verifier DID for audit trails
  - `apiEndpoint` (string): VitalCV API endpoint (default: production)

**Returns:**
```typescript
{
  valid: boolean;
  holderDid?: string;
  credentialId?: string;
  issuedAt?: string;
  claims?: object;
  error?: string;
  revoked?: boolean;
  auditRef?: string;
}
```

#### `checkRevocation(credentialId, options?)`

Checks if a credential has been revoked.

**Parameters:**
- `credentialId` (string): Credential ID to check
- `options` (object, optional):
  - `apiEndpoint` (string): VitalCV API endpoint

**Returns:**
```typescript
{
  revoked: boolean;
  revokedAt?: string;
  reason?: string;
  error?: string;
}
```

### Python API

#### `verify_credential(proof, options=None)`

Verifies a verifiable credential or presentation.

**Parameters:**
- `proof` (dict): The credential proof to verify
- `options` (dict, optional): Verification options

**Returns:**
```python
{
    "valid": bool,
    "holder_did": Optional[str],
    "credential_id": Optional[str],
    "issued_at": Optional[str],
    "claims": Optional[dict],
    "error": Optional[str],
    "revoked": Optional[bool],
    "audit_ref": Optional[str]
}
```

#### `check_revocation(credential_id, options=None)`

Checks if a credential has been revoked.

**Returns:**
```python
{
    "revoked": bool,
    "revoked_at": Optional[str],
    "reason": Optional[str],
    "error": Optional[str]
}
```

## Examples

### Node.js Examples

See [`examples/node/`](./examples/node/) for complete examples:

1. **Basic Verification:** [`verify-simple.js`](./examples/node/verify-simple.js)
2. **Batch Verification:** [`verify-batch.js`](./examples/node/verify-batch.js)
3. **Express Middleware:** [`express-middleware.js`](./examples/node/express-middleware.js)
4. **Webhook Handler:** [`webhook-handler.js`](./examples/node/webhook-handler.js)

### Python Examples

See [`examples/python/`](./examples/python/) for complete examples:

1. **Basic Verification:** [`verify_simple.py`](./examples/python/verify_simple.py)
2. **Batch Verification:** [`verify_batch.py`](./examples/python/verify_batch.py)
3. **Flask Integration:** [`flask_integration.py`](./examples/python/flask_integration.py)
4. **Django Decorator:** [`django_decorator.py`](./examples/python/django_decorator.py)

## Security Best Practices

### 1. Always Verify Signatures

Never skip signature verification, even in development:

```javascript
// ❌ BAD
const result = await verifyCredential(proof, { skipSignature: true });

// ✅ GOOD
const result = await verifyCredential(proof);
```

### 2. Check Revocation Status

Always check if credentials have been revoked:

```javascript
const result = await verifyCredential(proof, {
  checkRevocation: true  // Default, but be explicit
});

if (result.revoked) {
  throw new Error('Credential has been revoked');
}
```

### 3. Validate Timestamps

Check that credentials are not expired:

```javascript
const issuedAt = new Date(result.issuedAt);
const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days

if (Date.now() - issuedAt.getTime() > maxAge) {
  throw new Error('Credential too old');
}
```

### 4. Audit All Verifications

Log verification attempts for compliance:

```javascript
const result = await verifyCredential(proof, {
  verifierDid: 'did:vitalcv:your-org',
});

console.log('Audit reference:', result.auditRef);
// Store audit ref in your system for compliance
```

### 5. Use HTTPS Only

Never accept credentials over unencrypted connections:

```javascript
if (req.protocol !== 'https' && process.env.NODE_ENV === 'production') {
  throw new Error('HTTPS required');
}
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `INVALID_SIGNATURE` | Signature verification failed | Credential may be tampered with |
| `CREDENTIAL_REVOKED` | Credential has been revoked | Reject and notify user |
| `EXPIRED_CREDENTIAL` | Credential is too old | Request fresh credential |
| `NETWORK_ERROR` | Cannot reach VitalCV API | Retry or implement fallback |
| `MALFORMED_PROOF` | Invalid proof structure | Validate input format |

### Example Error Handler

```javascript
try {
  const result = await verifyCredential(proof);

  if (!result.valid) {
    switch (result.error) {
      case 'CREDENTIAL_REVOKED':
        return res.status(403).json({ error: 'Credential revoked' });
      case 'INVALID_SIGNATURE':
        return res.status(401).json({ error: 'Invalid credential' });
      default:
        return res.status(400).json({ error: result.error });
    }
  }

  // Success
  return res.json({ verified: true, holder: result.holderDid });

} catch (error) {
  console.error('Verification error:', error);
  return res.status(500).json({ error: 'Verification failed' });
}
```

## Testing

### Test Credentials

For development, use these test credentials:

```javascript
const TEST_PROOF = {
  credentialId: 'vc:test:pilot-12345',
  holderDid: 'did:vitalcv:test-holder',
  signature: '...',  // Valid test signature
  issuedAt: new Date().toISOString(),
  claims: {
    npi: '1801921148',
    licenseNumber: 'MD-12345',
    name: 'Dr. Test Provider',
  },
};
```

### Mock Mode

For unit testing, enable mock mode:

```javascript
const { verifyCredential } = require('@vitalcv/partner-sdk');

// Enable mock mode
process.env.VITALCV_MOCK_MODE = 'true';

const result = await verifyCredential(proof);
// Always returns valid in mock mode
```

## Performance

### Caching

Implement caching for frequently verified credentials:

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour

async function verifyWithCache(proof) {
  const cacheKey = `vc:${proof.credentialId}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const result = await verifyCredential(proof);

  if (result.valid && !result.revoked) {
    cache.set(cacheKey, result);
  }

  return result;
}
```

### Batch Verification

Verify multiple credentials in parallel:

```javascript
const proofs = [...];  // Array of proofs

const results = await Promise.all(
  proofs.map(proof => verifyCredential(proof))
);

const allValid = results.every(r => r.valid);
```

## Support

- **Documentation:** https://docs.vitalcv.com/partner-sdk
- **API Reference:** https://api.vitalcv.com/docs
- **Issues:** https://github.com/vitalcv/partner-sdk/issues
- **Email:** partners@vitalcv.com

## License

MIT License - See [LICENSE](./LICENSE) file

## Changelog

### 0.1.0-pilot (2025-10-31)

- Initial pilot release
- Node.js and Python support
- Ed25519 signature verification
- Revocation checking
- Basic examples and documentation

---

**Built with ❤️ by the VitalCV team**

