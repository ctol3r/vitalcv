# VitalCV Wallet - iOS Native App

## Batch 539 Implementation Status

### ✅ Foundation (Tasks 1-5) - COMPLETE

- [x] **Task 1**: SwiftUI project initialized
- [x] **Task 2**: Modular architecture (Feature modules + CoreKit + DesignKit)
- [x] **Task 3**: Combine integrated for reactive flows
- [x] **Task 4**: Secure local storage using Keychain
- [x] **Task 5**: AppState container for global UI state

### 🚧 In Progress

- [ ] **Task 6-10**: Auth + Identity (SIWA, PIN/biometric, DID generation)
- [ ] **Task 11-20**: Credential Wallet UI (Home screen, card stack, details)
- [ ] **Task 21-25**: Credential Flow (OIDC4VCI, deep links, DPoP)
- [ ] **Task 26-30**: Usability/UI Polish (Haptics, loading states)
- [ ] **Task 31-35**: Native Mobile Security
- [ ] **Task 36-40**: Plug-and-Play Flow
- [ ] **Task 41-45**: Native Performance
- [ ] **Task 46-50**: API Integration
- [ ] **Task 51-55**: Testing
- [ ] **Task 56-60**: Deployment

## Project Structure

```
ios-wallet/
├── VitalCVWallet/
│   ├── VitalCVWalletApp.swift      # App entry point
│   ├── ContentView.swift            # Root view
│   ├── Core/
│   │   ├── AppStateContainer.swift  # Global state (Task 5)
│   │   ├── KeychainService.swift    # Secure storage (Task 4)
│   │   ├── Models.swift             # Data models
│   │   └── NotificationExtensions.swift
│   ├── CoreKit/
│   │   └── NetworkService.swift     # Combine-based networking (Task 3)
│   ├── DesignKit/
│   │   └── Theme.swift              # Design system (Task 2)
│   ├── Features/
│   │   ├── Auth/
│   │   │   └── OnboardingView.swift # Onboarding (Task 36)
│   │   ├── Wallet/
│   │   │   ├── WalletHomeView.swift # Home screen (Task 11)
│   │   │   ├── CredentialCard.swift # Card UI (Task 12)
│   │   │   ├── CredentialDetailView.swift # Detail modal (Task 13)
│   │   │   ├── QRShareView.swift    # QR share (Task 15)
│   │   │   ├── VerificationResultView.swift # Verification (Task 17)
│   │   │   └── AllCredentialsView.swift
│   │   └── Scan/
│   │       └── ScanScreenView.swift # Scan screen (Task 37)
│   └── README.md
```

## Next Steps

1. **Auth Implementation** (Tasks 6-10)
   - Sign In with Apple
   - PIN + Biometric unlock
   - DID generation screen
   - DID backup/export
   - QR-based DID linking

2. **Complete Wallet UI** (Tasks 11-20)
   - Evidence timeline (Task 14)
   - Selective disclosure toggle (Task 18)
   - Human-readable parser (Task 19)
   - Issuer authenticity badge (Task 20)

3. **Credential Flow** (Tasks 21-25)
   - OIDC4VCI implementation
   - Deep link handling
   - DPoP binding
   - Background sync

## API Integration

The app is configured to connect to:
- Default: `http://localhost:4000`
- Configurable via `API_BASE_URL` environment variable

Endpoints integrated:
- `/api/credentials/issue` - Issue credentials
- `/api/verify` - Verify credentials
- `/api/did/link` - Link DID to NPI
- `/api/npi/lookup` - NPI lookup
- `/api/routing/recommend` - Routing recommendations

## Design System

The app uses a consistent design system defined in `DesignKit/Theme.swift`:
- Colors: Primary, secondary, accent, status colors
- Typography: System fonts with consistent sizing
- Spacing: Standard spacing scale
- Shadows: Three-level shadow system
- Corner radius: Consistent border radius values

## Security

- Keychain storage for sensitive data (DID, credentials, PIN)
- Device-only access for Keychain items
- Secure credential storage

## Development

To build and run:

1. Open `VitalCVWallet.xcodeproj` in Xcode
2. Select target device/simulator
3. Build and run (⌘R)

**Note**: This is a SwiftUI project structure. You'll need to create the Xcode project file or use Xcode to generate it from these Swift files.

