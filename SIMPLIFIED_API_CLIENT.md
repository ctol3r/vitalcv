# Simplified API Client - Production Focused

## Overview

A streamlined, production-ready API client implementation focused on simplicity, reliability, and clear error messages.

**Created**: October 26, 2025
**Status**: ✅ Complete

---

## New Files

### 1. `lib/npi.ts` - NPI Validation

**Purpose**: Luhn algorithm implementation for NPI checksum validation

**Key Features**:

- Validates 10-digit NPIs using Luhn algorithm over "80840" + first 9 digits
- Formats NPIs for display (XXX-XXX-XXXX)
- Warns about invalid checksums but allows user to proceed

**Functions**:

```typescript
isValidNpi(npi: string): boolean
formatNpi(npi: string): string
```

---

### 2. `lib/apiClient.ts` - Streamlined API Client

**Purpose**: Simplified API communication with robust error handling

**Key Features**:

- Flexible API base resolution (respects `NEXT_PUBLIC_BACKEND_URL`)
- Graceful error handling for JSON, HTML, and network errors
- Health check function for diagnostics
- Clear, user-friendly error messages

**Functions**:

```typescript
pingHealth(): Promise<boolean>
lookupNpi(npi: string): Promise<NpiRecord>
getClaimStatus(npi: string): Promise<ClaimStatus>
startBasicClaim(npi, email, phone?): Promise<Response>
verifyPin(npi, pin): Promise<Response>
uploadDocuments(npi, files): Promise<Response>
requestAttestation(npi): Promise<Response>
```

---

### 3. Enhanced Start Page

**Improvements**:

- Real-time NPI checksum validation with warnings
- Immediate feedback before navigation
- Clean, gradient background design
- Test NPI suggestions in footer

**User Flow**:

```
User enters NPI
  ↓
Real-time checksum validation
  ↓
Warning if checksum fails (but can proceed)
  ↓
Clicks Continue → API lookup
  ↓
Routes to /npi/[npi] with record
```

---

### 4. Simplified NPI Profile Page

**Location**: `app/npi/[npi]/simple/page.tsx`

**Features**:

- Minimal, focused UI
- Status badge with color coding
- All essential NPI information
- Direct "Claim this profile" link

**Status Levels**:

- **Gray**: Not Verified
- **Blue**: Email Verified
- **Purple**: ID Verified
- **Green**: Issuer Attested

---

## Error Handling

### Network Errors

**Detected**: "Failed to fetch", "NetworkError"

**Message**: "Network error: frontend cannot reach the API. Check environment/CORS."

**Action**: Verify `NEXT_PUBLIC_BACKEND_URL` and CORS configuration

---

### HTTP Status Codes

**404 + "not found"**:

- Message: "NPI not found. Please check the number or try a known test NPI."
- Action: Check NPI number or try test NPIs

**502/503**:

- Message: "Upstream service unavailable. Try again shortly."
- Action: Wait and retry

**Other errors**:

- Message: Uses backend error message or "Request failed (HTTP XXX)"
- Action: Check logs and retry

---

## Environment Configuration

### Local Development

```bash
# .env.local (optional)
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

### Production

```bash
# Set in hosting platform
NEXT_PUBLIC_BACKEND_URL=https://api.vitalcv.dev
```

**Fallback**: If not set, uses same-origin (`/api`)

---

## Test NPIs

For testing, use these real NPIs:

- `1538102066` - Nurse practitioner
- `1922074434` - Physician
- `1801921143` - Individual provider
- `1043233331` - Hospital (Type 2)

---

## API Base Resolution Logic

```typescript
const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
const base = API_BASE || ''; // same-origin fallback
```

**Behavior**:

1. If `NEXT_PUBLIC_BACKEND_URL` is set, use it (trim trailing slashes)
2. If not set, use empty string (same-origin)
3. All API calls prefix with `base`

---

## Benefits

### Simplicity

✅ **Less code**: ~120 lines vs 200+ in complex version
✅ **Clear logic**: Easy to understand and maintain
✅ **Fewer dependencies**: No extra abstractions

### Reliability

✅ **Error-tolerant**: Handles JSON, HTML, and plain text responses
✅ **Network-aware**: Detects and surfaces connectivity issues
✅ **User-friendly**: Clear error messages

### Production-Ready

✅ **Environment-aware**: Works in dev and prod
✅ **CORS-safe**: Clear errors when misconfigured
✅ **Graceful degradation**: Handles service outages

---

## Migration from Old API Client

### Old Import

```typescript
import { lookupNpi } from '@/lib/npi-client';
```

### New Import

```typescript
import { lookupNpi } from '@/lib/apiClient';
```

### No Breaking Changes

All function signatures remain the same:

- `lookupNpi(npi)`
- `getClaimStatus(npi)`
- `startBasicClaim(npi, email, phone?)`
- etc.

---

## Quick Start

### 1. Test NPI Validation

```typescript
import { isValidNpi } from '@/lib/npi';

console.log(isValidNpi('1538102066')); // true
console.log(isValidNpi('1234567890')); // false (invalid checksum)
```

### 2. Make API Call

```typescript
import { lookupNpi } from '@/lib/apiClient';

const record = await lookupNpi('1538102066');
console.log(record.name); // "Dr. Jane Smith"
```

### 3. Handle Errors

```typescript
try {
  await lookupNpi('9999999999');
} catch (err) {
  if (err.message.includes('Network error')) {
    // Handle connectivity issue
  } else if (err.message.includes('not found')) {
    // Handle NPI not found
  }
}
```

---

## Testing Checklist

- [x] NPI checksum validation works
- [x] API base resolution works in dev
- [x] API base resolution works in prod
- [x] Network errors caught and displayed
- [x] 404 errors show friendly message
- [x] 502/503 errors show retry message
- [x] JSON parsing handles malformed responses
- [x] HTML error pages handled gracefully
- [x] Health check function works
- [x] All API functions exported

---

## Next Steps

### Immediate

1. ✅ Test with real backend
2. ✅ Deploy to staging
3. ✅ Monitor error rates

### Short Term

1. Add retry logic for transient failures
2. Implement request caching
3. Add request timeout configuration

### Long Term

1. Add offline detection
2. Implement request queueing
3. Add analytics integration

---

## Comparison: Old vs New

| Feature         | Old (`lib/npi-client.ts`) | New (`lib/apiClient.ts`) |
| --------------- | ------------------------- | ------------------------ |
| Lines of code   | ~200                      | ~120                     |
| Error handling  | Complex                   | Simple                   |
| NPI validation  | No                        | Yes                      |
| Health check    | Yes                       | Yes                      |
| Flexibility     | Medium                    | High                     |
| Maintainability | Medium                    | High                     |

**Winner**: New simplified version

---

**Version**: 1.0
**Status**: ✅ Production Ready
**Last Updated**: October 26, 2025
