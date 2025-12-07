# VitalCV Pilot P0 - Pre-Demo Checklist

## 🎯 Overview
This checklist ensures all systems are ready for the live pilot demonstration. Complete all items before the demo.

---

## 📋 Pre-Demo Setup

### Environment Configuration
- [ ] `.env` file exists with `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`
- [ ] Backend service (chai-vc-platform) is running on port 4000
- [ ] Backend health check passes: `curl http://localhost:4000/healthz`
- [ ] Frontend can connect to backend (no offline banner appears)

### Application Startup
- [ ] Dependencies installed: `pnpm install` completed without errors
- [ ] Development server started: `PORT=3005 pnpm dev`
- [ ] Application accessible at: `http://localhost:3005`
- [ ] No console errors on page load
- [ ] All pages load successfully (verify, issuer, wallet, analytics)

### Browser Setup
- [ ] Chrome or Edge browser (latest version)
- [ ] Browser zoom set to 100%
- [ ] Clear browser cache and cookies
- [ ] Open DevTools console to monitor for errors
- [ ] Disable browser extensions that might interfere

---

## 🧪 Feature Testing

### 1. Credential Issuance
- [ ] Navigate to `/issuer`
- [ ] Fill credential form with sample data
- [ ] Click "Issue Credential"
- [ ] Credential ID returned (e.g., `CRED-12345`)
- [ ] Success toast notification appears
- [ ] Copy credential ID to clipboard

### 2. Valid Verification
- [ ] Navigate to `/verify`
- [ ] Paste credential ID from step 1
- [ ] Click "Verify Presentation"
- [ ] Green "Valid" status card appears
- [ ] Audit reference displayed
- [ ] Timestamp shows current time
- [ ] "Re-check Status" button visible

### 3. Re-check Functionality
- [ ] Click "Re-check Status" button
- [ ] Status refreshes (may stay valid)
- [ ] Timestamp updates
- [ ] No page reload occurs
- [ ] Loading state briefly visible

### 4. Auto-Polling
- [ ] Switch to another tab/window
- [ ] Wait 5 seconds
- [ ] Return to verification tab
- [ ] Auto-polling should trigger (check console)
- [ ] Status updates automatically

### 5. Credential Revocation
- [ ] Navigate to `/issuer` → Revoke tab
- [ ] Select credential from dropdown
- [ ] Enter revocation reason: "Expired license"
- [ ] Click "Revoke Credential"
- [ ] Success toast appears

### 6. Revoked Verification
- [ ] Navigate to `/verify`
- [ ] Enter same credential ID
- [ ] Click "Verify Presentation"
- [ ] Red "Revoked" status card appears
- [ ] Revocation reason displayed
- [ ] New audit reference shown
- [ ] Timestamp updated

### 7. Timeline Visualization
- [ ] Navigate to `/wallet`
- [ ] Select a credential
- [ ] Click "Timeline" tab
- [ ] Events displayed in chronological order
- [ ] Icons and colors correct (green, blue, red)
- [ ] Audit references visible

### 8. Access Log
- [ ] Stay on `/wallet`
- [ ] Click "Access Log" tab
- [ ] Verification entries visible
- [ ] Table columns populated
- [ ] Status badges colored correctly
- [ ] Timestamps in descending order

### 9. Session Analytics
- [ ] Navigate to `/analytics`
- [ ] Session counters visible at top
- [ ] Credentials Issued counter > 0
- [ ] Verifications Performed counter > 0
- [ ] Revocations Executed counter > 0
- [ ] Click "Reset Counters" to test reset

### 10. NPI Onboarding
- [ ] Navigate to `/onboarding`
- [ ] Enter a valid 10-digit NPI
- [ ] Click "Sync NPI"
- [ ] Wait for response (or timeout)
- [ ] If success: NPPES badge appears
- [ ] If timeout: Alert appears after 10 seconds
- [ ] Manual entry option becomes available

### 11. QR Code Features
- [ ] Navigate to any credential detail
- [ ] Click "Show QR Code"
- [ ] QR code displays
- [ ] Click "Copy Link" → Toast confirms copy
- [ ] Click "Open" → New tab opens (if URL)

### 12. Offline Detection
- [ ] Stop backend service
- [ ] Refresh page
- [ ] Red offline banner appears at top
- [ ] Banner message mentions backend unavailable
- [ ] Restart backend
- [ ] Wait 30 seconds
- [ ] Banner disappears

### 13. PWA Installation
- [ ] Open app in Chrome
- [ ] Look for install icon in address bar
- [ ] Click install
- [ ] App installs to desktop/home screen
- [ ] Launch installed app
- [ ] App runs in standalone mode

### 14. Accessibility
- [ ] Tab through all interactive elements
- [ ] Focus visible on all elements (blue outline)
- [ ] Screen reader announces all labels
- [ ] High contrast mode works
- [ ] Keyboard shortcuts function (Enter, Escape)

### 15. Reduced Motion
- [ ] Enable "Reduce motion" in OS settings
- [ ] Refresh page
- [ ] Animations simplified or removed
- [ ] Spinners don't rotate
- [ ] Transitions instant

---

## 📸 Screenshot Capture

### Required Screenshots
- [ ] `verify-green.png` - Valid credential
- [ ] `verify-red.png` - Revoked credential
- [ ] `wallet-access-log.png` - Access log tab
- [ ] `analytics.png` - Session analytics

### Screenshot Quality
- [ ] Resolution ≥ 1920x1080
- [ ] PNG format
- [ ] Clear and readable text
- [ ] Consistent browser UI
- [ ] No sensitive info visible
- [ ] Placed in `/docs` directory

---

## ⚡ Performance Validation

### Load Times
- [ ] Home page loads < 3 seconds
- [ ] Verify page loads < 3 seconds
- [ ] Wallet page loads < 3 seconds
- [ ] Analytics page loads < 3 seconds

### API Response Times
- [ ] Verification completes < 5 seconds
- [ ] Issuance completes < 3 seconds
- [ ] Revocation completes < 3 seconds
- [ ] NPI lookup completes < 10 seconds (or times out)

### Lighthouse Scores
- [ ] Performance ≥ 90
- [ ] Accessibility ≥ 90
- [ ] Best Practices ≥ 90
- [ ] SEO ≥ 90

---

## 🔍 Error Handling

### Network Errors
- [ ] Backend timeout shows error message
- [ ] Offline state detected and displayed
- [ ] Retry options available
- [ ] Toast notifications for errors

### Validation Errors
- [ ] Empty form fields show validation
- [ ] Invalid NPI shows error
- [ ] Unknown credential ID shows error
- [ ] All errors have clear messages

---

## 🎬 Demo Flow Practice

### Full Lifecycle (Target: < 10 seconds)
1. [ ] Start timer
2. [ ] Issue credential (2-3s)
3. [ ] Verify valid (2-3s)
4. [ ] Revoke credential (2-3s)
5. [ ] Verify revoked (2-3s)
6. [ ] Stop timer
7. [ ] Total time < 10 seconds

### Talking Points
- [ ] Explain W3C VC standard
- [ ] Mention blockchain anchoring (non-blocking)
- [ ] Highlight 10s total time
- [ ] Show timeline visualization
- [ ] Demonstrate access log
- [ ] Mention PWA capability
- [ ] Discuss accessibility features

---

## 📱 Device Testing

### Desktop
- [ ] Chrome on macOS
- [ ] Chrome on Windows
- [ ] Edge on Windows
- [ ] Firefox (optional)

### Mobile (Optional)
- [ ] Chrome on Android
- [ ] Safari on iOS
- [ ] Responsive layout works
- [ ] Touch interactions smooth

---

## 🛠️ Troubleshooting Prep

### Common Issues
- [ ] Backend not responding: Check port 4000
- [ ] Frontend not loading: Check port 3005
- [ ] CORS errors: Verify backend CORS config
- [ ] Build errors: Clear `.next` folder
- [ ] Dependency errors: Re-run `pnpm install`

### Backup Plan
- [ ] Screenshot backup ready
- [ ] Video recording of successful run
- [ ] Alternative credential IDs prepared
- [ ] Fallback demo environment

---

## 📝 Documentation Review

### Required Docs
- [ ] README.md reviewed
- [ ] SCREENSHOTS.md reviewed
- [ ] IMPLEMENTATION_SUMMARY.md reviewed
- [ ] PILOT_CHECKLIST.md (this file) reviewed

### Links Working
- [ ] All internal links functional
- [ ] Code examples correct
- [ ] Command examples tested

---

## 👥 Team Coordination

### Roles
- [ ] Demo presenter assigned
- [ ] Technical support standby
- [ ] Backend engineer available
- [ ] Stakeholders invited

### Communication
- [ ] Demo time confirmed
- [ ] Zoom/meeting link shared
- [ ] Screen sharing tested
- [ ] Backup presenter identified

---

## 🎉 Final Validation

### Critical Path
- [ ] Issue works
- [ ] Verify valid works
- [ ] Revoke works
- [ ] Verify revoked works
- [ ] Timeline shows events
- [ ] Access log records events
- [ ] Analytics counters increment

### Nice-to-Have
- [ ] QR codes work
- [ ] PWA installs
- [ ] Offline banner shows
- [ ] NPI lookup works
- [ ] Reduced motion works

---

## ✅ Sign-Off

**Date**: _________________

**Tested By**: _________________

**Backend Status**: ☐ Running  ☐ Not Running

**Frontend Status**: ☐ Running  ☐ Not Running

**Overall Readiness**: ☐ Ready  ☐ Not Ready  ☐ Ready with Issues

**Notes**:
_______________________________________
_______________________________________
_______________________________________

---

## 🚨 Last-Minute Checks (5 minutes before demo)

- [ ] Backend running and healthy
- [ ] Frontend accessible
- [ ] No offline banner showing
- [ ] Browser console clear of errors
- [ ] Sample credential ID copied and ready
- [ ] Screen sharing working
- [ ] Internet connection stable
- [ ] Backup plan ready

---

**Demo Time**: Under 10 seconds for full cycle
**Success Criteria**: Issue → Verify (Valid) → Revoke → Verify (Revoked)

**Good luck! 🚀**
