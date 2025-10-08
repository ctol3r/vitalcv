# VitalCV API Documentation

Welcome to the VitalCV API documentation. This API provides endpoints for decentralized identity authentication and verifiable credentials management.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [API Reference](#api-reference)
- [SDKs and Tools](#sdks-and-tools)
- [Standards Compliance](#standards-compliance)

## Getting Started

### Base URLs

- **Development**: `http://localhost:3000`
- **Production**: `https://api.vitalcv.app`

### Quick Start

1. **Connect your wallet** (MetaMask, WalletConnect, etc.)
2. **Request an authentication challenge**
3. **Sign the challenge** with your wallet's private key
4. **Verify the signature** to get JWT tokens
5. **Use the tokens** to access protected endpoints

### Example: Authentication Flow

```javascript
// 1. Request challenge
const challengeResponse = await fetch('http://localhost:3000/api/auth/did/challenge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    did: 'did:ethr:0x1234567890abcdef1234567890abcdef12345678'
  })
})

const { message } = await challengeResponse.json()

// 2. Sign the message with your wallet (e.g., MetaMask)
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: [message, walletAddress]
})

// 3. Verify the signature
const verifyResponse = await fetch('http://localhost:3000/api/auth/did/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    did: 'did:ethr:0x1234567890abcdef1234567890abcdef12345678',
    challenge: message,
    signature: signature,
    publicKey: publicKey
  })
})

const { accessToken, refreshToken } = await verifyResponse.json()

// 4. Use the access token for authenticated requests
const profileResponse = await fetch('http://localhost:3000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})
```

## Authentication

VitalCV uses **DID (Decentralized Identifier) Authentication** with Ed25519 signatures.

### Authentication Methods

1. **Bearer Token**: Include JWT in `Authorization` header
   ```
   Authorization: Bearer <access-token>
   ```

2. **HTTP-Only Cookie**: Automatically set by the server
   ```
   Cookie: auth-token=<access-token>
   ```

### Token Lifecycle

- **Access Token**: Valid for 7 days
- **Refresh Token**: Valid for 30 days
- **Challenge**: Expires in 5 minutes

### Security Best Practices

✅ **DO:**
- Store refresh tokens securely (HTTP-only cookies preferred)
- Refresh tokens before they expire
- Implement token rotation
- Use HTTPS in production

❌ **DON'T:**
- Store tokens in localStorage (XSS vulnerability)
- Share tokens across origins
- Hard-code tokens in client code
- Ignore token expiration

## Rate Limiting

All API endpoints are rate limited to prevent abuse.

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-10-08T16:00:00.000Z
```

### Rate Limits by Endpoint

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| `/api/auth/did/challenge` | 1 minute | 5 |
| `/api/auth/did/verify` | 1 minute | 5 |
| `/api/auth/did/refresh` | 1 minute | 10 |
| Other API endpoints | 15 minutes | 100 |

### Handling Rate Limits

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": "Too many authentication attempts. Please try again later.",
  "retryAfter": 60
}
```

Implement exponential backoff:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options)

    if (response.status !== 429) {
      return response
    }

    const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
  }

  throw new Error('Max retries exceeded')
}
```

## API Reference

### Full OpenAPI Specification

The complete API specification is available in OpenAPI 3.0 format:

- **YAML**: [`openapi.yaml`](./openapi.yaml)
- **Interactive Docs**: [Swagger UI](http://localhost:3000/api-docs) (coming soon)
- **Postman Collection**: [Download](./postman-collection.json) (coming soon)

### Authentication Endpoints

#### POST /api/auth/did/challenge

Generate an authentication challenge.

**Request:**
```json
{
  "did": "did:ethr:0x1234567890abcdef1234567890abcdef12345678"
}
```

**Response:**
```json
{
  "challenge": "a1b2c3d4e5f6...",
  "message": "VitalCV Authentication Request\n\n...",
  "expiresAt": "2024-10-08T16:05:00.000Z"
}
```

#### POST /api/auth/did/verify

Verify a signed challenge and get JWT tokens.

**Request:**
```json
{
  "did": "did:ethr:0x1234...",
  "challenge": "a1b2c3d4e5f6...",
  "signature": "9f8e7d6c5b4a...",
  "publicKey": "04abc123..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 604800,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "did": "did:ethr:0x1234..."
  }
}
```

#### POST /api/auth/did/refresh

Refresh an expired access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 604800
}
```

#### POST /api/auth/did/logout

Logout and invalidate session.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### User Endpoints

#### GET /api/auth/me

Get current user's profile.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "did": "did:ethr:0x1234...",
    "email": "user@example.com",
    "name": "John Doe",
    "walletAddress": "0x1234...",
    "walletType": "metamask",
    "createdAt": "2024-10-01T00:00:00.000Z",
    "lastLoginAt": "2024-10-08T12:00:00.000Z"
  }
}
```

#### PATCH /api/auth/me

Update user profile.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "email": "newemail@example.com",
  "name": "Jane Doe"
}
```

**Response:**
```json
{
  "user": { ... }
}
```

## SDKs and Tools

### Official SDKs

- **JavaScript/TypeScript**: Coming soon
- **Python**: Coming soon
- **Go**: Coming soon

### Third-Party Tools

- **Postman Collection**: Import our collection for easy testing
- **Swagger UI**: Interactive API documentation
- **cURL Examples**: See `examples/curl/` directory

### Code Examples

Check out the [`examples/`](../examples/) directory for complete working examples:

- Node.js authentication
- React integration
- Next.js server-side
- MetaMask integration
- WalletConnect integration

## Standards Compliance

VitalCV is built on open standards:

### W3C Standards

- ✅ **Verifiable Credentials Data Model 1.1**
  - [Specification](https://www.w3.org/TR/vc-data-model/)
  - Full support for credential issuance and verification

- ✅ **Decentralized Identifiers (DIDs) v1.0**
  - [Specification](https://www.w3.org/TR/did-core/)
  - Supported methods: `did:ethr`, `did:key`, `did:web`

### Cryptography Standards

- ✅ **Ed25519 Signature 2020**
  - High-performance digital signatures
  - Quantum-resistant security

- ✅ **BBS+ Signatures**
  - Selective disclosure (choose which fields to reveal)
  - Privacy-preserving credentials

- ✅ **Zero-Knowledge Proofs**
  - zk-SNARKs for range proofs
  - Prove properties without revealing data

### Compliance Frameworks

- ✅ **GDPR** (General Data Protection Regulation)
- ✅ **CCPA** (California Consumer Privacy Act)
- ✅ **HIPAA** Privacy Rule (for health credentials)
- ✅ **SOC 2 Type II** (Security controls)

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - validation failed |
| 401 | Unauthorized - authentication required |
| 404 | Not Found |
| 409 | Conflict (e.g., duplicate email) |
| 429 | Too Many Requests - rate limit exceeded |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": "Error message",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## Changelog

### Version 1.0.0 (2024-10-08)

- ✨ Initial release
- ✅ DID authentication with Ed25519 signatures
- ✅ JWT token management (access + refresh)
- ✅ User profile management
- ✅ Rate limiting with database tracking
- ✅ Security headers (CSP, HSTS, etc.)
- ✅ OpenAPI 3.0 specification

### Upcoming Features

- 🚧 Credential issuance endpoints
- 🚧 Credential verification endpoints
- 🚧 BBS+ selective disclosure
- 🚧 Zero-knowledge proofs
- 🚧 Trusted issuer registry
- 🚧 Revocation management

## Support

### Documentation

- **API Reference**: [OpenAPI Spec](./openapi.yaml)
- **Developer Guide**: [docs/guides/](../guides/)
- **FAQ**: [docs/FAQ.md](../FAQ.md)

### Community

- **GitHub Issues**: Report bugs and request features
- **Discord**: Join our community chat
- **Twitter**: [@VitalCV](https://twitter.com/vitalcv)

### Enterprise Support

For enterprise support, SLA agreements, and custom integrations:

- Email: enterprise@vitalcv.app
- Schedule a call: [calendly.com/vitalcv](https://calendly.com/vitalcv)

---

**Last Updated**: 2024-10-08
**API Version**: 1.0.0
**License**: MIT
