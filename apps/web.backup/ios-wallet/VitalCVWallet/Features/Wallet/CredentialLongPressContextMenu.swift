//
//  CredentialLongPressContextMenu.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 17
//  Long-press → context menu (Share, Verify, Copy DID)
//

import SwiftUI

/// CredentialLongPressContextMenu - Long-press context menu for credentials
struct CredentialLongPressContextMenu: ViewModifier {
    let credential: VerifiableCredential
    let onShare: () -> Void
    let onVerify: () -> Void
    let onCopyDID: () -> Void

    func body(content: Content) -> some View {
        content
            .contextMenu {
                // Share action
                Button(action: onShare) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }

                // Verify action
                Button(action: onVerify) {
                    Label("Verify", systemImage: "checkmark.shield.fill")
                }

                Divider()

                // Copy DID action
                Button(action: onCopyDID) {
                    Label("Copy DID", systemImage: "doc.on.doc")
                }

                // View Details
                Button(action: {}) {
                    Label("View Details", systemImage: "info.circle")
                }
            }
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.5)
                    .onEnded { _ in
                        HapticFeedbackService.shared.play(.impact(.medium))
                    }
            )
    }
}

extension View {
    /// Add long-press context menu to credential view
    func credentialContextMenu(
        credential: VerifiableCredential,
        onShare: @escaping () -> Void,
        onVerify: @escaping () -> Void,
        onCopyDID: @escaping () -> Void
    ) -> some View {
        modifier(
            CredentialLongPressContextMenu(
                credential: credential,
                onShare: onShare,
                onVerify: onVerify,
                onCopyDID: onCopyDID
            )
        )
    }
}

// MARK: - Enhanced Context Menu with Custom Actions

struct CredentialContextMenuActions {
    let onShare: () -> Void
    let onVerify: () -> Void
    let onCopyDID: () -> Void
    let onViewDetails: () -> Void
    let onDelete: (() -> Void)?

    static func `default`(
        credential: VerifiableCredential,
        onShare: @escaping () -> Void,
        onVerify: @escaping () -> Void,
        onCopyDID: @escaping () -> Void,
        onViewDetails: @escaping () -> Void,
        onDelete: (() -> Void)? = nil
    ) -> CredentialContextMenuActions {
        CredentialContextMenuActions(
            onShare: onShare,
            onVerify: onVerify,
            onCopyDID: onCopyDID,
            onViewDetails: onViewDetails,
            onDelete: onDelete
        )
    }
}

// MARK: - Context Menu View

struct CredentialContextMenuView: View {
    let credential: VerifiableCredential
    let actions: CredentialContextMenuActions

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Share
            ContextMenuItem(
                icon: "square.and.arrow.up",
                title: "Share Credential",
                subtitle: "Share via QR or link",
                color: .walletPrimary
            ) {
                actions.onShare()
            }

            // Verify
            ContextMenuItem(
                icon: "checkmark.shield.fill",
                title: "Verify",
                subtitle: "Check credential status",
                color: .walletSuccess
            ) {
                actions.onVerify()
            }

            Divider()
                .padding(.vertical, WalletSpacing.xs)

            // Copy DID
            ContextMenuItem(
                icon: "doc.on.doc",
                title: "Copy DID",
                subtitle: credential.credentialSubject.id,
                color: .walletInfo
            ) {
                actions.onCopyDID()
            }

            // View Details
            ContextMenuItem(
                icon: "info.circle",
                title: "View Details",
                subtitle: "See full information",
                color: .walletTextSecondary
            ) {
                actions.onViewDetails()
            }

            // Delete (if available)
            if let onDelete = actions.onDelete {
                Divider()
                    .padding(.vertical, WalletSpacing.xs)

                ContextMenuItem(
                    icon: "trash.fill",
                    title: "Delete",
                    subtitle: "Remove from wallet",
                    color: .walletError
                ) {
                    onDelete()
                }
            }
        }
        .padding(WalletSpacing.sm)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

// MARK: - Context Menu Item

struct ContextMenuItem: View {
    let icon: String
    let title: String
    let subtitle: String?
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticFeedbackService.shared.selectionChanged()
            action()
        }) {
            HStack(spacing: WalletSpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(color)
                    .frame(width: 32, height: 32)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletText)

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                            .lineLimit(1)
                    }
                }

                Spacer()
            }
            .padding(WalletSpacing.sm)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    VStack {
        CredentialContextMenuView(
            credential: VerifiableCredential(
                id: "test",
                type: ["TestCredential"],
                issuer: Issuer(id: "did:test", name: "Test Issuer", image: nil),
                issuanceDate: Date(),
                expirationDate: nil,
                credentialSubject: CredentialSubject(
                    id: "did:test:subject",
                    type: nil,
                    claims: [:]
                ),
                proof: nil,
                evidence: nil,
                chainAnchorId: nil
            ),
            actions: .default(
                credential: VerifiableCredential(
                    id: "test",
                    type: ["Test"],
                    issuer: Issuer(id: "did:test", name: "Test", image: nil),
                    issuanceDate: Date(),
                    expirationDate: nil,
                    credentialSubject: CredentialSubject(
                        id: "did:test:subject",
                        type: nil,
                        claims: [:]
                    ),
                    proof: nil,
                    evidence: nil,
                    chainAnchorId: nil
                ),
                onShare: {},
                onVerify: {},
                onCopyDID: {},
                onViewDetails: {}
            )
        )
    }
    .padding()
}

