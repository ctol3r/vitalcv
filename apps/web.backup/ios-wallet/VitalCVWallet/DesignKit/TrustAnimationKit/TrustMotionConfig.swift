//
//  TrustMotionConfig.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 1, Task 3
//  Spring, damping, and duration presets for trust animations
//

import SwiftUI

/// TrustMotionConfig - Centralized animation configuration for trust states
struct TrustMotionConfig {
    // MARK: - Spring Configurations

    /// Responsive spring for quick interactions
    static let responsiveSpring = Animation.spring(
        response: 0.3,
        dampingFraction: 0.8,
        blendDuration: 0
    )

    /// Smooth spring for natural motion
    static let smoothSpring = Animation.spring(
        response: 0.5,
        dampingFraction: 0.75,
        blendDuration: 0
    )

    /// Bouncy spring for celebratory animations
    static let bouncySpring = Animation.spring(
        response: 0.6,
        dampingFraction: 0.6,
        blendDuration: 0
    )

    /// Gentle spring for subtle animations
    static let gentleSpring = Animation.spring(
        response: 0.8,
        dampingFraction: 0.85,
        blendDuration: 0
    )

    // MARK: - Duration Presets

    /// Quick micro-interaction
    static let quick: Double = 0.2

    /// Standard interaction
    static let standard: Double = 0.3

    /// Comfortable transition
    static let comfortable: Double = 0.5

    /// Deliberate animation
    static let deliberate: Double = 0.8

    /// Extended sequence
    static let extended: Double = 1.5

    // MARK: - Easing Functions

    /// Standard ease in-out
    static let easeInOut = Animation.easeInOut(duration: standard)

    /// Fast ease out
    static let easeOut = Animation.easeOut(duration: quick)

    /// Slow ease in
    static let easeIn = Animation.easeIn(duration: comfortable)

    // MARK: - Trust-Specific Presets

    /// Pulse animation for trust indicators
    static let trustPulse: Animation = .easeInOut(duration: 1.5)
        .repeatForever(autoreverses: true)

    /// Glow animation for verified states
    static let trustGlow: Animation = .easeInOut(duration: 2.0)
        .repeatForever(autoreverses: true)

    /// Bloom animation for successful verification
    static let trustBloom: Animation = .spring(
        response: 0.6,
        dampingFraction: 0.65,
        blendDuration: 0
    )

    /// Chain ripple animation
    static let chainRipple: Animation = .easeOut(duration: 1.2)

    /// Anchor snap animation
    static let anchorSnap: Animation = .spring(
        response: 0.4,
        dampingFraction: 0.8,
        blendDuration: 0
    )

    // MARK: - State-Based Configs

    static func animation(for state: TrustState) -> Animation {
        switch state {
        case .idle:
            return smoothSpring
        case .verifying:
            return .linear(duration: extended).repeatForever(autoreverses: false)
        case .passed:
            return trustBloom
        case .warning:
            return bouncySpring
        case .failed:
            return easeOut
        }
    }
}

