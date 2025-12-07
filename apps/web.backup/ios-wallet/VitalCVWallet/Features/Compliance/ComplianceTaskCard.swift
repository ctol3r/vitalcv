//
//  ComplianceTaskCard.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 2, Task 11 & 13
//  Task cards with title, due date, trust-impact glow, urgency color band, swipe actions
//

import SwiftUI

/// ComplianceTaskCard - Individual task card with trust cues and swipe actions
struct ComplianceTaskCard: View {
    let task: ComplianceTask
    let onTap: () -> Void
    let onComplete: () -> Void
    let onSnooze: (Date) -> Void

    @State private var dragOffset: CGFloat = 0
    @State private var showingSnoozeSheet = false

    var body: some View {
        ZStack(alignment: .trailing) {
            // Swipe actions background
            HStack {
                Spacer()

                // Complete action
                Button(action: onComplete) {
                    VStack {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title2)
                        Text("Complete")
                            .font(WalletTypography.caption)
                    }
                    .foregroundColor(.white)
                    .frame(width: 80)
                }
                .background(Color.walletSuccess)

                // Snooze action
                Button(action: {
                    showingSnoozeSheet = true
                }) {
                    VStack {
                        Image(systemName: "clock.fill")
                            .font(.title2)
                        Text("Snooze")
                            .font(WalletTypography.caption)
                    }
                    .foregroundColor(.white)
                    .frame(width: 80)
                }
                .background(Color.walletWarning)
            }

            // Main card content
            Button(action: onTap) {
                HStack(spacing: WalletSpacing.md) {
                    // Urgency color band (Task 11)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(urgencyColor)
                        .frame(width: 4)

                    // Task icon
                    ZStack {
                        Circle()
                            .fill(urgencyColor.opacity(0.15))
                            .frame(width: 44, height: 44)

                        Image(systemName: task.type.icon)
                            .font(.title3)
                            .foregroundColor(urgencyColor)
                    }

                    // Task content
                    VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                        // Title
                        Text(task.title)
                            .font(WalletTypography.headline)
                            .foregroundColor(.walletTextPrimary)
                            .lineLimit(2)

                        // Description
                        Text(task.description)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)
                            .lineLimit(2)

                        // Due date and trust impact
                        HStack(spacing: WalletSpacing.md) {
                            if let dueDate = task.dueDate {
                                Label(
                                    dueDateText(dueDate),
                                    systemImage: "calendar"
                                )
                                .font(WalletTypography.caption)
                                .foregroundColor(dueDateColor)
                            }

                            // Trust impact indicator
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.up.circle.fill")
                                    .font(.caption2)
                                Text("+\(Int(task.trustImpactScore * 100))% trust")
                                    .font(WalletTypography.caption2)
                            }
                            .foregroundColor(.walletSuccess)
                        }
                    }

                    Spacer()

                    // Urgency badge
                    VStack {
                        Text(urgencyText)
                            .font(WalletTypography.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule()
                                    .fill(urgencyColor)
                            )

                        if let matchImpact = task.matchScoreImpact, matchImpact < 0 {
                            Text("\(Int(abs(matchImpact) * 100))% match")
                                .font(WalletTypography.caption2)
                                .foregroundColor(.walletError)
                        }
                    }
                }
                .padding(WalletSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                        .fill(Color.walletCard)
                        .walletShadow(WalletShadow.medium)
                        // Trust-impact glow (Task 11)
                        .overlay(
                            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                                .stroke(
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            trustGlowColor.opacity(0.6),
                                            trustGlowColor.opacity(0.0)
                                        ]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    ),
                                    lineWidth: 2
                                )
                        )
                )
                .offset(x: dragOffset)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            if value.translation.width < 0 {
                                dragOffset = max(value.translation.width, -160)
                            }
                        }
                        .onEnded { value in
                            if value.translation.width < -80 {
                                // Show actions
                                withAnimation(.spring()) {
                                    dragOffset = -160
                                }
                            } else {
                                // Snap back
                                withAnimation(.spring()) {
                                    dragOffset = 0
                                }
                            }
                        }
                )
            }
            .buttonStyle(PlainButtonStyle())
        }
        .sheet(isPresented: $showingSnoozeSheet) {
            SnoozeSheet(task: task) { date in
                onSnooze(date)
                withAnimation(.spring()) {
                    dragOffset = 0
                }
            }
        }
    }

    // MARK: - Computed Properties

    private var urgencyColor: Color {
        switch task.urgency {
        case .low: return .walletInfo
        case .medium: return .walletWarning
        case .high: return .walletError
        case .critical: return .purple
        }
    }

    private var urgencyText: String {
        switch task.urgency {
        case .low: return "LOW"
        case .medium: return "MED"
        case .high: return "HIGH"
        case .critical: return "CRIT"
        }
    }

    private var trustGlowColor: Color {
        if task.trustImpactScore >= 0.15 {
            return .walletSuccess
        } else if task.trustImpactScore >= 0.10 {
            return .walletWarning
        } else {
            return .walletInfo
        }
    }

    private func dueDateText(_ date: Date) -> String {
        let calendar = Calendar.current
        let now = Date()

        if date < now {
            let daysAgo = calendar.dateComponents([.day], from: date, to: now).day ?? 0
            return "\(daysAgo) day\(daysAgo == 1 ? "" : "s") overdue"
        } else {
            let daysUntil = calendar.dateComponents([.day], from: now, to: date).day ?? 0
            if daysUntil == 0 {
                return "Due today"
            } else if daysUntil == 1 {
                return "Due tomorrow"
            } else {
                return "Due in \(daysUntil) days"
            }
        }
    }

    private var dueDateColor: Color {
        if task.isOverdue {
            return .walletError
        } else if let daysUntil = task.daysUntilDue, daysUntil <= 7 {
            return .walletWarning
        } else {
            return .walletTextSecondary
        }
    }
}

// MARK: - Snooze Sheet

struct SnoozeSheet: View {
    let task: ComplianceTask
    let onSnooze: (Date) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var selectedDuration: SnoozeDuration = .oneDay

    enum SnoozeDuration: String, CaseIterable {
        case oneHour = "1 hour"
        case oneDay = "1 day"
        case threeDays = "3 days"
        case oneWeek = "1 week"

        var date: Date {
            let calendar = Calendar.current
            switch self {
            case .oneHour:
                return calendar.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
            case .oneDay:
                return calendar.date(byAdding: .day, value: 1, to: Date()) ?? Date()
            case .threeDays:
                return calendar.date(byAdding: .day, value: 3, to: Date()) ?? Date()
            case .oneWeek:
                return calendar.date(byAdding: .day, value: 7, to: Date()) ?? Date()
            }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: WalletSpacing.lg) {
                Text("Snooze Task")
                    .font(WalletTypography.title2)
                    .padding(.top, WalletSpacing.lg)

                Text(task.title)
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, WalletSpacing.md)

                VStack(spacing: WalletSpacing.md) {
                    ForEach(SnoozeDuration.allCases, id: \.self) { duration in
                        Button(action: {
                            selectedDuration = duration
                        }) {
                            HStack {
                                Text(duration.rawValue)
                                    .font(WalletTypography.body)

                                Spacer()

                                if selectedDuration == duration {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.walletPrimary)
                                }
                            }
                            .padding(WalletSpacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                                    .fill(selectedDuration == duration ? Color.walletPrimary.opacity(0.1) : Color.walletCard)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                                            .stroke(selectedDuration == duration ? Color.walletPrimary : Color.clear, lineWidth: 2)
                                    )
                            )
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
                .padding(.horizontal, WalletSpacing.md)

                Spacer()

                Button(action: {
                    onSnooze(selectedDuration.date)
                    dismiss()
                }) {
                    Text("Snooze")
                        .font(WalletTypography.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(WalletSpacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                                .fill(Color.walletPrimary)
                        )
                }
                .padding(.horizontal, WalletSpacing.md)
                .padding(.bottom, WalletSpacing.lg)
            }
            .navigationTitle("Snooze")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    VStack {
        ComplianceTaskCard(
            task: ComplianceTask(
                type: .licenseRenewal,
                urgency: .high,
                dueDate: Calendar.current.date(byAdding: .day, value: 5, to: Date()),
                trustImpactScore: 0.15,
                actionRoute: .renewLicense,
                title: "Medical License Renewal",
                description: "Your medical license expires in 5 days. Renew now to maintain compliance.",
                category: .credential
            ),
            onTap: {},
            onComplete: {},
            onSnooze: { _ in }
        )
        .padding()
    }
}

