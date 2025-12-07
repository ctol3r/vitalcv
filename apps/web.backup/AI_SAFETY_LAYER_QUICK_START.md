# 🔥 AI Safety Layer - Quick Start Guide

## Overview

The AI Safety Layer provides comprehensive guardrails, bias detection, and compliance features for all AI-powered modules in the VitalCV platform.

**Status**: ✅ Phase 1-2 Core Implementation Complete

---

## 🚀 Quick Integration

### iOS (SwiftUI)

```swift
import AISafetyEngine

// In your AI-powered feature
let safetyEngine = AISafetyEngine.shared

// 1. Process user input
let context = AIRequestContext(
    userId: user.id,
    did: user.did,
    category: .credentialAudit,
    module: .credentialAuditor
)

let safeInput = try await safetyEngine.processInput(userQuery, context: context)

// 2. Call your AI model with sanitized input
let aiResponse = await callAIModel(safeInput.sanitized)

// 3. Process AI output
let safeOutput = try await safetyEngine.processOutput(
    aiResponse,
    input: safeInput.sanitized,
    context: context
)

// 4. Use the safe output
if safeOutput.action == .allow {
    displayResponse(safeOutput.processed)
} else {
    displayError(safeOutput.processed) // Contains fallback message
}
```

### Backend (TypeScript)

The safety engine is **already integrated** into the AI controller. All AI endpoints automatically use safety filtering:

```typescript
// In your AI endpoint
import { safetyEngine, AICategory, AIModule } from '../services/aiSafety/safetyEngine';

const context: AIRequestContext = {
  userId: user.id,
  did: user.did,
  category: AICategory.CREDENTIAL_AUDIT,
  module: AIModule.CREDENTIAL_AUDITOR,
};

// Process input
const safeInput = await safetyEngine.processInput(inputText, context);

// Call LLM
const llmResponse = await callLLM(safeInput.sanitized);

// Process output
const safeOutput = await safetyEngine.processOutput(
  llmResponse.text,
  safeInput.sanitized,
  context
);
```

---

## 📊 Safety Features

### ✅ Implemented Features

1. **PII/PHI Filtering** - Automatically detects and redacts:
   - SSN
   - Phone numbers
   - Email addresses
   - Medical Record Numbers (MRN)
   - Dates (potential DOB)
   - NPI numbers

2. **Hallucination Detection** - Identifies:
   - Over-confident claims
   - Unsupported statements
   - Contradictions

3. **Bias Detection** - Detects:
   - Specialty bias
   - Gender-coded language
   - Name-origin bias
   - Geographic bias

4. **Safety Levels** - Classifies outputs as:
   - Low risk
   - Medium risk
   - High risk
   - Blocked

5. **Guardrails** - Enforces NIST GenAI Profile categories:
   - Harmful bias
   - Hallucination risk
   - Safety risk
   - Privacy risk
   - Information integrity

---

## 🔧 Configuration

### iOS Configuration

```swift
// Update safety configuration
let config = SafetyConfiguration(
    hallucinationThreshold: 0.7,
    biasThreshold: 0.6,
    piiStrictMode: true,
    enableBiasDetection: true,
    enableHallucinationDetection: true,
    enableChainAnchoring: true
)

AISafetyEngine.shared.updateConfiguration(config)
```

### Backend Configuration

```typescript
// Update via API (admin only)
PUT /api/ai/safety/config
{
  "hallucinationThreshold": 0.7,
  "biasThreshold": 0.6,
  "piiStrictMode": true,
  "enableBiasDetection": true,
  "enableHallucinationDetection": true,
  "enableChainAnchoring": true
}
```

---

## 📡 API Endpoints

### Safety Routes

All routes are prefixed with `/api/ai/safety`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/logs` | Get safety event logs | User/Admin |
| GET | `/statistics` | Get safety statistics | User/Admin |
| GET | `/config` | Get safety configuration | Public |
| PUT | `/config` | Update configuration | Admin |
| POST | `/override` | Grant safety override | Admin |
| DELETE | `/override/:userId` | Revoke override | Admin |
| GET | `/compliance/report` | Generate compliance report | Admin |
| POST | `/data/export` | Export user data (DSAR) | User/Admin |
| DELETE | `/data/:userId` | Delete user data (DSAR) | User/Admin |

---

## 🛡️ Safety Actions

The safety engine can take four actions:

1. **ALLOW** - Output passes all safety checks
2. **BLOCK** - Output is blocked and replaced with safe fallback message
3. **REWRITE** - Output is automatically rewritten to be safer
4. **ASK_USER** - Output requires user confirmation before displaying

---

## 📝 Example Responses

### Safe Output (Allowed)

```json
{
  "ok": true,
  "result": "The credential is valid and matches NPI registry records.",
  "safetyLevel": "low_risk",
  "biasScore": 0.1,
  "hallucinationRisk": 0.2
}
```

### Blocked Output

```json
{
  "ok": false,
  "error": "Response blocked by safety filters",
  "safeMessage": "I cannot provide that information for safety reasons. Please contact support for credential verification.",
  "safetyLevel": "high_risk",
  "biasScore": 0.8,
  "hallucinationRisk": 0.9
}
```

---

## 🔍 Monitoring

### View Safety Statistics

```swift
// iOS
let stats = await AISafetyEngine.shared.getStatistics()
print("Total events: \(stats.totalEvents)")
print("Blocked: \(stats.blockedCount)")
print("Bias detections: \(stats.biasDetections)")
```

```bash
# Backend
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/ai/safety/statistics
```

### View Safety Logs

```bash
# Get logs for current user
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/ai/safety/logs?limit=50

# Get logs for specific user (admin only)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/ai/safety/logs?userId=user123&limit=100
```

---

## 🎯 Integration Checklist

- [x] ✅ Safety engine core implementation
- [x] ✅ PII filtering
- [x] ✅ Bias detection
- [x] ✅ Hallucination detection
- [x] ✅ Safety event logging
- [x] ✅ Backend API routes
- [ ] ⬜ Integrate with Credential Auditor
- [ ] ⬜ Integrate with Skill Gap Predictor
- [ ] ⬜ Integrate with Career Growth Engine
- [ ] ⬜ Integrate with Telemedicine Eligibility
- [ ] ⬜ Integrate with TrustScore Explainability
- [ ] ⬜ Integrate with Recruiter Candidate AI
- [ ] ⬜ Build SafetyAdminView (SwiftUI)
- [ ] ⬜ Add on-device safety for App Clip

---

## 🔗 Related Documentation

- [Full Implementation Summary](./AI_SAFETY_LAYER_IMPLEMENTATION.md)
- [Backend Safety Engine](../backend/src/services/aiSafety/safetyEngine.ts)
- [iOS Safety Engine](../ios-wallet/VitalCVWallet/CoreKit/AISafetyEngine.swift)

---

**Version**: 1.0.0-alpha
**Last Updated**: January 2025

