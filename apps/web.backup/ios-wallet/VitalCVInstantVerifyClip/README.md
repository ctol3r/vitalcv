# VitalCV Instant Verify App Clip

**SwiftUI-native • App Clip • QR-triggered • OIDC4VP-ready • Chain-aware**

A lightweight, instant verification App Clip that allows recruiters to verify candidate credentials by scanning QR codes. The App Clip launches instantly, scans instantly, verifies instantly, and anchors instantly.

## Features

- ✅ **Instant Launch**: App Clip launches in < 1 second
- ✅ **QR Scanning**: High-performance QR code detection with Vision framework
- ✅ **Instant Verification**: Lightweight verification pipeline with local signature validation
- ✅ **Chain Anchoring**: Display chain anchor status for verified credentials
- ✅ **Compliance Check**: DEA and licensure status verification
- ✅ **Trust Score**: Visual trust score calculation and display
- ✅ **Full App Handoff**: Seamless transition to full VitalCV app
- ✅ **OIDC4VP Support**: Handle OIDC4VP verification requests

## Architecture

### Phase 1: App Clip Project Setup ✅
- App Clip target `VitalCVInstantVerifyClip`
- Reduced entitlements (no background sync, no push notifications)
- Universal link association: `vitalcv://clip/verify?qr=...`
- Shared code modules for verification logic
- Lightweight Keychain wrapper (session-only storage)

### Phase 2: Invocation & Handoff ✅
- Invocation handler via `openURLContexts` and universal links
- QR payload parsing from invocation links
- Direct routing to VerifyView for VC/VP data
- OIDC4VP Request Loader for verification requests
- Fallback "scan manually" option
- Secure handoff token creation
- Full app transition with state preservation

### Phase 3: Lightweight Verification Pipeline ✅
- Clipped ProofEngine with reduced footprint
- Local signature validation using CryptoKit
- Backend-weighted DID resolution
- No-login trust evaluation
- Backend `/verify-init` support
- DPoP keypair for VP submission
- Chain anchor status display
- Compliance summary (DEA/licensure)
- Trust score visualization
- Session-only proof data storage

### Phase 4: App Clip Trust UX Layer ✅
- Simplified trustGlow (one-layer blur)
- TrustPulse animation on verification completion
- ChainRipple micro-animation for anchor success
- SD-JWT selective disclosure summary
- Issuer authenticity badge
- "Candidate Verified" celebration burst
- Haptic feedback patterns

### Phase 5: Result + Full App Handoff ✅
- VerificationResultClipView (Success/Warning/Failure)
- "Open in VitalCV App" deep link button
- Handoff data passing (credential ID, VP receipt)
- Animation transition between Clip → Full App
- QR re-scan option for multiple candidates

## File Structure

```
VitalCVInstantVerifyClip/
├── VitalCVInstantVerifyClipApp.swift    # App Clip entry point
├── ClipEntryView.swift                  # Initial loading + scan view
├── AppClipState.swift                   # State management & invocation
├── Info.plist                           # App Clip configuration
├── Entitlements.entitlements            # Reduced permissions
├── Verify/
│   ├── ClipVerifyView.swift            # Main verification view
│   ├── ClipVerificationEngine.swift    # Verification engine
│   ├── VerificationFlowView.swift       # Verification flow
│   └── OIDC4VPRequestLoaderView.swift  # OIDC4VP handler
├── Result/
│   └── VerificationResultClipView.swift # Result display
├── UX/
│   ├── TrustGlowModifier.swift         # Trust glow effect
│   ├── TrustPulseView.swift            # Pulse animation
│   ├── ChainRippleAnimation.swift      # Chain ripple
│   └── CelebrationBurstView.swift     # Success celebration
├── Handoff/
│   └── HandoffView.swift               # Full app transition
└── Shared/
    ├── ClipKeychainService.swift       # Session storage
    ├── ClipProofEngine.swift           # Proof validation
    ├── ClipNetworkService.swift        # Backend communication
    ├── ClipTypes.swift                 # Shared types
    └── ClipTheme.swift                 # Design system
```

## Usage

### Invocation

The App Clip can be invoked via:

1. **Universal Link**: `https://vitalcv.com/clip/verify?qr=<encoded-qr-data>`
2. **URL Scheme**: `vitalcv://clip/verify?qr=<encoded-qr-data>`
3. **QR Code**: Scan a QR code containing VC/VP/OIDC4VP data

### Verification Flow

1. App Clip launches and parses invocation payload
2. If QR data is present, routes directly to verification
3. If no QR data, shows manual scan option
4. Verification engine processes credential:
   - Local signature validation
   - Issuer trust check
   - Chain anchor verification
   - Compliance check (DEA/licensure)
   - Trust score calculation
5. Display result with trust indicators
6. Option to open in full app for detailed view

### Handoff to Full App

When user taps "Open in VitalCV App":
1. Creates handoff data (credential ID, VP receipt)
2. Generates deep link: `vitalcv://clip-handoff?credentialId=...`
3. Opens full app with handoff data
4. Full app restores verification state

## Configuration

### Info.plist

- `NSAppClipInvocationURLs`: URL patterns for invocation
- `NSUserActivityTypes`: Universal link support
- `NSCameraUsageDescription`: Camera permission

### Entitlements

- `com.apple.developer.associated-domains`: App Clip domains
- `keychain-access-groups`: Limited keychain access
- No background modes
- No push notifications

## Dependencies

- **Shared with main app**:
  - `QRTypeDetector`: QR payload parsing
  - `VerificationFlowEngine`: Core verification logic (clipped version)
  - Design system (Theme, Typography, Colors)

- **App Clip specific**:
  - `ClipProofEngine`: Lightweight proof validation
  - `ClipNetworkService`: Backend communication
  - `ClipKeychainService`: Session-only storage

## Limitations

- **No persistent storage**: All data is session-only
- **No background processing**: App Clip terminates when dismissed
- **Reduced verification depth**: Simplified trust evaluation
- **Limited DID resolution**: Backend-weighted resolution only
- **No credential storage**: Results must be opened in full app

## Testing

### Test Invocation URLs

```
# Direct VC
vitalcv://clip/verify?qr=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...

# OIDC4VP Request
vitalcv://clip/verify?qr=openid-vc://?request_uri=https://...

# Universal Link
https://vitalcv.com/clip/verify?qr=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Version

**App Clip Instant Verify v1.0** - Initial release

## Notes

- App Clip size should be kept under 15MB
- All network requests use ephemeral URLSession
- Keychain data is cleared when App Clip terminates
- Handoff data is passed via deep links (not persisted)




