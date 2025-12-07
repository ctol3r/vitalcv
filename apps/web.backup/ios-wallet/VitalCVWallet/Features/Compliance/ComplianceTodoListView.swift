//
//  ComplianceTodoListView.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 2, Tasks 9-16
//  Elegant list of tasks with trust cues and compliance urgency
//

import SwiftUI

/// ComplianceTodoListView - Main view for compliance to-do list
struct ComplianceTodoListView: View {
    @StateObject private var engine = ComplianceTaskEngine.shared
    @StateObject private var viewModel = ComplianceTodoListViewModel()

    @State private var selectedFilter: TaskFilter = .all
    @State private var selectedSort: TaskSort = .urgency
    @State private var showingTaskDetail: ComplianceTask?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.walletBackground
                    .ignoresSafeArea()

                if engine.isDetecting && engine.tasks.isEmpty {
                    // Skeleton loading (Task 15)
                    SkeletonLoadingView()
                } else if filteredAndSortedTasks.isEmpty {
                    EmptyStateView()
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            // Animated header (Task 10)
                            CredentialHealthHeader()
                                .padding(.horizontal, WalletSpacing.md)
                                .padding(.top, WalletSpacing.md)

                            // Filter bar (Task 14)
                            FilterBarView(
                                selectedFilter: $selectedFilter,
                                taskCounts: viewModel.taskCounts
                            )
                            .padding(.horizontal, WalletSpacing.md)
                            .padding(.top, WalletSpacing.md)

                            // Hazards banner
                            if !engine.hazards.isEmpty {
                                HazardsBannerView(hazards: engine.hazards)
                                    .padding(.horizontal, WalletSpacing.md)
                                    .padding(.top, WalletSpacing.sm)
                            }

                            // Task cards (Task 11)
                            LazyVStack(spacing: WalletSpacing.md) {
                                ForEach(filteredAndSortedTasks) { task in
                                    ComplianceTaskCard(
                                        task: task,
                                        onTap: {
                                            showingTaskDetail = task
                                        },
                                        onComplete: {
                                            Task {
                                                await engine.markTaskComplete(task.id)
                                            }
                                        },
                                        onSnooze: { date in
                                            engine.snoozeTask(task.id, until: date)
                                        }
                                    )
                                    .padding(.horizontal, WalletSpacing.md)
                                }
                            }
                            .padding(.top, WalletSpacing.md)
                            .padding(.bottom, WalletSpacing.xl)
                        }
                    }
                }
            }
            .navigationTitle("Compliance")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        ForEach(TaskSort.allCases, id: \.self) { sort in
                            Button(action: {
                                selectedSort = sort
                            }) {
                                HStack {
                                    Text(sort.displayName)
                                    if selectedSort == sort {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        Image(systemName: "arrow.up.arrow.down")
                    }
                }
            }
            .sheet(item: $showingTaskDetail) { task in
                ComplianceTaskDetailView(task: task)
            }
            .onAppear {
                Task {
                    await engine.detectTasks()
                    viewModel.updateTaskCounts(from: engine)
                }
            }
            .refreshable {
                await engine.detectTasks()
                viewModel.updateTaskCounts(from: engine)
            }
        }
    }

    private var filteredAndSortedTasks: [ComplianceTask] {
        var tasks = engine.activeTasks

        // Apply filter (Task 14)
        switch selectedFilter {
        case .all:
            break
        case .urgent:
            tasks = tasks.filter { $0.urgency == .high || $0.urgency == .critical }
        case .credential:
            tasks = tasks.filter { $0.category == .credential }
        case .compliance:
            tasks = tasks.filter { $0.category == .compliance }
        case .evidence:
            tasks = tasks.filter { $0.category == .evidence }
        case .chain:
            tasks = tasks.filter { $0.category == .chain }
        case .recruiter:
            tasks = tasks.filter { $0.category == .recruiter }
        case .job:
            tasks = tasks.filter { $0.category == .job }
        }

        // Apply sorting (Task 12)
        switch selectedSort {
        case .urgency:
            tasks.sort { $0.urgency > $1.urgency }
        case .category:
            tasks.sort { $0.category.rawValue < $1.category.rawValue }
        case .trustImpact:
            tasks.sort { $0.trustImpactScore > $1.trustImpactScore }
        case .dueDate:
            tasks.sort { task1, task2 in
                guard let date1 = task1.dueDate else { return false }
                guard let date2 = task2.dueDate else { return true }
                return date1 < date2
            }
        }

        return tasks
    }
}

// MARK: - Credential Health Header (Task 10)

struct CredentialHealthHeader: View {
    @StateObject private var engine = ComplianceTaskEngine.shared
    @State private var isAnimating = false

    var body: some View {
        VStack(spacing: WalletSpacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text("Your Credential Health Today")
                        .font(WalletTypography.title2)
                        .foregroundColor(.walletTextPrimary)

                    Text(healthStatusText)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()

                // Health indicator
                ZStack {
                    Circle()
                        .fill(healthColor.opacity(0.2))
                        .frame(width: 60, height: 60)

                    Circle()
                        .stroke(healthColor, lineWidth: 3)
                        .frame(width: 60, height: 60)
                        .scaleEffect(isAnimating ? 1.1 : 1.0)
                        .opacity(isAnimating ? 0.5 : 1.0)
                        .animation(
                            Animation.easeInOut(duration: 2.0)
                                .repeatForever(autoreverses: true),
                            value: isAnimating
                        )

                    Image(systemName: healthIcon)
                        .font(.title2)
                        .foregroundColor(healthColor)
                }
            }
            .padding(WalletSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .fill(Color.walletCard)
                    .walletShadow(WalletShadow.medium)
            )
        }
        .onAppear {
            isAnimating = true
        }
    }

    private var healthStatusText: String {
        let urgentCount = engine.urgentTasks.count
        let totalCount = engine.activeTasks.count

        if urgentCount == 0 && totalCount == 0 {
            return "All clear! No pending tasks."
        } else if urgentCount == 0 {
            return "\(totalCount) task\(totalCount == 1 ? "" : "s") pending"
        } else {
            return "\(urgentCount) urgent task\(urgentCount == 1 ? "" : "s")"
        }
    }

    private var healthColor: Color {
        let urgentCount = engine.urgentTasks.count

        if urgentCount == 0 {
            return .walletSuccess
        } else if urgentCount <= 2 {
            return .walletWarning
        } else {
            return .walletError
        }
    }

    private var healthIcon: String {
        let urgentCount = engine.urgentTasks.count

        if urgentCount == 0 {
            return "checkmark.circle.fill"
        } else if urgentCount <= 2 {
            return "exclamationmark.triangle.fill"
        } else {
            return "xmark.circle.fill"
        }
    }
}

// MARK: - Filter Bar (Task 14)

enum TaskFilter: String, CaseIterable {
    case all = "All"
    case urgent = "Urgent"
    case credential = "Credential"
    case compliance = "Compliance"
    case evidence = "Evidence"
    case chain = "Chain"
    case recruiter = "Recruiter"
    case job = "Job"

    var displayName: String {
        return rawValue
    }
}

struct FilterBarView: View {
    @Binding var selectedFilter: TaskFilter
    let taskCounts: [TaskFilter: Int]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: WalletSpacing.sm) {
                ForEach(TaskFilter.allCases, id: \.self) { filter in
                    FilterChip(
                        title: filter.displayName,
                        count: taskCounts[filter] ?? 0,
                        isSelected: selectedFilter == filter
                    ) {
                        selectedFilter = filter
                    }
                }
            }
            .padding(.horizontal, WalletSpacing.md)
        }
    }
}

struct FilterChip: View {
    let title: String
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: WalletSpacing.xs) {
                Text(title)
                    .font(WalletTypography.caption)
                    .fontWeight(isSelected ? .semibold : .regular)

                if count > 0 {
                    Text("\(count)")
                        .font(WalletTypography.caption2)
                        .fontWeight(.bold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(isSelected ? Color.white.opacity(0.3) : Color.walletTextSecondary.opacity(0.2))
                        )
                }
            }
            .foregroundColor(isSelected ? .white : .walletTextPrimary)
            .padding(.horizontal, WalletSpacing.md)
            .padding(.vertical, WalletSpacing.sm)
            .background(
                Capsule()
                    .fill(isSelected ? Color.walletPrimary : Color.walletCard)
            )
            .walletShadow(isSelected ? WalletShadow.small : WalletShadow.small.opacity(0))
        }
    }
}

// MARK: - Task Sort

enum TaskSort: String, CaseIterable {
    case urgency = "urgency"
    case category = "category"
    case trustImpact = "trustImpact"
    case dueDate = "dueDate"

    var displayName: String {
        switch self {
        case .urgency: return "Urgency"
        case .category: return "Category"
        case .trustImpact: return "Trust Impact"
        case .dueDate: return "Due Date"
        }
    }
}

// MARK: - Hazards Banner

struct HazardsBannerView: View {
    let hazards: [IdentityHealthHazard]

    var body: some View {
        VStack(spacing: WalletSpacing.sm) {
            ForEach(hazards) { hazard in
                HazardBanner(hazard: hazard)
            }
        }
    }
}

struct HazardBanner: View {
    let hazard: IdentityHealthHazard

    var body: some View {
        HStack(spacing: WalletSpacing.sm) {
            Image(systemName: hazardIcon)
                .foregroundColor(hazardColor)
                .font(.title3)

            Text(hazard.message)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextPrimary)

            Spacer()
        }
        .padding(WalletSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(hazardColor.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                        .stroke(hazardColor.opacity(0.3), lineWidth: 1)
                )
        )
    }

    private var hazardColor: Color {
        switch hazard.severity {
        case .warning: return .walletWarning
        case .critical: return .walletError
        case .emergency: return .red
        }
    }

    private var hazardIcon: String {
        switch hazard.severity {
        case .warning: return "exclamationmark.triangle.fill"
        case .critical: return "exclamationmark.octagon.fill"
        case .emergency: return "xmark.circle.fill"
        }
    }
}

// MARK: - Empty State

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: WalletSpacing.lg) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundColor(.walletSuccess)

            Text("All Clear!")
                .font(WalletTypography.title1)
                .foregroundColor(.walletTextPrimary)

            Text("No pending compliance tasks")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
        }
        .padding(WalletSpacing.xl)
    }
}

// MARK: - Skeleton Loading (Task 15)

struct SkeletonLoadingView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: WalletSpacing.md) {
                // Header skeleton
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .fill(Color.gray.opacity(0.2))
                    .frame(height: 100)
                    .padding(.horizontal, WalletSpacing.md)
                    .shimmer()

                // Filter bar skeleton
                HStack(spacing: WalletSpacing.sm) {
                    ForEach(0..<5) { _ in
                        RoundedRectangle(cornerRadius: 20)
                            .fill(Color.gray.opacity(0.2))
                            .frame(width: 80, height: 32)
                            .shimmer()
                    }
                }
                .padding(.horizontal, WalletSpacing.md)

                // Task card skeletons
                ForEach(0..<3) { _ in
                    RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 120)
                        .padding(.horizontal, WalletSpacing.md)
                        .shimmer()
                }
            }
            .padding(.top, WalletSpacing.md)
        }
    }
}

extension View {
    func shimmer() -> some View {
        self.modifier(ShimmerModifier())
    }
}

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.clear,
                        Color.white.opacity(0.3),
                        Color.clear
                    ]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase * 200)
            )
            .onAppear {
                withAnimation(
                    Animation.linear(duration: 1.5)
                        .repeatForever(autoreverses: false)
                ) {
                    phase = 1
                }
            }
    }
}

// MARK: - ViewModel (Task 16)

@MainActor
class ComplianceTodoListViewModel: ObservableObject {
    @Published var taskCounts: [TaskFilter: Int] = [:]

    func updateTaskCounts(from engine: ComplianceTaskEngine) {
        taskCounts = [
            .all: engine.activeTasks.count,
            .urgent: engine.urgentTasks.count,
            .credential: engine.tasks(category: .credential).count,
            .compliance: engine.tasks(category: .compliance).count,
            .evidence: engine.tasks(category: .evidence).count,
            .chain: engine.tasks(category: .chain).count,
            .recruiter: engine.tasks(category: .recruiter).count,
            .job: engine.tasks(category: .job).count
        ]
    }
}

#Preview {
    ComplianceTodoListView()
}

