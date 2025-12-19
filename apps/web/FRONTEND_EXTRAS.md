# Frontend Extras - VitalCV NPI System

## Overview

Additional frontend components and pages to complete the NPI claim flow experience.

---

## New Files

### 1. `/components/api/http.ts` - HTTP Client Helper

**Purpose**: Centralized API client for all backend requests with error handling.

**Functions**:

- `getJSON<T>(path, init?)` - GET requests with type safety
- `postJSON<T>(path, body, init?)` - POST requests with JSON body

**Usage**:

```tsx
import { getJSON, postJSON } from '@/components/api/http';

const data = await getJSON<ClaimStatus>('/api/claim/status?npi=1234567890');
const result = await postJSON('/api/claim/basic', { npi, email });
```

**Features**:

- Respects `NEXT_PUBLIC_API_BASE` environment variable
- Automatic error handling
- Type-safe responses
- No-cache for fresh data

---

### 2. `/components/status/ClaimStatusBadge.tsx` - Claim Level Display

**Purpose**: Shows current claim verification level (L0-L3) with optional blockchain transaction link.

**Props**:

- `npi: string` - The NPI to fetch status for

**Behavior**:

- Fetches claim status from `/api/claim/status?npi={npi}`
- Shows loading state while fetching
- Displays error state if fetch fails
- Color-coded badges based on level

**Level Colors**:

- ⚪ **L0 Lookup**: Gray - Public record only
- 🔵 **L1 Basic**: Blue - Email verified
- 🟣 **L2 Doc/Live**: Purple - Documents + selfie verified
- 🟢 **L3 Issuer Attested**: Green - On-chain attestation

**Usage**:

```tsx
import ClaimStatusBadge from '@/components/status/ClaimStatusBadge';

<ClaimStatusBadge npi="1234567890" />;
```

**On-chain Link**:

- If `issuerAttestTx` is present, shows clickable "tx" link
- Links to `#onchain:{tx-hash}` (placeholder in demo)

---

### 3. `/app/start/page.tsx` - NPI Entry Page

**Purpose**: Primary entry point for users to begin the claim process.

**Features**:

- Clean, centered UI with 10-digit NPI input
- Real-time validation (numeric only, max 10 digits)
- Redirects to `/npi/[npi]?auto=1` on submit
- Auto-opens claim wizard pane via `?auto=1` parameter
- Informative help text explaining claim process

**User Flow**:

1. User enters 10-digit NPI
2. Validation ensures correct format
3. Click "Continue" button
4. Redirects to NPI profile page
5. Claim wizard pane opens automatically

**Validation**:

- Only allows numeric input
- Max 10 digits
- Shows error for invalid format

---

## Modified Files

### `/components/NpiPublicCard.tsx`

**Changes**:

- Added import for `ClaimStatusBadge`
- Integrated badge below NPI number in header
- Badge appears in all NPI profile views

**Location**: Between NPI number and Type badge

**Visual**:

```text
Dr. Jane Smith
NPI: 1234567890
[L1 Basic] <- NEW!
```

---

## API Endpoints Used

### GET `/api/claim/status`

**Query Params**:

- `npi: string` - 10-digit NPI

**Response**:

```typescript
{
  npi: string;
  level: 0 | 1 | 2 | 3;
  issuerAttestTx: string | null;
  lastVerifiedAt: string | null;
}
```

**Status Codes**:

- 200: Success
- 404: NPI not found
- 500: Server error

---

## User Journey

### Complete Flow

1. **Entry** (`/start`)

   - User enters NPI
   - System validates format

2. **Profile** (`/npi/[npi]?auto=1`)

   - Displays public NPPES data
   - Shows current claim status badge
   - Opens claim wizard pane automatically

3. **Claim Wizard** (sliding pane)

   - **Step 1**: Email verification (L1)
   - **Step 2**: Document upload (L2)
   - **Step 3**: Attestation request (L3)

4. **Status Updates**
   - Badge updates live after each claim level completion
   - User can see progress at any time

---

## Environment Variables

```bash
# .env.local

# Optional: Set if backend runs on different host
NEXT_PUBLIC_API_BASE=http://localhost:4000

# Leave unset if Next.js API routes handle backend
# (default: relative paths)
```

---

## Testing

### Quick Test Flow

```bash
# 1. Start dev server
npm run dev

# 2. Navigate to start page
open http://localhost:3000/start

# 3. Enter test NPI
1801921148

# 4. Click Continue
# → Should redirect to /npi/1801921148?auto=1
# → Claim wizard should open in sliding pane
# → Status badge should show L0

# 5. Complete claim steps
# → Badge updates to L1, L2, L3 as you progress
```

### Test NPIs (real from NPPES)

- `1801921148` - Individual physician
- `1538102066` - Nurse practitioner
- `1043233337` - Hospital (Type 2)

---

## UI/UX Highlights

### Start Page

- **Mobile-first**: Centered, responsive design
- **Validation**: Real-time feedback
- **Accessibility**: Proper input modes and patterns

### Status Badge

- **Progressive enhancement**: Shows loading state
- **Error handling**: Graceful failure display
- **Color semantics**: Intuitive level visualization
- **Dark mode**: Automatic theme adaptation

### Integration

- **Seamless**: Badge appears in context
- **Non-intrusive**: Doesn't disrupt layout
- **Informative**: Clear level names

---

## File Structure

```text
apps/web/
├── app/
│   └── start/
│       └── page.tsx                      # NEW: NPI entry page
├── components/
│   ├── api/
│   │   └── http.ts                       # NEW: HTTP client helper
│   ├── status/
│   │   └── ClaimStatusBadge.tsx          # NEW: Claim level badge
│   └── NpiPublicCard.tsx                 # MODIFIED: Added badge
```

---

## Next Steps

With these additions, the frontend now has:

- ✅ Complete entry flow
- ✅ Live claim status display
- ✅ Type-safe API client
- ✅ Consistent error handling
- ✅ Mobile-friendly UI

**Ready for backend integration** when you add:

- Real `/api/claim/status` endpoint
- Database persistence for claim levels
- Blockchain transaction tracking

---

**Created**: October 24, 2025
**Version**: 2.1 - Frontend Extras
**Status**: ✅ Complete
