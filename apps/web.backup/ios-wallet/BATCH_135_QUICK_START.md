# Batch 135 Integration - Quick Start Guide

## 🚀 Getting Started

### Basic Setup

```swift
import VitalCVWallet

// Get shared integration layer
let integration = VitalCVIntegrationLayer.shared

// Set authentication token (after user login)
await integration.setSessionToken(accessToken)

// Unlock session with biometric
let unlocked = await integration.unlockWithBiometric()
```

## 📖 Common Use Cases

### 1. Generate and Link DID

```swift
// Generate DID and link to NPI
let registration = try await integration.generateAndRegisterDID(
    userId: userId,
    npi: npi
)

print("DID: \(registration.did)")
print("Linked: \(registration.linked)")
```

### 2. Accept Credential Offer

```swift
// Step 1: Fetch offer metadata
let metadata = try await integration.fetchCredentialOfferMetadata(
    credentialOfferURI: offerURI
)

// Step 2: Check issuer trust score
let trustScore = try await integration.getIssuerTrustScore(
    issuerDID: metadata.issuerMetadata.credentialIssuer
)

if trustScore.score < 0.7 {
    // Warn user about low trust score
    throw Error.issuerTrustTooLow
}

// Step 3: Get supported formats
let formats = try await integration.getSupportedCredentialFormats(
    issuerDID: issuerDID
)

// Step 4: Handle pre-authorized flow
let tokenResponse = try await integration.handlePreAuthorizedFlow(
    offer: metadata.offer,
    preAuthCode: preAuthCode,
    userPin: nil
)

// Step 5: Retrieve credential
let credential = try await integration.retrieveCredential(
    credentialEndpoint: metadata.issuerMetadata.credentialEndpoint!,
    accessToken: tokenResponse.accessToken,
    format: "jwt_vc",
    credentialDefinition: metadata.offer.credentials.first!
)

// Step 6: Store and anchor
let storageResult = try await integration.storeCredentialAndAnchor(
    credential: credential,
    holderDID: holderDID
)
```

### 3. Verify Credential (VP Flow)

```swift
// Step 1: Fetch VP request
let vpRequestMetadata = try await integration.fetchVPRequestMetadata(
    verifierEndpoint: verifierURL
)

// Step 2: Validate request
let validation = try await integration.validateVPRequest(
    nonce: vpRequestMetadata.nonce,
    audience: vpRequestMetadata.audience ?? "",
    verifierId: vpRequestMetadata.clientId
)

guard validation.valid else {
    throw Error.invalidVPRequest
}

// Step 3: Build VP
let vp = try await integration.buildVerifiablePresentation(
    credentials: selectedCredentials,
    request: vpRequestMetadata,
    format: "jwt_vp"
)

// Step 4: Submit for verification
let verificationResult = try await integration.submitVPForVerification(
    presentation: vp,
    verifierEndpoint: verifierURL
)

// Step 5: Get UI state for rendering
let uiState = integration.getVerificationResultUIState(
    result: integration.parseVerificationResponse(response: verificationResult)
)

// Display result based on uiState
switch uiState.state {
case .success:
    showSuccess(message: uiState.message)
case .warning:
    showWarning(message: uiState.message)
case .failed:
    showError(message: uiState.message)
}
```

### 4. Check Anchor Status

```swift
// Fetch anchor proof
let anchor = try await integration.fetchAnchorProof(anchorId: anchorId)

// Validate timestamp
let timestampValidation = integration.validateAnchorTimestamp(anchor)

switch timestampValidation.status {
case .fresh:
    print("Anchor is fresh")
case .acceptable:
    print("Anchor is acceptable")
case .stale:
    print("Anchor is stale - requesting refresh")
    try await integration.requestAnchorRefresh(anchorId: anchorId)
}

// Verify on-chain
let verification = try await integration.verifyAnchorProof(anchor)
print("Verified: \(verification.verified)")

// Get chain confidence
let confidence = try await integration.getChainConfidenceLevel(anchorId: anchorId)
print("Confirmations: \(confidence.blockConfirmations)")
```

### 5. Get Compliance Signals

```swift
let compliance = try await integration.getComplianceSignals(
    credentialId: credential.id
)

print("DEA Status: \(compliance.deaStatus)")
print("License Status: \(compliance.licenseStatus)")
print("Sanctions: \(compliance.sanctionsStatus)")
```

### 6. Rotate DID

```swift
let rotation = try await integration.rotateDID(
    oldDID: currentDID,
    userId: userId
)

if rotation.success {
    print("DID rotated to: \(rotation.newDID ?? "unknown")")
}
```

## 🔧 Configuration

### Environment Switching

The integration layer automatically uses environment from `EnvironmentConfig`:

```swift
// Development (default in DEBUG builds)
EnvironmentConfig.shared.environment = .development
// API Base: http://localhost:4000

// Staging
EnvironmentConfig.shared.environment = .staging
// API Base: https://api-staging.vitalcv.com

// Production
EnvironmentConfig.shared.environment = .production
// API Base: https://api.vitalcv.com
```

### Retry Policy

Network requests automatically retry with exponential backoff:

```swift
// Default: 3 retries, 1s initial delay, max 10s
// Can be customized in NetworkClient if needed
```

## 🐛 Error Handling

All errors are automatically mapped and handled:

```swift
do {
    let result = try await integration.someOperation()
} catch let error as IntegrationError {
    switch error {
    case .invalidURL(let endpoint):
        print("Invalid URL: \(endpoint)")
    case .httpError(let code, let message):
        print("HTTP \(code): \(message ?? "Unknown")")
    case .unauthorized:
        // Re-authenticate
        await reauthenticate()
    default:
        print("Error: \(error.localizedDescription)")
    }
}
```

## 📚 Extension Modules

The integration layer is modular:

- **+DID.swift** - DID operations
- **+OIDC4VCI.swift** - Credential issuance
- **+OIDC4VP.swift** - Credential verification
- **+Blockchain.swift** - Chain anchoring

All methods are available through the main `VitalCVIntegrationLayer` instance.

## 🔒 Security Notes

1. **DPoP** - Automatically added to all authenticated requests
2. **Biometric Auth** - Required for sensitive operations
3. **Session Tokens** - Stored securely in session management
4. **Private Keys** - Managed by DIDService via KeychainService

## 🎯 Next Steps

For remaining features, see:
- `BATCH_135_IMPLEMENTATION_SUMMARY.md` - Full feature list
- `BATCH_135_INTEGRATION_IMPLEMENTATION.md` - Task tracking

