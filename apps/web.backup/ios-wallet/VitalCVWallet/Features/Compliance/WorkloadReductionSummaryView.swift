//
//  WorkloadReductionSummaryView.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 4, Task 30
//  Predicted workload reduction summary
//

import SwiftUI

/// WorkloadReductionSummaryView - Shows predicted impact of completing tasks
struct WorkloadReductionSummaryView: View {
    @StateObject private var engine = ComplianceTaskEngine.shared

    @State private var selectedTasks: Set<String> = []

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Complete Tasks to Boost Your Profile")
                .font(WalletTypography.title2)
                .foregroundColor(.walletTextPrimary)

            // Task selection
            ScrollView {
                VStack(spacing: WalletSpacing.sm) {
                    ForEach(engine.activeTasks.prefix(10)) { task in
                        TaskSelectionRow(
                            task: task,
                            isSelected: selectedTasks.contains(task.id),
                            onToggle: {
                                if selectedTasks.contains(task.id) {
                                    selectedTasks.remove(task.id)
                                } else {
                                    selectedTasks.insert(task.id)
                                }
                            }
                        )
                    }
                }
            }

            // Impact summary
            if !selectedTasks.isEmpty {
                ImpactSummaryView(
                    selectedTaskIds: selectedTasks,
                    tasks: engine.activeTasks
                )
            }
        }
        .padding(WalletSpacing.md)
    }
}

// MARK: - Task Selection Row

struct TaskSelectionRow: View {
    let task: ComplianceTask
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .walletPrimary : .walletTextSecondary)

                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(task.title)
                        .font(WalletTypography.body)
                        .foregroundColor(.walletTextPrimary)

                    HStack {
                        Label("+\(Int(task.trustImpactScore * 100))% trust", systemImage: "arrow.up.circle.fill")
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletSuccess)

                        if let matchImpact = task.matchScoreImpact, matchImpact < 0 {
                            Label("+\(Int(abs(matchImpact) * 100))% match", systemImage: "arrow.up.circle.fill")
                                .font(WalletTypography.caption)
                                .foregroundColor(.walletSuccess)
                        }
                    }
                }

                Spacer()
            }
            .padding(WalletSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: WalletCornerRadius.small)
                    .fill(isSelected ? Color.walletPrimary.opacity(0.1) : Color.walletCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: WalletCornerRadius.small)
                            .stroke(isSelected ? Color.walletPrimary : Color.clear, lineWidth: 2)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Impact Summary

struct ImpactSummaryView: View {
    let selectedTaskIds: Set<String>
    let tasks: [ComplianceTask]

    var selectedTasks: [ComplianceTask] {
        tasks.filter { selectedTaskIds.contains($0.id) }
    }

    var totalTrustBoost: Double {
        selectedTasks.reduce(0.0) { $0 + $1.trustImpactScore }
    }

    var totalMatchBoost: Double {
        selectedTasks.compactMap { $0.matchScoreImpact }
            .filter { $0 < 0 }
            .reduce(0.0) { $0 + abs($1) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Impact Summary")
                .font(WalletTypography.title3)
                .foregroundColor(.walletTextPrimary)

            VStack(spacing: WalletSpacing.sm) {
                // Trust score boost
                ImpactCard(
                    icon: "arrow.up.circle.fill",
                    title: "Trust Score",
                    value: "+\(Int(totalTrustBoost * 100))%",
                    color: .walletSuccess,
                    description: "Completing these \(selectedTasks.count) tasks will boost your trust score"
                )

                // Match score boost
                if totalMatchBoost > 0 {
                    ImpactCard(
                        icon: "briefcase.fill",
                        title: "Match Score",
                        value: "+\(Int(totalMatchBoost * 100))%",
                        color: .walletInfo,
                        description: "Improve your job match potential"
                    )
                }

                // Task count
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.walletPrimary)
                    Text("\(selectedTasks.count) task\(selectedTasks.count == 1 ? "" : "s") selected")
                        .font(WalletTypography.body)
                        .foregroundColor(.walletTextPrimary)
                }
            }

            // Complete button
            Button(action: {
                // Complete all selected tasks
                Task {
                    for taskId in selectedTaskIds {
                        await ComplianceTaskEngine.shared.markTaskComplete(taskId)
                    }
                }
            }) {
                Text("Complete Selected Tasks")
                    .font(WalletTypography.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(WalletSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                            .fill(Color.walletPrimary)
                    )
            }
        }
        .padding(WalletSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.walletSuccess.opacity(0.1),
                            Color.walletInfo.opacity(0.05)
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .walletShadow(WalletShadow.medium)
        )
    }
}

// MARK: - Impact Card

struct ImpactCard: View {
    let icon: String
    let title: String
    let value: String
    let color: Color
    let description: String

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
                .frame(width: 40)

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(title)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)

                Text(value)
                    .font(WalletTypography.title2)
                    .fontWeight(.bold)
                    .foregroundColor(color)

                Text(description)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            Spacer()
        }
        .padding(WalletSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(Color.walletCard)
                .walletShadow(WalletShadow.small)
        )
    }
}

#Preview {
    WorkloadReductionSummaryView()
}

