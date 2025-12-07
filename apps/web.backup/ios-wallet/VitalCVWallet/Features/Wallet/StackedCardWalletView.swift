//
//  StackedCardWalletView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 11
//  Stacked-card wallet with depth layers
//

import SwiftUI

struct StackedCardWalletView: View {
    let credentials: [VerifiableCredential]
    let onCardTap: (VerifiableCredential) -> Void
    @State private var dragOffset: CGFloat = 0
    @State private var selectedIndex: Int = 0
    @State private var scrollOffset: CGFloat = 0

    private let cardSpacing: CGFloat = 20
    private let maxVisibleCards = 3

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(Array(visibleCards.enumerated()), id: \.element.id) { index, credential in
                    CredentialCard(
                        credential: credential,
                        onTap: {
                            onCardTap(credential)
                        }
                    )
                    .cardStackAnimation(
                        index: index,
                        total: min(visibleCards.count, maxVisibleCards)
                    )
                    .offset(
                        x: cardOffsetX(for: index, in: geometry.size.width),
                        y: cardOffsetY(for: index) + scrollOffset * parallaxMultiplier(for: index)
                    )
                    .scaleEffect(cardScale(for: index))
                    .zIndex(Double(maxVisibleCards - index))
                    .opacity(cardOpacity(for: index))
                }
            }
            .gesture(
                DragGesture()
                    .onChanged { value in
                        dragOffset = value.translation.x
                    }
                    .onEnded { value in
                        handleDragEnd(value: value, screenWidth: geometry.size.width)
                    }
            )
        }
        .frame(height: 200)
    }

    private var visibleCards: [VerifiableCredential] {
        Array(credentials.prefix(maxVisibleCards))
    }

    private func cardOffsetX(for index: Int, in width: CGFloat) -> CGFloat {
        let baseOffset = CGFloat(index) * 10.0
        if index == 0 {
            return baseOffset + dragOffset
        }
        return baseOffset
    }

    private func cardOffsetY(for index: Int) -> CGFloat {
        CGFloat(index) * 8.0
    }

    private func cardScale(for index: Int) -> CGFloat {
        1.0 - CGFloat(index) * 0.05
    }

    private func cardOpacity(for index: Int) -> Double {
        if index >= maxVisibleCards {
            return 0.0
        }
        return 1.0 - Double(index) * 0.15
    }

    private func parallaxMultiplier(for index: Int) -> CGFloat {
        // Each card moves at different speed for parallax effect
        return CGFloat(index) * 0.3
    }

    private func handleDragEnd(value: DragGesture.Value, screenWidth: CGFloat) {
        let threshold: CGFloat = screenWidth * 0.25

        withAnimation(StandardAnimations.sheetSpring) {
            if value.translation.x > threshold && selectedIndex > 0 {
                selectedIndex -= 1
            } else if value.translation.x < -threshold && selectedIndex < credentials.count - 1 {
                selectedIndex += 1
            }
            dragOffset = 0
        }
    }
}

// MARK: - Parallax Scroll Modifier (Task 12)

struct ParallaxScrollModifier: ViewModifier {
    @Binding var scrollOffset: CGFloat
    let parallaxSpeed: CGFloat

    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { geometry in
                    Color.clear
                        .preference(
                            key: ScrollOffsetPreferenceKey.self,
                            value: geometry.frame(in: .named("scroll")).minY
                        )
                }
            )
            .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
                scrollOffset = value * parallaxSpeed
            }
    }
}

extension View {
    func parallaxScroll(offset: Binding<CGFloat>, speed: CGFloat = 0.5) -> some View {
        modifier(ParallaxScrollModifier(scrollOffset: offset, parallaxSpeed: speed))
    }
}

struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}








