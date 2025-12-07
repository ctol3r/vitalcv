//
//  RiskHeatmapView.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 4, Task 29
//  Risk heatmap visualizing urgency across timeline
//

import SwiftUI

/// RiskHeatmapView - Visualizes urgency across timeline
struct RiskHeatmapView: View {
    @StateObject private var engine = ComplianceTaskEngine.shared

    @State private var selectedTimeframe: Timeframe = .threeMonths
    @State private var selectedDate: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            // Timeframe selector
            Picker("Timeframe", selection: $selectedTimeframe) {
                ForEach(Timeframe.allCases, id: \.self) { timeframe in
                    Text(timeframe.displayName).tag(timeframe)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, WalletSpacing.md)

            // Heatmap
            ScrollView {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    // Timeline header
                    Text("Risk Timeline")
                        .font(WalletTypography.title3)
                        .padding(.horizontal, WalletSpacing.md)

                    // Heatmap grid
                    LazyVStack(spacing: WalletSpacing.xs) {
                        ForEach(timeframeDates, id: \.self) { date in
                            HeatmapRow(
                                date: date,
                                tasks: tasksForDate(date),
                                isSelected: selectedDate == date,
                                onTap: {
                                    selectedDate = selectedDate == date ? nil : date
                                }
                            )
                        }
                    }
                    .padding(.horizontal, WalletSpacing.md)

                    // Legend
                    HeatmapLegend()
                        .padding(.horizontal, WalletSpacing.md)
                        .padding(.top, WalletSpacing.md)
                }
            }

            // Selected date details
            if let selectedDate = selectedDate {
                SelectedDateDetailsView(
                    date: selectedDate,
                    tasks: tasksForDate(selectedDate)
                )
                .padding(.horizontal, WalletSpacing.md)
            }
        }
        .padding(.vertical, WalletSpacing.md)
    }

    private var timeframeDates: [Date] {
        let calendar = Calendar.current
        let startDate = calendar.startOfDay(for: Date())
        let endDate = calendar.date(byAdding: .day, value: selectedTimeframe.days, to: startDate) ?? startDate

        var dates: [Date] = []
        var currentDate = startDate

        while currentDate <= endDate {
            dates.append(currentDate)
            currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate) ?? endDate
        }

        return dates
    }

    private func tasksForDate(_ date: Date) -> [ComplianceTask] {
        let calendar = Calendar.current
        let dayStart = calendar.startOfDay(for: date)
        let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart) ?? dayStart

        return engine.activeTasks.filter { task in
            guard let dueDate = task.dueDate else { return false }
            return dueDate >= dayStart && dueDate < dayEnd
        }
    }
}

// MARK: - Timeframe

enum Timeframe: CaseIterable {
    case oneMonth
    case threeMonths
    case sixMonths
    case oneYear

    var displayName: String {
        switch self {
        case .oneMonth: return "1 Month"
        case .threeMonths: return "3 Months"
        case .sixMonths: return "6 Months"
        case .oneYear: return "1 Year"
        }
    }

    var days: Int {
        switch self {
        case .oneMonth: return 30
        case .threeMonths: return 90
        case .sixMonths: return 180
        case .oneYear: return 365
        }
    }
}

// MARK: - Heatmap Row

struct HeatmapRow: View {
    let date: Date
    let tasks: [ComplianceTask]
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: WalletSpacing.sm) {
                // Date label
                VStack(alignment: .leading, spacing: 2) {
                    Text(date, style: .date)
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextPrimary)

                    if !tasks.isEmpty {
                        Text("\(tasks.count) task\(tasks.count == 1 ? "" : "s")")
                            .font(WalletTypography.caption2)
                            .foregroundColor(.walletTextSecondary)
                    }
                }
                .frame(width: 100, alignment: .leading)

                // Risk indicator
                HStack(spacing: 2) {
                    ForEach(0..<7) { weekDay in
                        let weekDate = Calendar.current.date(byAdding: .day, value: weekDay, to: date) ?? date
                        let weekTasks = tasks.filter { task in
                            guard let dueDate = task.dueDate else { return false }
                            return Calendar.current.isDate(dueDate, inSameDayAs: weekDate)
                        }

                        RiskCell(
                            riskLevel: calculateRiskLevel(for: weekTasks),
                            hasTasks: !weekTasks.isEmpty
                        )
                    }
                }

                Spacer()
            }
            .padding(WalletSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: WalletCornerRadius.small)
                    .fill(isSelected ? Color.walletPrimary.opacity(0.1) : Color.clear)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }

    private func calculateRiskLevel(for tasks: [ComplianceTask]) -> RiskLevel {
        if tasks.isEmpty {
            return .none
        }

        let maxUrgency = tasks.map { $0.urgency }.max() ?? .low

        switch maxUrgency {
        case .critical:
            return .critical
        case .high:
            return .high
        case .medium:
            return .medium
        case .low:
            return .low
        }
    }
}

// MARK: - Risk Cell

struct RiskCell: View {
    let riskLevel: RiskLevel
    let hasTasks: Bool

    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(riskColor)
            .frame(width: 20, height: 20)
    }

    private var riskColor: Color {
        switch riskLevel {
        case .none:
            return Color.gray.opacity(0.1)
        case .low:
            return Color.walletInfo.opacity(0.3)
        case .medium:
            return Color.walletWarning.opacity(0.5)
        case .high:
            return Color.walletError.opacity(0.7)
        case .critical:
            return Color.purple.opacity(0.9)
        }
    }
}

enum RiskLevel {
    case none
    case low
    case medium
    case high
    case critical
}

// MARK: - Heatmap Legend

struct HeatmapLegend: View {
    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            Text("Risk Levels")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)

            HStack(spacing: WalletSpacing.md) {
                LegendItem(color: Color.gray.opacity(0.1), label: "None")
                LegendItem(color: Color.walletInfo.opacity(0.3), label: "Low")
                LegendItem(color: Color.walletWarning.opacity(0.5), label: "Medium")
                LegendItem(color: Color.walletError.opacity(0.7), label: "High")
                LegendItem(color: Color.purple.opacity(0.9), label: "Critical")
            }
        }
    }
}

struct LegendItem: View {
    let color: Color
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 2)
                .fill(color)
                .frame(width: 16, height: 16)

            Text(label)
                .font(WalletTypography.caption2)
                .foregroundColor(.walletTextSecondary)
        }
    }
}

// MARK: - Selected Date Details

struct SelectedDateDetailsView: View {
    let date: Date
    let tasks: [ComplianceTask]

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text(date, style: .date)
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            if tasks.isEmpty {
                Text("No tasks due on this date")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
            } else {
                ForEach(tasks) { task in
                    HStack {
                        Circle()
                            .fill(urgencyColor(for: task.urgency))
                            .frame(width: 8, height: 8)

                        Text(task.title)
                            .font(WalletTypography.body)
                            .foregroundColor(.walletTextPrimary)
                    }
                }
            }
        }
        .padding(WalletSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(Color.walletCard)
                .walletShadow(WalletShadow.small)
        )
    }

    private func urgencyColor(for urgency: Urgency) -> Color {
        switch urgency {
        case .low: return .walletInfo
        case .medium: return .walletWarning
        case .high: return .walletError
        case .critical: return .purple
        }
    }
}

#Preview {
    RiskHeatmapView()
}

