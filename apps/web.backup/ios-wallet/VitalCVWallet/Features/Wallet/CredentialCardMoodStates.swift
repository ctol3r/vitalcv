//
//  CredentialCardMoodStates.swift
//  VitalCVWallet
//
//  Created: Batch 566 - Task 10
//  Card mood-states (safe / pending / expired)
//

import SwiftUI

/// CredentialMoodState - Visual mood states for credential cards
public enum CredentialMoodState {
    case safe      // Valid, active credential
    case pending   // Verification in progress or expiring soon
    case expired   // Credential has expired
    case warning   // Warning state (e.g., weak signature)
    case error     // Error state (e.g., invalid proof)

    var color: Color {
        switch self {
        case .safe: return .walletSuccess
        case .pending: return .walletWarning
        case .expired: return .walletError
        case .warning: return .walletWarning
        case .error: return .walletError
        }
    }

    var icon: String {
        switch self {
        case .safe: return "checkmark.circle.fill"
        case .pending: return "clock.fill"
        case .expired: return "xmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "exclamationmark.octagon.fill"
        }
    }

    var title: String {
        switch self {
        case .safe: return "Safe"
        case .pending: return "Pending"
        case .expired: return "Expired"
        case .warning: return "Warning"
        case .error: return "Error"
        }
    }

    var glowIntensity: CGFloat {
        switch self {
        case .safe: return 0.3
        case .pending: return 0.2
        case .expired: return 0.1
        case .warning: return 0.25
        case .error: return 0.15
        }
    }
}

/// CredentialMoodStateIndicator - Visual indicator for mood state
public struct CredentialMoodStateIndicator: View {
    let moodState: CredentialMoodState
    let size: CGFloat

    @State private var isPulsing = false

    public init(moodState: CredentialMoodState, size: CGFloat = 12) {
        self.moodState = moodState
        self.size = size
    }

    public var body: some View {
        ZStack {
            // Glow effect
            Circle()
                .fill(moodState.color.opacity(moodState.glowIntensity))
                .frame(width: size * 2, height: size * 2)
                .blur(radius: 4)
                .opacity(isPulsing ? 0.5 : 1.0)
                .animation(
                    Animation.easeInOut(duration: 2.0)
                        .repeatForever(autoreverses: true),
                    value: isPulsing
                )

            // Icon
            Image(systemName: moodState.icon)
                .font(.system(size: size))
                .foregroundColor(moodState.color)
        }
        .onAppear {
            if moodState == .safe || moodState == .pending {
                isPulsing = true
            }
        }
    }
}

/// CredentialMoodStateBadge - Badge showing mood state
public struct CredentialMoodStateBadge: View {
    let moodState: CredentialMoodState

    public var body: some View {
        HStack(spacing: WalletSpacing.xs) {
            CredentialMoodStateIndicator(moodState: moodState)

            Text(moodState.title)
                .font(WalletTypography.caption2)
                .foregroundColor(moodState.color)
        }
        .padding(.horizontal, WalletSpacing.sm)
        .padding(.vertical, 4)
        .background(moodState.color.opacity(0.1))
        .cornerRadius(WalletCornerRadius.small)
        .overlay(
            RoundedRectangle(cornerRadius: WalletCornerRadius.small)
                .stroke(moodState.color.opacity(0.3), lineWidth: 1)
        )
    }
}

/// CredentialMoodStateRing - Animated ring around card
public struct CredentialMoodStateRing: View {
    let moodState: CredentialMoodState
    let lineWidth: CGFloat

    @State private var rotation: Double = 0

    public init(moodState: CredentialMoodState, lineWidth: CGFloat = 3) {
        self.moodState = moodState
        self.lineWidth = lineWidth
    }

    public var body: some View {
        Circle()
            .stroke(
                AngularGradient(
                    gradient: Gradient(colors: [
                        moodState.color.opacity(0.3),
                        moodState.color,
                        moodState.color.opacity(0.3)
                    ]),
                    center: .center,
                    angle: .degrees(rotation)
                ),
                lineWidth: lineWidth
            )
            .rotationEffect(.degrees(rotation))
            .onAppear {
                if moodState == .pending {
                    withAnimation(
                        Animation.linear(duration: 2.0)
                            .repeatForever(autoreverses: false)
                    ) {
                        rotation = 360
                    }
                }
            }
    }
}

/// Extension to determine mood state from credential
extension VerifiableCredential {
    public var moodState: CredentialMoodState {
        // Check expiration
        if isExpired {
            return .expired
        }

        // Check if expiring soon
        if isExpiringSoon {
            return .pending
        }

        // Check proof validity (would need to integrate with verification)
        if proof == nil {
            return .warning
        }

        // Default to safe
        return .safe
    }
}

/// CredentialCardMoodOverlay - Overlay for mood state on cards
public struct CredentialCardMoodOverlay: ViewModifier {
    let credential: VerifiableCredential

    public func body(content: Content) -> some View {
        content
            .overlay(
                // Mood state indicator
                VStack {
                    HStack {
                        Spacer()
                        CredentialMoodStateIndicator(
                            moodState: credential.moodState,
                            size: 16
                        )
                        .padding(WalletSpacing.sm)
                    }
                    Spacer()
                }
            )
            .overlay(
                // Mood state ring (for pending/expired)
                Group {
                    if credential.moodState == .pending || credential.moodState == .expired {
                        CredentialMoodStateRing(moodState: credential.moodState)
                            .padding(-WalletSpacing.xs)
                    }
                }
            )
            .overlay(
                // Border color based on mood
                RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                    .stroke(
                        credential.moodState.color.opacity(
                            credential.moodState == .safe ? 0.0 : 0.5
                        ),
                        lineWidth: credential.moodState == .safe ? 0 : 2
                    )
            )
    }
}

extension View {
    public func credentialMoodOverlay(credential: VerifiableCredential) -> some View {
        modifier(CredentialCardMoodOverlay(credential: credential))
    }
}

