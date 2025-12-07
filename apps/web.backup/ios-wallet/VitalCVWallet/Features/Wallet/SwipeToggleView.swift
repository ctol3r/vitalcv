//
//  SwipeToggleView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 14
//  Swipe-to-toggle views (Full → Compact)
//

import SwiftUI

/// SwipeToggleView - Swipe to toggle between full and compact views
struct SwipeToggleView<FullView: View, CompactView: View>: View {
    @Binding var isCompact: Bool
    let fullView: () -> FullView
    let compactView: () -> CompactView

    @State private var dragOffset: CGFloat = 0
    @State private var isDragging = false

    var body: some View {
        ZStack {
            if isCompact {
                compactView()
                    .transition(.scale)
            } else {
                fullView()
                    .transition(.scale)
            }
        }
        .gesture(
            DragGesture()
                .onChanged { value in
                    isDragging = true
                    dragOffset = value.translation.height
                }
                .onEnded { value in
                    isDragging = false

                    // Toggle if dragged enough
                    if abs(value.translation.height) > 50 {
                        withAnimation {
                            isCompact.toggle()
                        }
                    }

                    dragOffset = 0
                }
        )
        .offset(y: isDragging ? dragOffset : 0)
    }
}

// MARK: - Wallet View Toggle

struct WalletViewToggle: View {
    @State private var isCompact = false
    let credentials: [VerifiableCredential]

    var body: some View {
        SwipeToggleView(isCompact: $isCompact) {
            // Full view
            VStack(spacing: WalletSpacing.md) {
                ForEach(credentials) { credential in
                    CredentialCard(credential: credential)
                }
            }
        } compactView: {
            // Compact view
            VStack(spacing: WalletSpacing.sm) {
                ForEach(credentials) { credential in
                    CompactCredentialRow(credential: credential)
                }
            }
        }
    }
}

// MARK: - Compact Credential Row

struct CompactCredentialRow: View {
    let credential: VerifiableCredential

    var body: some View {
        HStack {
            // Icon
            Image(systemName: "doc.text.fill")
                .foregroundColor(.walletPrimary)
                .frame(width: 40, height: 40)
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.small)

            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(credential.type.first ?? "Credential")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                Text(credential.issuer.name ?? "Unknown Issuer")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            Spacer()

            // Status
            if credential.isExpired {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.walletError)
            } else if credential.isExpiringSoon {
                Image(systemName: "clock.fill")
                    .foregroundColor(.walletWarning)
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.walletSuccess)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

#Preview {
    WalletViewToggle(
        credentials: [
            VerifiableCredential(
                id: "1",
                type: ["VerifiableCredential"],
                issuer: Issuer(id: "did:example:issuer", name: "Issuer", image: nil),
                issuanceDate: Date(),
                expirationDate: nil,
                credentialSubject: CredentialSubject(id: "did:example:holder", type: nil, claims: [:]),
                proof: nil,
                evidence: nil
            )
        ]
    )
    .padding()
    .background(Color.walletBackground)
}

