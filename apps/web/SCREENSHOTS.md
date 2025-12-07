# VitalCV Pilot Screenshots

This document describes the required screenshots for the P0 pilot demo.

## Screenshot Locations

All screenshots should be captured and placed in the `/docs` directory:

### 1. verify-green.png
**Path**: `/docs/verify-green.png`

**Description**: Verification page showing a VALID credential

**Content**:
- Credential ID displayed in the form
- Large green ✅ status card with "Credential Valid" message
- Audit reference visible below the status card
- Timestamp showing "Last checked"
- "Re-check Status" button present

**How to Capture**:
1. Navigate to `/verify`
2. Enter a valid credential ID (e.g., `CRED-12345`)
3. Click "Verify Presentation"
4. Wait for green valid status to appear
5. Take full-page screenshot

---

### 2. verify-red.png
**Path**: `/docs/verify-red.png`

**Description**: Verification page showing a REVOKED credential

**Content**:
- Same credential ID from verify-green
- Large red ❌ status card with "Credential Revoked" message
- Revocation reason displayed
- Audit reference visible
- Timestamp showing updated check time
- "Re-check Status" button present

**How to Capture**:
1. First revoke the credential on `/issuer` → Revoke tab
2. Return to `/verify` with the same credential ID
3. Click "Verify Presentation" or "Re-check Status"
4. Wait for red revoked status to appear
5. Take full-page screenshot

---

### 3. wallet-access-log.png
**Path**: `/docs/wallet-access-log.png`

**Description**: Wallet page showing the Access Log tab with verification history

**Content**:
- Left side: List of credentials in wallet
- Right side: Tabs with "Access Log" selected
- Table showing:
  - Timestamp column
  - Credential ID column
  - Verifier column (e.g., "UCSF Medical Center")
  - Status badges (Valid/Revoked)
  - Audit Reference column
- At least 2-3 entries visible in the log

**How to Capture**:
1. Navigate to `/wallet`
2. Click "Access Log" tab on the right
3. Ensure some verification events are visible in the table
4. Take full-page screenshot including header

---

### 4. analytics.png
**Path**: `/docs/analytics.png`

**Description**: Analytics dashboard showing session metrics

**Content**:
- Top section: Three session metric cards:
  - **Credentials Issued** (with count)
  - **Verifications Performed** (with count)
  - **Revocations Executed** (with count)
- Each card should show a non-zero number
- Charts section visible below (Success Rate, Fraud Detection, etc.)
- "Reset Counters" button visible in top-right

**How to Capture**:
1. Perform at least one issue, verify, and revoke action
2. Navigate to `/analytics`
3. Verify session counters show numbers > 0
4. Take full-page screenshot

---

## Screenshot Specifications

- **Format**: PNG
- **Resolution**: Minimum 1920x1080 (Full HD)
- **Color Depth**: 24-bit or 32-bit
- **Quality**: Lossless compression
- **Browser**: Chrome or Edge recommended for consistency
- **Window Size**: Full screen or maximized window
- **Zoom**: 100% (default browser zoom)

## Tools for Screenshot Capture

### macOS
```bash
# Full screen
Cmd + Shift + 3

# Selection
Cmd + Shift + 4

# Full window
Cmd + Shift + 4, then Space, click window
```

### Windows
```bash
# Full screen
Windows + Print Screen

# Selection
Windows + Shift + S

# Third-party: ShareX (recommended)
```

### Linux
```bash
# GNOME
gnome-screenshot

# KDE
spectacle

# Command line
scrot filename.png
```

### Browser Extensions
- **Nimbus Screenshot** (Chrome/Firefox)
- **Awesome Screenshot** (Chrome/Firefox)
- **Full Page Screen Capture** (Chrome)

## Post-Processing

After capturing screenshots:

1. Crop to remove OS elements (taskbar, dock) if needed
2. Ensure no sensitive information is visible
3. Optimize file size (use TinyPNG or similar)
4. Verify image quality and readability
5. Place in `/docs` directory with exact filenames

## Checklist

Before submitting screenshots:

- [ ] All 4 screenshots captured
- [ ] Correct filenames (`verify-green.png`, `verify-red.png`, `wallet-access-log.png`, `analytics.png`)
- [ ] Placed in `/docs` directory
- [ ] Resolution ≥ 1920x1080
- [ ] PNG format
- [ ] Clear and readable text
- [ ] No sensitive/personal information visible
- [ ] Consistent browser UI across all screenshots
- [ ] Demo flow visible (green → red transition)

## Demo Flow Validation

To ensure screenshots tell the complete story:

1. **verify-green.png** should show timestamp T1
2. **verify-red.png** should show same credential ID but later timestamp T2
3. **wallet-access-log.png** should show both verification events
4. **analytics.png** should show counters reflecting the actions taken

This creates a cohesive narrative of the credential lifecycle.
