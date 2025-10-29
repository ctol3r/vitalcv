# VitalCV Frontend Roadmap - 100 Features

## Overview

Comprehensive feature backlog for enhancing the VitalCV NPI claim and verification system. Organized by category with priority ratings and estimated complexity.

**Legend**:

- 🔴 **P0**: Critical - Core functionality
- 🟡 **P1**: High - Major UX improvements
- 🟢 **P2**: Medium - Nice to have
- ⚪ **P3**: Low - Future enhancements

**Complexity**:

- 🟦 **S**: Small (1-2 days)
- 🟨 **M**: Medium (3-5 days)
- 🟥 **L**: Large (1-2 weeks)
- 🟪 **XL**: Extra Large (2+ weeks)

---

## Phase 1: Foundation & Quick Wins (Q1 2026)

### A. Onboarding & Guidance

| #   | Task                                                                | Priority | Size | Status  |
| --- | ------------------------------------------------------------------- | -------- | ---- | ------- |
| 1   | Add 60-sec "First-Run" guided tour overlay (Start → NPI → Claim)    | 🟡 P1    | 🟨 M | ⬜ Todo |
| 2   | Build persistent "Help" beacon with contextual docs pane            | 🟡 P1    | 🟦 S | ⬜ Todo |
| 3   | Add inline micro-tutorials for each Claim step (expandable ? pills) | 🟢 P2    | 🟦 S | ⬜ Todo |
| 4   | Implement "Try with Sample NPI" demo mode (auto-fills sandbox data) | 🟡 P1    | 🟦 S | ⬜ Todo |
| 5   | Add "What's this?" explainer for L0/L1/L2/L3 badges                 | 🟡 P1    | 🟦 S | ⬜ Todo |
| 6   | Create "Learn more about NPIs" sheet with NPPES links               | 🟢 P2    | 🟦 S | ⬜ Todo |
| 7   | Add "Report incorrect NPI record" link with form + screenshot       | 🟢 P2    | 🟨 M | ⬜ Todo |
| 8   | Build "Resend OTP" UX with cooldown, progress ring, SMS fallback    | 🟡 P1    | 🟨 M | ⬜ Todo |
| 9   | Design "Resume where you left off" bar (wizard step memory)         | 🟡 P1    | 🟨 M | ⬜ Todo |
| 10  | Add onboarding checklist card on dashboard with completion %        | 🟢 P2    | 🟦 S | ⬜ Todo |

### C. Accessibility Deep Dive

| #   | Task                                                       | Priority | Size | Status  |
| --- | ---------------------------------------------------------- | -------- | ---- | ------- |
| 16  | Full keyboard trap auditing across all panes and modals    | 🔴 P0    | 🟨 M | ⬜ Todo |
| 17  | Add prefers-reduced-transparency variants (remove blur)    | 🟡 P1    | 🟦 S | ⬜ Todo |
| 18  | Improve color contrast in badges and buttons (WCAG AA+)    | 🔴 P0    | 🟦 S | ⬜ Todo |
| 19  | Add skip-to-main shortcut and landmark roles for all pages | 🔴 P0    | 🟦 S | ⬜ Todo |
| 20  | VoiceOver/JAWS pass on QR scanner and Graph controls       | 🟡 P1    | 🟨 M | ⬜ Todo |

### D. Form & Validation System

| #   | Task                                                           | Priority | Size | Status  |
| --- | -------------------------------------------------------------- | -------- | ---- | ------- |
| 21  | Centralize validation using zod-resolver + react-hook-form     | 🟡 P1    | 🟨 M | ⬜ Todo |
| 22  | Add input masks for phone, license numbers (state-aware)       | 🟡 P1    | 🟨 M | ⬜ Todo |
| 23  | Provide inline "confidence" chips after OCR parse preview      | 🟢 P2    | 🟦 S | ⬜ Todo |
| 24  | Add dropzone for multi-page PDF with page thumbnails + reorder | 🟢 P2    | 🟨 M | ⬜ Todo |
| 25  | Provide error banners with "copy error ID" for support         | 🟡 P1    | 🟦 S | ⬜ Todo |

### M. Performance

| #   | Task                                                 | Priority | Size | Status  |
| --- | ---------------------------------------------------- | -------- | ---- | ------- |
| 66  | Preload frequently used routes (NPI→Claim)           | 🟡 P1    | 🟦 S | ⬜ Todo |
| 67  | Dynamic import & suspense boundaries for heavy panes | 🟡 P1    | 🟨 M | ⬜ Todo |
| 68  | Use React cache for ClaimStatusBadge (short TTL)     | 🟢 P2    | 🟦 S | ⬜ Todo |
| 69  | Defer non-critical analytics until idle              | 🟢 P2    | 🟦 S | ⬜ Todo |
| 70  | Optimize QR scanner canvas & worker-offload scanning | 🟢 P2    | 🟨 M | ⬜ Todo |

---

## Phase 2: Enhanced UX (Q2 2026)

### B. Internationalization & Copy

| #   | Task                                                       | Priority | Size | Status  |
| --- | ---------------------------------------------------------- | -------- | ---- | ------- |
| 11  | Wire i18n scaffold (en → es placeholders) for core pages   | 🟢 P2    | 🟨 M | ⬜ Todo |
| 12  | Add locale switcher chip next to ThemePicker               | 🟢 P2    | 🟦 S | ⬜ Todo |
| 13  | Extract all validation/error copy into i18n messages       | 🟢 P2    | 🟦 S | ⬜ Todo |
| 14  | Add RTL support styles (testing with Arabic pseudo-locale) | 🟢 P2    | 🟨 M | ⬜ Todo |
| 15  | Provide "Plain English" mode toggle (simplify jargon)      | 🟢 P2    | 🟦 S | ⬜ Todo |

### E. Files & Media

| #   | Task                                                            | Priority | Size | Status  |
| --- | --------------------------------------------------------------- | -------- | ---- | ------- |
| 26  | Client-side EXIF strip (privacy) before upload (web-worker)     | 🟡 P1    | 🟨 M | ⬜ Todo |
| 27  | Add selfie capture with face guide overlay and brightness hints | 🟡 P1    | 🟥 L | ⬜ Todo |
| 28  | Provide fallback to manual form entry when camera denied        | 🟡 P1    | 🟦 S | ⬜ Todo |
| 29  | Chunked upload stream (Resumable.js or tus) for poor networks   | 🟢 P2    | 🟥 L | ⬜ Todo |
| 30  | Preview liveness video frames (last 5 frames) before submit     | 🟢 P2    | 🟨 M | ⬜ Todo |

### F. Wallet Enhancements

| #   | Task                                                         | Priority | Size | Status  |
| --- | ------------------------------------------------------------ | -------- | ---- | ------- |
| 31  | Add "pin to top" for favorite credentials                    | 🟢 P2    | 🟦 S | ⬜ Todo |
| 32  | Group credentials by issuer; expandable accordions           | 🟡 P1    | 🟨 M | ⬜ Todo |
| 33  | Provide version history badge if credential is re-issued     | 🟢 P2    | 🟨 M | ⬜ Todo |
| 34  | "Compare revisions" diff view for re-issued credentials      | 🟢 P2    | 🟨 M | ⬜ Todo |
| 35  | One-click "share read-only link" with expiring token preview | 🟡 P1    | 🟨 M | ⬜ Todo |

### L. Theme & Settings

| #   | Task                                                 | Priority | Size | Status  |
| --- | ---------------------------------------------------- | -------- | ---- | ------- |
| 61  | Create "Clinical", "Slate", "Emerald" palettes       | 🟢 P2    | 🟦 S | ⬜ Todo |
| 62  | Add font switcher: Inter / System / Nunito (preload) | 🟢 P2    | 🟦 S | ⬜ Todo |
| 63  | Settings page: motion/transparency/graph defaults    | 🟡 P1    | 🟨 M | ⬜ Todo |
| 64  | Dark-mode optimized QR colors (contrast safe)        | 🟡 P1    | 🟦 S | ⬜ Todo |
| 65  | Add favicon theme variants (light/dark)              | 🟢 P2    | 🟦 S | ⬜ Todo |

---

## Phase 3: Power User Features (Q3 2026)

### G. Verifier UX Add-Ons

| #   | Task                                                        | Priority | Size | Status  |
| --- | ----------------------------------------------------------- | -------- | ---- | ------- |
| 36  | Add "scan from gallery" (upload QR screenshot)              | 🟡 P1    | 🟨 M | ⬜ Todo |
| 37  | Auto-zoom focus rectangle for QR (better mobile UX)         | 🟡 P1    | 🟨 M | ⬜ Todo |
| 38  | Verifier result: plain-language explanation (why pass/fail) | 🟡 P1    | 🟦 S | ⬜ Todo |
| 39  | Provide "Save this verification" bookmark list              | 🟢 P2    | 🟨 M | ⬜ Todo |
| 40  | Batch verify: upload CSV of links, show table of pass/fail  | 🟢 P2    | 🟥 L | ⬜ Todo |

### H. Issuer Portal Power-Tools

| #   | Task                                                            | Priority | Size | Status  |
| --- | --------------------------------------------------------------- | -------- | ---- | ------- |
| 41  | Template builder UI (JSON inputs → preview VC card)             | 🟢 P2    | 🟥 L | ⬜ Todo |
| 42  | Add "pre-validate CSV" step with download of error report       | 🟡 P1    | 🟨 M | ⬜ Todo |
| 43  | Bulk revoke modal with multi-select and templated reasons       | 🟡 P1    | 🟨 M | ⬜ Todo |
| 44  | Job queue page showing "in progress / completed / failed"       | 🟡 P1    | 🟨 M | ⬜ Todo |
| 45  | Issuer dashboard charts (last 30 days: issued/revoked/attested) | 🟢 P2    | 🟨 M | ⬜ Todo |

### I. Admin & Registry Frontend

| #   | Task                                                             | Priority | Size | Status  |
| --- | ---------------------------------------------------------------- | -------- | ---- | ------- |
| 46  | Add "Invite issuer" flow (email + domain proof instructions)     | 🟡 P1    | 🟨 M | ⬜ Todo |
| 47  | Trust Registry search with fuzzy match and quick actions         | 🟡 P1    | 🟨 M | ⬜ Todo |
| 48  | Governance proposals: "view details" pane with timeline/comments | 🟢 P2    | 🟥 L | ⬜ Todo |
| 49  | Network health widget (Substrate node status, block time)        | 🟢 P2    | 🟨 M | ⬜ Todo |
| 50  | API key management UI (create/rotate/revoke) for org automations | 🟡 P1    | 🟨 M | ⬜ Todo |

### J. Graph: Advanced

| #   | Task                                                  | Priority | Size | Status  |
| --- | ----------------------------------------------------- | -------- | ---- | ------- |
| 51  | Node clustering toggle (group by org / type)          | 🟢 P2    | 🟨 M | ⬜ Todo |
| 52  | Node pinning (drag + lock) and "reset pinned" action  | 🟢 P2    | 🟨 M | ⬜ Todo |
| 53  | Export graph to JSON and import to restore layout     | 🟢 P2    | 🟦 S | ⬜ Todo |
| 54  | Graph mini-map in bottom-right corner                 | 🟢 P2    | 🟨 M | ⬜ Todo |
| 55  | "Highlight path" between two nodes (holder ↔ issuer)  | 🟢 P2    | 🟨 M | ⬜ Todo |
| 56  | Filter by claim level (only show L2+ holders)         | 🟡 P1    | 🟦 S | ⬜ Todo |
| 57  | Heatmap coloring by verification frequency            | 🟢 P2    | 🟨 M | ⬜ Todo |
| 58  | Toggle link arrows for directionality                 | 🟢 P2    | 🟦 S | ⬜ Todo |
| 59  | Snapshot & share graph state as link                  | 🟢 P2    | 🟨 M | ⬜ Todo |
| 60  | Profile panes when clicking nodes (open sliding pane) | 🟡 P1    | 🟨 M | ⬜ Todo |

---

## Phase 4: Production Hardening (Q4 2026)

### K. Timeline: Advanced

| #   | Task                                                         | Priority | Size | Status  |
| --- | ------------------------------------------------------------ | -------- | ---- | ------- |
| 61  | Support multiple milestones per ring with auto-angle spacing | 🟢 P2    | 🟨 M | ⬜ Todo |
| 62  | Add "today" indicator and now-line animation                 | 🟢 P2    | 🟦 S | ⬜ Todo |
| 63  | Toggle radial vs vertical layout; remember preference        | 🟢 P2    | 🟨 M | ⬜ Todo |
| 64  | Export timeline as SVG/PNG with brand colors                 | 🟢 P2    | 🟨 M | ⬜ Todo |
| 65  | Add "Decision markers" (green/red diamonds) for go/no-go     | 🟢 P2    | 🟦 S | ⬜ Todo |

### N. Security & Privacy UI

| #   | Task                                                           | Priority | Size | Status  |
| --- | -------------------------------------------------------------- | -------- | ---- | ------- |
| 71  | "Privacy Mode" toggle: blur PII until hover/focus              | 🟡 P1    | 🟨 M | ⬜ Todo |
| 72  | Session timeout banner with "extend session" CTA               | 🟡 P1    | 🟦 S | ⬜ Todo |
| 73  | Explain data retention on upload step                          | 🟡 P1    | 🟦 S | ⬜ Todo |
| 74  | Client-side redaction preview (black-bar effect) before submit | 🟢 P2    | 🟨 M | ⬜ Todo |
| 75  | Add "download my data" request pane (export triggers backend)  | 🟡 P1    | 🟨 M | ⬜ Todo |

### O. Notifications

| #   | Task                                                  | Priority | Size | Status  |
| --- | ----------------------------------------------------- | -------- | ---- | ------- |
| 76  | In-app toasts → inbox sidebar panel (activity feed)   | 🟡 P1    | 🟥 L | ⬜ Todo |
| 77  | Subscribe to claim status updates (SSE/WebSocket)     | 🟡 P1    | 🟥 L | ⬜ Todo |
| 78  | Desktop notifications prompt (with settings)          | 🟢 P2    | 🟦 S | ⬜ Todo |
| 79  | Email template previews (for OTP/attestation updates) | 🟢 P2    | 🟨 M | ⬜ Todo |
| 80  | "All caught up" empty state confetti                  | ⚪ P3    | 🟦 S | ⬜ Todo |

### P. PWA & Offline++

| #   | Task                                                     | Priority | Size | Status  |
| --- | -------------------------------------------------------- | -------- | ---- | ------- |
| 81  | Add background sync for queued uploads                   | 🟢 P2    | 🟥 L | ⬜ Todo |
| 82  | Show cached graph snapshot when offline                  | 🟢 P2    | 🟨 M | ⬜ Todo |
| 83  | "Work offline" banner with local persistence (IndexedDB) | 🟢 P2    | 🟨 M | ⬜ Todo |
| 84  | Clear cache & reset app data button in Settings          | 🟢 P2    | 🟦 S | ⬜ Todo |
| 85  | Offline docs page (FAQ + steps)                          | 🟢 P2    | 🟦 S | ⬜ Todo |

---

## Phase 5: Testing & Quality (Ongoing)

### Q. Testing & QA

| #   | Task                                                     | Priority | Size | Status  |
| --- | -------------------------------------------------------- | -------- | ---- | ------- |
| 86  | Playwright scenario: slow 3G, retry flows, file uploads  | 🟡 P1    | 🟨 M | ⬜ Todo |
| 87  | Visual a11y snapshots in dark mode                       | 🟡 P1    | 🟦 S | ⬜ Todo |
| 88  | Unit tests for graph controls + search/focus             | 🟡 P1    | 🟨 M | ⬜ Todo |
| 89  | Snapshot tests for ClaimStatusBadge states               | 🟡 P1    | 🟦 S | ⬜ Todo |
| 90  | Lighthouse CI config per PR                              | 🟡 P1    | 🟦 S | ⬜ Todo |
| 91  | Replay test runner for common UI failures (jest-retries) | 🟢 P2    | 🟨 M | ⬜ Todo |
| 92  | Storybook accessibility addon pass on key components     | 🟡 P1    | 🟨 M | ⬜ Todo |
| 93  | Anti-flakiness: stabilize animation timers in tests      | 🟡 P1    | 🟦 S | ⬜ Todo |
| 94  | E2E test: CSV bulk verify overview                       | 🟢 P2    | 🟨 M | ⬜ Todo |
| 95  | Smoke test: first-run tour doesn't trap keyboard         | 🟡 P1    | 🟦 S | ⬜ Todo |

---

## Quick Wins (High Impact, Low Effort)

Prioritize these for immediate user value:

### Top 10 Quick Wins

1. ✅ **Add "What's this?" explainer for L0/L1/L2/L3 badges** (Task #5)

   - Impact: Reduces confusion, improves onboarding
   - Effort: 1 day - Simple popover with 4 level descriptions

2. ✅ **Implement "Try with Sample NPI" demo mode** (Task #4)

   - Impact: Instant user engagement, safe testing
   - Effort: 1 day - Button that auto-fills known test NPI

3. ✅ **Build persistent "Help" beacon** (Task #2)

   - Impact: Always-accessible support
   - Effort: 1 day - Floating button + docs pane

4. ✅ **Add "Resend OTP" UX with cooldown** (Task #8)

   - Impact: Reduces support tickets
   - Effort: 2 days - Timer + SMS fallback prompt

5. ✅ **Improve color contrast in badges** (Task #18)

   - Impact: Accessibility compliance
   - Effort: 0.5 day - Tailwind color adjustments

6. ✅ **Add skip-to-main shortcut** (Task #19)

   - Impact: Keyboard user delight
   - Effort: 0.5 day - Hidden link + focus management

7. ✅ **Provide error banners with "copy error ID"** (Task #25)

   - Impact: Better support communication
   - Effort: 1 day - Error boundary enhancement

8. ✅ **Preload frequently used routes** (Task #66)

   - Impact: Perceived performance boost
   - Effort: 0.5 day - Next.js prefetch links

9. ✅ **Defer non-critical analytics** (Task #69)

   - Impact: Faster initial load
   - Effort: 0.5 day - requestIdleCallback wrapper

10. ✅ **Dark-mode optimized QR colors** (Task #64)
    - Impact: Better mobile experience
    - Effort: 1 day - Canvas color inversion logic

**Total Effort**: ~9 days
**Total Impact**: 🚀 High

---

## Technology Stack Additions

### New Dependencies Required

```bash
# Onboarding
npm i @reactour/tour
npm i driver.js

# Forms & Validation
npm i react-hook-form zod @hookform/resolvers
npm i react-input-mask

# File Handling
npm i exifreader
npm i resumablejs
npm i react-dropzone

# Internationalization
npm i next-intl
npm i i18next react-i18next

# PWA & Offline
npm i workbox-window
npm i idb

# Testing
npm i -D @playwright/test
npm i -D @storybook/addon-a11y
npm i -D lighthouse

# Notifications
npm i react-hot-toast
npm i socket.io-client

# Graph Enhancements
npm i react-force-graph-3d  # optional 3D view
```

---

## Implementation Phases Summary

| Phase       | Duration | Focus                   | Tasks    |
| ----------- | -------- | ----------------------- | -------- |
| **Phase 1** | Q1 2026  | Foundation & Quick Wins | 25 tasks |
| **Phase 2** | Q2 2026  | Enhanced UX             | 25 tasks |
| **Phase 3** | Q3 2026  | Power User Features     | 30 tasks |
| **Phase 4** | Q4 2026  | Production Hardening    | 20 tasks |
| **Phase 5** | Ongoing  | Testing & Quality       | 10 tasks |

**Total**: 100 tasks across 12 months

---

## Success Metrics

### User Engagement

- [ ] First-run tour completion rate >70%
- [ ] Demo mode usage >40% of new users
- [ ] Help beacon clicks <5% (good docs = fewer clicks)

### Accessibility

- [ ] Lighthouse a11y score ≥95
- [ ] Zero keyboard traps
- [ ] VoiceOver success rate >90%

### Performance

- [ ] Lighthouse performance ≥90
- [ ] FCP <1.5s, LCP <2.5s
- [ ] 95th percentile page load <3s

### Conversion

- [ ] Start → L1 completion rate >60%
- [ ] L1 → L2 completion rate >50%
- [ ] L2 → L3 request rate >30%

---

## Risk Mitigation

### Technical Risks

1. **File Upload Reliability**

   - Risk: Large files fail on poor networks
   - Mitigation: Chunked uploads (Task #29), retry logic

2. **Graph Performance**

   - Risk: Slow with >1000 nodes
   - Mitigation: Clustering (Task #51), virtualization

3. **PWA Complexity**
   - Risk: Offline sync conflicts
   - Mitigation: Conflict resolution UI, last-write-wins strategy

### UX Risks

1. **Tour Fatigue**

   - Risk: Users skip tour
   - Mitigation: 60-second limit, dismissible, contextual hints

2. **Notification Overload**
   - Risk: Too many in-app notifications
   - Mitigation: Grouped inbox (Task #76), smart batching

---

## Dependencies & Blockers

### Backend Dependencies

- [ ] SSE/WebSocket endpoint for live updates (Task #77)
- [ ] CSV batch verify API (Task #40)
- [ ] Export user data endpoint (Task #75)
- [ ] Template management API (Task #41)

### Design Dependencies

- [ ] Accessibility audit results
- [ ] Additional color palettes (Task #61)
- [ ] Icon set for new features
- [ ] Empty state illustrations

---

## Contributing

### How to Pick a Task

1. Filter by priority (P0/P1 first)
2. Match your skills (frontend, a11y, testing)
3. Check dependencies
4. Create feature branch: `feat/task-{number}-short-name`
5. Update status in this file

### Task Status Options

- ⬜ **Todo**: Not started
- 🔵 **In Progress**: Currently being worked on
- 🟢 **Complete**: Merged to main
- 🔴 **Blocked**: Waiting on dependencies
- ⚪ **Deferred**: Moved to later phase

---

**Last Updated**: October 26, 2025
**Version**: 1.0
**Total Progress**: 0/100 (0%)

---

## Next Steps

### Immediate (This Week)

1. Review and prioritize Phase 1 tasks
2. Set up testing infrastructure (Playwright, Lighthouse CI)
3. Begin Quick Wins implementation

### Short Term (This Month)

1. Complete 10 Quick Wins
2. Implement core accessibility fixes
3. Add form validation system

### Long Term (This Quarter)

1. Complete Phase 1 (25 tasks)
2. User testing and feedback
3. Iterate based on metrics
