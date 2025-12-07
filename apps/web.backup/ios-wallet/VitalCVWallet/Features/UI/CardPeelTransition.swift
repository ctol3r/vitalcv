//
//  CardPeelTransition.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 34
//  Apple-style "card peel" transition
//

import SwiftUI

struct CardPeelTransition: ViewModifier {
    @Binding var isPresented: Bool
    let onDismiss: (() -> Void)?

    func body(content: Content) -> some View {
        content
            .transition(.asymmetric(
                insertion: .move(edge: .bottom).combined(with: .opacity),
                removal: .move(edge: .bottom).combined(with: .opacity)
            ))
    }
}

extension View {
    func cardPeelTransition(isPresented: Binding<Bool>, onDismiss: (() -> Void)? = nil) -> some View {
        modifier(CardPeelTransition(isPresented: isPresented, onDismiss: onDismiss))
    }
}

// Card peel animation effect
struct CardPeelEffect: GeometryEffect {
    var amount: CGFloat

    var animatableData: CGFloat {
        get { amount }
        set { amount = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        let rotation = amount * .pi / 2
        let transform = CGAffineTransform(rotationAngle: rotation)
            .concatenating(CGAffineTransform(translationX: size.width * amount, y: 0))

        return ProjectionTransform(transform)
    }
}








