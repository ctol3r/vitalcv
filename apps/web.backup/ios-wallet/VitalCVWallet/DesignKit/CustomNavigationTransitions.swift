//
//  CustomNavigationTransitions.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 18
//  Custom navigation transitions (fade-slide combo)
//

import SwiftUI

// MARK: - Fade-Slide Transition

struct FadeSlideTransition: ViewModifier {
    let edge: Edge
    var isPresented: Bool

    enum Edge {
        case leading
        case trailing
        case top
        case bottom
    }

    func body(content: Content) -> some View {
        content
            .transition(
                .asymmetric(
                    insertion: .move(edge: transitionEdge).combined(with: .opacity),
                    removal: .move(edge: transitionEdge).combined(with: .opacity)
                )
            )
    }

    private var transitionEdge: Edge {
        switch edge {
        case .leading: return .leading
        case .trailing: return .trailing
        case .top: return .top
        case .bottom: return .bottom
        }
    }
}

// MARK: - Scale-Fade Transition

struct ScaleFadeTransition: ViewModifier {
    var isPresented: Bool

    func body(content: Content) -> some View {
        content
            .transition(
                .asymmetric(
                    insertion: .scale(scale: 0.9).combined(with: .opacity),
                    removal: .scale(scale: 0.95).combined(with: .opacity)
                )
            )
    }
}

// MARK: - Trust-Aware Transition

struct TrustTransition: ViewModifier {
    var trustScore: Double
    var isPresented: Bool

    func body(content: Content) -> some View {
        content
            .transition(
                .asymmetric(
                    insertion: .scale(scale: 0.8)
                        .combined(with: .opacity)
                        .combined(with: .blur(radius: isPresented ? 0 : 10)),
                    removal: .scale(scale: 1.1)
                        .combined(with: .opacity)
                )
            )
            .animation(
                .spring(response: 0.5, dampingFraction: 0.7)
                    .speed(trustScore > 0.7 ? 1.2 : 0.8),
                value: isPresented
            )
    }
}

// MARK: - View Extensions

extension View {
    /// Apply fade-slide transition
    func fadeSlideTransition(edge: FadeSlideTransition.Edge = .trailing) -> some View {
        modifier(FadeSlideTransition(edge: edge, isPresented: true))
    }

    /// Apply scale-fade transition
    func scaleFadeTransition() -> some View {
        modifier(ScaleFadeTransition(isPresented: true))
    }

    /// Apply trust-aware transition
    func trustTransition(trustScore: Double) -> some View {
        modifier(TrustTransition(trustScore: trustScore, isPresented: true))
    }
}

// MARK: - Navigation Link Style

struct FadeSlideNavigationLinkStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .navigationTransition(.zoom(sourceID: \.self))
    }
}

extension View {
    func fadeSlideNavigation() -> some View {
        modifier(FadeSlideNavigationLinkStyle())
    }
}








