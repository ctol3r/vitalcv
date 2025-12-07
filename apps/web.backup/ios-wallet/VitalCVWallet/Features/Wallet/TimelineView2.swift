//
//  TimelineView2.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Tasks 16-20
//  Vertical animated timeline with tap nodes, color-coded events, proof chain
//

import SwiftUI

struct TimelineEvent2: Identifiable {
    let id: String
    let type: EventType
    let timestamp: Date
    let title: String
    let description: String?
    let proof: Proof?
    let actor: String?

    enum EventType {
        case issue
        case verify
        case anchor
        case revoke
        case conflict

        var color: Color {
            switch self {
            case .issue: return .walletSuccess
            case .verify: return .walletInfo
            case .anchor: return .walletPrimary
            case .revoke: return .walletError
            case .conflict: return .walletWarning
            }
        }

        var icon: String {
            switch self {
            case .issue: return VitalCVIcons.Timeline.issue
            case .verify: return VitalCVIcons.Timeline.verify
            case .anchor: return VitalCVIcons.Timeline.anchor
            case .revoke: return VitalCVIcons.Timeline.revoke
            case .conflict: return VitalCVIcons.Timeline.conflict
            }
        }
    }
}

struct TimelineView2: View {
    let events: [TimelineEvent2]
    let onEventTap: ((TimelineEvent2) -> Void)?

    @State private var expandedEventId: String? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                    TimelineNode(
                        event: event,
                        isFirst: index == 0,
                        isLast: index == events.count - 1,
                        isExpanded: expandedEventId == event.id,
                        onTap: {
                            // Task 17: Tap node to reveal proof
                            if expandedEventId == event.id {
                                expandedEventId = nil
                            } else {
                                withAnimation(.spring()) {
                                    expandedEventId = event.id
                                }
                                onEventTap?(event)
                            }
                        }
                    )
                }
            }
            .padding(.horizontal, WalletSpacing.md)
            .padding(.vertical, WalletSpacing.lg)
        }
    }
}

struct TimelineNode: View {
    let event: TimelineEvent2
    let isFirst: Bool
    let isLast: Bool
    let isExpanded: Bool
    let onTap: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: WalletSpacing.md) {
            // Timeline line and node
            VStack(spacing: 0) {
                // Top line (if not first)
                if !isFirst {
                    Rectangle()
                        .fill(event.type.color.opacity(0.3))
                        .frame(width: 2)
                        .frame(height: 40)
                }

                // Node
                Button(action: onTap) {
                    ZStack {
                        Circle()
                            .fill(event.type.color)
                            .frame(width: 24, height: 24)
                            .shadow(color: event.type.color.opacity(0.5), radius: 8, x: 0, y: 2)

                        VitalCVIcon(
                            systemName: event.type.icon,
                            size: 12,
                            color: .white
                        )
                    }
                }
                .buttonStyle(PlainButtonStyle())

                // Bottom line (if not last)
                if !isLast {
                    Rectangle()
                        .fill(event.type.color.opacity(0.3))
                        .frame(width: 2)
                        .frame(height: 40)
                }
            }
            .frame(width: 24)

            // Event content
            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                // Task 18: Color-coded events
                HStack {
                    Text(event.title)
                        .font(VitalCVFonts.headline)
                        .foregroundColor(event.type.color)

                    Spacer()

                    Text(formatTime(event.timestamp))
                        .font(VitalCVFonts.caption1)
                        .foregroundColor(.walletTextSecondary)
                }

                if let description = event.description {
                    Text(description)
                        .font(VitalCVFonts.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }

                // Task 17: Reveal proof when expanded
                if isExpanded, let proof = event.proof {
                    ProofDetailView(proof: proof)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }

                // Task 19: Proof chain carousel (if multiple proofs)
                if isExpanded && event.proof != nil {
                    ProofChainCarousel(event: event)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }

                // Task 20: Conflict detected visual alert
                if event.type == .conflict {
                    ConflictAlertView()
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(WalletSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .fill(Color.walletCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                            .stroke(event.type.color.opacity(0.3), lineWidth: 1)
                    )
            )
            .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
        }
        .padding(.vertical, WalletSpacing.xs)
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Proof Detail View

struct ProofDetailView: View {
    let proof: Proof

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            Text("Proof Details")
                .font(VitalCVFonts.caption1)
                .foregroundColor(.walletTextSecondary)

            HStack {
                Text("Type:")
                    .font(VitalCVFonts.caption2)
                    .foregroundColor(.walletTextSecondary)
                Text(proof.type)
                    .font(VitalCVFonts.caption2)
                    .foregroundColor(.walletText)
            }

            HStack {
                Text("Created:")
                    .font(VitalCVFonts.caption2)
                    .foregroundColor(.walletTextSecondary)
                Text(formatDate(proof.created))
                    .font(VitalCVFonts.caption2)
                    .foregroundColor(.walletText)
            }
        }
        .padding(WalletSpacing.sm)
        .background(Color.walletBackground)
        .cornerRadius(WalletCornerRadius.small)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Proof Chain Carousel

struct ProofChainCarousel: View {
    let event: TimelineEvent2
    @State private var currentIndex = 0

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            Text("Proof Chain")
                .font(VitalCVFonts.caption1)
                .foregroundColor(.walletTextSecondary)

            if let proof = event.proof {
                TabView(selection: $currentIndex) {
                    ProofCard(proof: proof)
                        .tag(0)

                    // Additional proof cards can be added here
                }
                .tabViewStyle(.page)
                .frame(height: 100)
            }
        }
    }
}

struct ProofCard: View {
    let proof: Proof

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            Text(proof.type)
                .font(VitalCVFonts.caption1)
                .foregroundColor(.walletText)

            Text(formatDate(proof.created))
                .font(VitalCVFonts.caption2)
                .foregroundColor(.walletTextSecondary)
        }
        .padding(WalletSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.walletBackground)
        .cornerRadius(WalletCornerRadius.small)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Conflict Alert View

struct ConflictAlertView: View {
    @State private var isPulsing = false

    var body: some View {
        HStack(spacing: WalletSpacing.sm) {
            VitalCVIcon(
                systemName: VitalCVIcons.Timeline.conflict,
                size: 16,
                color: .walletWarning
            )

            Text("Conflict Detected")
                .font(VitalCVFonts.caption1)
                .foregroundColor(.walletWarning)
        }
        .padding(WalletSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.small)
                .fill(Color.walletWarning.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: WalletCornerRadius.small)
                        .stroke(Color.walletWarning, lineWidth: 1)
                )
        )
        .scaleEffect(isPulsing ? 1.05 : 1.0)
        .animation(
            Animation.easeInOut(duration: 1.0)
                .repeatForever(autoreverses: true),
            value: isPulsing
        )
        .onAppear {
            isPulsing = true
        }
    }
}

