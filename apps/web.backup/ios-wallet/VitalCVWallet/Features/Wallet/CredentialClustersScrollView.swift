//
//  CredentialClustersScrollView.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 16
//  Scroll to reveal credential clusters
//

import SwiftUI

/// CredentialClustersScrollView - Scrollable view that reveals credential clusters
struct CredentialClustersScrollView: View {
    let credentials: [VerifiableCredential]
    let onCredentialSelected: (VerifiableCredential) -> Void

    @State private var scrollOffset: CGFloat = 0
    @State private var revealedClusters: Set<Int> = []

    private var clusteredCredentials: [CredentialCluster] {
        Dictionary(grouping: credentials) { $0.category }
            .map { CredentialCluster(category: $0.key, credentials: $0.value) }
            .sorted { $0.category.rawValue < $1.category.rawValue }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: WalletSpacing.xl) {
                ForEach(Array(clusteredCredentials.enumerated()), id: \.element.category) { index, cluster in
                    CredentialClusterCard(
                        cluster: cluster,
                        isRevealed: revealedClusters.contains(index),
                        scrollOffset: scrollOffset
                    ) {
                        onCredentialSelected($0)
                    }
                    .onAppear {
                        withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                            revealedClusters.insert(index)
                        }
                    }
                }
            }
            .padding(.horizontal, WalletSpacing.md)
            .padding(.vertical, WalletSpacing.lg)
        }
        .background(
            GeometryReader { geometry in
                Color.clear
                    .preference(
                        key: ScrollOffsetPreferenceKey.self,
                        value: geometry.frame(in: .named("scroll")).minY
                    )
            }
        )
        .coordinateSpace(name: "scroll")
        .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
            scrollOffset = value
        }
    }
}

// MARK: - Credential Cluster

struct CredentialCluster {
    let category: CredentialCategory
    let credentials: [VerifiableCredential]
}

// MARK: - Credential Cluster Card

struct CredentialClusterCard: View {
    let cluster: CredentialCluster
    let isRevealed: Bool
    let scrollOffset: CGFloat
    let onCredentialSelected: (VerifiableCredential) -> Void

    @State private var cardOffset: CGFloat = 100
    @State private var cardOpacity: Double = 0

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            // Cluster header
            HStack {
                Image(systemName: cluster.category.icon)
                    .font(.title2)
                    .foregroundColor(cluster.category.color)

                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(cluster.category.rawValue)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Text("\(cluster.credentials.count) credential\(cluster.credentials.count == 1 ? "" : "s")")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()
            }
            .padding(.horizontal, WalletSpacing.md)
            .padding(.top, WalletSpacing.md)

            // Credentials in cluster
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: WalletSpacing.md) {
                    ForEach(cluster.credentials) { credential in
                        CompactCredentialCard(credential: credential) {
                            onCredentialSelected(credential)
                        }
                    }
                }
                .padding(.horizontal, WalletSpacing.md)
            }
            .padding(.bottom, WalletSpacing.md)
        }
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
        .offset(y: isRevealed ? 0 : cardOffset)
        .opacity(isRevealed ? 1 : cardOpacity)
        .onAppear {
            if isRevealed {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8).delay(0.1)) {
                    cardOffset = 0
                    cardOpacity = 1
                }
            }
        }
    }
}

// MARK: - Compact Credential Card

struct CompactCredentialCard: View {
    let credential: VerifiableCredential
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                // Icon
                ZStack {
                    Circle()
                        .fill(credential.category.color.opacity(0.1))
                        .frame(width: 50, height: 50)

                    Image(systemName: credential.category.icon)
                        .font(.system(size: 24))
                        .foregroundColor(credential.category.color)
                }

                // Title
                Text(credential.type.first ?? "Credential")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                // Issuer
                Text(credential.issuer.name ?? "Issuer")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
                    .lineLimit(1)
            }
            .frame(width: 140)
            .padding(WalletSpacing.md)
            .background(Color.walletBackground)
            .cornerRadius(WalletCornerRadius.medium)
            .walletShadow(WalletShadow.small)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Scroll Offset Preference Key

struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

#Preview {
    CredentialClustersScrollView(
        credentials: [],
        onCredentialSelected: { _ in }
    )
}

