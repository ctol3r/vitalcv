# YC-Ready Product Snapshots

## Required Screenshots

Screenshots must demonstrate:
- Calm, professional UI
- Clear role separation (Clinician/Holder, Employer/Verifier, Issuer/Authority)
- No fake data or implied metrics
- Revocation-first, deterministic language

## Snapshot Specifications

### 1. Homepage Hero (`01-homepage-hero.png`)

**URL**: `/`

**Show**:
- Clean hero section with tagline
- Three role cards (Clinician/Holder, Employer/Verifier, Issuer/Authority)
- Professional color scheme
- Clear value proposition

**Capture**:
- Desktop viewport: 1920x1080
- Show full hero + role cards section
- No scrolling required

**Key Elements**:
- "Institutional credentialing for modern healthcare networks"
- Role-based entry points with clear CTAs
- SOC2, VC standards, Enterprise readiness badges

---

### 2. Clinician Interface (`02-clinician-holder.png`)

**URL**: `/holder`

**Show**:
- Readiness status badge (GREEN/NOT_READY)
- Share token creation flow
- Time-bound, revocable share link
- CRS grade display

**Capture**:
- Desktop viewport: 1920x1080
- Full page view showing readiness + share flow

**Key Elements**:
- Clear readiness status
- "Time-bound. Revocable." copy
- No implied real-time verification
- Professional card-based layout

---

### 3. Employer Verification (`03-employer-verify.png`)

**URL**: `/verify/[token]` (use demo token from /holder)

**Show**:
- Clinician credential summary
- CRS grade badge (GREEN/YELLOW/RED)
- Credential verification details
- Decision button (GREENLIGHT/BLOCK)

**Capture**:
- Desktop viewport: 1920x1080
- Full verification summary + decision flow

**Key Elements**:
- "Read-only verification summary" copy
- CRS grade with reasons
- Credential status (VALID/REVOKED/EXPIRED)
- Decision capsule details after decision

---

### 4. Demo Overview (`04-demo-overview.png`)

**URL**: Create composite or capture `/` with annotations

**Show**:
- All three routes accessible
- Flow diagram: Holder → Token → Verifier → Decision
- Golden path orchestration

**Option A - Composite**:
Create a 3-panel view showing:
1. Holder creates token
2. Verifier checks credentials  
3. Decision made (GREENLIGHT/BLOCK)

**Option B - Annotated Homepage**:
Show homepage with arrows/labels indicating the three role flows

**Key Elements**:
- Clear role separation
- Deterministic flow (no AI magic)
- Revocation-first validation
- CRS → Readiness → Accept

---

## Screenshot Guidelines

### Technical Requirements
- Format: PNG (lossless)
- Resolution: 1920x1080 minimum
- DPI: 144 (Retina) or 72 (standard)
- Color space: sRGB
- No browser chrome (hide URL bar, bookmarks)

### Content Requirements
✅ **Show**:
- Clean, professional UI
- Real data flow (holder → token → verify → decide)
- Status badges (GREEN/RED, VALID/REVOKED)
- Deterministic language

❌ **Do NOT Show**:
- Fake user names or NPIs
- Implied real-time verification
- Blockchain/AI marketing language
- Loading spinners or "processing" states
- Development tools or console

### Capture Tools

**Recommended**:
- Browser DevTools (F12 → Device toolbar → Set to 1920x1080)
- macOS: Cmd+Shift+4 → Space → Click window
- Windows: Snipping Tool (Full Screen)
- Chrome Extension: "Full Page Screen Capture"

**Post-Processing**:
- Crop to remove browser chrome
- Ensure consistent viewport size
- Compress with `pngquant` or similar (optional)
- No filters or enhancements

---

## Validation Checklist

Before committing screenshots, verify:

- [ ] No fake data visible (names, NPIs, timestamps should be real demo flow)
- [ ] No "AI-powered" or "blockchain-based" language visible
- [ ] All role names consistent (Clinician/Holder, Employer/Verifier, Issuer/Authority)
- [ ] Status badges show appropriate states (GREEN, VALID, etc.)
- [ ] No Lorem Ipsum or placeholder text
- [ ] No browser chrome or development tools
- [ ] Image dimensions consistent (1920x1080)
- [ ] File sizes reasonable (<500KB per image)

---

## Usage

These snapshots are for:
- YC application materials
- Investor decks
- Product documentation
- Demo walkthroughs

**NOT** for:
- Marketing pages (use professional renders)
- Public-facing website (may need legal review)
- Social media (may need branding adjustments)

---

## File Naming

- `01-homepage-hero.png` - Landing page with role cards
- `02-clinician-holder.png` - Holder dashboard with share token
- `03-employer-verify.png` - Verification summary with CRS
- `04-demo-overview.png` - Composite or annotated flow

Keep filenames simple and sequential.
