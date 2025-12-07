# 🔥 Trust UX Animation Kit

**SwiftUI-native motion, haptics, trust metaphors, physics, subtle emotional reinforcement**

A comprehensive animation system for building trust through motion, designed for credential verification, blockchain anchors, and identity proof systems.

---

## 📋 Overview

This kit provides **40 master tasks** organized into **5 phases**, each building on the previous to create a cohesive, emotionally resonant animation language.

### Phase 1: Trust Animation Foundations (Tasks 1-8)
Core engine, state management, and fundamental modifiers.

### Phase 2: Trust Glow, Pulse & Bloom (Tasks 9-16)
Visual trust language: glows, pulses, blooms, and state-specific effects.

### Phase 3: Chain Ripple & Anchor Physics (Tasks 17-24)
Blockchain trust animations: ripples, waves, anchors, and chain interactions.

### Phase 4: Micro-Interactions & Micro-Delight (Tasks 25-32)
Apple-grade polish: haptics, sounds, gestures, and micro-animations.

### Phase 5: Proof Narrative & Emotional Clarity (Tasks 33-40)
Meaningful animations that communicate trust story and emotional states.

---

## 🚀 Quick Start

### Basic Usage

```swift
import SwiftUI

struct VerificationView: View {
    @StateObject private var engine = TrustAnimationEngine()

    var body: some View {
        VStack {
            // Identity orb with sub-surface glow
            IdentityOrb(trustScore: engine.trustScore, size: 100)
                .subSurfaceGlow(intensity: 0.6)

            // Trust score with dynamic glow
            TrustScoreIndicator(trustScore: engine.trustScore)
                .trustGlowIntensity(score: engine.trustScore)

            // Verification steps with pop animations
            ForEach(steps) { step in
                VerificationStepView(step: step, isCompleted: step.isVerified)
                    .verificationStepPop()
            }
        }
        .trustAnimatedBackground(state: engine.currentState, trustScore: engine.trustScore)
    }
}
```

### State Management

```swift
// Initialize engine
let engine = TrustAnimationEngine()

// Transition states
engine.transition(to: .verifying)
engine.updateTrustScore(85.0, animated: true)

// Access state
Text(engine.currentState.description)
    .foregroundColor(engine.currentState.color)
```

---

## 📚 Components

### Core Engine

- **TrustAnimationEngine** - Central animation coordinator
- **TrustState** - Verification states (.idle, .verifying, .passed, .warning, .failed)
- **TrustMotionConfig** - Spring, damping, duration presets
- **TrustColorPalette** - Emerald, Amber, Rose, Indigo color system

### Visual Effects

- **TrustGlow** - Dynamic glow for cards and icons
- **TrustPulse** - Repeating gentle pulses
- **TrustBloom** - Celebration bloom on success
- **SubSurfaceGlow** - Inner glow for identity orbs
- **HazardGlow** - Amber flicker for warnings
- **FailureFracture** - Red cracks for failures

### Chain & Anchor

- **ChainRipple** - Circles spreading on anchor success
- **AnchorPulse** - Pulse synchronized to confirmations
- **ChainWave** - Wave motion on timeline scroll
- **AnchorSnap** - Snap animation when verified
- **TrustGravity** - Elements pulled toward strong proofs
- **TrustFlow** - Combined evidence + chain animations

### Micro-Interactions

- **VerificationStepPop** - Tiny bounce on step resolve
- **TrustTickSound** - Soft, subtle sound feedback
- **HapticTrace** - Haptic feedback for rapid sequences
- **SoftSnapGesture** - Smooth snap for card swipes
- **RevealEase** - Smooth reveal for SD-JWT fields
- **ConfidenceSlide** - Slide animation on score updates
- **HeartbeatGlow** - Persistent glow for primary credential

### Narrative & Emotion

- **ProofPathline** - Line draws as steps verify
- **TrustStoryView** - Animated "why this is trusted" sequence
- **ComplianceSparkles** - Sparkles when compliance passes
- **ProofRipple** - Ripple from verified credential
- **IdentityAlignment** - Animation when credential joins
- **TrustHorizon** - Gradient behind verification result
- **ResonancePulse** - Final pulse for 100% trust success

---

## 🎨 Design Principles

1. **Subtle Reinforcement** - Animations reinforce trust without overwhelming
2. **State Clarity** - Each trust state has distinct visual language
3. **Emotional Resonance** - Motion communicates meaning, not just motion
4. **Performance First** - Smooth 60fps animations with minimal overhead
5. **Accessibility** - Respects reduced motion preferences

---

## 🔧 Configuration

### Motion Presets

```swift
// Use predefined presets
withAnimation(TrustMotionConfig.smoothSpring) { ... }
withAnimation(TrustMotionConfig.bouncySpring) { ... }
withAnimation(TrustMotionConfig.trustBloom) { ... }
```

### Color Customization

```swift
// Use trust palette
let color = TrustColorPalette.emerald500
let stateColor = TrustColorPalette.color(for: .passed, intensity: 0.7)
```

### Haptic Feedback

```swift
// Use haptic engine
TrustHapticEngine.shared.verificationSuccess()
TrustHapticEngine.shared.chainAnchorSuccess()
TrustHapticEngine.shared.rapidProofSequence(count: 5)
```

### Sound Effects

```swift
// Enable/disable sounds
view.trustTickSound(enabled: true)

// Play specific sounds
TrustTickSound.shared.playTick()
TrustTickSound.shared.playSuccess()
```

---

## 📖 Examples

### Verification Flow

```swift
struct VerificationFlow: View {
    @StateObject private var engine = TrustAnimationEngine()
    @State private var steps: [ProofStep] = []

    var body: some View {
        VStack {
            ProofPathline(steps: steps)

            ForEach(steps) { step in
                VerificationStepView(step: step)
            }
        }
        .onAppear {
            engine.transition(to: .verifying)
        }
    }
}
```

### Credential Card

```swift
struct CredentialCard: View {
    let credential: Credential

    var body: some View {
        VStack {
            Text(credential.title)
            TrustScoreIndicator(trustScore: credential.trustScore)
        }
        .trustGlowIntensity(score: credential.trustScore)
        .proofRipple(isVerified: credential.isVerified)
        .heartbeatGlow(frequency: credential.isPrimary ? 1.0 : 0)
    }
}
```

### Chain Anchor

```swift
struct ChainAnchorView: View {
    let confirmationCount: Int
    let isAnchored: Bool

    var body: some View {
        VStack {
            AnchorPulse(confirmationCount: confirmationCount)

            if isAnchored {
                ChainRipple()
            }
        }
        .anchorSnap(isVerified: isAnchored)
    }
}
```

---

## 🎯 Best Practices

1. **Use State-Driven Animations** - Let `TrustAnimationEngine` manage state transitions
2. **Combine Effects Thoughtfully** - Don't stack too many animations
3. **Respect User Preferences** - Check for reduced motion settings
4. **Test on Device** - Haptics and sounds require physical device
5. **Performance Monitor** - Use Instruments to check animation performance

---

## 📦 Integration

All components are self-contained and can be used independently or together. Simply import and use:

```swift
import SwiftUI

struct MyView: View {
    var body: some View {
        Text("Hello")
            .trustGlow(radius: 20, strength: 0.5)
            .trustPulse(frequency: 1.0, intensity: 0.5)
    }
}
```

---

## 🐛 Troubleshooting

### Animations not playing?
- Check that views are visible and not clipped
- Ensure state changes trigger `onChange` modifiers
- Verify animation phase values are being updated

### Haptics not working?
- Requires physical iOS device (not simulator)
- Check haptic permissions
- Verify `TrustHapticEngine` is properly initialized

### Performance issues?
- Reduce number of concurrent animations
- Use `LazyVStack` for long lists
- Cache animated views when possible

---

## 📄 License

This animation kit is part of the VitalCV Wallet project.

---

## 🤝 Contributing

When adding new animations:
1. Follow existing naming conventions
2. Use `TrustMotionConfig` for timing
3. Include haptic feedback where appropriate
4. Add documentation comments
5. Test on multiple device sizes

---

**Built with ❤️ for trust and transparency**

