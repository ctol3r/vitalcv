//
//  CredentialCard.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 12
//  Card-stack UI for credentials
//

import SwiftUI
import UIKit

struct CredentialCard: View {
    let credential: VerifiableCredential
    let onTap: () -> Void
    var size: CardSize = .medium // Task 12: Dynamic card sizes
    var isPrimary: Bool = false // Task 13: Primary credential badge

    @State private var isPressed = false

    enum CardSize {
        case small, medium, expanded

        var padding: CGFloat {
            switch self {
            case .small: return WalletSpacing.sm
            case .medium: return WalletSpacing.md
            case .expanded: return WalletSpacing.lg
            }
        }

        var minHeight: CGFloat {
            switch self {
            case .small: return 80
            case .medium: return 120
            case .expanded: return 180
            }
        }
    }

    var body: some View {
        Button(action: {
            // Task 15: Haptic feedback for card interactions
            HapticFeedbackService.shared.cardTapped()
            onTap()
        }) {
            VStack(alignment: .leading, spacing: size.padding) {
                // Task 13: Primary credential badge
                if isPrimary {
                    HStack {
                        Image(systemName: "star.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.walletAccent)
                        Text("Primary Credential")
                            .font(WalletTypography.caption2)
                            .foregroundColor(.walletAccent)
                        Spacer()
                    }
                    .padding(.horizontal, WalletSpacing.sm)
                    .padding(.vertical, 4)
                    .background(Color.walletAccent.opacity(0.1))
                    .cornerRadius(WalletCornerRadius.small)
                }

                // Header
                HStack {
                    VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                        Text(credential.type.first ?? "Credential")
                            .font(size == .small ? WalletTypography.subheadline : WalletTypography.headline)
                            .foregroundColor(.walletText)

                        Text(credential.issuer.name ?? credential.issuer.id)
                            .font(size == .small ? WalletTypography.caption1 : WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)
                    }

                    Spacer()

                    // Status badge
                    VStack(alignment: .trailing, spacing: WalletSpacing.xs) {
                        statusBadge
                        CredentialRibbon(credential: credential)
                    }
                }

                // Issued date
                HStack {
                    Image(systemName: "calendar")
                        .font(.system(size: 12))
                        .foregroundColor(.walletTextSecondary)

                    Text("Issued \(formatDate(credential.issuanceDate))")
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletTextSecondary)

                    if credential.isExpiringSoon {
                        Spacer()

                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 10))
                            Text("Expiring soon")
                                .font(WalletTypography.caption2)
                        }
                        .foregroundColor(.walletWarning)
                        .padding(.horizontal, WalletSpacing.sm)
                        .padding(.vertical, 4)
                        .background(Color.walletWarning.opacity(0.1))
                        .cornerRadius(WalletCornerRadius.small)
                    }
                }

                // Evidence timeline indicator
                if let evidence = credential.evidence, !evidence.isEmpty {
                    HStack {
                        Image(systemName: "clock.arrow.circlepath")
                            .font(.system(size: 12))
                            .foregroundColor(.walletTextSecondary)

                        Text("\(evidence.count) evidence entries")
                            .font(WalletTypography.caption1)
                            .foregroundColor(.walletTextSecondary)
                    }
                }
            }
            .padding(size.padding)
            .frame(minHeight: size.minHeight)
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.large)
            .walletShadow(isPrimary ? WalletShadow.large : WalletShadow.medium)
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: isPressed)
            // Task 14: Expired/expiring warning states (enhanced visual)
            .overlay(
                RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                    .stroke(
                        credential.isExpired ? Color.walletError.opacity(0.5) :
                        credential.isExpiringSoon ? Color.walletWarning.opacity(0.5) :
                        Color.clear,
                        lineWidth: credential.isExpired || credential.isExpiringSoon ? 2 : 0
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }

    private var statusBadge: some View {
        Group {
            if credential.isExpired {
                Badge(text: "Expired", color: .walletError)
            } else if credential.isExpiringSoon {
                Badge(text: "Expiring", color: .walletWarning)
            } else {
                Badge(text: "Active", color: .walletSuccess)
            }
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

struct Badge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(WalletTypography.caption2)
            .foregroundColor(.white)
            .padding(.horizontal, WalletSpacing.sm)
            .padding(.vertical, 4)
            .background(color)
            .cornerRadius(WalletCornerRadius.small)
    }
}

#Preview {
    CredentialCard(
        credential: VerifiableCredential(
            id: "1",
            type: ["VerifiableCredential", "ProfessionalCredential"],
            issuer: Issuer(id: "did:example:issuer", name: "Medical Board", image: nil),
            issuanceDate: Date(),
            expirationDate: Calendar.current.date(byAdding: .day, value: 30, to: Date()),
            credentialSubject: CredentialSubject(id: "did:example:holder", type: "Person", claims: [:]),
            proof: nil,
            evidence: nil
        ),
        onTap: {}
    )
    .padding()
}

