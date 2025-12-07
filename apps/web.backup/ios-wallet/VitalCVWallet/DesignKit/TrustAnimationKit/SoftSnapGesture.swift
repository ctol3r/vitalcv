//
//  SoftSnapGesture.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 4, Task 29
//  Soft snap gestures for card swipes
//

import SwiftUI

/// SoftSnapGesture - Smooth snap gesture for card swipes
struct SoftSnapGesture: ViewModifier {
    let snapThreshold: CGFloat
    let onSnap: (SnapDirection) -> Void

    enum SnapDirection {
        case left
        case right
        case up
        case down
        case none
    }

    @State private var dragOffset: CGSize = .zero
    @State private var isDragging = false

    init(snapThreshold: CGFloat = 100, onSnap: @escaping (SnapDirection) -> Void) {
        self.snapThreshold = snapThreshold
        self.onSnap = onSnap
    }

    func body(content: Content) -> some View {
        content
            .offset(dragOffset)
            .scaleEffect(isDragging ? 0.95 : 1.0)
            .rotationEffect(.degrees(isDragging ? Double(dragOffset.width) * 0.05 : 0))
            .gesture(
                DragGesture()
                    .onChanged { value in
                        isDragging = true
                        dragOffset = value.translation
                    }
                    .onEnded { value in
                        handleSnap(from: value)
                    }
            )
    }

    private func handleSnap(from gesture: DragGesture.Value) {
        let translation = gesture.translation
        let velocity = gesture.predictedEndTranslation

        var snapDirection: SnapDirection = .none

        // Determine snap direction based on translation and velocity
        if abs(translation.width) > abs(translation.height) {
            // Horizontal swipe
            if abs(translation.width) > snapThreshold || abs(velocity.width) > 500 {
                snapDirection = translation.width > 0 ? .right : .left
            }
        } else {
            // Vertical swipe
            if abs(translation.height) > snapThreshold || abs(velocity.height) > 500 {
                snapDirection = translation.height > 0 ? .down : .up
            }
        }

        // Animate snap
        if snapDirection != .none {
            // Snap off screen
            withAnimation(TrustMotionConfig.smoothSpring) {
                let snapDistance: CGFloat = 1000
                switch snapDirection {
                case .left:
                    dragOffset.width = -snapDistance
                case .right:
                    dragOffset.width = snapDistance
                case .up:
                    dragOffset.height = -snapDistance
                case .down:
                    dragOffset.height = snapDistance
                case .none:
                    break
                }
            }

            // Callback after animation
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                onSnap(snapDirection)
                dragOffset = .zero
                isDragging = false
            }

            TrustHapticEngine.shared.stepCompleted()
        } else {
            // Snap back
            withAnimation(TrustMotionConfig.bouncySpring) {
                dragOffset = .zero
                isDragging = false
            }
        }
    }
}

/// SwipeableCard - Card with soft snap gesture
struct SwipeableCard<Content: View>: View {
    let content: Content
    let onSwipe: (SoftSnapGesture.SnapDirection) -> Void

    @State private var isVisible = true

    init(@ViewBuilder content: () -> Content, onSwipe: @escaping (SoftSnapGesture.SnapDirection) -> Void) {
        self.content = content()
        self.onSwipe = onSwipe
    }

    var body: some View {
        if isVisible {
            content
                .modifier(SoftSnapGesture { direction in
                    if direction != .none {
                        isVisible = false
                        onSwipe(direction)
                    }
                })
                .transition(.asymmetric(
                    insertion: .move(edge: .bottom).combined(with: .opacity),
                    removal: .scale.combined(with: .opacity)
                ))
        }
    }
}

extension View {
    /// Adds soft snap gesture for card swipes
    func softSnapGesture(
        threshold: CGFloat = 100,
        onSnap: @escaping (SoftSnapGesture.SnapDirection) -> Void
    ) -> some View {
        modifier(SoftSnapGesture(snapThreshold: threshold, onSnap: onSnap))
    }
}

