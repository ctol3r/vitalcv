# 🔥 Chain UX Layer — Quick Reference

## 🎯 Core Components

### ChainUXEngine
Central engine for chain → UI mapping.

```swift
let engine = ChainUXEngine.shared
let treatment = engine.visualTreatment(for: .anchored)
let icon = engine.icon(for: .anchored)
let haptic = engine.hapticAction(for: .anchored)
let confidence = engine.confidenceLevel(confirmations: 8)
let trustScore = engine.trustScore(status: .anchored, confirmations: 8, anchorAge: nil, isStale: false)
```

### ChainStatus
```swift
enum ChainStatus {
    case confirming    // Transaction pending
    case anchored      // Successfully anchored
    case stale         // Anchor is old
    case unverified    // Status unknown
    case rejected      // Transaction failed
}
```

---

## 🎨 Visual Components

### Chain Badge
```swift
ChainBadge(status: .anchored, confirmations: 12)
    .chainGlow(color: .chainEmerald, intensity: 0.4)
```

### Block Number Badge
```swift
BlockNumberBadge(blockNumber: 12345678, style: .compact)
```

### Confirmation Meter
```swift
ConfirmationCountMeter(confirmations: 8, maxConfirmations: 12, style: .bars)
```

### Chain Confidence Bar
```swift
ChainConfidenceBar(confirmations: 8, maxConfirmations: 12)
```

---

## 📊 Timeline & History

### Anchor Timeline
```swift
AnchorTimelineView(events: chainEvents)
```

### Chain Event
```swift
ChainEvent(
    type: .anchor,
    timestamp: Date(),
    blockNumber: 12345678,
    transactionHash: "0x...",
    confirmations: 12,
    status: .anchored,
    metadata: ChainEventMetadata(
        ledgerId: "ledger-123",
        explorerUrl: "https://explorer.example.com/tx/0x123"
    )
)
```

---

## 📱 Detail Views

### Chain Detail Sheet
```swift
.sheet(isPresented: $showDetail) {
    ChainDetailSheetView(anchor: chainAnchor)
}
```

### Chain Anchor Model
```swift
ChainAnchor(
    credentialId: "cred-123",
    blockNumber: 12345678,
    transactionHash: "0x...",
    timestamp: Date(),
    confirmations: 8,
    status: .anchored,
    ledgerId: "ledger-123",
    explorerUrl: "https://explorer.example.com/tx/0x123"
)
```

---

## ✨ View Modifiers

### Chain Ripple
```swift
.chainRipple(color: .chainEmerald, isActive: true, pulseCount: 3)
```

### Chain Glow
```swift
.chainGlow(color: .chainEmerald, intensity: 0.6, radius: 20)
```

### Chain Drift
```swift
.chainDrift(isStale: true)
```

### Trust Harmonics
```swift
.trustHarmonics(status: .anchored)
```

### Failure Fracture
```swift
.failureFracture(isActive: true)
```

### Chain Anchor Verification
```swift
.chainAnchorVerification(anchor: anchor) {
    // Show detail sheet
}
```

---

## 🌈 Color Palette

### Direct Colors
```swift
ChainColorPalette.glacialBlue  // Confirming
ChainColorPalette.emerald      // Anchored
ChainColorPalette.amber        // Stale
ChainColorPalette.red          // Rejected
```

### Status-Based Color
```swift
ChainColorPalette.color(for: .anchored)
```

### Gradient
```swift
ChainColorPalette.gradient(for: .anchored)
```

---

## 🎭 Emotional Effects

### Anchor Success Bloom
```swift
AnchorSuccessBloom(petalCount: 8)
```

### Anchor Drift Haze
```swift
AnchorDriftHaze(isStale: true)
```

### Chain Heartbeat
```swift
ChainHeartbeatAnimation(
    anchorAge: 86400,
    isAnchored: true
)
```

### Identity Alignment Bloom
```swift
IdentityAlignmentBloom(isAligned: true)
```

### Anchor Descent
```swift
AnchorDescentAnimation(isAnchoring: true)
```

### High-Trust Resonance
```swift
HighTrustResonancePulse(
    trustScore: 0.95,
    isFullyVerified: true
)
```

---

## 🔗 Integration Examples

### Wallet Card with Chain Badge
```swift
VStack {
    // Card content
    ChainBadge(status: .anchored, confirmations: 12)
        .chainGlow(color: .chainEmerald)
}
```

### Credential Detail with Anchor Verification
```swift
CredentialDetailView(credential: credential)
    .chainAnchorVerification(anchor: anchor) {
        showChainDetail = true
    }
```

### Verification Result with Confidence
```swift
VStack {
    ChainConfidenceBar(confirmations: 8, maxConfirmations: 12)
    LastAnchoredTextBlock(anchorDate: anchor.timestamp)
}
```

### Timeline with Events
```swift
AnchorTimelineView(events: [
    ChainEvent(type: .anchor, timestamp: Date(), status: .anchored),
    ChainEvent(type: .verified, timestamp: Date(), status: .anchored)
])
```

---

## 📦 Data Models

### ChainAnchor
```swift
struct ChainAnchor {
    let id: String
    let credentialId: String
    let blockNumber: UInt64
    let transactionHash: String
    let timestamp: Date
    let confirmations: Int
    let status: ChainStatus
    let ledgerId: String?
    let explorerUrl: String?

    var isStale: Bool { ... }
    var daysSinceAnchor: Int { ... }
}
```

### ChainEvent
```swift
struct ChainEvent {
    let id: String
    let type: ChainEventType
    let timestamp: Date
    let blockNumber: UInt64?
    let transactionHash: String?
    let confirmations: Int
    let status: ChainStatus
    let metadata: ChainEventMetadata?
}
```

---

## 🎯 Common Patterns

### Check if Anchor is Stale
```swift
let isStale = ChainUXEngine.shared.isStale(
    anchorDate: anchor.timestamp,
    currentDate: Date()
)
```

### Calculate Trust Score
```swift
let trustScore = ChainUXEngine.shared.trustScore(
    status: .anchored,
    confirmations: 8,
    anchorAge: nil,
    isStale: false
)
```

### Get Confidence Level
```swift
let confidence = ChainUXEngine.shared.confidenceLevel(confirmations: 8)
// Returns: .medium, .high, .maximum, etc.
```

---

## 🚨 Warning Components

### Stale Anchor Warning
```swift
StaleAnchorWarningRibbon(daysSinceAnchor: 95)
```

### Trust Caveats
```swift
TrustCaveatsView(anchor: staleAnchor)
```

### Chain Caching Indicator
```swift
ChainCachingIndicator(isCached: true, cacheAge: 3600)
```

---

## 🎨 Iconography

### Event Icons
```swift
ChainEventIconographySet.icon(for: .anchor)  // "anchor.fill"
ChainEventIconographySet.icon(for: .reAnchor)  // "arrow.clockwise.circle.fill"
ChainEventIconographySet.icon(for: .revoke)  // "xmark.circle.fill"
ChainEventIconographySet.icon(for: .stale)  // "exclamationmark.triangle.fill"
```

### Icon View
```swift
ChainEventIconographySet.iconView(
    for: .anchor,
    size: 24,
    color: .chainEmerald
)
```

### Event Badge
```swift
ChainEventBadge(eventType: .anchor, label: "Anchored")
```

---

## 📱 Sheet Presentations

### Chain Detail Sheet
```swift
@State private var showChainDetail = false

Button("View Chain Details") {
    showChainDetail = true
}
.sheet(isPresented: $showChainDetail) {
    ChainDetailSheetView(anchor: chainAnchor)
}
```

---

## 🔄 Animation Timing

### Standard Animations
- **Ripple**: 1.5s duration, 3 pulses
- **Glow**: 0.6 intensity, 20px radius
- **Heartbeat**: 0.8-2.0s (faster for fresh anchors)
- **Bloom**: 0.8s spring, 0.6 damping
- **Descent**: 0.6s spring, 0.6 damping

### Performance
- All animations respect `prefers-reduced-motion`
- Optimized for 60fps
- Uses SwiftUI native animations

---

## ✅ Best Practices

1. **Always check staleness** before showing stale warnings
2. **Use appropriate colors** based on chain status
3. **Respect reduced motion** preferences
4. **Cache chain data** for offline viewing
5. **Show loading states** during confirmation
6. **Provide fallbacks** for missing data

---

**Quick Start**: Import `ChainUX` components and start with `ChainBadge` on wallet cards!








