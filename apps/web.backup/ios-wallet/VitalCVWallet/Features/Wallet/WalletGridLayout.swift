//
//  WalletGridLayout.swift
//  VitalCVWallet
//
//  Created: Batch 566 - Task 6
//  WalletGrid mode (Pinterest-style masonry layout)
//

import SwiftUI

/// WalletGridLayout - Pinterest-style masonry layout for credentials
public struct WalletGridLayout: View {
    let credentials: [VerifiableCredential]
    let columns: Int
    let spacing: CGFloat
    let onCredentialTap: (VerifiableCredential) -> Void

    @State private var columnHeights: [CGFloat]

    public init(
        credentials: [VerifiableCredential],
        columns: Int = 2,
        spacing: CGFloat = WalletSpacing.md,
        onCredentialTap: @escaping (VerifiableCredential) -> Void
    ) {
        self.credentials = credentials
        self.columns = columns
        self.spacing = spacing
        self.onCredentialTap = onCredentialTap
        _columnHeights = State(initialValue: Array(repeating: 0, count: columns))
    }

    public var body: some View {
        GeometryReader { geometry in
            let columnWidth = (geometry.size.width - spacing * CGFloat(columns - 1)) / CGFloat(columns)

            ScrollView {
                LazyVStack(spacing: spacing) {
                    ForEach(credentials) { credential in
                        let columnIndex = shortestColumnIndex()
                        let cardHeight = calculateCardHeight(for: credential, width: columnWidth)

                        CredentialCard(
                            credential: credential,
                            onTap: { onCredentialTap(credential) }
                        )
                        .frame(width: columnWidth, height: cardHeight)
                        .onAppear {
                            columnHeights[columnIndex] += cardHeight + spacing
                        }
                    }
                }
                .padding(.horizontal, spacing)
            }
        }
    }

    private func shortestColumnIndex() -> Int {
        columnHeights.enumerated()
            .min(by: { $0.element < $1.element })?
            .offset ?? 0
    }

    private func calculateCardHeight(for credential: VerifiableCredential, width: CGFloat) -> CGFloat {
        // Base height
        var height: CGFloat = 120

        // Add height for issuer name
        if credential.issuer.name != nil {
            height += 20
        }

        // Add height for evidence count
        if let evidence = credential.evidence, !evidence.isEmpty {
            height += 30
        }

        // Add height for expiration warning
        if credential.isExpiringSoon || credential.isExpired {
            height += 25
        }

        // Add height for mood state indicator
        height += 30

        return height
    }
}

/// WalletGridMode - View mode selector for wallet
public enum WalletViewMode {
    case stack
    case grid
    case list
}

/// WalletGridToggle - Toggle between stack and grid views
public struct WalletGridToggle: View {
    @Binding var viewMode: WalletViewMode

    public var body: some View {
        HStack(spacing: WalletSpacing.sm) {
            Button(action: { viewMode = .stack }) {
                Image(systemName: "square.stack.3d.up.fill")
                    .foregroundColor(viewMode == .stack ? .walletPrimary : .walletTextSecondary)
            }

            Button(action: { viewMode = .grid }) {
                Image(systemName: "square.grid.2x2.fill")
                    .foregroundColor(viewMode == .grid ? .walletPrimary : .walletTextSecondary)
            }

            Button(action: { viewMode = .list }) {
                Image(systemName: "list.bullet")
                    .foregroundColor(viewMode == .list ? .walletPrimary : .walletTextSecondary)
            }
        }
        .padding(.horizontal, WalletSpacing.md)
        .padding(.vertical, WalletSpacing.sm)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

