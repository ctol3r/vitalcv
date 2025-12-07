//
//  CoverageAnalysisView.swift
//  VitalCVWallet
//
//  Created: Hospital Scheduling & Shift Credentialing - Phase 4
//  CoverageAnalysisView: Hospital-wide visibility of credential-backed coverage
//

import SwiftUI
import Charts

struct CoverageAnalysisView: View {
    @ObservedObject var viewModel: SchedulerDashboardViewModel
    @StateObject private var analysisViewModel = CoverageAnalysisViewModel()
    @State private var selectedDateRange: DateRange = .week

    enum DateRange: String, CaseIterable {
        case week = "Week"
        case month = "Month"
        case quarter = "Quarter"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Date Range Selector
                Picker("Date Range", selection: $selectedDateRange) {
                    ForEach(DateRange.allCases, id: \.self) { range in
                        Text(range.rawValue).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .padding()
                .onChange(of: selectedDateRange) { _, _ in
                    analysisViewModel.loadAnalysis(dateRange: selectedDateRange)
                }

                // Compliance Score
                ComplianceScoreCard(score: analysisViewModel.complianceScore)

                // Heatmap
                if !analysisViewModel.shifts.isEmpty {
                    ComplianceHeatmapView(shifts: analysisViewModel.shifts)
                }

                // Weak Coverage Alerts
                if !analysisViewModel.weakCoverageAlerts.isEmpty {
                    WeakCoverageAlertsView(alerts: analysisViewModel.weakCoverageAlerts)
                }

                // Credential Gaps
                if !analysisViewModel.credentialGaps.isEmpty {
                    CredentialGapsView(gaps: analysisViewModel.credentialGaps)
                }

                // Download Report Button
                Button(action: {
                    analysisViewModel.downloadComplianceReport()
                }) {
                    HStack {
                        Image(systemName: "arrow.down.doc")
                        Text("Download Compliance Report")
                    }
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.blue)
                    )
                }
                .padding()
            }
        }
        .navigationTitle("Compliance")
        .onAppear {
            analysisViewModel.loadAnalysis(dateRange: selectedDateRange)
        }
    }
}

// MARK: - Compliance Score Card

struct ComplianceScoreCard: View {
    let score: Double

    var body: some View {
        VStack(spacing: 12) {
            Text("Overall Compliance Score")
                .font(.headline)
                .foregroundColor(.secondary)

            Text(String(format: "%.0f%%", score * 100))
                .font(.system(size: 48, weight: .bold))
                .foregroundColor(scoreColor)

            ProgressView(value: score, total: 1.0)
                .tint(scoreColor)
                .frame(height: 8)

            Text(scoreDescription)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.secondarySystemBackground))
        )
        .padding(.horizontal)
    }

    private var scoreColor: Color {
        if score >= 0.9 {
            return .green
        } else if score >= 0.7 {
            return .orange
        } else {
            return .red
        }
    }

    private var scoreDescription: String {
        if score >= 0.9 {
            return "Excellent compliance"
        } else if score >= 0.7 {
            return "Good compliance with minor gaps"
        } else {
            return "Compliance issues detected"
        }
    }
}

// MARK: - Compliance Heatmap View

struct ComplianceHeatmapView: View {
    let shifts: [Shift]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Credential Compliance Risk Heatmap")
                .font(.headline)
                .padding(.horizontal)

            // Group shifts by date
            let groupedShifts = Dictionary(grouping: shifts) { shift in
                Calendar.current.startOfDay(for: shift.startTime)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(groupedShifts.keys.sorted()), id: \.self) { date in
                        DayHeatmapColumn(date: date, shifts: groupedShifts[date] ?? [])
                    }
                }
                .padding(.horizontal)
            }
        }
    }
}

struct DayHeatmapColumn: View {
    let date: Date
    let shifts: [Shift]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(dayLabel)
                .font(.caption)
                .foregroundColor(.secondary)

            VStack(spacing: 4) {
                ForEach(shifts) { shift in
                    HeatmapCell(shift: shift)
                }
            }
        }
    }

    private var dayLabel: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

struct HeatmapCell: View {
    let shift: Shift

    var body: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(riskColor)
            .frame(width: 40, height: 40)
            .overlay(
                Text(shift.shiftType.rawValue.prefix(1))
                    .font(.caption2)
                    .foregroundColor(.white)
            )
    }

    private var riskColor: Color {
        switch shift.credentialRiskLevel {
        case .low:
            return .green
        case .medium:
            return .yellow
        case .high:
            return .orange
        case .critical:
            return .red
        }
    }
}

// MARK: - Weak Coverage Alerts View

struct WeakCoverageAlertsView: View {
    let alerts: [CoverageAlert]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Weak Coverage Alerts")
                    .font(.headline)

                Spacer()

                Text("\(alerts.count)")
                    .font(.caption)
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color.red)
                    )
            }
            .padding(.horizontal)

            ForEach(alerts) { alert in
                CoverageAlertCard(alert: alert)
            }
        }
    }
}

struct CoverageAlertCard: View {
    let alert: CoverageAlert

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: severityIcon)
                    .foregroundColor(severityColor)

                Text(alert.shiftName)
                    .font(.headline)

                Spacer()

                Text(severityLabel)
                    .font(.caption)
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(severityColor)
                    )
            }

            Text(alert.message)
                .font(.subheadline)
                .foregroundColor(.secondary)

            HStack {
                Text("Required: \(alert.requiredStaff)")
                Text("•")
                Text("Current: \(alert.currentStaff)")
                Text("•")
                Text("Gap: \(alert.gap)")
                    .foregroundColor(.red)
                    .fontWeight(.semibold)
            }
            .font(.caption)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
        .padding(.horizontal)
    }

    private var severityIcon: String {
        switch alert.severity {
        case .low: return "info.circle.fill"
        case .medium: return "exclamationmark.triangle.fill"
        case .high: return "exclamationmark.triangle.fill"
        case .critical: return "exclamationmark.octagon.fill"
        }
    }

    private var severityColor: Color {
        switch alert.severity {
        case .low: return .blue
        case .medium: return .orange
        case .high: return .orange
        case .critical: return .red
        }
    }

    private var severityLabel: String {
        alert.severity.rawValue.capitalized
    }
}

// MARK: - Credential Gaps View

struct CredentialGapsView: View {
    let gaps: [CredentialGap]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Credential Gaps")
                    .font(.headline)

                Spacer()

                Text("\(gaps.count)")
                    .font(.caption)
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color.orange)
                    )
            }
            .padding(.horizontal)

            ForEach(gaps) { gap in
                CredentialGapCard(gap: gap)
            }
        }
    }
}

struct CredentialGapCard: View {
    let gap: CredentialGap

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange)

                Text(gap.shiftName)
                    .font(.headline)

                Spacer()
            }

            Text("Missing: \(gap.missingCredential)")
                .font(.subheadline)
                .foregroundColor(.secondary)

            HStack {
                Text("Required: \(gap.requiredCount)")
                Text("•")
                Text("Current: \(gap.currentCount)")
                Text("•")
                Text("Gap: \(gap.gap)")
                    .foregroundColor(.orange)
                    .fontWeight(.semibold)
            }
            .font(.caption)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
        .padding(.horizontal)
    }
}

// MARK: - Coverage Analysis View Model

@MainActor
class CoverageAnalysisViewModel: ObservableObject {
    @Published var complianceScore: Double = 0.0
    @Published var shifts: [Shift] = []
    @Published var weakCoverageAlerts: [CoverageAlert] = []
    @Published var credentialGaps: [CredentialGap] = []

    private let networkService = NetworkService.shared
    private var cancellables = Set<AnyCancellable>()

    func loadAnalysis(dateRange: CoverageAnalysisView.DateRange) {
        let (startDate, endDate) = dateRangeForPeriod(dateRange)

        networkService.getCoverageAnalysis(startDate: startDate, endDate: endDate)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { completion in
                    if case .failure(let error) = completion {
                        print("Error loading coverage analysis: \(error)")
                    }
                },
                receiveValue: { [weak self] analysis in
                    self?.complianceScore = analysis.complianceScore
                    self?.shifts = analysis.shifts
                    self?.weakCoverageAlerts = analysis.weakCoverageAlerts
                    self?.credentialGaps = analysis.credentialGaps
                }
            )
            .store(in: &cancellables)
    }

    private func dateRangeForPeriod(_ period: CoverageAnalysisView.DateRange) -> (Date, Date) {
        let calendar = Calendar.current
        let now = Date()

        switch period {
        case .week:
            let start = calendar.date(byAdding: .day, value: -7, to: now) ?? now
            return (start, now)
        case .month:
            let start = calendar.date(byAdding: .month, value: -1, to: now) ?? now
            return (start, now)
        case .quarter:
            let start = calendar.date(byAdding: .month, value: -3, to: now) ?? now
            return (start, now)
        }
    }

    func downloadComplianceReport() {
        // Generate PDF report with chain hashes
        // This would integrate with PDF generation library
        print("Downloading compliance report...")
        // Implementation would create PDF with:
        // - Compliance score
        // - Shift details
        // - Provider assignments
        // - Chain anchor hashes
        // - Timestamps
    }
}

