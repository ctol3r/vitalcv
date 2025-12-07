//
//  TrustAnimationEngine.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 1, Task 1
//  Central animation controller for all trust states
//

import SwiftUI
import Combine

/// TrustAnimationEngine - Central coordinator for trust animations
@MainActor
class TrustAnimationEngine: ObservableObject {
    // MARK: - Published State

    @Published var currentState: TrustState = .idle
    @Published var trustScore: Double = 0.0 // 0-100
    @Published var isAnimating: Bool = false
    @Published var animationPhase: Double = 0.0

    // MARK: - Private Properties

    private var cancellables = Set<AnyCancellable>()
    private var animationTimer: Timer?

    // MARK: - State Transitions

    func transition(to newState: TrustState, animated: Bool = true) {
        guard currentState != newState else { return }

        let previousState = currentState
        currentState = newState

        if animated {
            animateTransition(from: previousState, to: newState)
        }
    }

    func updateTrustScore(_ score: Double, animated: Bool = true) {
        let clampedScore = max(0.0, min(100.0, score))

        if animated {
            withAnimation(TrustMotionConfig.smoothSpring) {
                trustScore = clampedScore
            }
        } else {
            trustScore = clampedScore
        }

        // Update state based on score
        updateStateFromScore()
    }

    // MARK: - Animation Control

    func startAnimation() {
        guard !isAnimating else { return }

        isAnimating = true

        // Continuous animation loop
        animationTimer = Timer.scheduledTimer(withTimeInterval: 0.016, repeats: true) { [weak self] _ in
            guard let self = self, self.isAnimating else { return }

            Task { @MainActor in
                self.animationPhase += 0.01
                if self.animationPhase >= 1.0 {
                    self.animationPhase = 0.0
                }
            }
        }
    }

    func stopAnimation() {
        isAnimating = false
        animationTimer?.invalidate()
        animationTimer = nil
    }

    func reset() {
        stopAnimation()
        currentState = .idle
        trustScore = 0.0
        animationPhase = 0.0
    }

    // MARK: - Private Methods

    private func animateTransition(from: TrustState, to: TrustState) {
        // Play haptic feedback
        playHapticForTransition(to: to)

        // Trigger animation based on transition
        switch to {
        case .passed:
            // Celebration animation
            triggerBloomAnimation()
        case .failed:
            // Failure feedback
            triggerFailureAnimation()
        case .warning:
            // Warning pulse
            triggerWarningAnimation()
        case .verifying:
            // Start continuous animation
            startAnimation()
        case .idle:
            // Stop animation
            stopAnimation()
        }
    }

    private func updateStateFromScore() {
        if trustScore >= 80 {
            if currentState != .passed {
                transition(to: .passed)
            }
        } else if trustScore >= 60 {
            if currentState != .warning && currentState != .passed {
                transition(to: .warning)
            }
        } else if trustScore < 40 {
            if currentState != .failed {
                transition(to: .failed)
            }
        }
    }

    private func triggerBloomAnimation() {
        // Bloom animation will be handled by TrustBloomAnimation
        stopAnimation()
    }

    private func triggerFailureAnimation() {
        // Failure animation handled by FailureFractureEffect
        stopAnimation()
    }

    private func triggerWarningAnimation() {
        // Warning animation handled by HazardGlow
        startAnimation()
    }

    private func playHapticForTransition(to: TrustState) {
        switch to {
        case .passed:
            HapticFeedback.play(.trustGained)
        case .failed:
            HapticFeedback.play(.trustLost)
        case .warning:
            HapticFeedback.play(.warning)
        case .verifying:
            HapticFeedback.play(.impact(style: .light))
        case .idle:
            break
        }
    }

    deinit {
        stopAnimation()
    }
}

