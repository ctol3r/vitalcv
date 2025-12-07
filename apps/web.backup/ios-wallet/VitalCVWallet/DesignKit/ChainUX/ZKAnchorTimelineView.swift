//
//  ZKAnchorTimelineView.swift
//  VitalCVWallet
//
//  Created: Advanced Chain Anchoring & ZK-Proof Identity ARC - Phase 4
//  ZK-Anchor Timeline View combining block events with ZK attestations
//

import SwiftUI

/// ZKAnchorTimelineView - Timeline showing block events + ZK attestations
public struct ZKAnchorTimelineView: View {
    let events: [ZKAnchorEvent]
    @State private var expandedEventId: String?
    @State private var selectedProofId: String?

    public init(events: [ZKAnchorEvent]) {
        self.events = events
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Task 25: ZK-Anchor Timeline
                ForEach(events) { event in
                    ZKAnchorEventRow(
                        event: event,
                        isExpanded: expandedEventId == event.id,
                        selectedProofId: $selectedProofId,
                        onTap: {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                if expandedEventId == event.id {
                                    expandedEventId = nil
                                } else {
                                    expandedEventId = event.id
                                }
                            }
                        }
                    )
                }
            }
            .padding(.vertical, WalletSpacing.md)
        }
    }
}

// MARK: - ZK Anchor Event Row

struct ZKAnchorEventRow: View {
    let event: ZKAnchorEvent
    let isExpanded: Bool
    @Binding var selectedProofId: String?
    let onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: WalletSpacing.md) {
                // Timeline indicator
                VStack(spacing: 0) {
                    Circle()
                        .fill(eventTypeColor)
                        .frame(width: 12, height: 12)
                        .overlay(
                            Circle()
                                .stroke(Color.walletCard, lineWidth: 2)
                        )

                    if !isExpanded {
                        Rectangle()
                            .fill(Color.walletTextSecondary.opacity(0.2))
                            .frame(width: 2)
                            .frame(maxHeight: .infinity)
                    }
                }
                .frame(width: 12)

                // Event content
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    // Event header
                    HStack {
                        Image(systemName: eventTypeIcon)
                            .foregroundColor(eventTypeColor)

                        Text(eventTitle)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextPrimary)

                        Spacer()

                        // Task 26: Anchor stability indicator
                        AnchorStabilityBadge(stability: event.stability)

                        Text(timeLabel)
                            .font(WalletTypography.caption2)
                            .foregroundColor(.walletTextSecondary)
                    }

                    // Task 30: Timeline nodes for hidden attributes
                    if event.hasZKProof {
                        ZKProofIndicator(proof: event.zkProof)
                    }

                    // Expanded content
                    if isExpanded {
                        ZKAnchorEventDetailView(
                            event: event,
                            selectedProofId: $selectedProofId
                        )
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, WalletSpacing.md)
            .padding(.vertical, WalletSpacing.sm)
            .contentShape(Rectangle())
            .onTapGesture {
                onTap()
            }
        }
    }

    private var eventTitle: String {
        switch event.type {
        case .zkIssuance:
            return "ZK Credential Issued"
        case .anchor:
            return "Anchored to Chain"
        case .zkPresentation:
            return "ZK Presentation"
        case .reAnchor:
            return "Re-anchored"
        case .proofReplay:
            return "Proof Replayed"
        }
    }

    private var eventTypeIcon: String {
        switch event.type {
        case .zkIssuance:
            return "lock.shield.fill"
        case .anchor:
            return "link"
        case .zkPresentation:
            return "eye.slash.fill"
        case .reAnchor:
            return "arrow.clockwise"
        case .proofReplay:
            return "arrow.triangle.2.circlepath"
        }
    }

    private var eventTypeColor: Color {
        switch event.type {
        case .zkIssuance:
            return .walletPrimary
        case .anchor:
            return ChainColorPalette.emerald
        case .zkPresentation:
            return .walletPrimary.opacity(0.7)
        case .reAnchor:
            return ChainColorPalette.amber
        case .proofReplay:
            return .walletTextSecondary
        }
    }

    private var timeLabel: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: event.timestamp, relativeTo: Date())
    }
}

// MARK: - Task 26: Anchor Stability Graph

struct AnchorStabilityBadge: View {
    let stability: AnchorStability

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(stabilityColor)
                .frame(width: 8, height: 8)

            Text(stabilityLabel)
                .font(WalletTypography.caption2)
                .foregroundColor(stabilityColor)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(stabilityColor.opacity(0.1))
        .cornerRadius(4)
    }

    private var stabilityColor: Color {
        switch stability {
        case .stable:
            return ChainColorPalette.emerald
        case .risk:
            return ChainColorPalette.amber
        case .unstable:
            return .walletError
        }
    }

    private var stabilityLabel: String {
        switch stability {
        case .stable:
            return "Stable"
        case .risk:
            return "Risk"
        case .unstable:
            return "Unstable"
        }
    }
}

// MARK: - Task 27: Selective Disclosure Timeline

struct SelectiveDisclosureTimeline: View {
    let disclosures: [SelectiveDisclosureRecord]

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Selective Disclosure History")
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            ForEach(disclosures) { disclosure in
                DisclosureRecordRow(disclosure: disclosure)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

struct DisclosureRecordRow: View {
    let disclosure: SelectiveDisclosureRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(disclosure.verifierName ?? "Unknown Verifier")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextPrimary)

                Spacer()

                Text(formatDate(disclosure.timestamp))
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletTextSecondary)
            }

            Text("Revealed: \(disclosure.revealedAttributes.joined(separator: ", "))")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)

            Text("Hidden: \(disclosure.hiddenAttributes.count) attributes")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
        }
        .padding()
        .background(Color.walletCard.opacity(0.5))
        .cornerRadius(WalletCornerRadius.small)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Task 28: Proof Replay

struct ProofReplayView: View {
    let proof: ZKProof
    @State private var isReplaying = false

    var body: some View {
        Button(action: {
            isReplaying = true
            // In production, replay proof verification
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                isReplaying = false
            }
        }) {
            HStack {
                if isReplaying {
                    ProgressView()
                } else {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text("Replay Proof")
                }
            }
            .font(WalletTypography.subheadline)
            .foregroundColor(.walletPrimary)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.walletPrimary.opacity(0.1))
            .cornerRadius(WalletCornerRadius.medium)
        }
        .disabled(isReplaying)
    }
}

// MARK: - Task 29: ZK Issuance → Anchor → Re-anchor Animation

struct ZKAnchorAnimationPath: View {
    let events: [ZKAnchorEvent]
    @State private var animationProgress: Double = 0.0

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Path
                Path { path in
                    let width = geometry.size.width
                    let height = geometry.size.height
                    let step = width / CGFloat(max(events.count - 1, 1))

                    path.move(to: CGPoint(x: 0, y: height / 2))

                    for i in 1..<events.count {
                        let x = CGFloat(i) * step
                        path.addLine(to: CGPoint(x: x, y: height / 2))
                    }
                }
                .stroke(
                    Color.walletPrimary.opacity(0.3),
                    style: StrokeStyle(lineWidth: 2, dash: [5, 5])
                )

                // Animated dot
                Circle()
                    .fill(Color.walletPrimary)
                    .frame(width: 12, height: 12)
                    .offset(x: geometry.size.width * animationProgress - 6, y: geometry.size.height / 2 - 6)
            }
        }
        .frame(height: 40)
        .onAppear {
            withAnimation(.linear(duration: 2.0).repeatForever(autoreverses: false)) {
                animationProgress = 1.0
            }
        }
    }
}

// MARK: - Task 30: Hidden Attribute Timeline Nodes

struct ZKProofIndicator: View {
    let proof: ZKProof?
    @State private var isPulsing = false

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "eye.slash.fill")
                .font(.system(size: 10))
                .foregroundColor(.walletPrimary)
                .opacity(isPulsing ? 0.6 : 1.0)
                .animation(
                    Animation.easeInOut(duration: 1.0)
                        .repeatForever(autoreverses: true),
                    value: isPulsing
                )

            Text("\(proof?.hiddenAttributes.count ?? 0) hidden")
                .font(WalletTypography.caption2)
                .foregroundColor(.walletTextSecondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(Color.walletPrimary.opacity(0.1))
                .blur(radius: isPulsing ? 2 : 0)
        )
        .onAppear {
            isPulsing = true
        }
    }
}

// MARK: - Task 31: Breach Detection

struct BreachDetectionView: View {
    let digestMismatch: Bool
    let trustDrop: Double

    var body: some View {
        if digestMismatch {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.walletError)

                Text("Proof digest mismatch detected")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletError)

                Spacer()

                Text("Trust: -\(Int(trustDrop * 100))%")
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletError)
            }
            .padding()
            .background(Color.walletError.opacity(0.1))
            .cornerRadius(WalletCornerRadius.small)
        }
    }
}

// MARK: - Task 32: Multi-Issuer ZK Chain Linking

struct MultiIssuerZKChainView: View {
    let chain: [MultiIssuerZKLink]

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Multi-Issuer ZK Chain")
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            ForEach(chain) { link in
                MultiIssuerZKLinkRow(link: link)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

struct MultiIssuerZKLinkRow: View {
    let link: MultiIssuerZKLink

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(link.issuerName)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextPrimary)

                Text("Proof continuity: \(link.continuityScore)%")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            Spacer()

            if link.isContinuous {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.walletSuccess)
            } else {
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundColor(.walletError)
            }
        }
        .padding()
        .background(Color.walletCard.opacity(0.5))
        .cornerRadius(WalletCornerRadius.small)
    }
}

// MARK: - ZK Anchor Event Detail View

struct ZKAnchorEventDetailView: View {
    let event: ZKAnchorEvent
    @Binding var selectedProofId: String?

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            if let blockNumber = event.blockNumber {
                DetailRow(label: "Block Number", value: "\(blockNumber)")
            }

            if let txHash = event.transactionHash {
                DetailRow(label: "Transaction Hash", value: String(txHash.prefix(16)) + "...")
            }

            if event.hasZKProof, let proof = event.zkProof {
                VStack(alignment: .leading, spacing: 4) {
                    Text("ZK Proof")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)

                    Text("Revealed: \(proof.revealedAttributes.count), Hidden: \(proof.hiddenAttributes.count)")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextPrimary)
                }
            }

            // Task 28: Proof replay button
            if event.hasZKProof {
                ProofReplayView(proof: event.zkProof!)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .padding(.top, WalletSpacing.sm)
    }
}

// MARK: - Models

public struct ZKAnchorEvent: Identifiable {
    public let id = UUID().uuidString
    public let type: ZKAnchorEventType
    public let timestamp: Date
    public let blockNumber: Int?
    public let transactionHash: String?
    public let stability: AnchorStability
    public let zkProof: ZKProof?
    public let disclosureRecord: SelectiveDisclosureRecord?

    public var hasZKProof: Bool {
        zkProof != nil
    }
}

public enum ZKAnchorEventType {
    case zkIssuance
    case anchor
    case zkPresentation
    case reAnchor
    case proofReplay
}

public enum AnchorStability {
    case stable
    case risk
    case unstable
}

public struct SelectiveDisclosureRecord: Identifiable {
    public let id = UUID().uuidString
    public let verifierName: String?
    public let timestamp: Date
    public let revealedAttributes: [String]
    public let hiddenAttributes: [String]
    public let proofId: String
}

public struct MultiIssuerZKLink: Identifiable {
    public let id = UUID().uuidString
    public let issuerName: String
    public let issuerId: String
    public let proofId: String
    public let continuityScore: Double
    public let isContinuous: Bool
}








