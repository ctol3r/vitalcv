//
//  IssuerConnectOnboardingCard.swift
//  VitalCVWallet
//
//  Created: Batch 560 - Task 8
//  Issuer-connect onboarding card
//

import SwiftUI

/// IssuerConnectOnboardingCard - Onboarding card for connecting with issuers
/// Guides users through connecting with credential issuers
struct IssuerConnectOnboardingCard: View {
    @State private var isExpanded = false
    @State private var selectedIssuer: IssuerOption?

    let onConnect: (String) -> Void // issuerId

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Connect with Issuers")
                        .font(WalletTypography.title3)
                        .foregroundColor(.walletTextPrimary)

                    Text("Link your accounts to receive credentials")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()

                Button(action: {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        isExpanded.toggle()
                    }
                }) {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(.walletPrimary)
                        .font(.system(size: 16, weight: .semibold))
                }
            }
            .padding()
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium, corners: [.topLeft, .topRight])

            // Expanded content
            if isExpanded {
                VStack(spacing: 12) {
                    ForEach(IssuerOption.allCases, id: \.self) { issuer in
                        IssuerOptionRow(
                            issuer: issuer,
                            isSelected: selectedIssuer == issuer
                        ) {
                            selectedIssuer = issuer
                        }
                    }

                    if selectedIssuer != nil {
                        Button(action: {
                            if let issuer = selectedIssuer {
                                onConnect(issuer.id)
                            }
                        }) {
                            Text("Connect")
                                .font(WalletTypography.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.walletPrimary)
                                .cornerRadius(WalletCornerRadius.medium)
                        }
                        .padding(.horizontal)
                        .padding(.top, 8)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
                .padding()
                .background(Color.walletCard.opacity(0.5))
                .cornerRadius(WalletCornerRadius.medium, corners: [.bottomLeft, .bottomRight])
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 2)
    }
}

struct IssuerOptionRow: View {
    let issuer: IssuerOption
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Icon
                ZStack {
                    Circle()
                        .fill(issuer.color.opacity(0.2))
                        .frame(width: 44, height: 44)

                    Image(systemName: issuer.icon)
                        .foregroundColor(issuer.color)
                        .font(.system(size: 20))
                }

                // Info
                VStack(alignment: .leading, spacing: 2) {
                    Text(issuer.name)
                        .font(WalletTypography.body)
                        .foregroundColor(.walletTextPrimary)

                    Text(issuer.description)
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()

                // Selection indicator
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.walletPrimary)
                        .font(.system(size: 24))
                } else {
                    Image(systemName: "circle")
                        .foregroundColor(.walletTextSecondary)
                        .font(.system(size: 24))
                }
            }
            .padding()
            .background(isSelected ? Color.walletPrimary.opacity(0.1) : Color.clear)
            .cornerRadius(WalletCornerRadius.small)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

enum IssuerOption: String, CaseIterable {
    case nppes
    case stateBoard
    case hospital
    case university

    var id: String {
        return rawValue
    }

    var name: String {
        switch self {
        case .nppes:
            return "NPPES Registry"
        case .stateBoard:
            return "State Medical Board"
        case .hospital:
            return "Hospital System"
        case .university:
            return "University"
        }
    }

    var description: String {
        switch self {
        case .nppes:
            return "National Provider Identifier"
        case .stateBoard:
            return "Medical license verification"
        case .hospital:
            return "Employment credentials"
        case .university:
            return "Educational credentials"
        }
    }

    var icon: String {
        switch self {
        case .nppes:
            return "building.2.fill"
        case .stateBoard:
            return "seal.fill"
        case .hospital:
            return "cross.case.fill"
        case .university:
            return "graduationcap.fill"
        }
    }

    var color: Color {
        switch self {
        case .nppes:
            return .blue
        case .stateBoard:
            return .green
        case .hospital:
            return .red
        case .university:
            return .purple
        }
    }
}

// Helper extension for corner radius
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

#Preview {
    IssuerConnectOnboardingCard { issuerId in
        print("Connecting to: \(issuerId)")
    }
    .padding()
    .background(Color.walletBackground)
}

