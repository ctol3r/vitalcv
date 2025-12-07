//
//  ChainAnchorStatusInspector.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 18
//  Chain anchor status inspector
//

import SwiftUI

/// ChainAnchorStatusInspector - Inspects chain anchor status
struct ChainAnchorStatusInspector: View {
    let credential: VerifiableCredential
    @State private var anchorStatus: ChainAnchorStatus?
    @State private var isLoading = false

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            // Header
            HStack {
                Image(systemName: "link")
                    .foregroundColor(.walletPrimary)
                Text("Chain Anchor Status")
                    .font(WalletTypography.headline)
            }

            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity)
            } else if let status = anchorStatus {
                // Status display
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    // Status badge
                    HStack {
                        statusBadge(status)
                        Text(status.description)
                            .font(WalletTypography.body)
                    }

                    // Details
                    if let anchor = status.anchor {
                        Divider()

                        VStack(alignment: .leading, spacing: 8) {
                            DetailRow(label: "Transaction Hash", value: anchor.txHash)
                            DetailRow(label: "Block Number", value: "\(anchor.blockNumber)")
                            DetailRow(label: "Timestamp", value: formatDate(anchor.timestamp))
                        }
                    }
                }
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
            } else {
                Text("No anchor found")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .onAppear {
            loadAnchorStatus()
        }
    }

    private func statusBadge(_ status: ChainAnchorStatus) -> some View {
        Group {
            switch status {
            case .pending:
                Image(systemName: "clock.fill")
                    .foregroundColor(.walletWarning)
            case .confirmed:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.walletSuccess)
            case .failed:
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.walletError)
            }
        }
    }

    private func loadAnchorStatus() {
        guard let anchorId = credential.chainAnchorId else {
            return
        }

        isLoading = true

        Task {
            do {
                let status = try await ChainAnchorService.shared.checkAnchorStatus(anchorId: anchorId)
                await MainActor.run {
                    self.anchorStatus = status
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.isLoading = false
                }
            }
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Detail Row

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
            Spacer()
            Text(value)
                .font(WalletTypography.caption)
                .foregroundColor(.walletText)
        }
    }
}

// MARK: - Chain Anchor Status Extension

extension ChainAnchorStatus {
    var anchor: ChainAnchor? {
        // In production, this would be part of the status
        return nil
    }

    var description: String {
        switch self {
        case .pending: return "Pending Confirmation"
        case .confirmed: return "Confirmed on Chain"
        case .failed: return "Anchor Failed"
        }
    }
}

#Preview {
    ChainAnchorStatusInspector(
        credential: VerifiableCredential(
            id: "1",
            type: ["VerifiableCredential"],
            issuer: Issuer(id: "did:example:issuer", name: "Issuer", image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(id: "did:example:holder", type: nil, claims: [:]),
            proof: nil,
            evidence: nil
        )
    )
    .padding()
    .background(Color.walletBackground)
}

