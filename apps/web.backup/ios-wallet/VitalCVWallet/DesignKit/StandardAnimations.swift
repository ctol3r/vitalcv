//
//  StandardAnimations.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 5
//  Standardized sheet + modal animations
//

import SwiftUI

// MARK: - Standard Animation Presets

struct StandardAnimations {
    // Sheet animations
    static let sheetSpring = Animation.spring(response: 0.4, dampingFraction: 0.8, blendDuration: 0)
    static let sheetBouncy = Animation.spring(response: 0.5, dampingFraction: 0.7, blendDuration: 0)
    static let sheetSmooth = Animation.easeInOut(duration: 0.3)

    // Modal animations
    static let modalSpring = Animation.spring(response: 0.35, dampingFraction: 0.85, blendDuration: 0)
    static let modalFade = Animation.easeInOut(duration: 0.25)
    static let modalScale = Animation.spring(response: 0.3, dampingFraction: 0.8, blendDuration: 0)

    // Card animations
    static let cardFlip = Animation.spring(response: 0.4, dampingFraction: 0.75, blendDuration: 0)
    static let cardPeel = Animation.spring(response: 0.5, dampingFraction: 0.7, blendDuration: 0)

    // Trust animations
    static let trustPulse = Animation.easeInOut(duration: 1.5).repeatForever(autoreverses: true)
    static let trustGlow = Animation.easeInOut(duration: 2.0).repeatForever(autoreverses: true)
}

// MARK: - Sheet Transition

struct StandardSheetTransition: ViewModifier {
    let edge: Edge

    enum Edge {
        case bottom
        case top
        case leading
        case trailing
    }

    func body(content: Content) -> some View {
        content
            .transition(.asymmetric(
                insertion: .move(edge: edge).combined(with: .opacity),
                removal: .move(edge: edge).combined(with: .opacity)
            ))
    }
}

extension View {
    func standardSheetTransition(edge: StandardSheetTransition.Edge = .bottom) -> some View {
        modifier(StandardSheetTransition(edge: edge))
    }
}

// MARK: - Modal Transition

struct StandardModalTransition: ViewModifier {
    func body(content: Content) -> some View {
        content
            .transition(.asymmetric(
                insertion: .scale(scale: 0.9).combined(with: .opacity),
                removal: .scale(scale: 0.95).combined(with: .opacity)
            ))
    }
}

extension View {
    func standardModalTransition() -> some View {
        modifier(StandardModalTransition())
    }
}

// MARK: - Card Stack Animation

struct CardStackAnimation: ViewModifier {
    let index: Int
    let total: Int
    @State private var offset: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .offset(y: offset)
            .scaleEffect(1.0 - CGFloat(index) * 0.05)
            .zIndex(Double(total - index))
            .animation(
                StandardAnimations.sheetSpring.delay(Double(index) * 0.1),
                value: offset
            )
    }
}

extension View {
    func cardStackAnimation(index: Int, total: Int) -> some View {
        modifier(CardStackAnimation(index: index, total: total))
    }
}

// MARK: - Parallax Effect

struct ParallaxEffect: GeometryEffect {
    var offset: CGFloat

    var animatableData: CGFloat {
        get { offset }
        set { offset = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        let translation = CGAffineTransform(translationX: 0, y: offset)
        return ProjectionTransform(translation)
    }
}

extension View {
    func parallax(offset: CGFloat) -> some View {
        modifier(ParallaxEffect(offset: offset))
    }
}

// MARK: - Trust Pulse Animation

struct TrustPulseModifier: ViewModifier {
    @State private var isPulsing = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPulsing ? 1.05 : 1.0)
            .opacity(isPulsing ? 0.8 : 1.0)
            .onAppear {
                withAnimation(StandardAnimations.trustPulse) {
                    isPulsing = true
                }
            }
    }
}

extension View {
    func trustPulse() -> some View {
        modifier(TrustPulseModifier())
    }
}








