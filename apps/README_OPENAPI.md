# OpenAPI Specifications & Try-It Mocks

**B128B-OPENAPI-029: OpenAPI examples (issuer/verifier/privileges/evidence) + try-it mocks**

## Overview

This document describes the OpenAPI specifications for VitalCV platform APIs, including comprehensive examples and try-it mock servers for interactive testing.

## API Specifications

### 1. Issuer API (`apps/issuer-api/openapi/openapi.yaml`)

**Purpose**: OIDC4VCI-compliant credential issuance

**Endpoints**:
- `/.well-known/openid-credential-issuer` - Issuer metadata
- `/token` - OAuth2 token endpoint
- `/credential` - Credential issuance
- `/deferred` - Deferred credential retrieval
- `/batch` - Batch credential issuance

**Mock Server**: https://stoplight.io/mocks/vitalcv/issuer-api/1.0.0

**Examples Included**:
- Issuer metadata response
- Authorization code token request
- Pre-authorized code token request
- Credential request with proof
- Batch credential request
- Deferred credential request

### 2. Verifier API (`apps/verifier-api/openapi/openapi.yaml`)

**Purpose**: OIDC4VP-compliant presentation verification

**Endpoints**:
- `/.well-known/openid-credential-verifier` - Verifier metadata
- `/presentation` - Presentation verification
- `/request` - Presentation request creation

**Mock Server**: https://stoplight.io/mocks/vitalcv/verifier-api/1.0.0

**Examples Included**:
- Verifier metadata with EUDI mode
- JWT VP presentation
- EUDI wallet presentation
- Presentation verification success
- EUDI-only mode rejection

### 3. Compliance API (`apps/compliance-api/openapi/openapi.yaml`)

**Purpose**: NCQA compliance and evidence management

**Endpoints**:
- `/coverage` - Coverage metrics with auto-PSV and stale tracking
- `/coverage/source/{sourceId}` - Source-specific coverage
- `/coverage/evidence/{evidenceId}` - Evidence details
- `/ncqa/evidence/zip` - Evidence ZIP export
- `/evidence/registry` - Evidence registry listing

**Mock Server**: https://stoplight.io/mocks/vitalcv/compliance-api/1.0.0

**Examples Included**:
- Coverage metrics with tiles and SLA badges
- Stale source tracking with age in days
- Source-specific coverage details
- Evidence record details with timestamps
- Evidence ZIP export request

## Using Try-It Mocks

### Stoplight Studio

1. **Open API Specification**
   ```bash
   cd apps/[api-name]/openapi
   npx @stoplight/cli prism mock openapi.yaml
   ```

2. **Access Mock Server**
   - Issuer: http://localhost:4010
   - Verifier: http://localhost:4011
   - Compliance: http://localhost:4012

3. **Make Requests**
   ```bash
   # Example: Get issuer metadata
   curl http://localhost:4010/.well-known/openid-credential-issuer

   # Example: Get coverage metrics
   curl http://localhost:4012/coverage
   ```

### Online Try-It

Visit the mock server URLs directly:
- https://stoplight.io/mocks/vitalcv/issuer-api/1.0.0
- https://stoplight.io/mocks/vitalcv/verifier-api/1.0.0
- https://stoplight.io/mocks/vitalcv/compliance-api/1.0.0

## API Examples

### Issuer API - Request Credential

**Request**:
```bash
POST /credential
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "format": "jwt_vc_json",
  "credential_definition": {
    "type": ["VerifiableCredential", "PhysicianCredential"]
  },
  "proof": {
    "proof_type": "jwt",
    "jwt": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response**:
```json
{
  "credential": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...",
  "format": "jwt_vc_json",
  "c_nonce": "nonce-abc123",
  "c_nonce_expires_in": 86400
}
```

### Verifier API - Verify Presentation

**Request**:
```bash
POST /presentation
Content-Type: application/json

{
  "vp_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "nonce": "nonce123",
  "presentation_submission": {
    "id": "submission-123",
    "definition_id": "physician-credential-definition",
    "descriptor_map": [
      {
        "id": "physician-credential",
        "path": "$.vp.verifiableCredential[0]",
        "format": "jwt_vc_json"
      }
    ]
  }
}
```

**Response**:
```json
{
  "verified": true,
  "credential": {
    "type": ["VerifiableCredential", "PhysicianCredential"],
    "credentialSubject": {
      "id": "did:web:vitalcv.ai:physicians:12345",
      "licenseNumber": "MD-CA-12345"
    }
  },
  "timestamp": "2025-11-12T10:00:00.000Z"
}
```

### Compliance API - Get Coverage Metrics

**Request**:
```bash
GET /coverage
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "summary": {
    "autoPSVPercentage": 85,
    "totalVerifications": 1250,
    "autoVerifications": 1063,
    "manualVerifications": 187,
    "totalSources": 12,
    "slaDistribution": {
      "green": 8,
      "yellow": 3,
      "red": 1
    }
  },
  "tiles": [
    {
      "id": "auto-psv-percentage",
      "title": "Auto-PSV Coverage",
      "value": "85%",
      "description": "1063 of 1250 verifications automated",
      "badge": "green"
    }
  ],
  "staleBySource": [
    {
      "sourceId": "nppes",
      "sourceName": "NPPES Registry",
      "totalVerifications": 450,
      "ageInDays": 15,
      "slaBadge": "green",
      "evidenceIds": ["ver-nppes-001", "ver-nppes-002"]
    }
  ],
  "timestamp": "2025-11-12T10:00:00.000Z"
}
```

## Validation

### Validate OpenAPI Specs

```bash
# Install validator
npm install -g @stoplight/spectral-cli

# Validate specs
spectral lint apps/issuer-api/openapi/openapi.yaml
spectral lint apps/verifier-api/openapi/openapi.yaml
spectral lint apps/compliance-api/openapi/openapi.yaml
```

### Test Mock Responses

```bash
# Install Prism
npm install -g @stoplight/prism-cli

# Start mock server
prism mock apps/issuer-api/openapi/openapi.yaml

# Test endpoints
curl http://localhost:4010/.well-known/openid-credential-issuer
curl -X POST http://localhost:4010/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=abc123"
```

## Development

### Adding New Examples

1. **Define Schema**
   ```yaml
   components:
     schemas:
       MySchema:
         type: object
         properties:
           field:
             type: string
   ```

2. **Add Example**
   ```yaml
   paths:
     /my-endpoint:
       get:
         responses:
           '200':
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/MySchema'
                 examples:
                   success:
                     summary: Successful response
                     value:
                       field: "example value"
   ```

3. **Test Example**
   ```bash
   prism mock openapi.yaml
   curl http://localhost:4010/my-endpoint
   ```

### Mock Server Configuration

Configure mock servers in OpenAPI spec:

```yaml
servers:
  - url: https://vitalcv.ai/api
    description: Production server
  - url: http://localhost:4000
    description: Development server
  - url: https://stoplight.io/mocks/vitalcv/my-api/1.0.0
    description: Mock server (Try It Out)
    x-try-it-out: true
```

## Integration

### Frontend Integration

```typescript
// Use OpenAPI-generated client
import { IssuerAPI } from './generated/issuer-api';

const api = new IssuerAPI({
  baseUrl: process.env.ISSUER_API_URL || 'http://localhost:4010',
});

// Request credential
const response = await api.requestCredential({
  format: 'jwt_vc_json',
  credential_definition: {
    type: ['VerifiableCredential', 'PhysicianCredential'],
  },
});
```

### Generating Client SDKs

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i apps/issuer-api/openapi/openapi.yaml \
  -g typescript-axios \
  -o sdks/issuer-api-client

# Generate Python client
openapi-generator-cli generate \
  -i apps/verifier-api/openapi/openapi.yaml \
  -g python \
  -o sdks/verifier-api-client
```

## Testing

### API Contract Testing

```typescript
import { test, expect } from '@playwright/test';

test('issuer metadata matches OpenAPI spec', async ({ request }) => {
  const response = await request.get('/.well-known/openid-credential-issuer');

  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  expect(data).toHaveProperty('credential_issuer');
  expect(data).toHaveProperty('credential_endpoint');
  expect(data).toHaveProperty('credentials_supported');
});
```

### Mock Server Testing

```bash
# Start mock server
prism mock apps/issuer-api/openapi/openapi.yaml &

# Run tests
npm test -- api-contract.test.ts

# Stop mock server
pkill -f prism
```

## Documentation

### Generating API Docs

```bash
# Install Redoc CLI
npm install -g redoc-cli

# Generate HTML docs
redoc-cli bundle apps/issuer-api/openapi/openapi.yaml \
  -o public-docs/issuer-api.html

redoc-cli bundle apps/verifier-api/openapi/openapi.yaml \
  -o public-docs/verifier-api.html

redoc-cli bundle apps/compliance-api/openapi/openapi.yaml \
  -o public-docs/compliance-api.html
```

### Hosting API Docs

```bash
# Install Swagger UI
npm install -g swagger-ui-watcher

# Start Swagger UI
swagger-ui-watcher apps/issuer-api/openapi/openapi.yaml
```

## Best Practices

1. **Comprehensive Examples**: Include examples for all request/response combinations
2. **Error Cases**: Document error responses with examples
3. **Mock Data**: Use realistic mock data in examples
4. **Validation**: Validate specs before committing
5. **Versioning**: Version APIs semantically (v1, v2, etc.)
6. **Security**: Document authentication/authorization requirements
7. **Deprecation**: Mark deprecated endpoints clearly
8. **Testing**: Test against mock servers in CI/CD

## Troubleshooting

### Mock Server Not Starting

```bash
# Check if port is in use
lsof -i :4010

# Use different port
prism mock openapi.yaml -p 4020
```

### Example Not Showing

1. Check YAML syntax
2. Verify schema reference
3. Ensure example is properly indented
4. Validate with Spectral

### Client Generation Fails

1. Validate OpenAPI spec
2. Check generator compatibility
3. Use `--skip-validate-spec` if needed (not recommended)

## Resources

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Stoplight Prism](https://stoplight.io/open-source/prism)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Spectral Linter](https://stoplight.io/open-source/spectral)
- [Redoc Documentation](https://redocly.com/)

---

**Last Updated**: 2025-11-12
**Version**: 1.0.0
**Owner**: API Platform Team
