//
//  VerificationStepPop.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 4, Task 25
//  Tiny bounce when each verification step resolves
//

import SwiftUI

/// VerificationStepPop - Tiny bounce animation when step resolves
struct VerificationStepPop: ViewModifier {
    @State private var isPopping = false
    @State private var popScale: CGFloat = 1.0

    func body(content: Content) -> some View {
        content
            .scaleEffect(popScale)
            .onAppear {
                triggerPop()
            }
    }

    private func triggerPop() {
        isPopping = true

        // Quick pop up
        withAnimation(
            Animation.easeOut(duration: 0.15)
        ) {
            popScale = 1.15
        }

        // Bounce back
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(
                TrustMotionConfig.bouncySpring
            ) {
                popScale = 1.0
            }
        }

        TrustHapticEngine.shared.stepCompleted()
    }
}

/// VerificationStepView - Complete step view with pop animation
struct VerificationStepView: View {
    let step: VerificationStep
    let isCompleted: Bool
    @State private var showCheckmark = false

    struct VerificationStep: Identifiable {
        let id: UUID
        let title: String
        let description: String?
    }

    var body: some View {
        HStack(spacing: 12) {
            // Step indicator
            ZStack {
                Circle()
                    .fill(isCompleted ? Color.trustEmerald : Color.walletTextSecondary.opacity(0.2))
                    .frame(width: 40, height: 40)

                if isCompleted {
                    Image(systemName: "checkmark")
                        .foregroundColor(.white)
                        .font(.system(size: 18, weight: .bold))
                        .transition(.scale.combined(with: .opacity))
                } else {
                    Circle()
                        .stroke(Color.walletTextSecondary.opacity(0.3), lineWidth: 2)
                        .frame(width: 40, height: 40)
                }
            }
            .modifier(VerificationStepPop())

            // Step content
            VStack(alignment: .leading, spacing: 4) {
                Text(step.title)
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                if let description = step.description {
                    Text(description)
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }
            }

            Spacer()
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(isCompleted ? Color.trustEmerald.opacity(0.05) : Color.walletCard)
        )
        .onChange(of: isCompleted) { completed in
            if completed {
                showCheckmark = true
            }
        }
    }
}

extension View {
    /// Adds verification step pop (tiny bounce) animation
    func verificationStepPop() -> some View {
        modifier(VerificationStepPop())
    }
}

