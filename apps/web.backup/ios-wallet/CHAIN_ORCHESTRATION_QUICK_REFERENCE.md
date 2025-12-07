# 🔥 Chain Orchestration Layer — Quick Reference

## 🚀 Quick Start

### **1. Anchor a Credential**
```swift
let bundle = try await MultiAnchorEngine.shared.anchorOnMultipleChains(
    credentialId: "cred-123",
    credentialHash: "0xabc...",
    metadata: ["type": "license"]
)
```

### **2. Verify Across Chains**
```swift
let result = try await CrossChainVerifier.shared.verify(
    credentialHash: "0xabc...",
    credentialId: "cred-123"
)
```

### **3. Display Multi-Chain View**
```swift
NavigationView {
    MultiChainAnchorView(
        credentialId: "cred-123",
        credentialHash: "0xabc..."
    )
}
```

---

## 📋 Core Classes

| Class | Purpose | Key Methods |
|-------|---------|-------------|
| `ChainOrchestrator` | Central chain router | `routeAnchorRequest()`, `createAnchorRequest()` |
| `MultiAnchorEngine` | Multi-chain anchoring | `anchorOnMultipleChains()`, `verifyAcrossChains()` |
| `RollupEngine` | Rollup batching | `addCredentialEvent()`, `verifyMembership()` |
| `CrossChainVerifier` | Cross-chain verification | `verify()`, `verifyCredential()` |

---

## 🔗 Ledger Types

```swift
.vitalCVChain              // Primary Substrate
.evmChain(chainId: "1")    // Ethereum mirror
.tezosChain                // Tezos (optional)
.offChainMerkle            // Rollup layer
```

---

## 📊 Status Types

### **AnchorStatus**
- `.pending` - Transaction pending
- `.confirmed` - Transaction confirmed
- `.failed` - Transaction failed
- `.rejected` - Transaction rejected

### **LedgerHealthStatus**
- `.healthy` - Chain is healthy
- `.degraded` - Chain is degraded
- `.slow` - Chain is slow
- `.down` - Chain is down
- `.unknown` - Status unknown

---

## 🎨 UI Components

### **Chain Badges**
- **Primary Chain** - Green halo
- **EVM Mirror** - Blue pulse
- **Rollup** - Gold filament

### **Health Indicators**
- 🟢 Healthy
- 🟡 Degraded
- 🟠 Slow
- 🔴 Down

---

## 🔧 Configuration

### **Quick Config**
```swift
// ChainOrchestrator
ChainOrchestrator.shared.cacheTTL = 3600
ChainOrchestrator.shared.heartbeatInterval = 30.0

// MultiAnchorEngine
MultiAnchorEngine.shared.maxConcurrentAnchors = 5

// RollupEngine
RollupEngine.shared.rollupCycleInterval = 3600.0

// CrossChainVerifier
CrossChainVerifier.shared.timestampTolerance = 300.0
```

---

## 🔗 Deep Links

```
vitalcv://chain/orchestrator?anchor=<hash>
vitalcv://chain/orchestrator?verify=<hash>
vitalcv://chain/orchestrator?status
```

---

## 📈 Trust Score Impact

- **Multi-chain anchoring**: +20% trust score
- **Stale anchor**: -10% per stale anchor
- **Panic mode**: Trust score adjustment

---

## 🐛 Common Issues

### **No Anchors Found**
- Check credential ID is correct
- Verify credential has been anchored
- Check network connectivity

### **Verification Failed**
- Check chain health status
- Verify hash consistency
- Check for stale anchors

### **Panic Mode Active**
- Primary chain may be down
- Failover chain is active
- Check chain health status

---

## 📚 Related Documentation

- [Full Implementation Guide](./CHAIN_ORCHESTRATION_LAYER_IMPLEMENTATION.md)
- [TrustScore Calculator](../VitalCVWallet/CoreKit/TrustScoreCalculator.swift)
- [Advanced Anchor Engine](../VitalCVWallet/CoreKit/AdvancedAnchorEngine.swift)

---

**Last Updated**: 2025-01-27

