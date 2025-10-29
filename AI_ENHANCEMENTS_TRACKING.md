# AI-Enhanced Features - Tracking Document

## Overview

New enhancement tasks for AI link inference, autocomplete, analytics, and testing.

**Created**: October 26, 2025
**Status**: 🟢 Active Development

---

## Tasks List

| #   | Task                                        | Priority | Size | Status  |
| --- | ------------------------------------------- | -------- | ---- | ------- |
| 1   | LinkInspector panel + hook                  | 🟡 P1    | 🟨 M | ⬜ Todo |
| 2   | Graph toggle: AI edges                      | 🟡 P1    | 🟨 M | ⬜ Todo |
| 3   | NPI autosuggest on /start                   | 🟡 P1    | 🟨 M | ⬜ Todo |
| 4   | ClaimStatusBadge transitions + L3 highlight | 🟢 P2    | 🟦 S | ⬜ Todo |
| 5   | Multipart upload in ClaimWizard             | 🟡 P1    | 🟨 M | ⬜ Todo |
| 6   | Sidebar role filter + active animation      | 🟢 P2    | 🟦 S | ⬜ Todo |
| 7   | /analytics mini dashboard                   | 🟡 P1    | 🟨 M | ⬜ Todo |
| 8   | Playwright smoke tests                      | 🔴 P0    | 🟨 M | ⬜ Todo |

---

## Task 1: LinkInspector Panel + Hook

**Description**: Create AI link inference component that fetches and displays inferred connections.

**Components to Create**:

1. `src/components/ai/LinkInspector.tsx` - Displays linked entities with scores
2. `src/hooks/useLocalLinkUpdate.ts` - Polls for recent link updates

**API Integration**:

- `GET /api/links?entity=:id` - Fetch links for an entity
- `GET /api/links/recent` - Recent link updates (poll every 15s)

**Features**:

- Render `targetName` + `score%` for each link
- Callback on updates: `[{sourceId, targetId, score}]`
- Wire into credential detail pane or ClaimWizard success step

**Status**: ⬜ Todo

---

## Task 2: Graph Toggle - AI Edges

**Description**: Add AI-inferred link visualization to force-directed graph.

**Location**: `components/graph/VitalGraph.tsx`

**Features**:

- Toggle button: "Show AI links"
- When enabled + node selected: Fetch `/api/links?entity=:id`
- Render dashed, tinted edges for AI links
- Debounce fetch to 400ms
- Tooltip shows: `{label} + {score}%`

**Implementation**:

```tsx
const [showAILinks, setShowAILinks] = useState(false);
const [aiLinks, setAILinks] = useState<Link[]>([]);

// When node selected and toggle enabled
useEffect(() => {
  if (showAILinks && selectedNode) {
    const timer = setTimeout(() => {
      fetchAILinks(selectedNode.id);
    }, 400);
    return () => clearTimeout(timer);
  }
}, [showAILinks, selectedNode]);

// Render dashed edges
{
  aiLinks.map((link) => (
    <motion.line
      strokeDasharray="5,5"
      stroke={getLinkColor(link.score)}
      opacity={0.6}
      d={linkPath}
    />
  ));
}
```

**Status**: ⬜ Todo

---

## Task 3: NPI Autosuggest on /start

**Description**: Add real-time NPI lookup suggestions as user types.

**Location**: `app/start/page.tsx`

**Features**:

- After 3+ digits typed, call `/api/npi/lookup` (QPS safe)
- Show dropdown with: NPI, name, taxonomy
- Enter/Click navigates to `/npi/:npi?auto=1`
- Handle 429/5xx with silent fallback

**Implementation**:

```tsx
const [suggestions, setSuggestions] = useState([]);
const debouncedSearch = useDebounce(npi, 400);

useEffect(() => {
  if (debouncedSearch.length >= 3) {
    fetch(`/api/npi/lookup?npi=${debouncedSearch}&suggest=true`)
      .then((r) => r.json())
      .then((data) => setSuggestions(data.results))
      .catch(() => {}); // Silent fallback
  }
}, [debouncedSearch]);
```

**Status**: ⬜ Todo

---

## Task 4: ClaimStatusBadge Transitions + L3 Highlight

**Description**: Enhance badge with smooth transitions and celebration animation.

**Location**: `components/status/ClaimStatusBadge.tsx`

**Features**:

- Add `transition-colors duration-300` for level changes
- When level becomes L3, show pulse ring (2-3 pulses)
- Respect `prefers-reduced-motion`
- Clickable badge links to on-chain tx if `issuerAttestTx` present

**Implementation**:

```tsx
<AnimatePresence>
  {status.level === 3 && (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 0.5, repeat: 2 }}
      className="absolute inset-0 rounded-full ring-2 ring-emerald-500"
      style={{ animation: 'pulse 2s ease-in-out' }}
    />
  )}
</AnimatePresence>

<a href={status.issuerAttestTx ? `#onchain:${status.issuerAttestTx}` : undefined}>
  <span className="inline-flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors duration-300">
    {levels[status.level]}
  </span>
</a>
```

**Status**: ⬜ Todo

---

## Task 5: Multipart Upload in ClaimWizard

**Description**: Switch Step 2 to use FormData for real file uploads.

**Location**: `components/claim/ClaimWizardPane.tsx`

**Current**: JSON fallback
**Target**: FormData to `/api/claim/doc-multipart`

**Features**:

- Create FormData with `license` and `selfie` files
- POST to `/api/claim/doc-multipart` if available
- Fallback to JSON `/api/claim/doc` if multipart fails
- Show file names + fake progress (0-100%)

**Implementation**:

```tsx
const formData = new FormData();
formData.append('npi', npi);
formData.append('userId', userId);
formData.append('license', licenseFile);
formData.append('selfie', selfieFile);

// Try multipart first
try {
  await fetch('/api/claim/doc', { method: 'POST', body: formData });
} catch {
  // Fallback to JSON
  await postJSON('/api/claim/doc', { npi, userId });
}
```

**Status**: ⬜ Todo

---

## Task 6: Sidebar Role Filter + Active Animation

**Description**: Make sidebar respond to role changes with smooth animations.

**Features**:

- Hide/show nav items based on `useRole()` context
- Add Framer Motion active highlight with `layoutId='activeTab'`
- Keep mobile drawer behavior intact

**Status**: ⬜ Todo

---

## Task 7: /analytics Mini Dashboard

**Description**: Create analytics page with issuance and verification charts.

**Location**: `app/analytics/page.tsx`

**Features**:

- Card 1: Issuances last 7 days (bar or area chart)
- Card 2: Verifications by outcome (pie chart)
- Fetch from backend `/api/analytics` (mock JSON acceptable)
- Dark mode support

**Charts Library**: Recharts or Chart.js

**Status**: ⬜ Todo

---

## Task 8: Playwright Smoke Tests

**Description**: Add E2E tests for critical user flows.

**Test Cases**:

1. `/start → type NPI, select suggestion → lands on /npi/:npi`
2. Open Claim Wizard, complete L1 (mock OTP) → level=1
3. Graph page renders at least 3 nodes
4. Sidebar mobile toggle works

**Commands**:

```bash
npm i -D @playwright/test
npx playwright install
```

**Status**: ⬜ Todo

---

## Implementation Order

### Sprint 1 (Week 1)

1. ✅ Task 8: Playwright smoke tests (Critical)
2. ✅ Task 4: ClaimStatusBadge transitions (Quick win)
3. ✅ Task 5: Multipart upload (High impact)

### Sprint 2 (Week 2)

4. ✅ Task 3: NPI autosuggest (User delight)
5. ✅ Task 1: LinkInspector (New feature)
6. ✅ Task 2: Graph AI edges (Enhancement)

### Sprint 3 (Week 3)

7. ✅ Task 6: Sidebar role filter (UX polish)
8. ✅ Task 7: Analytics dashboard (Data insights)

---

## Dependencies

### New Packages Needed

```bash
# E2E Testing
npm i -D @playwright/test

# Charts
npm i recharts
# or
npm i chart.js react-chartjs-2

# Hooks
npm i use-debounce
```

### Backend APIs Required

- `/api/links?entity=:id` - Fetch AI links
- `/api/links/recent` - Poll for updates
- `/api/npi/lookup?npi=:id&suggest=true` - Autosuggest
- `/api/analytics` - Dashboard data

---

## Success Metrics

### Task 1-2: AI Links

- [ ] LinkInspector shows >5 suggested links
- [ ] Graph AI edges render correctly
- [ ] User can toggle AI links on/off
- [ ] Tooltips show score%

### Task 3: Autosuggest

- [ ] Dropdown appears after 3 digits
- [ ] Suggestions are relevant
- [ ] No 429 errors
- [ ] Click navigates correctly

### Task 4: Badge Enhancements

- [ ] Smooth color transitions
- [ ] L3 pulse animation plays
- [ ] Respects reduced motion
- [ ] Links to tx hash

### Task 5: Multipart Upload

- [ ] Files upload successfully
- [ ] Progress shows
- [ ] Fallback works
- [ ] Backend receives files

### Task 7: Analytics

- [ ] Charts load data
- [ ] Dark mode works
- [ ] Metrics update live
- [ ] Mobile responsive

### Task 8: Tests

- [ ] All 4 scenarios pass
- [ ] Zero flaky tests
- [ ] CI integration ready

---

## Notes

- All tasks are additive (no breaking changes)
- Backend APIs can be mocked initially
- Dark mode support required for all UI
- Mobile-first responsive design
- Accessibility compliance (WCAG AA)

---

**Progress**: 0/8 (0%)
**Sprint 1**: Oct 28 - Nov 3, 2025
**Sprint 2**: Nov 4 - Nov 10, 2025
**Sprint 3**: Nov 11 - Nov 17, 2025
