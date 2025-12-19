# VitalCV - Demo Script (10 Seconds)

## 🎬 Quick Demo Flow

**Target Time:** Under 10 seconds for full cycle

### Prerequisites

- Backend running on `http://localhost:4000`
- Frontend running on `http://localhost:3005`
- Browser with dev tools open (optional)

---

## 📋 Demo Steps

### 1. Issue Credential (2-3s)

```bash
# Navigate to issuer portal
http://localhost:3005/issuer

# Quick fill:
- Subject: Dr. Jane Smith
- Type: MedicalLicense
- NPI: 1234567890
- Click "Issue Credential"

# Result: CRED-xxxxx displayed
```

**What to highlight:**

- ✅ Instant issuance
- 📝 Credential ID generated
- 🎯 Success toast notification

---

### 2. Verify Valid (2-3s)

```bash
# Navigate to verifier
http://localhost:3005/verify

# Paste credential ID
# Click "Verify Presentation"

# Result: Green "Valid" status card
```

**What to highlight:**

- ✅ Valid status with green indicator
- 📅 Issuance timestamp
- 🔍 Audit reference
- 🔄 Re-check button available

---

### 3. Revoke Credential (2-3s)

```bash
# Navigate to issuer revoke tab
http://localhost:3005/issuer (Revoke tab)

# Select credential from dropdown
# Reason: "Expired license"
# Click "Revoke Credential"

# Result: Success toast
```

**What to highlight:**

- ⚠️ Revocation reason captured
- 📝 Audit trail maintained
- ⚡ Instant revocation

---

### 4. Verify Revoked (2-3s)

```bash
# Return to verifier
http://localhost:3005/verify

# Paste same credential ID
# Click "Verify Presentation"

# Result: Red "Revoked" status card
```

**What to highlight:**

- 🚫 Revoked status with red indicator
- 📋 Revocation reason displayed
- 📅 Revocation timestamp
- 🔗 New audit reference

---

## 🎯 Total Demo Time

- **Issue**: 2-3 seconds
- **Verify Valid**: 2-3 seconds
- **Revoke**: 2-3 seconds
- **Verify Revoked**: 2-3 seconds

**Total: 8-12 seconds** ✨

---

## 📊 Alternative Demos

### Full NPI Claim Flow (30 seconds)

```bash
1. Navigate to /start
2. Enter 10-digit NPI: 1234567890
3. Complete email verification (mock OTP: 123456)
4. Upload documents (use sample files)
5. View Level 2 achievement
6. Request attestation
```

### Timeline Visualization (15 seconds)

```bash
1. Navigate to /wallet
2. Select any credential
3. Click "Timeline" tab
4. Show event history
5. Click "Access Log" tab
6. Show verification attempts
```

### Graph Visualization (20 seconds)

```bash
1. Navigate to /graph
2. Show entity relationships
3. Filter by node types
4. Click node to see details
5. Export as PNG
```

---

## 🗣️ Talking Points

### For Stakeholders

- **Speed**: "Full verification cycle in under 10 seconds"
- **Security**: "Cryptographic proof with blockchain anchoring"
- **Audit**: "Complete audit trail for compliance"
- **Standards**: "W3C Verifiable Credentials standard"

### For Technical Audience

- **Architecture**: Next.js 15 + App Router
- **Backend**: Express + Passport + DID:web
- **Storage**: In-memory + blockchain anchoring
- **Performance**: Sub-second verification times

### For Healthcare Context

- **NPI Integration**: Direct NPPES lookup
- **Multi-level Verification**: L0 → L3 progressive trust
- **Privacy**: Selective disclosure (BBS+ ready)
- **Interoperability**: Standard VC format

---

## 🎨 UI Highlights to Show

1. **Real-time Updates**

   - Toast notifications
   - Status changes
   - Loading states

2. **Accessibility**

   - Keyboard navigation
   - Screen reader support
   - High contrast mode

3. **PWA Features**

   - Offline detection banner
   - Install prompt
   - Standalone mode

4. **Analytics**
   - Session counters
   - Timeline view
   - Access logs

---

## 🐛 Troubleshooting During Demo

### Backend Not Responding

```bash
# Check backend
curl http://localhost:4000/healthz

# Restart if needed
cd ../chai-vc-platform
npm run dev
```

### Frontend Error

```bash
# Clear cache
Ctrl+Shift+R (hard refresh)

# Check console
Look for CORS or connection errors
```

### Credential Not Found

```bash
# Verify credential ID copied correctly
# Check backend logs
# Re-issue if needed
```

---

## 📸 Screenshot Checklist

Before demo, capture:

- [ ] Valid verification (green)
- [ ] Revoked verification (red)
- [ ] Timeline view
- [ ] Access log
- [ ] Analytics dashboard
- [ ] NPI claim wizard

---

## 🎓 Practice Tips

1. **Rehearse 3 times** before live demo
2. **Have backup credential IDs** ready
3. **Test all services** 5 minutes before
4. **Prepare fallback slides** if tech fails
5. **Record a video** as backup

---

## ⚡ Quick Commands Cheat Sheet

```bash
# Start backend
pnpm --filter @vitalcv/api dev

# Start frontend
PORT=3005 pnpm --filter @vitalcv/web dev

# Health check
curl http://localhost:4000/healthz

# Build for production
pnpm build && pnpm start

# Run tests
pnpm test
```

---

**Demo Confidence Level:** 🚀 Production Ready

Good luck with your demo! 🎉
