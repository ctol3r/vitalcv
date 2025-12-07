//
//  ChainAnchorView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 19
//  Chain anchor viewer (block #, timestamp)
//

import SwiftUI

struct ChainAnchorView: View {
    let credential: VerifiableCredential
    @State private var anchorInfo: ChainAnchorInfo?
    @State private var isLoading = false
    @State private var validationResult: ChainValidationResult?
    @State private var showingAuditTrail = false
    @State private var confirmationAnimationTrigger = false

    private let trustKit = VitalCVTrustKit.shared

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            if isLoading {
                HStack {
                    ProgressView()
                    Text("Loading anchor information...")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }
                .padding()
            } else if let anchor = anchorInfo {
                VStack(alignment: .leading, spacing: WalletSpacing.md) {
                    // Task 28: Add anchor integrity badge (Valid / Expired / Missing)
                    integrityBadge(anchor: anchor)

                    // Task 29: Add chain confirmation animation (ripple effect)
                    if confirmationAnimationTrigger {
                        confirmationAnimationView
                    }

                    VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                        AnchorInfoRow(
                            label: "Block Number",
                            value: "#\(anchor.blockNumber)",
                            icon: "number"
                        )

                        AnchorInfoRow(
                            label: "Transaction Hash",
                            value: anchor.transactionHash.prefix(16) + "...",
                            icon: "link",
                            isCopyable: true,
                            fullValue: anchor.transactionHash
                        )

                        AnchorInfoRow(
                            label: "Timestamp",
                            value: formatTimestamp(anchor.timestamp),
                            icon: "clock"
                        )

                        AnchorInfoRow(
                            label: "Network",
                            value: anchor.network,
                            icon: "network"
                        )

                        if let validation = validationResult {
                            AnchorInfoRow(
                                label: "Confirmations",
                                value: "\(validation.confirmations)",
                                icon: "checkmark.shield.fill"
                            )
                        }
                    }

                    // Task 27: Add tappable chain explorer deep link
                    if let explorerURL = anchor.explorerURL {
                        Button(action: {
                            UIApplication.shared.open(explorerURL)
                        }) {
                            HStack {
                                Image(systemName: "arrow.up.right.square")
                                Text("View on Explorer")
                                    .font(WalletTypography.subheadline)
                            }
                            .foregroundColor(.walletPrimary)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(Color.walletPrimary.opacity(0.1))
                            .cornerRadius(WalletCornerRadius.medium)
                        }
                    }

                    // Task 30: Add on-chain audit trail viewer
                    Button(action: {
                        showingAuditTrail = true
                    }) {
                        HStack {
                            Image(systemName: "list.bullet.rectangle")
                            Text("View Audit Trail")
                                .font(WalletTypography.subheadline)
                        }
                        .foregroundColor(.walletText)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.walletCard)
                        .cornerRadius(WalletCornerRadius.medium)
                    }
                }
            } else {
                Text("No blockchain anchor found")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
                    .padding()
            }
        }
        .onAppear {
            loadAnchorInfo()
        }
        .sheet(isPresented: $showingAuditTrail) {
            if let anchor = anchorInfo {
                ChainAuditTrailView(anchor: anchor)
            }
        }
    }

    private func loadAnchorInfo() {
        isLoading = true

        // In production, fetch from blockchain or credential proof
        Task {
            // Simulate network call
            try? await Task.sleep(nanoseconds: 500_000_000)

            // Extract anchor info from proof or fetch from chain
            if let proof = credential.proof {
                let txHash = "0x\(proof.jws?.prefix(64) ?? String(repeating: "0", count: 64))"
                let anchor = ChainAnchorInfo(
                    blockNumber: 12345678,
                    transactionHash: txHash,
                    timestamp: proof.created,
                    network: "Substrate",
                    explorerURL: URL(string: "https://explorer.example.com/tx/\(txHash.prefix(16))")
                )

                // Validate chain anchor
                do {
                    let validation = try await trustKit.validateChainAnchor(
                        blockNumber: anchor.blockNumber,
                        transactionHash: anchor.transactionHash,
                        network: anchor.network
                    )

                    await MainActor.run {
                        self.anchorInfo = anchor
                        self.validationResult = validation
                        self.isLoading = false

                        // Task 29: Trigger confirmation animation
                        if validation.isValid {
                            withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                                confirmationAnimationTrigger = true
                            }

                            // Reset animation after delay
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                confirmationAnimationTrigger = false
                            }
                        }
                    }
                } catch {
                    await MainActor.run {
                        self.anchorInfo = anchor
                        self.isLoading = false
                    }
                }
            } else {
                await MainActor.run {
                    self.isLoading = false
                }
            }
        }
    }

    // Task 28: Integrity badge
    private func integrityBadge(anchor: ChainAnchorInfo) -> some View {
        let status: AnchorStatus
        if let validation = validationResult {
            status = validation.isValid ? .valid : .expired
        } else {
            status = .missing
        }

        return HStack {
            Image(systemName: status.icon)
                .foregroundColor(status.color)

            Text(status.label)
                .font(WalletTypography.subheadline)
                .foregroundColor(status.color)

            Spacer()
        }
        .padding()
        .background(status.color.opacity(0.1))
        .cornerRadius(WalletCornerRadius.medium)
    }

    // Task 29: Confirmation animation
    private var confirmationAnimationView: some View {
        ZStack {
            // Ripple effect
            ForEach(0..<3) { index in
                Circle()
                    .stroke(Color.walletSuccess, lineWidth: 2)
                    .frame(width: 100 + CGFloat(index * 20), height: 100 + CGFloat(index * 20))
                    .opacity(1.0 - Double(index) * 0.3)
                    .scaleEffect(confirmationAnimationTrigger ? 1.5 : 1.0)
                    .animation(
                        .easeOut(duration: 1.0)
                        .repeatCount(1, autoreverses: false)
                        .delay(Double(index) * 0.2),
                        value: confirmationAnimationTrigger
                    )
            }

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.walletSuccess)
        }
        .frame(height: 150)
        .frame(maxWidth: .infinity)
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Chain Anchor Info

struct ChainAnchorInfo {
    let blockNumber: Int
    let transactionHash: String
    let timestamp: Date
    let network: String
    let explorerURL: URL?
}

// MARK: - Anchor Status

enum AnchorStatus {
    case valid
    case expired
    case missing

    var label: String {
        switch self {
        case .valid:
            return "Valid"
        case .expired:
            return "Expired"
        case .missing:
            return "Missing"
        }
    }

    var icon: String {
        switch self {
        case .valid:
            return "checkmark.shield.fill"
        case .expired:
            return "exclamationmark.shield.fill"
        case .missing:
            return "questionmark.shield.fill"
        }
    }

    var color: Color {
        switch self {
        case .valid:
            return .walletSuccess
        case .expired:
            return .walletError
        case .missing:
            return .walletTextSecondary
        }
    }
}

// MARK: - Task 30: Chain Audit Trail View

struct ChainAuditTrailView: View {
    let anchor: ChainAnchorInfo
    @Environment(\.dismiss) var dismiss
    @State private var auditEntries: [AuditEntry] = []

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: WalletSpacing.md) {
                    Text("On-Chain Audit Trail")
                        .font(WalletTypography.title2)
                        .foregroundColor(.walletText)

                    Text("Complete history of this credential's blockchain anchor")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)

                    ForEach(auditEntries) { entry in
                        AuditEntryRow(entry: entry)
                    }
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("Audit Trail")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                loadAuditTrail()
            }
        }
    }

    private func loadAuditTrail() {
        // In production, fetch from blockchain
        auditEntries = [
            AuditEntry(
                id: "1",
                event: "Anchored",
                timestamp: anchor.timestamp,
                blockNumber: anchor.blockNumber,
                transactionHash: anchor.transactionHash,
                description: "Credential anchored to blockchain"
            ),
            AuditEntry(
                id: "2",
                event: "Confirmed",
                timestamp: anchor.timestamp.addingTimeInterval(60),
                blockNumber: anchor.blockNumber + 1,
                transactionHash: anchor.transactionHash,
                description: "Transaction confirmed in block"
            )
        ]
    }
}

struct AuditEntry: Identifiable {
    let id: String
    let event: String
    let timestamp: Date
    let blockNumber: Int
    let transactionHash: String
    let description: String
}

struct AuditEntryRow: View {
    let entry: AuditEntry

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            HStack {
                Text(entry.event)
                    .font(WalletTypography.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.walletText)

                Spacer()

                Text(formatTimestamp(entry.timestamp))
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)
            }

            Text(entry.description)
                .font(WalletTypography.caption1)
                .foregroundColor(.walletTextSecondary)

            HStack {
                Text("Block #\(entry.blockNumber)")
                    .font(WalletTypography.caption2)
                    .fontDesign(.monospaced)
                    .foregroundColor(.walletTextSecondary)

                Text("•")
                    .foregroundColor(.walletTextSecondary)

                Text(entry.transactionHash.prefix(16) + "...")
                    .font(WalletTypography.caption2)
                    .fontDesign(.monospaced)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Anchor Info Row

struct AnchorInfoRow: View {
    let label: String
    let value: String
    let icon: String
    var isCopyable: Bool = false
    var fullValue: String?
    @State private var copied = false

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.walletPrimary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)

                Text(value)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)
            }

            Spacer()

            if isCopyable {
                Button(action: {
                    if let full = fullValue {
                        UIPasteboard.general.string = full
                        copied = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            copied = false
                        }
                    }
                }) {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        .foregroundColor(copied ? .walletSuccess : .walletTextSecondary)
                        .font(.system(size: 16))
                }
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.small)
    }
}

