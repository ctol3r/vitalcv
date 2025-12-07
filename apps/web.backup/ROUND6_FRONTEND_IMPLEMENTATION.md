# Round 6 Frontend Implementation
**Date:** November 3, 2025
**Status:** ✅ Complete

## New Pages

### 1. `/verify/physician` - Physician Instant Verify
**File:** `app/verify/physician/page.tsx`

**Features:**
- Input: State code (e.g., "CA") + License file ID
- Calls backend `/solve` with task: "physician instant verify"
- Scope hints: `['global', 'domain:physician']`
- Displays full agent response (traceId, used tools, picks)

**Usage:**
```typescript
POST /api/agent/solve
{
  "task": "physician instant verify",
  "input": {
    "state": "CA",
    "licensePdfId": "file_demo"
  },
  "scopeHints": ["global", "domain:physician"]
}
```

### 2. `/metrics` - Metrics Dashboard
**File:** `app/metrics/page.tsx`

**Features:**
- Fetches `/metrics` endpoint on mount
- Displays Prometheus-style metrics in plain text
- Shows agent success rate, total runs

---

## New Components

### 1. SelectiveDisclosureCard
**File:** `app/components/SelectiveDisclosureCard.tsx`

**Features:**
- Interactive SD-JWT demo
- Textarea for claims input (JSON)
- Three-step flow:
  1. **Issue** - POST to `/crypto/sdjwt/issue`
  2. **Present** - POST to `/crypto/sdjwt/present` with selective fields
  3. **Verify** - POST to `/crypto/sdjwt/verify`
- Displays JSON at each step

**Integration:**
- Added to `/agent` page below SloMini

### 2. AnchorsPanel
**File:** `app/components/AnchorsPanel.tsx`

**Features:**
- Fetches `/audit-chain/anchors` on mount
- Displays Merkle roots + recent audit events
- Shows loading state while fetching

**Integration:**
- Added to `/agent` page below SelectiveDisclosureCard

---

## Modified Pages

### `/agent` - Agent Console
**File:** `app/agent/page.tsx`

**Changes:**
- Imported `AnchorsPanel` and `SelectiveDisclosureCard`
- Added new section with both components:
  ```tsx
  <div className="mt-6 space-y-4">
    <SelectiveDisclosureCard />
    <AnchorsPanel />
  </div>
  ```

---

## Environment Variables

**Required:** `NEXT_PUBLIC_AGENT_BASE`

Example:
```bash
NEXT_PUBLIC_AGENT_BASE=http://localhost:4000/api/agent
```

Used in:
- `app/verify/physician/page.tsx` - for `/solve` endpoint
- `app/components/SelectiveDisclosureCard.tsx` - for crypto endpoints
- `app/components/AnchorsPanel.tsx` - for audit-chain endpoints

---

## API Endpoints Used

### Selective Disclosure
- `POST ${NEXT_PUBLIC_AGENT_BASE}/crypto/sdjwt/issue`
- `POST ${NEXT_PUBLIC_AGENT_BASE}/crypto/sdjwt/present`
- `POST ${NEXT_PUBLIC_AGENT_BASE}/crypto/sdjwt/verify`

### Audit Chain
- `GET ${NEXT_PUBLIC_AGENT_BASE}/audit-chain/anchors`

### Agent
- `POST ${NEXT_PUBLIC_AGENT_BASE}/solve`

### Metrics
- `GET /metrics` (proxied to backend)

---

## Testing

### 1. Physician Instant Verify
1. Navigate to `http://localhost:3000/verify/physician`
2. Enter state code (e.g., "CA")
3. Enter license file ID (e.g., "file_demo")
4. Click "Verify"
5. Verify JSON response shows `traceId`, `used`, `picks`

### 2. Selective Disclosure
1. Navigate to `http://localhost:3000/agent`
2. Scroll to "Selective Disclosure (SD-JWT)" card
3. Modify claims JSON if desired
4. Click "Issue" → verify SD-JWT appears
5. Click "Present name only" → verify presentation appears
6. Click "Verify" → verify `ok: true` and `selective_fields`

### 3. Audit Anchors
1. Navigate to `http://localhost:3000/agent`
2. Scroll to "Audit Anchors" panel
3. Verify roots and events are displayed

### 4. Metrics
1. Navigate to `http://localhost:3000/metrics`
2. Verify metrics are displayed in plain text format
3. Example:
   ```
   agent_success_total 42
   agent_runs_total 58
   ```

---

## File Manifest

```
app/
├── verify/
│   └── physician/
│       └── page.tsx                 ✨ NEW
├── components/
│   ├── SelectiveDisclosureCard.tsx  ✨ NEW
│   └── AnchorsPanel.tsx             ✨ NEW
├── metrics/
│   └── page.tsx                     ✨ NEW
└── agent/
    └── page.tsx                     📝 MODIFIED
```

---

## Styling

All components use Tailwind CSS classes:
- `border`, `rounded` - card styling
- `p-2`, `p-3`, `p-4` - padding
- `bg-gray-50` - light background for code/data display
- `text-[10px]`, `text-xs` - small font for JSON
- `overflow-auto` - scrollable pre blocks
- `space-y-4` - vertical spacing between components

---

## Future Enhancements

1. **Error Handling**
   - Add try/catch blocks with user-friendly error messages
   - Display loading states during API calls

2. **BBS+ Card**
   - Create parallel component for BBS+ signatures
   - Same three-step flow as SD-JWT

3. **Physician Verify Enhancements**
   - File upload widget for license PDFs
   - State dropdown (all 50 US states)
   - Display parsed license data in structured format

4. **Metrics Dashboard**
   - Add charts (success rate over time)
   - Per-MCP breakdown
   - Latency histograms

5. **Anchors Panel**
   - Real-time updates via WebSocket
   - Click to explore full audit trail
   - Export audit log

---

## Completion Status

✅ All pages created
✅ All components created
✅ Integration into `/agent` page complete
✅ No linter errors
✅ Environment variables documented

**Status:** Ready for pilot testing 🚀
