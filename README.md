# VitalCV Frontend - Pilot P0

[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js%2015-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

Healthcare credential verification platform powered by W3C Verifiable Credentials, DIDComm v2, and blockchain anchoring. Built for the VitalCV pilot demonstration.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or pnpm
- Backend service running on `http://localhost:4000` (chai-vc-platform)

### Environment Setup

Create a `.env` file in the project root:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation & Development

```bash
# Install dependencies
pnpm install

# Run development server (default port 3000)
pnpm dev

# Or specify port 3005 for pilot setup
PORT=3005 pnpm dev
```

The application will be available at `http://localhost:3005`

### Production Build

```bash
# Build the application
pnpm build

# Start production server
PORT=3005 pnpm start
```

## 📋 Pilot Demo Script

This demo showcases the complete credential lifecycle under 10 seconds:

### 1. Issue a Credential

1. Navigate to `/issuer`
2. Fill in the credential form:
   - **Credential Type**: Medical License
   - **Subject ID**: test@example.com
   - **License Number**: CA123456
   - **Issuing Authority**: California Medical Board
   - **Expiry Date**: 2025-12-31
3. Click **"Issue Credential"**
4. Note the returned `credentialId` (e.g., `CRED-12345`)
5. Observe the **Timeline** showing "Issued" event

### 2. Verify the Credential (Valid State)

1. Navigate to `/verify`
2. Enter the `credentialId` from step 1
3. Click **"Verify Presentation"**
4. Observe:
   - ✅ **Green "Valid" status card**
   - Audit reference displayed
   - Timestamp of verification
5. Click **"Re-check Status"** to refresh

### 3. Revoke the Credential

1. Return to `/issuer` → **Revoke** tab
2. Select the credential from the dropdown
3. Enter revocation reason: "Expired license"
4. Click **"Revoke Credential"**
5. Observe timeline update showing "Revoked" event

### 4. Re-verify (Revoked State)

1. Return to `/verify` with the same `credentialId`
2. Click **"Verify Presentation"**
3. Observe:
   - ❌ **Red "Revoked" status card**
   - Revocation reason displayed
   - Updated audit reference
   - Timeline shows revocation event

**Total Demo Time**: ~8-10 seconds

## 🎯 Key Features

### P0 Pilot Features

- ✅ **Credential Verification**: Real-time credential status checking with <5s latency
- ✅ **Issuance & Revocation**: Full lifecycle management with audit trail
- ✅ **Timeline View**: Chronological event history (Issued → Verified → Revoked)
- ✅ **Access Log**: Verification history with audit references
- ✅ **Auto-Polling**: Visibility-aware status updates (5s on tab focus)
- ✅ **Re-check Button**: Manual status refresh without page reload
- ✅ **QR Code Sharing**: Copy link and open in new tab
- ✅ **NPI Integration**: 10s timeout with graceful fallback to manual entry
- ✅ **NPPES Badge**: Visual indicator when data sourced from NPPES
- ✅ **Session Analytics**: Real-time counters for issued/verified/revoked credentials
- ✅ **Offline Detection**: Banner when backend is unavailable
- ✅ **PWA Support**: Installable progressive web app
- ✅ **Accessibility**: WCAG AA compliance, ARIA labels, keyboard navigation
- ✅ **Reduced Motion**: Respects prefers-reduced-motion preference

### Technical Stack

- **Framework**: Next.js 15 (App Router, React Server Components)
- **UI Library**: Radix UI + Tailwind CSS 4.1
- **State Management**: React hooks + sessionStorage
- **Type Safety**: TypeScript 5
- **Standards**: W3C Verifiable Credentials, DIDComm v2
- **Blockchain**: Substrate anchoring (non-blocking)

## 📁 Project Structure

```
app/
├── analytics/         # Analytics dashboard with session metrics
├── issuer/           # Credential issuance and revocation
├── verify/           # Credential verification with auto-poll
├── wallet/           # Holder wallet with timeline and access log
├── onboarding/       # NPI sync and CV upload flow
├── profile/          # Clinician profile with credentials
└── api/              # Next.js API routes (proxy to backend)

components/
├── RevocationTimeline.tsx    # Event timeline visualization
├── AccessLog.tsx            # Verification history table
├── SessionAnalyticsWidget.tsx # Real-time session counters
├── OfflineBanner.tsx         # Backend health detection
├── QRCodeDisplay.tsx         # Enhanced QR with actions
└── ui/                       # Radix UI component library

hooks/
├── use-session-analytics.ts  # Session-based event tracking
├── use-toast.ts             # Toast notifications
└── use-mobile.ts            # Responsive breakpoint detection

styles/
├── globals.css              # Global styles and Tailwind config
└── accessibility.css        # A11y and reduced motion styles
```

## 🔌 API Integration

All API routes proxy to the backend service (`NEXT_PUBLIC_BACKEND_URL`):

### Issuer Endpoints
- `POST /api/issuer/credential` → Issue new credential
- `POST /api/status/revoke` → Revoke credential

### Verifier Endpoints
- `POST /api/verifier/presentation` → Verify presentation
- `GET /api/verifier/credential/:id/status` → Check credential status

### NPI Lookup
- `POST /api/clinician/npi-sync` → Sync with NPPES (10s timeout)

All endpoints use `AbortController` with 5-second timeouts and return detailed error messages.

## 🎨 PWA Configuration

The app is installable as a Progressive Web App:

### Manifest
- **Name**: VitalCV - Healthcare Credential Verification
- **Theme Color**: `#2563eb` (light) / `#1e40af` (dark)
- **Icons**: 192x192 and 512x512 SVG icons
- **Display**: Standalone
- **Start URL**: `/`

### Installation
1. Open the app in Chrome/Edge
2. Click the install icon in the address bar
3. Follow the installation prompt

### Browser Support
- Chrome/Edge 90+
- Safari 15+ (iOS/macOS)
- Firefox 100+

## ♿ Accessibility

Target: **Lighthouse Accessibility Score ≥ 90**

### Features
- ✅ Semantic HTML5 structure
- ✅ ARIA labels on all interactive elements
- ✅ Keyboard navigation support (Tab, Enter, Escape)
- ✅ Focus visible styles (2px blue outline)
- ✅ Color contrast ratios ≥ 4.5:1 (WCAG AA)
- ✅ Skip-to-main-content link
- ✅ Screen reader announcements for status changes
- ✅ Reduced motion support (prefers-reduced-motion)

### Testing
```bash
# Run Lighthouse CI
npm run lighthouse
```

## 🔧 Configuration

### Port Configuration
- **Frontend**: `PORT=3005` (pilot default)
- **Backend**: `4000` (chai-vc-platform)

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | No |

### Offline Mode
When the backend is unavailable, a banner displays:
> **Backend service unavailable.** Credential verification and issuance are currently disabled.

The app automatically reconnects when the service is restored.

## 📸 Screenshots

Demo screenshots are located in `/docs`:
- `verify-green.png` - Valid credential verification
- `verify-red.png` - Revoked credential verification
- `wallet-access-log.png` - Access log with verification history
- `analytics.png` - Analytics dashboard with session metrics

## 🐛 Troubleshooting

### Backend Connection Issues
```bash
# Check backend health
curl http://localhost:4000/healthz

# Expected response: {"status":"ok"}
```

### Port Already in Use
```bash
# Kill process on port 3005
lsof -ti:3005 | xargs kill -9

# Or use a different port
PORT=3006 pnpm dev
```

### Build Errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## 📚 Additional Resources

- [VitalCV Executive Summary](https://github.com/your-org/vital-cv-docs/exec-summary.md)
- [MVP → Production Roadmap](https://github.com/your-org/vital-cv-docs/roadmap.md)
- [Backend Repository (chai-vc-platform)](https://github.com/your-org/chai-vc-platform)
- [W3C Verifiable Credentials Spec](https://www.w3.org/TR/vc-data-model/)
- [DIDComm v2 Spec](https://identity.foundation/didcomm-messaging/spec/)

## 🤝 Contributing

This is a pilot project. For questions or issues, contact the VitalCV team.

## 📄 License

Proprietary - VitalCV Project © 2025
