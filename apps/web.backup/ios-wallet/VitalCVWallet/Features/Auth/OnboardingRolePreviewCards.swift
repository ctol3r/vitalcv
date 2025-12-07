//
//  OnboardingRolePreviewCards.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 15
//  Onboarding role preview cards (Clinician, Issuer, Verifier)
//

import SwiftUI

/// OnboardingRolePreviewCards - Preview cards showing different user roles
struct OnboardingRolePreviewCards: View {
    @Binding var selectedRole: UserRole?
    let onRoleSelected: (UserRole) -> Void

    var body: some View {
        VStack(spacing: WalletSpacing.lg) {
            Text("Choose Your Role")
                .font(WalletTypography.title2)
                .foregroundColor(.walletText)
                .padding(.top, WalletSpacing.lg)

            Text("Select how you'll primarily use VitalCV")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, WalletSpacing.lg)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: WalletSpacing.md) {
                    ForEach(UserRole.allCases, id: \.self) { role in
                        RolePreviewCard(
                            role: role,
                            isSelected: selectedRole == role
                        ) {
                            selectedRole = role
                            onRoleSelected(role)
                        }
                    }
                }
                .padding(.horizontal, WalletSpacing.lg)
            }
        }
    }
}

// MARK: - User Role

enum UserRole: String, CaseIterable {
    case clinician = "Clinician"
    case issuer = "Issuer"
    case verifier = "Verifier"

    var icon: String {
        switch self {
        case .clinician:
            return "person.badge.shield.checkmark.fill"
        case .issuer:
            return "seal.fill"
        case .verifier:
            return "checkmark.shield.fill"
        }
    }

    var title: String {
        return rawValue
    }

    var description: String {
        switch self {
        case .clinician:
            return "Store and manage your professional credentials"
        case .issuer:
            return "Issue verifiable credentials to others"
        case .verifier:
            return "Verify credentials from issuers"
        }
    }

    var features: [String] {
        switch self {
        case .clinician:
            return [
                "Store credentials securely",
                "Share proof with employers",
                "Track verification history"
            ]
        case .issuer:
            return [
                "Issue credentials",
                "Manage credential lifecycle",
                "Track issuance analytics"
            ]
        case .verifier:
            return [
                "Scan QR codes to verify",
                "Check credential status",
                "View verification history"
            ]
        }
    }

    var color: Color {
        switch self {
        case .clinician:
            return .walletPrimary
        case .issuer:
            return .walletSuccess
        case .verifier:
            return .walletAccent
        }
    }
}

// MARK: - Role Preview Card

struct RolePreviewCard: View {
    let role: UserRole
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                // Icon
                ZStack {
                    Circle()
                        .fill(role.color.opacity(0.1))
                        .frame(width: 60, height: 60)

                    Image(systemName: role.icon)
                        .font(.system(size: 30))
                        .foregroundColor(role.color)
                }

                // Title
                Text(role.title)
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                // Description
                Text(role.description)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                // Features
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    ForEach(role.features, id: \.self) { feature in
                        HStack(spacing: WalletSpacing.xs) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 12))
                                .foregroundColor(role.color)

                            Text(feature)
                                .font(WalletTypography.caption)
                                .foregroundColor(.walletTextSecondary)
                        }
                    }
                }

                Spacer()

                // Selection indicator
                if isSelected {
                    HStack {
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(role.color)
                            .font(.title3)
                    }
                }
            }
            .padding(WalletSpacing.lg)
            .frame(width: 280, height: 320)
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.large)
            .overlay(
                RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                    .stroke(
                        isSelected ? role.color : Color.clear,
                        lineWidth: 3
                    )
            )
            .walletShadow(isSelected ? WalletShadow.large : WalletShadow.medium)
            .scaleEffect(isSelected ? 1.02 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSelected)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    OnboardingRolePreviewCards(selectedRole: .constant(nil)) { role in
        print("Selected role: \(role)")
    }
}

