# Marketplace Module

B223A-MARKET: Marketplace module implementation for module discovery, vendor management, approval workflows, and licensing.

## Components

### Models

#### MarketplaceModule (B223A-MARKET-001)
- **Fields**: id, name, version, description, vendorId, capabilities[], price, currency, licenseType, approvalStatus, averageRating
- **Location**: `models/MarketplaceModule.ts`
- **Tests**: `models/__tests__/MarketplaceModule.test.ts`

#### VendorProfile (B223A-MARKET-002)
- **Fields**: vendorId, did, name, contactInfo, kycStatus, reputationScore
- **Location**: `models/VendorProfile.ts`
- **Tests**: `models/__tests__/VendorProfile.test.ts`

### Services

#### MarketplaceService (B223A-MARKET-003)
- **Methods**:
  - `listModules()` - List modules with filters and pagination
  - `searchModules()` - Search modules by query string
  - `registerVendor()` - Register a new vendor
  - `submitModuleForApproval()` - Submit module for approval
  - `fetchVendorModules()` - Get all modules for a vendor
- **Location**: `marketplaceService.ts`
- **Tests**: `__tests__/marketplaceService.test.ts`

#### ModuleApprovalWorkflow (B223A-MARKET-004)
- **Features**:
  - Automated security scan
  - Capability validation
  - Policy compliance checks
  - Manual review support
- **Transitions**: `PENDING` → `UNDER_REVIEW` → `APPROVED` or `REJECTED`
- **Location**: `approvalWorkflow.ts`
- **Tests**: `__tests__/approvalWorkflow.test.ts`

#### LicenseKeyGenerator (B223A-MARKET-005)
- **Features**:
  - Cryptographically signed license keys
  - Tied to moduleId and purchaser DID
  - Tracks issuance and expiry
  - License revocation support
- **Location**: `licensing/licenseKeyGenerator.ts`
- **Tests**: `licensing/__tests__/licenseKeyGenerator.test.ts`

## Database Migration

To create the database tables, run:

```bash
cd backend
npx prisma migrate dev --name add_marketplace_models
npx prisma generate
```

This will create:
- `MarketplaceModule` table
- `VendorProfile` table
- `LicenseKey` table
- Enums: `ApprovalStatus`, `LicenseType`, `KYCStatus`

## Usage Examples

### Register a Vendor

```typescript
import { MarketplaceService } from './services/marketplace';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const marketplace = new MarketplaceService(prisma);

const vendor = await marketplace.registerVendor({
  vendorId: 'vendor-123',
  name: 'Acme Corp',
  did: 'did:example:123',
  contactInfo: {
    email: 'contact@acme.com',
    website: 'https://acme.com',
  },
});
```

### Submit Module for Approval

```typescript
const module = await marketplace.submitModuleForApproval({
  name: 'Analytics Module',
  version: '1.0.0',
  description: 'Advanced analytics capabilities',
  vendorId: 'vendor-123',
  capabilities: ['analytics', 'reporting'],
  price: 99.99,
  licenseType: LicenseType.SUBSCRIPTION,
});
```

### Process Approval

```typescript
import { ModuleApprovalWorkflow } from './services/marketplace';

const workflow = new ModuleApprovalWorkflow(prisma);

// Run automated checks
const result = await workflow.runAutomatedChecks('module-123');

// Process approval (automated + manual)
const approval = await workflow.processApproval('module-123', {
  approved: true,
  reviewerNotes: 'All checks passed',
});
```

### Generate License Key

```typescript
import { LicenseKeyGenerator } from './services/marketplace';

const generator = new LicenseKeyGenerator(prisma);

const licenseKey = await generator.generateLicenseKey(
  'module-123',
  'did:example:purchaser',
  new Date('2025-12-31') // Optional expiry
);

// Validate license
const validation = await generator.validateLicenseKey(licenseKey);
```

## Testing

Run tests with:

```bash
npm test -- services/marketplace
```

## Environment Variables

For production, set these environment variables:

- `LICENSE_PRIVATE_KEY` - Private key for license signing
- `LICENSE_PUBLIC_KEY` - Public key for license verification

**Note**: In production, use proper RSA key pairs from secure key management (e.g., AWS KMS, HashiCorp Vault).

