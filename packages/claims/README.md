# @vitalcv/claims

## TIER-0 CLAIM PRIMITIVES

Foundational package for handling healthcare claims with compile-time guarantees.

## Design Guarantees

1. **purpose_of_use cannot be empty** - Enforced at compile time via branded types
2. **Values must be hashes (no raw PII)** - All claim values are cryptographic hashes
3. **Validation throws on failure** - No silent bypasses or assumptions
4. **Immutable structures** - All claims are readonly

## Core Types

### Claim

```typescript
interface Claim {
  readonly type: ClaimType;
  readonly value: ClaimValue; // Always a hash
  readonly purpose_of_use: PurposeOfUse; // Non-empty string
  readonly issued_at: number; // Unix timestamp (ms)
  readonly issuer: NonEmptyString; // DID or identifier
  readonly subject: NonEmptyString; // DID or identifier
}
```

### Hash Format

Hashes follow the format: `algorithm:hexdigest`

Supported algorithms:

- `sha256` - SHA-256 (64 hex chars)
- `sha512` - SHA-512 (128 hex chars)
- `blake2b256` - BLAKE2b truncated to 256 bits (64 hex chars)

## Usage

### Creating Claims

```typescript
import { createClaimType, createPurposeOfUse, computeHash, type Claim } from '@vitalcv/claims';

// Hash the PII value (never store raw PII)
const npiHash = computeHash('1234567890', 'sha256');

// Create claim
const claim: Claim = {
  type: createClaimType('npi'),
  value: npiHash,
  purpose_of_use: createPurposeOfUse('TREATMENT'),
  issued_at: Date.now(),
  issuer: 'did:web:issuer.vitalcv.com',
  subject: 'did:web:subject.example.com',
};
```

### Schema Registry

```typescript
import {
  SchemaRegistry,
  registerStandardSchemas,
  createClaimType,
  type ClaimSchema,
} from '@vitalcv/claims';

// Create registry
const registry = new SchemaRegistry();

// Register standard healthcare schemas
registerStandardSchemas(registry);

// Register custom schema
const customSchema: ClaimSchema = {
  type: createClaimType('custom_claim'),
  description: 'Custom claim type',
  hash_algorithm: 'sha256',
  allowed_purposes: ['TREATMENT', 'OPERATIONS'],
};

registry.register(customSchema);
```

### Validation

```typescript
import { validateClaimWithRegistry, validateClaimStructure, parseClaim } from '@vitalcv/claims';

// Validate claim structure (shallow)
try {
  validateClaimStructure(unknownInput);
  console.log('Valid claim structure');
} catch (error) {
  console.error('Invalid:', error.message);
}

// Validate against schema
try {
  validateClaimWithRegistry(claim, registry);
  console.log('Claim is valid');
} catch (error) {
  console.error('Validation failed:', error.message);
}

// Parse and validate unknown input
try {
  const claim = parseClaim(json);
  console.log('Parsed claim:', claim);
} catch (error) {
  console.error('Parse error:', error.message);
}
```

### Hashing Utilities

```typescript
import { computeHash, computeHashWithSalt, verifyHash } from '@vitalcv/claims';

// Basic hashing
const hash = computeHash('sensitive-data', 'sha256');

// Hashing with salt/pepper
const saltedHash = computeHashWithSalt(
  'sensitive-data',
  'random-salt',
  process.env.SECRET_PEPPER,
  'sha256',
);

// Verify hash
const isValid = verifyHash('sensitive-data', hash, 'random-salt', process.env.SECRET_PEPPER);
```

## Standard Purpose of Use Values

HIPAA-compliant purposes:

- `TREATMENT` - Direct patient care
- `PAYMENT` - Billing and reimbursement
- `OPERATIONS` - Healthcare operations
- `HOPER` - Healthcare Operations, Policy, and Research
- `QUALITY` - Quality improvement
- `RESEARCH` - Research activities
- `EMERGENCY` - Emergency care
- `PUBLIC_HEALTH` - Public health reporting
- `JUDICIAL` - Judicial proceedings
- `LAW_ENFORCEMENT` - Law enforcement
- `COVERAGE` - Coverage determination
- `MARKETING` - Marketing activities

## Error Handling

All validation functions throw on failure:

```typescript
import { ClaimValidationError, SchemaRegistryError } from '@vitalcv/claims';

try {
  validateClaimWithRegistry(claim, registry);
} catch (error) {
  if (error instanceof ClaimValidationError) {
    // Handle validation error
    console.error('Validation failed:', error.message);
  } else if (error instanceof SchemaRegistryError) {
    // Handle registry error
    console.error('Schema error:', error.message);
  }
}
```

## Compile-Time Guarantees

The package uses TypeScript branded types to enforce constraints at compile time:

```typescript
// ✅ This compiles
const purpose = createPurposeOfUse('TREATMENT');

// ❌ This does NOT compile (empty string)
const invalid: PurposeOfUse = ''; // Type error

// ✅ This compiles (valid hash)
const hash: Hash = computeHash('data', 'sha256');

// ❌ This does NOT compile (not a hash)
const invalid: Hash = 'just-a-string'; // Type error
```

## No Stubs, No Bypasses

This package contains zero stubs or bypass logic:

- All validations execute
- All assertions throw on failure
- No assumptions about data
- No AI or resolver logic
- Pure deterministic functions

## License

Private - VitalCV Healthcare Credentialing Platform
