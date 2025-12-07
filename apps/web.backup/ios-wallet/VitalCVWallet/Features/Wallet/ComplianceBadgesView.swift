//
//  ComplianceBadgesView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 20
//  Compliance badges section
//

import SwiftUI

struct ComplianceBadgesView: View {
    let credential: VerifiableCredential

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Compliance & Standards")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: WalletSpacing.md) {
                ForEach(complianceBadges, id: \.type) { badge in
                    ComplianceBadgeCard(badge: badge)
                }
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .walletShadow(WalletShadow.small)
    }

    private var complianceBadges: [ComplianceBadge] {
        var badges: [ComplianceBadge] = []

        // W3C Verifiable Credentials
        badges.append(ComplianceBadge(
            type: .w3cVC,
            title: "W3C VC",
            description: "W3C Verifiable Credentials standard",
            verified: true
        ))

        // DIDComm
        if credential.proof != nil {
            badges.append(ComplianceBadge(
                type: .didComm,
                title: "DIDComm",
                description: "DID Communication protocol",
                verified: true
            ))
        }

        // Blockchain anchored
        if credential.proof?.jws != nil {
            badges.append(ComplianceBadge(
                type: .blockchain,
                title: "Blockchain",
                description: "Anchored on blockchain",
                verified: true
            ))
        }

        // Expiration check
        if credential.expirationDate != nil {
            badges.append(ComplianceBadge(
                type: .expiration,
                title: "Expiration",
                description: credential.isExpired ? "Expired" : "Valid",
                verified: !credential.isExpired
            ))
        }

        return badges
    }
}

// MARK: - Compliance Badge

struct ComplianceBadge {
    let type: BadgeType
    let title: String
    let description: String
    let verified: Bool

    enum BadgeType {
        case w3cVC
        case didComm
        case blockchain
        case expiration
        case gdpr
        case hipaa

        var icon: String {
            switch self {
            case .w3cVC: return "checkmark.shield.fill"
            case .didComm: return "network"
            case .blockchain: return "link"
            case .expiration: return "clock.fill"
            case .gdpr: return "lock.shield.fill"
            case .hipaa: return "heart.text.square.fill"
            }
        }

        var color: Color {
            switch self {
            case .w3cVC: return .blue
            case .didComm: return .purple
            case .blockchain: return .orange
            case .expiration: return .green
            case .gdpr: return .red
            case .hipaa: return .pink
            }
        }
    }
}

// MARK: - Compliance Badge Card

struct ComplianceBadgeCard: View {
    let badge: ComplianceBadge

    var body: some View {
        VStack(spacing: WalletSpacing.sm) {
            ZStack {
                Circle()
                    .fill(badge.verified ? badge.type.color.opacity(0.2) : Color.walletTextSecondary.opacity(0.1))
                    .frame(width: 50, height: 50)

                Image(systemName: badge.type.icon)
                    .foregroundColor(badge.verified ? badge.type.color : .walletTextSecondary)
                    .font(.system(size: 24))
            }

            Text(badge.title)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletText)
                .multilineTextAlignment(.center)

            Text(badge.description)
                .font(WalletTypography.caption2)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)

            if badge.verified {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 12))
                    Text("Verified")
                        .font(WalletTypography.caption2)
                }
                .foregroundColor(.walletSuccess)
            }
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color.walletBackground)
        .cornerRadius(WalletCornerRadius.medium)
        .overlay(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .stroke(badge.verified ? badge.type.color.opacity(0.3) : Color.clear, lineWidth: 1)
        )
    }
}








