# API Client Improvements - Production Ready

## Overview

Enhanced the frontend API client with robust error handling, flexible API base configuration, and improved user feedback for connectivity issues.

**Created**: October 26, 2025
**Status**: ✅ Complete

---

## Changes Made

### 1. Flexible API Base Resolution

**File**: `lib/npi-client.ts`

**Improvements**:

- Respects `NEXT_PUBLIC_BACKEND_URL` environment variable
- Falls back to same-origin (`/api`) for local development
- Trims trailing slashes automatically

**Code**:

```typescript
function resolveApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();
  if (env) return env.replace(/\/+$/, '');
  return '';
}
const API_BASE = resolveApiBase() || '/api';
```

### 2. Enhanced Error Handling

**Improved Capabilities**:

- Handles plain text/HTML responses (common in 404s)
- Maps specific HTTP status codes to user-friendly messages
- Detects CORS/network errors and provides actionable hints
- Catches upstream service unavailability (502/503)

**User-Friendly Messages**:

- **404 + NPI not found**: "NPI not found. Please check the number or try a known test NPI."
- **502/503**: "Upstream service unavailable. Try again in a minute."
- **Network errors**: "Network error: frontend cannot reach the API. Check NEXT_PUBLIC_BACKEND_URL and CORS."

### 3. Health Check Function

**Export**: `pingHealth()`

**Purpose**: Optional diagnostics for API connectivity

**Usage**:

```typescript
import { pingHealth } from '@/lib/npi-client';

const isConnected = await pingHealth();
if (!isConnected) {
  console.warn('API health check failed');
}
```

### 4. Improved NPI Lookup

**Added**: Better error handling in `lookupNpi()` function

**Features**:

- Catches network-level errors
- Provides specific error messages for CORS issues
- Validates fetch failures before parsing

---

## Environment Configuration

### Development (Local)

```bash
# .env.local (optional - defaults to same-origin)
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

### Production (Separate Hosts)

```bash
# .env.production
NEXT_PUBLIC_BACKEND_URL=https://api.vitalcv.dev
```

### Vercel Deployment

```bash
# Vercel environment variables
NEXT_PUBLIC_BACKEND_URL=https://api.vitalcv.dev
```

---

## Error Handling Flow

### 1. Network Error Detection

```
User Action → API Call
  ↓
Fetch fails (CORS, network down)
  ↓
Error caught: "Failed to fetch"
  ↓
Message: "Network error: frontend cannot reach the API."
```

### 2. HTTP Error Mapping

```
API returns 404
  ↓
Try parse JSON
  ↓
Check for "not found" message
  ↓
Message: "NPI not found. Check the number."
```

### 3. Service Unavailable

```
API returns 502/503
  ↓
Detect upstream issue
  ↓
Message: "Upstream service unavailable. Try again in a minute."
```

---

## Testing

### Test Network Errors

```bash
# Simulate network failure
# In browser console:
fetch('/api/npi/lookup?npi=1234567890')
  .catch(e => console.log('Expected error:', e));
```

### Test 404 Handling

```bash
curl http://localhost:3000/api/npi/lookup?npi=9999999999
```

### Test CORS Issues

```bash
# Backend doesn't allow origin
curl http://localhost:4000/api/npi/lookup?npi=1234567890 \
  -H "Origin: http://invalid-origin.com"
```

---

## Benefits

### For Developers

✅ **Flexible Configuration**: Works in dev and prod without code changes
✅ **Better Debugging**: Clear error messages point to configuration issues
✅ **Graceful Degradation**: Handles HTML error pages gracefully

### For Users

✅ **Clear Feedback**: Know exactly what went wrong
✅ **Actionable Messages**: "Try again in a minute" vs generic "Error"
✅ **Professional UX**: No raw JSON in error messages

### For Operations

✅ **Easy Deployment**: Just set environment variable
✅ **Quick Troubleshooting**: Health check function available
✅ **CORS Detection**: Immediately identifies connectivity issues

---

## Migration Guide

### From Previous Version

**Old**:

```typescript
const API_BASE = '/api';
```

**New** (automatic):

```typescript
const API_BASE = resolveApiBase() || '/api';
```

**No code changes needed** - works with existing code!

### Setting Up New Environments

1. **Local Development**: No config needed (uses `/api`)
2. **Staging**: Set `NEXT_PUBLIC_BACKEND_URL=https://staging-api.vitalcv.dev`
3. **Production**: Set `NEXT_PUBLIC_BACKEND_URL=https://api.vitalcv.dev`

---

## Compatibility

✅ **Backward Compatible**: All existing code works without changes
✅ **Environment Agnostic**: Works in Vercel, Netlify, self-hosted
✅ **CORS Safe**: Clear errors when CORS is misconfigured

---

## Next Steps

### Recommended Additions

1. **Rate Limiting**: Detect and handle 429 responses
2. **Retry Logic**: Automatic retry for transient failures
3. **Request Caching**: Cache successful NPI lookups
4. **Analytics**: Track error rates by type

### Future Enhancements

- [ ] Offline detection and queuing
- [ ] WebSocket fallback for real-time updates
- [ ] Request timeout configuration
- [ ] Circuit breaker pattern

---

## Troubleshooting

### "Network error: frontend cannot reach API"

**Causes**:

- Backend not running
- Wrong `NEXT_PUBLIC_BACKEND_URL`
- CORS misconfiguration

**Solutions**:

```bash
# Check environment variable
echo $NEXT_PUBLIC_BACKEND_URL

# Test backend directly
curl http://localhost:4000/api/health

# Check CORS headers
curl -H "Origin: http://localhost:3000" http://localhost:4000/api/health
```

### "Upstream service unavailable"

**Meaning**: Backend is running but the service it calls (e.g., NPPES API) is down

**Action**: Wait and retry, or check backend logs

---

**Version**: 1.0
**Last Updated**: October 26, 2025
**Status**: ✅ Production Ready
