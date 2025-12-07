//
//  MultiChainAnchorView.swift
//  VitalCVWallet
//
//  Created: Chain Orchestration Layer - Phase 5
//  UX Layer for Multi-Chain Anchoring - Visual, emotional, intuitive multi-ledger trust transparency
//

import SwiftUI

/// MultiChainAnchorView - Main view for multi-chain anchor visualization
public struct MultiChainAnchorView: View {
    @StateObject private var orchestrator = ChainOrchestrator.shared
    @StateObject private var multiAnchor = MultiAnchorEngine.shared
    @StateObject private var verifier = CrossChainVerifier.shared

    let credentialId: String
    let credentialHash: String

    @State private var showingExplanation = false
    @State private var anchorTimeline: [AnchorTimelineEvent] = []

    public init(credentialId: String, credentialHash: String) {
        self.credentialId = credentialId
        self.credentialHash = credentialHash
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Task 33: MultiChainAnchorView Foundation
                headerSection

                // Task 34: Per-chain anchor badges
                chainBadgesSection

                // Task 35: Anchor ripple animation
                anchorRippleSection

                // Task 36: Explanation sheet trigger
                explanationButton

                // Task 37: Chain health transparency
                chainHealthSection

                // Task 38: Anchor timeline
                timelineSection

                // Task 39: Multi-chain integrity summary
                integritySummarySection
            }
            .padding()
        }
        .navigationTitle("Multi-Chain Anchor")
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showingExplanation) {
            WhereYourCredentialLivesSheet()
        }
        .task {
            await loadAnchorData()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Multi-Chain Anchoring")
                .font(.title2)
                .fontWeight(.bold)

            Text("Your credential is anchored across multiple blockchains for maximum trust and redundancy.")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Task 34: Per-Chain Anchor Badges

    private var chainBadgesSection: some View {
        VStack(spacing: 16) {
            Text("Anchor Status")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let bundle = multiAnchor.getReceiptsBundle(for: credentialId) {
                // Primary Chain (green halo)
                if let primaryReceipt = bundle.receipts[.vitalCVChain] {
                    ChainBadge(
                        chain: .vitalCVChain,
                        receipt: primaryReceipt,
                        style: .primary
                    )
                }

                // EVM Mirror (blue pulse)
                for (ledger, receipt) in bundle.receipts {
                    if case .evmChain = ledger {
                        ChainBadge(
                            chain: ledger,
                            receipt: receipt,
                            style: .evmMirror
                        )
                    }
                }

                // Rollup (gold filament)
                if let rollupReceipt = bundle.receipts[.offChainMerkle] {
                    ChainBadge(
                        chain: .offChainMerkle,
                        receipt: rollupReceipt,
                        style: .rollup
                    )
                }
            } else {
                Text("No anchors found")
                    .foregroundColor(.secondary)
            }
        }
    }

    // MARK: - Task 35: Anchor Ripple Animation

    private var anchorRippleSection: some View {
        VStack {
            if let bundle = multiAnchor.getReceiptsBundle(for: credentialId),
               bundle.receipts.count >= 2 {
                // Multi-ledger success - enhanced ripple
                AnchorRippleView(
                    chainCount: bundle.receipts.count,
                    intensity: .high
                )
                .frame(height: 200)
            }
        }
    }

    // MARK: - Task 36: Explanation Sheet

    private var explanationButton: some View {
        Button(action: {
            showingExplanation = true
        }) {
            HStack {
                Image(systemName: "info.circle")
                Text("Where Your Credential Lives")
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.blue.opacity(0.1))
            .cornerRadius(12)
        }
    }

    // MARK: - Task 37: Chain Health Transparency

    private var chainHealthSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Chain Health")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)

            ForEach(Array(orchestrator.activeLedgers.keys), id: \.self) { ledger in
                if let profile = orchestrator.activeLedgers[ledger],
                   let health = orchestrator.healthStatus[ledger] {
                    ChainHealthRow(
                        ledger: ledger,
                        profile: profile,
                        health: health
                    )
                }
            }
        }
    }

    // MARK: - Task 38: Anchor Timeline

    private var timelineSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Anchor Timeline")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)

            if anchorTimeline.isEmpty {
                Text("No timeline events yet")
                    .foregroundColor(.secondary)
            } else {
                ForEach(anchorTimeline) { event in
                    AnchorTimelineRow(event: event)
                }
            }
        }
    }

    // MARK: - Task 39: Integrity Summary

    private var integritySummarySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Multi-Chain Integrity Summary")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let result = verifier.verificationResults[credentialHash] {
                IntegritySummaryCard(result: result)
            } else {
                Text("Verification pending")
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(12)
    }

    // MARK: - Data Loading

    private func loadAnchorData() async {
        // Load anchor timeline
        if let bundle = multiAnchor.getReceiptsBundle(for: credentialId) {
            var events: [AnchorTimelineEvent] = []

            for (ledger, receipt) in bundle.receipts {
                events.append(AnchorTimelineEvent(
                    id: UUID().uuidString,
                    ledger: ledger,
                    event: "Anchored",
                    timestamp: receipt.timestamp,
                    transactionHash: receipt.transactionHash
                ))
            }

            anchorTimeline = events.sorted { $0.timestamp > $1.timestamp }
        }

        // Trigger verification
        _ = try? await verifier.verify(
            credentialHash: credentialHash,
            credentialId: credentialId
        )
    }
}

// MARK: - Chain Badge Component

struct ChainBadge: View {
    let chain: Ledger
    let receipt: AnchorReceipt
    let style: ChainBadgeStyle

    var body: some View {
        HStack {
            // Chain icon with style
            chainIcon

            VStack(alignment: .leading, spacing: 4) {
                Text(chainName)
                    .font(.headline)
                Text(statusText)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Status indicator
            statusIndicator
        }
        .padding()
        .background(backgroundColor)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(borderColor, lineWidth: 2)
        )
    }

    private var chainIcon: some View {
        ZStack {
            Circle()
                .fill(iconBackgroundColor)
                .frame(width: 40, height: 40)

            Image(systemName: iconName)
                .foregroundColor(iconColor)
        }
        .overlay(
            Circle()
                .stroke(haloColor, lineWidth: style == .primary ? 3 : 0)
                .blur(radius: style == .primary ? 4 : 0)
        )
    }

    private var chainName: String {
        switch chain {
        case .vitalCVChain:
            return "Primary Chain"
        case .evmChain(let chainId):
            return "EVM Mirror (\(chainId))"
        case .tezosChain:
            return "Tezos Chain"
        case .offChainMerkle:
            return "Rollup Layer"
        }
    }

    private var statusText: String {
        switch receipt.status {
        case .confirmed:
            return "Confirmed"
        case .pending:
            return "Pending"
        case .failed:
            return "Failed"
        case .rejected:
            return "Rejected"
        }
    }

    private var statusIndicator: some View {
        Circle()
            .fill(statusColor)
            .frame(width: 12, height: 12)
    }

    private var iconName: String {
        switch style {
        case .primary:
            return "link.circle.fill"
        case .evmMirror:
            return "arrow.triangle.2.circlepath"
        case .rollup:
            return "layers.fill"
        }
    }

    private var iconColor: Color {
        switch style {
        case .primary:
            return .green
        case .evmMirror:
            return .blue
        case .rollup:
            return .yellow
        }
    }

    private var iconBackgroundColor: Color {
        iconColor.opacity(0.2)
    }

    private var backgroundColor: Color {
        switch style {
        case .primary:
            return Color.green.opacity(0.1)
        case .evmMirror:
            return Color.blue.opacity(0.1)
        case .rollup:
            return Color.yellow.opacity(0.1)
        }
    }

    private var borderColor: Color {
        iconColor.opacity(0.3)
    }

    private var haloColor: Color {
        iconColor.opacity(0.5)
    }

    private var statusColor: Color {
        switch receipt.status {
        case .confirmed:
            return .green
        case .pending:
            return .orange
        case .failed, .rejected:
            return .red
        }
    }
}

enum ChainBadgeStyle {
    case primary // Green halo
    case evmMirror // Blue pulse
    case rollup // Gold filament
}

// MARK: - Anchor Ripple View

struct AnchorRippleView: View {
    let chainCount: Int
    let intensity: RippleIntensity

    @State private var animationPhase: CGFloat = 0

    var body: some View {
        ZStack {
            ForEach(0..<chainCount, id: \.self) { index in
                Circle()
                    .stroke(
                        rippleColor(for: index),
                        lineWidth: 2
                    )
                    .frame(width: baseSize + CGFloat(index) * rippleSpacing)
                    .opacity(rippleOpacity(for: index))
                    .scaleEffect(rippleScale(for: index))
            }
        }
        .onAppear {
            withAnimation(
                Animation.easeOut(duration: 2.0)
                    .repeatForever(autoreverses: false)
            ) {
                animationPhase = 1.0
            }
        }
    }

    private func rippleColor(for index: Int) -> Color {
        let colors: [Color] = [.green, .blue, .yellow, .purple]
        return colors[index % colors.count]
    }

    private func rippleOpacity(for index: Int) -> Double {
        let delay = Double(index) * 0.3
        let phase = (animationPhase + delay).truncatingRemainder(dividingBy: 1.0)
        return max(0, 1.0 - phase)
    }

    private func rippleScale(for index: Int) -> CGFloat {
        let delay = Double(index) * 0.3
        let phase = (animationPhase + delay).truncatingRemainder(dividingBy: 1.0)
        return 1.0 + phase * 0.5
    }

    private var baseSize: CGFloat {
        switch intensity {
        case .low:
            return 50
        case .medium:
            return 80
        case .high:
            return 120
        }
    }

    private var rippleSpacing: CGFloat {
        switch intensity {
        case .low:
            return 30
        case .medium:
            return 40
        case .high:
            return 50
        }
    }
}

enum RippleIntensity {
    case low
    case medium
    case high
}

// MARK: - Where Your Credential Lives Sheet

struct WhereYourCredentialLivesSheet: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("Where Your Credential Lives")
                        .font(.title)
                        .fontWeight(.bold)

                    explanationSection(
                        title: "Primary Chain",
                        description: "Your credential is anchored on the VitalCV Substrate blockchain, providing immutable proof of issuance and status.",
                        color: .green
                    )

                    explanationSection(
                        title: "EVM Mirror",
                        description: "A mirror copy is also anchored on Ethereum-compatible chains for redundancy and cross-chain verification.",
                        color: .blue
                    )

                    explanationSection(
                        title: "Rollup Layer",
                        description: "Your credential events are batched in a Merkle rollup for efficient verification and lower costs.",
                        color: .yellow
                    )

                    Text("This multi-chain approach ensures your credential remains verifiable even if one blockchain experiences issues.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .padding(.top)
                }
                .padding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func explanationSection(title: String, description: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle()
                    .fill(color)
                    .frame(width: 12, height: 12)
                Text(title)
                    .font(.headline)
            }
            Text(description)
                .font(.body)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(12)
    }
}

// MARK: - Chain Health Row

struct ChainHealthRow: View {
    let ledger: Ledger
    let profile: LedgerProfile
    let health: LedgerHealthStatus

    var body: some View {
        HStack {
            Text(ledgerName)
                .font(.subheadline)

            Spacer()

            healthIndicator

            Text(healthText)
                .font(.caption)
                .foregroundColor(healthColor)
        }
        .padding(.horizontal)
    }

    private var ledgerName: String {
        switch ledger {
        case .vitalCVChain:
            return "Primary Chain"
        case .evmChain(let chainId):
            return "EVM (\(chainId))"
        case .tezosChain:
            return "Tezos"
        case .offChainMerkle:
            return "Rollup"
        }
    }

    private var healthIndicator: some View {
        Circle()
            .fill(healthColor)
            .frame(width: 8, height: 8)
    }

    private var healthText: String {
        switch health {
        case .healthy:
            return "Healthy"
        case .degraded:
            return "Degraded"
        case .slow:
            return "Slow"
        case .down:
            return "Down"
        case .unknown:
            return "Unknown"
        }
    }

    private var healthColor: Color {
        switch health {
        case .healthy:
            return .green
        case .degraded:
            return .yellow
        case .slow:
            return .orange
        case .down:
            return .red
        case .unknown:
            return .gray
        }
    }
}

// MARK: - Anchor Timeline Row

struct AnchorTimelineRow: View {
    let event: AnchorTimelineEvent

    var body: some View {
        HStack {
            VStack(spacing: 0) {
                Circle()
                    .fill(timelineColor)
                    .frame(width: 8, height: 8)
                Rectangle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 1, height: 30)
            }
            .frame(width: 20)

            VStack(alignment: .leading, spacing: 4) {
                Text(event.event)
                    .font(.subheadline)
                Text(event.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
    }

    private var timelineColor: Color {
        switch event.ledger {
        case .vitalCVChain:
            return .green
        case .evmChain:
            return .blue
        case .offChainMerkle:
            return .yellow
        default:
            return .gray
        }
    }
}

struct AnchorTimelineEvent: Identifiable {
    let id: String
    let ledger: Ledger
    let event: String
    let timestamp: Date
    let transactionHash: String
}

// MARK: - Integrity Summary Card

struct IntegritySummaryCard: View {
    let result: CrossChainVerificationResult

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Verification Status")
                    .font(.headline)
                Spacer()
                statusBadge
            }

            Divider()

            HStack {
                Text("Confidence Score")
                Spacer()
                Text(String(format: "%.1f%%", result.confidenceScore.overall * 100))
                    .fontWeight(.semibold)
            }

            if !result.staleAnchors.isEmpty {
                HStack {
                    Text("Stale Anchors")
                    Spacer()
                    Text("\(result.staleAnchors.count)")
                        .foregroundColor(.orange)
                }
            }

            if result.panicMode {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                    Text("Panic Mode Active")
                        .foregroundColor(.red)
                }
            }
        }
    }

    private var statusBadge: some View {
        Text(result.verified ? "Verified" : "Not Verified")
            .font(.caption)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(result.verified ? Color.green.opacity(0.2) : Color.red.opacity(0.2))
            .foregroundColor(result.verified ? .green : .red)
            .cornerRadius(8)
    }
}

