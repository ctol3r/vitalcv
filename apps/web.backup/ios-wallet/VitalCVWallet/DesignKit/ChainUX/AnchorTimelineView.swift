//
//  AnchorTimelineView.swift
//  VitalCVWallet
//
//  Created: Phase 2 - Task 9
//  Anchor timeline view (vertical timeline)
//

import SwiftUI

/// AnchorTimelineView - Vertical timeline showing chain anchor history
struct AnchorTimelineView: View {
    let events: [ChainEvent]
    @State private var expandedEventId: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(groupedEvents) { group in
                    ChainEventGroupView(
                        group: group,
                        expandedEventId: $expandedEventId
                    )
                }
            }
            .padding(.vertical, WalletSpacing.md)
        }
    }

    private var groupedEvents: [ChainEventGroupSection] {
        let grouped = Dictionary(grouping: events) { event in
            eventGroup(for: event)
        }

        return grouped.map { (group, events) in
            ChainEventGroupSection(
                group: group,
                events: events.sorted { $0.timestamp > $1.timestamp }
            )
        }
        .sorted { $0.group.priority > $1.group.priority }
    }

    private func eventGroup(for event: ChainEvent) -> ChainEventGroup {
        switch event.type {
        case .anchor:
            return .anchored
        case .reAnchor:
            return .reAnchored
        case .revoke:
            return .revoked
        case .verified:
            return .verified
        default:
            return .issued
        }
    }
}

/// ChainEventGroupSection - Section for a group of events
struct ChainEventGroupSection: Identifiable {
    let id = UUID()
    let group: ChainEventGroup
    let events: [ChainEvent]

    var priority: Int {
        group.priority
    }
}

/// ChainEventGroupView - View for a group of events
struct ChainEventGroupView: View {
    let group: ChainEventGroupSection
    @Binding var expandedEventId: String?

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            // Group header
            HStack {
                Text(group.group.displayName)
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletTextPrimary)

                Spacer()

                Text("\(group.events.count)")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color.walletCard)
                    )
            }
            .padding(.horizontal, WalletSpacing.md)

            // Events
            VStack(spacing: 0) {
                ForEach(group.events) { event in
                    ChainEventRow(
                        event: event,
                        isExpanded: expandedEventId == event.id,
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
        }
        .padding(.bottom, WalletSpacing.lg)
    }
}

/// ChainEventRow - Individual event row in timeline
struct ChainEventRow: View {
    let event: ChainEvent
    let isExpanded: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Timeline line and content
            HStack(alignment: .top, spacing: WalletSpacing.md) {
                // Timeline indicator
                VStack(spacing: 0) {
                    Circle()
                        .fill(ChainEventIconographySet.color(for: event.type))
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
                        ChainEventIconographySet.iconView(
                            for: event.type,
                            size: 20
                        )

                        Text(eventTitle)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextPrimary)

                        Spacer()

                        // Block height marker (Task 10)
                        if let blockNumber = event.blockNumber {
                            BlockNumberBadge(blockNumber: blockNumber, style: .compact)
                        }

                        // Time label (Task 10)
                        Text(timeLabel)
                            .font(WalletTypography.caption2)
                            .foregroundColor(.walletTextSecondary)
                    }

                    // Expanded content (Task 16)
                    if isExpanded {
                        ChainEventDetailView(event: event)
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

            // Animated anchor drop (Task 11)
            if event.type == .anchor && !isExpanded {
                AnchorDropAnimation()
                    .frame(height: 40)
                    .padding(.leading, WalletSpacing.md * 2)
            }
        }
    }

    private var eventTitle: String {
        switch event.type {
        case .anchor: return "Anchored to Chain"
        case .reAnchor: return "Re-anchored"
        case .revoke: return "Revoked"
        case .stale: return "Stale Anchor"
        case .confirming: return "Confirming..."
        case .verified: return "Verified"
        case .unverified: return "Unverified"
        }
    }

    private var timeLabel: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: event.timestamp, relativeTo: Date())
    }
}

/// AnchorDropAnimation - Animated anchor drop icon (Task 11)
struct AnchorDropAnimation: View {
    @State private var dropOffset: CGFloat = -20
    @State private var dropOpacity: Double = 0.0
    @State private var hasAnimated = false

    var body: some View {
        Image(systemName: "anchor.fill")
            .font(.system(size: 24))
            .foregroundColor(ChainColorPalette.emerald)
            .offset(y: dropOffset)
            .opacity(dropOpacity)
            .onAppear {
                if !hasAnimated {
                    withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                        dropOffset = 0
                        dropOpacity = 1.0
                    }
                    hasAnimated = true
                }
            }
    }
}

/// ChainEventDetailView - Detailed view for expanded event (Task 16)
struct ChainEventDetailView: View {
    let event: ChainEvent

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            if let blockNumber = event.blockNumber {
                DetailRow(label: "Block Number", value: "\(blockNumber)")
            }

            if let txHash = event.transactionHash {
                DetailRow(
                    label: "Transaction Hash",
                    value: String(txHash.prefix(16)) + "..."
                )
            }

            if let ledgerId = event.metadata?.ledgerId {
                DetailRow(label: "Ledger ID", value: ledgerId)
            }

            DetailRow(
                label: "Timestamp",
                value: timestampString
            )

            DetailRow(
                label: "Confirmations",
                value: "\(event.confirmations)"
            )

            if let explorerUrl = event.metadata?.explorerUrl {
                Link("View in Explorer", destination: URL(string: explorerUrl)!)
                    .font(WalletTypography.caption)
                    .foregroundColor(.chainEmerald)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .padding(.top, WalletSpacing.sm)
    }

    private var timestampString: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.timeZone = TimeZone.current
        let local = formatter.string(from: event.timestamp)

        formatter.timeZone = TimeZone(identifier: "UTC")
        let utc = formatter.string(from: event.timestamp)

        return "\(local) (UTC: \(utc))"
    }
}

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
                .foregroundColor(.walletTextPrimary)
        }
    }
}

// MARK: - Chain Wave Effect (Task 12)

/// ChainWaveEffect - Wave effect behind stable anchors (Task 12)
struct ChainWaveEffect: View {
    @State private var wavePhase: Double = 0
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            Path { path in
                let width = geometry.size.width
                let height = geometry.size.height
                let amplitude = height * 0.3
                let frequency = 2.0

                path.move(to: CGPoint(x: 0, y: height / 2))

                for x in stride(from: 0, through: width, by: 1) {
                    let y = height / 2 + amplitude * sin((Double(x) / width * frequency * 2 * .pi) + wavePhase)
                    path.addLine(to: CGPoint(x: x, y: y))
                }
            }
            .stroke(color.opacity(0.3), lineWidth: 2)
        }
        .onAppear {
            withAnimation(
                Animation.linear(duration: 3.0)
                    .repeatForever(autoreverses: false)
            ) {
                wavePhase = .pi * 2
            }
        }
    }
}

// MARK: - Stale Anchor Warning Ribbon (Task 13)

/// StaleAnchorWarningRibbon - Warning ribbon for stale anchors (Task 13)
struct StaleAnchorWarningRibbon: View {
    let daysSinceAnchor: Int

    var body: some View {
        HStack(spacing: WalletSpacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(ChainColorPalette.amber)

            Text("Anchor is \(daysSinceAnchor) days old. Re-verification recommended.")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextPrimary)
        }
        .padding(.horizontal, WalletSpacing.md)
        .padding(.vertical, WalletSpacing.sm)
        .background(
            LinearGradient(
                colors: [
                    ChainColorPalette.amber.opacity(0.2),
                    ChainColorPalette.amber.opacity(0.1)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .overlay(
            Rectangle()
                .frame(height: 2)
                .fill(ChainColorPalette.amber),
            alignment: .top
        )
    }
}

// MARK: - Anchor Confidence Rings (Task 14)

/// AnchorConfidenceRings - Confidence rings showing confirmations (Task 14)
struct AnchorConfidenceRings: View {
    let confirmations: Int
    let maxConfirmations: Int

    var body: some View {
        ZStack {
            // Outer ring (max confirmations)
            Circle()
                .stroke(Color.gray.opacity(0.2), lineWidth: 4)
                .frame(width: 60, height: 60)

            // Inner ring (current confirmations)
            Circle()
                .trim(from: 0, to: CGFloat(confirmations) / CGFloat(maxConfirmations))
                .stroke(
                    confirmationColor,
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .frame(width: 50, height: 50)
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: confirmations)

            // Center text
            Text("\(confirmations)")
                .font(WalletTypography.headline)
                .foregroundColor(confirmationColor)
        }
    }

    private var confirmationColor: Color {
        if confirmations >= 12 {
            return ChainColorPalette.emerald
        } else if confirmations >= 6 {
            return ChainColorPalette.emerald.opacity(0.8)
        } else if confirmations >= 3 {
            return ChainColorPalette.amber
        } else {
            return ChainColorPalette.glacialBlue
        }
    }
}

// MARK: - Preview

#Preview {
    AnchorTimelineView(events: [
        ChainEvent(
            type: .anchor,
            timestamp: Date().addingTimeInterval(-86400 * 5),
            blockNumber: 12345678,
            transactionHash: "0x1234567890abcdef",
            confirmations: 12,
            status: .anchored,
            metadata: ChainEventMetadata(
                ledgerId: "ledger-123",
                explorerUrl: "https://explorer.example.com/tx/0x123"
            )
        ),
        ChainEvent(
            type: .verified,
            timestamp: Date().addingTimeInterval(-86400 * 3),
            blockNumber: nil,
            transactionHash: nil,
            confirmations: 0,
            status: .anchored
        )
    ])
    .padding()
}

