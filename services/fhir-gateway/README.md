# Da Vinci ATR FHIR Group Client

FHIR Group client for Da Vinci ATR (Attestation Transaction Records) that fetches Group exports with SMART auth rotation.

## Task: B119B-ATR-015

### Acceptance Criteria
- ✅ /Group export fetch OK
- ✅ SMART auth rotates
- ✅ ATR UI syncs

## Features

### SMART Auth Rotation
- Automatically refreshes tokens before expiry
- Prevents concurrent refresh requests
- Configurable rotation threshold (default: 5 minutes before expiry)

### Group Export
- Fetches FHIR Group export from Da Vinci ATR endpoint
- Supports pagination and filtering
- Handles incremental updates with `_since` parameter

### UI Sync
- Syncs fetched groups with ATR UI
- Updates database/cache
- Emits events for UI refresh

## Usage

### Basic Usage

```typescript
import { createATRGroupClient } from './atr-group-client';

const client = createATRGroupClient({
  fhirBaseUrl: 'https://atr.example.com/fhir',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
});

// Fetch Group export
const exportResult = await client.fetchGroupExport();

// Full sync (fetch + sync with UI)
const result = await client.fullSync();
console.log(`Synced ${result.groups.length} groups`);
```

### With Parameters

```typescript
// Fetch groups updated since a specific date
const result = await client.fetchGroupExport({
  _since: '2025-01-01T00:00:00Z',
  _count: 100,
  _type: 'practitioner',
});

// Sync specific groups
await client.syncWithATRUI(result.entry.map(e => e.resource));
```

### Token Management

```typescript
// Get current token (auto-refreshes if needed)
const token = await client.getAuthToken();

// Force token refresh
const newToken = await client.getAuthToken(true);
```

## Configuration

### Environment Variables

```bash
ATR_FHIR_BASE_URL=https://atr.example.com/fhir
ATR_CLIENT_ID=your-client-id
ATR_CLIENT_SECRET=your-client-secret
ATR_TOKEN_ROTATION_THRESHOLD=300  # seconds before expiry
```

### Custom Endpoints

```typescript
const client = createATRGroupClient({
  fhirBaseUrl: 'https://atr.example.com/fhir',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tokenUrl: 'https://auth.example.com/token', // Custom token endpoint
  groupExportUrl: 'https://atr.example.com/fhir/Group?_export', // Custom export endpoint
  tokenRotationThreshold: 600, // 10 minutes
});
```

## Integration

### With ATR Reconcile Job

```typescript
import { getATRReconcileService } from '../../jobs/atr/reconcile';
import { createATRGroupClient } from './atr-group-client';

const reconcileService = getATRReconcileService();
const groupClient = createATRGroupClient({
  fhirBaseUrl: process.env.ATR_FHIR_BASE_URL!,
  clientId: process.env.ATR_CLIENT_ID!,
  clientSecret: process.env.ATR_CLIENT_SECRET!,
});

// Fetch groups and reconcile
const result = await groupClient.fullSync({
  _since: lastSyncTimestamp,
});

// Process groups through reconcile service
for (const group of result.groups) {
  // Extract ATR records from group members
  // Process through reconcile service
}
```

## SMART Auth Flow

1. Client credentials grant (client_credentials)
2. Token obtained with scope `system/Group.read`
3. Token automatically refreshed before expiry
4. Refresh prevents concurrent requests

## Error Handling

The client handles:
- Token expiry and refresh
- Network errors with retries (to be implemented)
- Rate limiting (429 responses)
- Invalid responses

## References

- [Da Vinci ATR Implementation Guide](http://hl7.org/fhir/us/davinci-atr/)
- [SMART on FHIR](http://hl7.org/fhir/smart-app-launch/)
- [FHIR Group Resource](http://hl7.org/fhir/group.html)


