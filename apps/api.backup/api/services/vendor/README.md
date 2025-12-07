# Vendor Management Service

## Overview

Complete vendor management system with models, services, APIs, and storage for managing vendors, their contacts, onboarding flows, contracts, and documents.

## Implementation Status

All tasks from B240A-VM-001 through B240A-VM-010 have been completed:

### ✅ Models

1. **Vendor** (`models/Vendor.ts`) - B240A-VM-001
   - Fields: id, name, orgId, categoryId, status (pending/active/inactive), description, website, primaryContactId, createdAt, updatedAt
   - CRUD operations with validation

2. **VendorContact** (`models/VendorContact.ts`) - B240A-VM-002
   - Fields: id, vendorId, name, role, email, phone, createdAt, updatedAt
   - Supports multiple contacts per vendor

3. **VendorOnboardingFlow** (`models/VendorOnboardingFlow.ts`) - B240A-VM-003
   - Fields: id, vendorId, currentStep, status, checklist (JSON), createdAt, updatedAt
   - Manages onboarding steps and checklist items

4. **VendorCategory** (`models/VendorCategory.ts`) - B240A-VM-007
   - Fields: id, name, description, complianceRequirements (JSON), createdAt, updatedAt
   - Used to group vendors

5. **ContractLibrary** (`models/ContractLibrary.ts`) - B240A-VM-005
   - Fields: id, name, version, content (HTML or markdown), effectiveDate, expiryDate, jurisdiction, createdAt
   - Stores standard contract templates

### ✅ Services

1. **VendorProfileService** (`services/vendorProfileService.ts`) - B240A-VM-004
   - CRUD operations for vendor profiles
   - Merges vendor data from external sources
   - Ensures category assignment
   - Includes unit tests

2. **ContractManagementService** (`services/contractManagementService.ts`) - B240A-VM-006
   - Template selection
   - Draft generation
   - Signature tracking
   - Renewal alerts
   - Integrates with Marketplace and billing modules

### ✅ API

1. **VendorRepository API** (`api/vendorRepositoryAPI.ts`) - B240A-VM-008
   - Endpoints to list, create, update, and archive vendors
   - Supports filtering by category, status, and risk level
   - Implements pagination and sorting
   - Enforces RBAC (Role-Based Access Control)

### ✅ Storage

1. **VendorDocumentStorage** (`storage/vendorDocumentStorage.ts`) - B240A-VM-009
   - Securely stores vendor documents (encrypted)
   - Indexes by vendorId and docType
   - Supports upload, versioning, retrieval
   - Integrates with EvidenceStore

### ✅ Tests

1. **VendorCoreTests** (`tests/core.test.ts`) - B240A-VM-010
   - End-to-end tests covering:
     - Vendor creation
     - Onboarding flows
     - Contract management
     - Document uploads
   - Ensures models and services operate correctly

## Database Schema

The Prisma schema already includes all vendor models:
- `Vendor`
- `VendorContact`
- `VendorOnboardingFlow`
- `VendorCategory`
- `ContractLibrary`
- `VendorContract`
- `VendorDocument`

## Usage

### Basic Vendor Operations

```typescript
import { VendorProfileService } from './services/vendorProfileService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const service = new VendorProfileService(prisma);

// Create vendor
const vendor = await service.createVendorProfile('org-id', {
  name: 'Acme Corp',
  categoryId: 'category-id',
  description: 'IT Supplier',
  website: 'https://acme.com',
});

// Get vendor with relations
const vendorWithRelations = await service.getVendorWithRelations(vendor.id);
```

### Contract Management

```typescript
import { ContractManagementService } from './services/contractManagementService';

const contractService = new ContractManagementService(prisma);

// Generate contract draft
const draft = await contractService.generateContractDraft({
  vendorId: 'vendor-id',
  templateId: 'template-id',
  expiresAt: new Date('2026-12-31'),
});

// Track signature
await contractService.trackContractSignature(draft.id);
```

### Document Storage

```typescript
import { uploadVendorDocument } from './storage/vendorDocumentStorage';

const document = await uploadVendorDocument(prisma, {
  vendorId: 'vendor-id',
  docType: DocumentType.CERTIFICATE,
  title: 'ISO 27001 Certificate',
  fileName: 'iso-cert.pdf',
  mimeType: 'application/pdf',
  fileData: Buffer.from('...'),
  uploadedBy: 'user-id',
});
```

### API Integration

```typescript
import vendorRepositoryAPI from './api/vendorRepositoryAPI';
import express from 'express';

const app = express();
app.use('/api/vendors', vendorRepositoryAPI);
```

## API Endpoints

- `GET /api/vendors` - List vendors (with filtering, pagination, sorting)
- `GET /api/vendors/:id` - Get vendor by ID
- `POST /api/vendors` - Create vendor
- `PATCH /api/vendors/:id` - Update vendor
- `DELETE /api/vendors/:id` - Archive vendor
- `GET /api/vendors/:id/contacts` - List vendor contacts
- `POST /api/vendors/:id/contacts` - Create vendor contact
- `GET /api/vendors/:id/documents` - List vendor documents
- `GET /api/vendors/:id/onboarding` - Get onboarding flow
- `GET /api/vendors/:id/contracts` - List vendor contracts

## RBAC Roles

- `vendor_viewer` - Can view vendors
- `vendor_admin` - Can manage vendors
- `admin` - Full access

## Testing

Run tests with:

```bash
npm test -- services/vendor/tests/core.test.ts
```

## Notes

- All models are already defined in the Prisma schema
- Document storage uses encryption (AES-256-CBC)
- EvidenceStore integration for compliance tracking
- Contract renewal alerts supported
- Marketplace and billing module integrations included

