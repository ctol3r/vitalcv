//
//  SchedulerRootView.swift
//  VitalCVWallet
//
//  Created: Hospital Scheduling & Shift Credentialing - Phase 1, Task 4
//  SchedulerRootView (tabs: Shifts / Providers / Compliance)
//

import SwiftUI

struct SchedulerRootView: View {
    @StateObject private var viewModel = SchedulerDashboardViewModel()
    @State private var selectedTab: SchedulerTab = .shifts

    enum SchedulerTab: String, CaseIterable, Identifiable {
        case shifts = "Shifts"
        case providers = "Providers"
        case compliance = "Compliance"

        var id: String { rawValue }

        var icon: String {
            switch self {
            case .shifts: return "calendar"
            case .providers: return "person.2.fill"
            case .compliance: return "checkmark.shield.fill"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Today's Coverage Banner
            if let coverage = viewModel.todayCoverage {
                TodayCoverageBanner(coverage: coverage)
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(Color(.systemBackground))
            }

            // Tab Content
            TabView(selection: $selectedTab) {
                ShiftsTabView(viewModel: viewModel)
                    .tag(SchedulerTab.shifts)

                ProvidersTabView(viewModel: viewModel)
                    .tag(SchedulerTab.providers)

                ComplianceTabView(viewModel: viewModel)
                    .tag(SchedulerTab.compliance)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .navigationTitle("Scheduler")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    viewModel.refresh()
                }) {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .onAppear {
            viewModel.loadDashboard()
        }
    }
}

// MARK: - Today's Coverage Banner

struct TodayCoverageBanner: View {
    let coverage: TodayCoverage

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Today's Coverage")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text("\(coverage.totalStaff) / \(coverage.requiredStaff) staff")
                    .font(.headline)
                    .foregroundColor(.primary)
            }

            Spacer()

            // Coverage indicator
            VStack(alignment: .trailing, spacing: 4) {
                Text("\(Int(coverage.coveragePercentage * 100))%")
                    .font(.headline)
                    .foregroundColor(coverageStatusColor)

                ProgressView(value: coverage.coveragePercentage, total: 1.0)
                    .frame(width: 60)
                    .tint(coverageStatusColor)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var coverageStatusColor: Color {
        if coverage.coveragePercentage >= 1.0 {
            return .green
        } else if coverage.coveragePercentage >= 0.8 {
            return .orange
        } else {
            return .red
        }
    }
}

// MARK: - Shifts Tab View

struct ShiftsTabView: View {
    @ObservedObject var viewModel: SchedulerDashboardViewModel
    @State private var selectedDate = Date()

    var body: some View {
        NavigationStack {
        VStack(spacing: 0) {
            // Shift Type Filter
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ShiftTypeFilterButton(
                        title: "All",
                        isSelected: viewModel.selectedShiftType == nil
                    ) {
                        viewModel.filterByShiftType(nil)
                    }

                    ForEach(ShiftType.allCases) { type in
                        ShiftTypeFilterButton(
                            title: type.rawValue,
                            icon: type.icon,
                            isSelected: viewModel.selectedShiftType == type
                        ) {
                            viewModel.filterByShiftType(type)
                        }
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical, 8)

            // Shifts List
            NavigationStack {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(filteredShifts) { shift in
                            NavigationLink(value: shift) {
                                ShiftCard(shift: shift)
                            }
                        }
                    }
                    .padding()
                }
                .navigationDestination(for: Shift.self) { shift in
                    ShiftAssignmentView(shift: shift)
                }
            }
        }
    }

    private var filteredShifts: [Shift] {
        var shifts = viewModel.shifts

        if let selectedType = viewModel.selectedShiftType {
            shifts = shifts.filter { $0.shiftType == selectedType }
        }

        return shifts.sorted { $0.startTime < $1.startTime }
    }
}

// MARK: - Shift Type Filter Button

struct ShiftTypeFilterButton: View {
    let title: String
    var icon: String? = nil
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.caption)
                }
                Text(title)
                    .font(.subheadline)
                    .fontWeight(isSelected ? .semibold : .regular)
            }
            .foregroundColor(isSelected ? .white : .primary)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(isSelected ? Color.blue : Color(.secondarySystemBackground))
            )
        }
    }
}

// MARK: - Shift Card

struct ShiftCard: View {
    let shift: Shift

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(shift.unitName)
                        .font(.headline)

                    HStack(spacing: 8) {
                        Label(shift.shiftType.rawValue, systemImage: shift.shiftType.icon)
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(timeRange)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    }

                Spacer()

                // Credential Risk Indicator
                CredentialRiskIndicator(riskLevel: shift.credentialRiskLevel)
            }

            Divider()

            // Staffing Info
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Staffing")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text("\(shift.assignedProviders.count) / \(shift.capacity)")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }

                Spacer()

                if let trustScore = shift.trustScore {
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("Trust Score")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(String(format: "%.1f", trustScore * 100))
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(trustScoreColor(trustScore))
                    }
                }
            }

            // Coverage Warning
            if !shift.hasMinimumCoverage {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.caption)

                    Text("\(shift.coverageGap) staff needed for minimum coverage")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.orange.opacity(0.1))
                )
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var timeRange: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return "\(formatter.string(from: shift.startTime)) - \(formatter.string(from: shift.endTime))"
    }

    private func trustScoreColor(_ score: Double) -> Color {
        if score >= 0.8 {
            return .green
        } else if score >= 0.5 {
            return .orange
        } else {
            return .red
        }
    }
}

// MARK: - Credential Risk Indicator

struct CredentialRiskIndicator: View {
    let riskLevel: CredentialRiskLevel

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(riskColor)
                .frame(width: 8, height: 8)

            Text(riskLevel.rawValue.capitalized)
                .font(.caption2)
                .foregroundColor(riskColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(riskColor.opacity(0.1))
        )
    }

    private var riskColor: Color {
        switch riskLevel {
        case .low: return .green
        case .medium: return .yellow
        case .high: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - Providers Tab View

struct ProvidersTabView: View {
    @ObservedObject var viewModel: SchedulerDashboardViewModel
    @State private var searchText = ""

    var body: some View {
        VStack(spacing: 0) {
            // Search Bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)

                TextField("Search providers...", text: $searchText)
                    .textFieldStyle(.plain)
                    .onChange(of: searchText) { _, newValue in
                        viewModel.updateSearchQuery(newValue)
                    }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(.secondarySystemBackground))
            )
            .padding()

            // Providers List
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(viewModel.roster.filteredProviders) { provider in
                        ProviderCard(provider: provider)
                    }
                }
                .padding()
            }
        }
    }
}

// MARK: - Provider Card

struct ProviderCard: View {
    let provider: Provider

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(provider.name)
                        .font(.headline)

                    Text(provider.specialty)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Trust Score
                VStack(alignment: .trailing, spacing: 4) {
                    Text("Trust")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(String(format: "%.0f", provider.trustScore * 100))
                        .font(.headline)
                        .foregroundColor(trustScoreColor(provider.trustScore))
                }
            }

            // Credentials Summary
            HStack(spacing: 8) {
                if provider.hasActiveLicense {
                    Label("License", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundColor(.green)
                }

                if provider.hasValidDEA {
                    Label("DEA", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundColor(.green)
                }

                if provider.isSanctioned {
                    Label("Sanctions", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private func trustScoreColor(_ score: Double) -> Color {
        if score >= 0.8 {
            return .green
        } else if score >= 0.5 {
            return .orange
        } else {
            return .red
        }
    }
}

// MARK: - Compliance Tab View

struct ComplianceTabView: View {
    @ObservedObject var viewModel: SchedulerDashboardViewModel

    var body: some View {
        CoverageAnalysisView(viewModel: viewModel)
    }
}

#Preview {
    NavigationStack {
        SchedulerRootView()
    }
}

