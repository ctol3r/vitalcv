//
//  VerificationTimelineView.swift
//  VitalCVWallet
//
//  Created: Phase 4 - Trust UX Experience
//  The emotional arc. The magic. The SparkJoy.
//

import SwiftUI

// MARK: - Task 27: Animated Step-by-Step Timeline

struct VerificationTimelineView: View {
    let currentStep: VerificationStep
    @State private var completedSteps: Set<VerificationStep> = []
    @State private var trustPulse: Bool = false
    @State private var colorTransition: Double = 0.0

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Verification Progress")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            ForEach(verificationSteps, id: \.step) { stepInfo in
                VerificationStepRow(
                    step: stepInfo.step,
                    label: stepInfo.label,
                    isActive: currentStep == stepInfo.step,
                    isCompleted: completedSteps.contains(stepInfo.step),
                    trustPulse: trustPulse && currentStep == stepInfo.step,
                    colorTransition: colorTransition
                )
            }
        }
        .onChange(of: currentStep) { newStep in
            handleStepChange(newStep)
        }
        .onAppear {
            updateCompletedSteps()
        }
    }

    private var verificationSteps: [(step: VerificationStep, label: String)] {
        [
            (.verifyingSignature, "Signature Verification"),
            (.fetchingIssuerDID, "Issuer DID Resolution"),
            (.validatingIssuerTrust, "Issuer Trust Validation"),
            (.fetchingChainAnchor, "Chain Anchor Check"),
            (.fetchingCompliance, "Compliance Verification"),
            (.calculatingTrustScore, "Trust Score Calculation")
        ]
    }

    private func handleStepChange(_ step: VerificationStep) {
        // Task 28: Trust pulse effect when step completes
        if completedSteps.contains(step) {
            withAnimation(.spring(response: 0.3)) {
                trustPulse = true
            }

            // Task 32: Micro-haptic sequence
            HapticFeedback.shared.play(.impact(style: .light))

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                trustPulse = false
            }
        }

        updateCompletedSteps()

        // Task 33: Warm color transition
        withAnimation(.easeInOut(duration: 0.5)) {
            colorTransition = Double(completedSteps.count) / Double(verificationSteps.count)
        }
    }

    private func updateCompletedSteps() {
        let allSteps: [VerificationStep] = [
            .verifyingSignature,
            .fetchingIssuerDID,
            .validatingIssuerTrust,
            .fetchingChainAnchor,
            .fetchingCompliance,
            .calculatingTrustScore
        ]

        if let currentIndex = allSteps.firstIndex(of: currentStep) {
            completedSteps = Set(allSteps.prefix(currentIndex))
        } else if currentStep == .completed {
            completedSteps = Set(allSteps)
        }
    }
}

struct VerificationStepRow: View {
    let step: VerificationStep
    let label: String
    let isActive: Bool
    let isCompleted: Bool
    let trustPulse: Bool
    let colorTransition: Double

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            // Step indicator
            ZStack {
                Circle()
                    .fill(stepColor.opacity(0.2))
                    .frame(width: 32, height: 32)

                if isCompleted {
                    Image(systemName: "checkmark")
                        .foregroundColor(stepColor)
                        .font(.system(size: 16, weight: .bold))
                } else if isActive {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: stepColor))
                } else {
                    Circle()
                        .stroke(stepColor.opacity(0.3), lineWidth: 2)
                        .frame(width: 32, height: 32)
                }
            }
            .scaleEffect(trustPulse ? 1.2 : 1.0)
            .animation(.spring(response: 0.3), value: trustPulse)

            // Step label
            Text(label)
                .font(WalletTypography.subheadline)
                .foregroundColor(isActive || isCompleted ? .walletText : .walletTextSecondary)

            Spacer()
        }
        .padding(.vertical, WalletSpacing.xs)
    }

    // Task 33: Warm color transition (yellow → green)
    private var stepColor: Color {
        if isCompleted {
            // Green for completed
            return Color.green
        } else if isActive {
            // Yellow transitioning to green based on progress
            return Color(
                red: 1.0 - (colorTransition * 0.5),
                green: 0.8 + (colorTransition * 0.2),
                blue: colorTransition * 0.3
            )
        } else {
            return Color.walletTextSecondary
        }
    }
}

// MARK: - Task 29: Chain Ripple Animation

struct ChainRippleAnimation: View {
    @State private var rippleScale: CGFloat = 1.0
    @State private var rippleOpacity: Double = 1.0

    var body: some View {
        ZStack {
            ForEach(0..<3) { index in
                Circle()
                    .stroke(Color.green, lineWidth: 2)
                    .frame(width: 100, height: 100)
                    .scaleEffect(rippleScale + CGFloat(index) * 0.3)
                    .opacity(rippleOpacity - Double(index) * 0.3)
            }
        }
        .onAppear {
            withAnimation(
                Animation.easeOut(duration: 1.0)
                    .repeatForever(autoreverses: false)
            ) {
                rippleScale = 2.0
                rippleOpacity = 0.0
            }
        }
    }
}

// MARK: - Task 30: Trust Glow Modifier

struct TrustGlowModifier: ViewModifier {
    let trustScore: Double
    @State private var glowIntensity: Double = 0.0

    func body(content: Content) -> some View {
        content
            .shadow(
                color: trustScore >= 0.8 ? Color.green.opacity(glowIntensity) : Color.clear,
                radius: 20
            )
            .onAppear {
                if trustScore >= 0.8 {
                    withAnimation(
                        Animation.easeInOut(duration: 1.5)
                            .repeatForever(autoreverses: true)
                    ) {
                        glowIntensity = 0.6
                    }
                }
            }
    }
}

extension View {
    func trustGlow(score: Double) -> some View {
        modifier(TrustGlowModifier(trustScore: score))
    }
}

// MARK: - Task 31: Identity Orb Resonance

struct IdentityOrbResonance: View {
    @State private var resonance: CGFloat = 1.0
    let isPerfect: Bool

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        Color.blue.opacity(0.8),
                        Color.purple.opacity(0.6),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: 100
                )
            )
            .frame(width: 200, height: 200)
            .scaleEffect(resonance)
            .opacity(isPerfect ? 1.0 : 0.0)
            .onAppear {
                if isPerfect {
                    withAnimation(
                        Animation.spring(response: 0.6, dampingFraction: 0.5)
                            .repeatForever(autoreverses: true)
                    ) {
                        resonance = 1.1
                    }
                }
            }
    }
}

// MARK: - Task 34: Trust Explainer

struct TrustExplainerView: View {
    let trustScore: TrustScore
    @State private var isExpanded: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Button(action: {
                withAnimation {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    Text("What affected trust?")
                        .font(WalletTypography.headline)

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                }
            }
            .foregroundColor(.walletText)

            if isExpanded {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    TrustFactorRow(
                        label: "Issuer Trust",
                        score: trustScore.issuerScore,
                        explanation: "The credential issuer's reputation and verification status"
                    )

                    TrustFactorRow(
                        label: "Chain Anchor",
                        score: trustScore.chainScore,
                        explanation: "Blockchain confirmation and immutability"
                    )

                    TrustFactorRow(
                        label: "Compliance",
                        score: trustScore.complianceScore,
                        explanation: "Regulatory compliance and sanctions checks"
                    )
                }
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding()
        .background(Color.walletBackground)
        .cornerRadius(WalletCornerRadius.large)
    }
}

struct TrustFactorRow: View {
    let label: String
    let score: Double
    let explanation: String

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            HStack {
                Text(label)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)

                Spacer()

                Text("\(Int(score * 100))%")
                    .font(WalletTypography.caption)
                    .foregroundColor(scoreColor)
            }

            ProgressView(value: score)
                .progressViewStyle(LinearProgressViewStyle(tint: scoreColor))

            Text(explanation)
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
        }
    }

    private var scoreColor: Color {
        if score >= 0.8 {
            return .green
        } else if score >= 0.5 {
            return .yellow
        } else {
            return .red
        }
    }
}




