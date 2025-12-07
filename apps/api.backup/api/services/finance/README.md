# Finance Service

This directory contains the finance/ledger functionality for the Chai VC Platform.

## Overview

The finance service provides:
- **LedgerEntry**: Double-entry accounting ledger entries
- **RevenueRecognitionEvent**: Revenue recognition with scheduling (immediate, linear, rateable)
- **LedgerPostingService**: Posts entries for marketplace purchases, revenue share distributions, refunds
- **RevenueRecognitionScheduler**: Processes revenue recognition events based on schedules
- **SettlementProcessor**: Aggregates payables and triggers payouts via BillingGateway

## Models

### LedgerEntry (`models/LedgerEntry.ts`)

Represents a ledger entry in the double-entry accounting system.

**Fields:**
- `id`: Unique identifier
- `orgId`: Organization ID (null for platform transactions)
- `amount`: Amount in smallest currency unit
- `currency`: Currency code (default: 'USD')
- `type`: 'credit' or 'debit'
- `referenceId`: Reference to related entity
- `relatedEventId`: Related event ID for tracking
- `metadata`: Additional transaction metadata
- `createdAt`: Creation timestamp

**Methods:**
- `create()`: Create a new ledger entry
- `findById()`: Find entry by ID
- `findByOrgId()`: Find entries by organization
- `findByReferenceId()`: Find entries by reference ID
- `getBalance()`: Calculate balance for an organization

### RevenueRecognitionEvent (`models/RevenueRecognitionEvent.ts`)

Represents a revenue recognition event with scheduling.

**Fields:**
- `id`: Unique identifier
- `eventId`: Reference to BillingEvent or other event
- `orgId`: Organization ID
- `amount`: Amount in cents (fiat) or tokens (VITA)
- `revenueType`: 'VITA' or 'FIAT'
- `recognitionSchedule`: 'immediate', 'linear', or 'rateable'
- `recognizedAt`: When revenue is recognized
- `status`: 'pending', 'recognized', or 'settled'
- `metadata`: Additional recognition metadata

**Methods:**
- `create()`: Create a new revenue recognition event
- `findById()`: Find event by ID
- `findByEventId()`: Find events by event ID
- `findByOrgId()`: Find events by organization
- `findPending()`: Find pending events
- `updateStatus()`: Update the status

## Services

### LedgerPostingService (`ledger/postingService.ts`)

Posts entries to the VitaLedger table and enforces double-entry accounting.

**Methods:**
- `postEntry()`: Post a single ledger entry
- `postDoubleEntry()`: Post a double-entry transaction (debit and credit)
- `postMarketplacePurchase()`: Post marketplace purchase transaction
- `postRevenueShareDistribution()`: Post revenue share distribution
- `postRefund()`: Post refund transaction
- `verifyBalance()`: Verify double-entry accounting balance

**Example:**
```typescript
const postingService = new LedgerPostingService(prisma);

// Post marketplace purchase
const [purchaserDebit, vendorCredit, platformFee] =
  await postingService.postMarketplacePurchase({
    purchaseId: 'purchase-123',
    purchaserOrgId: 'org-purchaser',
    vendorOrgId: 'org-vendor',
    amount: 1000,
    currency: 'USD',
    platformFee: 100,
  });
```

### RevenueRecognitionScheduler (`revenue/recognitionScheduler.ts`)

Processes revenue recognition events based on schedules.

**Recognition Schedules:**
- **immediate**: Recognize revenue immediately
- **linear**: Recognize revenue evenly over time periods
- **rateable**: Recognize revenue based on completion percentage

**Methods:**
- `createRecognitionEvent()`: Create a revenue recognition event
- `processRecognition()`: Process a revenue recognition event
- `processPendingEvents()`: Process all pending events
- `updateCompletionPercentage()`: Update completion percentage for rateable recognition

**Example:**
```typescript
const scheduler = new RevenueRecognitionScheduler(prisma);

// Create immediate recognition
const event = await scheduler.createRecognitionEvent({
  eventId: 'event-123',
  orgId: 'org-123',
  amount: 10000,
  revenueType: 'USD',
  recognitionSchedule: 'immediate',
});

// Process recognition
const processed = await scheduler.processRecognition(event.id);
```

### SettlementProcessor (`settlement/processor.ts`)

Aggregates payable amounts and triggers payouts via BillingGateway.

**Methods:**
- `aggregatePayables()`: Aggregate pending payables for an organization
- `processSettlement()`: Process settlement for an organization
- `updateSettlementStatus()`: Update settlement status from BillingGateway
- `getSettlementSummary()`: Get settlement summary for an organization
- `processAllSettlements()`: Process settlements for all organizations

**BillingGateway Interface:**
```typescript
interface BillingGateway {
  initiatePayout(params: {
    orgId: string;
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    settlementTxId: string;
    status: 'pending' | 'completed' | 'failed';
    estimatedCompletionDate?: Date;
  }>;

  getPayoutStatus(settlementTxId: string): Promise<{
    status: 'pending' | 'completed' | 'failed';
    completedAt?: Date;
    failureReason?: string;
  }>;
}
```

**Example:**
```typescript
const billingGateway: BillingGateway = {
  initiatePayout: async (params) => {
    // Implementation
  },
  getPayoutStatus: async (txId) => {
    // Implementation
  },
};

const processor = new SettlementProcessor(prisma, billingGateway);

// Process settlement
const result = await processor.processSettlement({
  orgId: 'org-123',
  currency: 'USD',
  minAmount: 1000,
});
```

## Database Schema

The following tables are created:

- `LedgerEntry`: Stores ledger entries
- `RevenueRecognitionEvent`: Stores revenue recognition events

See `backend/prisma/migrations/20251116_add_ledger_entry_revenue_recognition_event/migration.sql` for the migration.

## Tests

Tests are located in:
- `models/__tests__/LedgerEntry.test.ts`
- `models/__tests__/RevenueRecognitionEvent.test.ts`
- `ledger/__tests__/postingService.test.ts`
- `revenue/__tests__/recognitionScheduler.test.ts`
- `settlement/__tests__/processor.test.ts`

## Usage

1. Run the migration:
```bash
cd backend
npx prisma migrate deploy
```

2. Import and use the services:
```typescript
import { LedgerPostingService } from './services/finance/ledger/postingService';
import { RevenueRecognitionScheduler } from './services/finance/revenue/recognitionScheduler';
import { SettlementProcessor } from './services/finance/settlement/processor';
```

## Tasks Completed

- ✅ B225A-FIN-001: LedgerEntry model
- ✅ B225A-FIN-002: RevenueRecognitionEvent model
- ✅ B225A-FIN-003: LedgerPostingService
- ✅ B225A-FIN-004: RevenueRecognitionScheduler
- ✅ B225A-FIN-005: SettlementProcessor
- ✅ Migration created
- ✅ Tests created

