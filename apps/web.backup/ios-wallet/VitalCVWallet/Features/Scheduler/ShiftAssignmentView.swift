//
//  ShiftAssignmentView.swift
//  VitalCVWallet
//
//  Created: Hospital Scheduling & Shift Credentialing - Phase 3, Task 17
//  ShiftAssignmentView: Beautiful, fast UI for assigning clinicians to shifts
//

import SwiftUI

struct ShiftAssignmentView: View {
    let shift: Shift
    @StateObject private var viewModel: ShiftAssignmentViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedProvider: Provider?
    @State private var showCredentialDetail = false

    init(shift: Shift) {
        self.shift = shift
        self._viewModel = StateObject(wrappedValue: ShiftAssignmentViewModel(shift: shift))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Shift Header
            ShiftHeaderView(shift: shift)
                .padding()
                .background(Color(.systemBackground))

            // Unit Capacity Indicators
            UnitCapacityView(shift: shift)
                .padding(.horizontal)
                .padding(.bottom, 8)

            // Auto-Assign Button
            HStack {
                Button(action: {
                    viewModel.autoAssignBestFit()
                }) {
                    HStack {
                        Image(systemName: "sparkles")
                        Text("Auto-Assign Best Fit")
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
            }
            .padding()

            // Provider List
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(viewModel.sortedEligibilities) { eligibility in
                        ProviderEligibilityCard(
                            eligibility: eligibility,
                            shift: shift,
                            onAssign: {
                                viewModel.assignProvider(eligibility.providerId)
                            },
                            onViewCredentials: {
                                selectedProvider = viewModel.getProvider(id: eligibility.providerId)
                                showCredentialDetail = true
                            }
                        )
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(action: {
                                viewModel.assignProvider(eligibility.providerId)
                            }) {
                                Label("Assign", systemImage: "checkmark")
                            }
                            .tint(.green)
                        }
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Assign Staff")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showCredentialDetail) {
            if let provider = selectedProvider {
                ProviderCredentialDetailView(provider: provider, shift: shift)
            }
        }
        .onAppear {
            viewModel.loadEligibilities()
        }
        .alert("Assignment Complete", isPresented: $viewModel.showSuccessAlert) {
            Button("OK") {
                dismiss()
            }
        } message: {
            Text("Provider successfully assigned to shift")
        }
        .alert("Error", isPresented: $viewModel.showErrorAlert) {
            Button("OK") { }
        } message: {
            Text(viewModel.errorMessage ?? "Unknown error")
        }
    }
}

// MARK: - Shift Header View

struct ShiftHeaderView: View {
    let shift: Shift

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(shift.unitName)
                        .font(.title2)
                        .fontWeight(.bold)

                    HStack(spacing: 12) {
                        Label(shift.shiftType.rawValue, systemImage: shift.shiftType.icon)
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Text(timeRange)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                CredentialRiskIndicator(riskLevel: shift.credentialRiskLevel)
            }

            // Staffing Status
            HStack {
                Text("\(shift.assignedProviders.count) / \(shift.capacity) staffed")
                    .font(.headline)

                Spacer()

                if let trustScore = shift.trustScore {
                    HStack(spacing: 4) {
                        Text("Trust:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(String(format: "%.0f", trustScore * 100))
                            .font(.headline)
                            .foregroundColor(trustScoreColor(trustScore))
                    }
                }
            }
        }
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

// MARK: - Unit Capacity View

struct UnitCapacityView: View {
    let shift: Shift

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Required Credentials")
                .font(.headline)
                .padding(.bottom, 4)

            ForEach(shift.requiredCredentials) { cred in
                HStack {
                    Image(systemName: cred.required ? "checkmark.circle.fill" : "circle")
                        .foregroundColor(cred.required ? .green : .gray)

                    Text(cred.type)
                        .font(.subheadline)

                    if let description = cred.description {
                        Text("(\(description))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    // Count how many assigned providers have this credential
                    let count = shift.assignedProviders.filter { assignment in
                        // This would need to check actual provider credentials
                        // Simplified for now
                        true
                    }.count

                    Text("\(count)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

// MARK: - Provider Eligibility Card

struct ProviderEligibilityCard: View {
    let eligibility: ProviderEligibility
    let shift: Shift
    let onAssign: () -> Void
    let onViewCredentials: () -> Void

    @State private var showReasons = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with Trust Ring
            HStack {
                // Trust Ring Indicator
                TrustRingView(trustScore: eligibility.trustScore)

                VStack(alignment: .leading, spacing: 4) {
                    Text(eligibility.providerName)
                        .font(.headline)

                    // Eligibility Status Badge
                    EligibilityStatusBadge(status: eligibility.status)
                }

                Spacer()

                // Scores
                VStack(alignment: .trailing, spacing: 4) {
                    Text("Match: \(Int(eligibility.matchScore * 100))%")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text("Risk: \(Int(eligibility.riskScore * 100))%")
                        .font(.caption)
                        .foregroundColor(riskColor(eligibility.riskScore))
                }
            }

            // Trust-Colored Eligibility Bar
            EligibilityBar(
                riskScore: eligibility.riskScore,
                trustScore: eligibility.trustScore,
                matchScore: eligibility.matchScore
            )

            // Chain Event Warning (if risky)
            if eligibility.complianceHeat > 0.5 {
                ChainEventWarningView(complianceHeat: eligibility.complianceHeat)
            }

            // Action Buttons
            HStack(spacing: 12) {
                Button(action: onViewCredentials) {
                    HStack {
                        Image(systemName: "doc.text.magnifyingglass")
                        Text("View Credentials")
                    }
                    .font(.subheadline)
                    .foregroundColor(.blue)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.blue, lineWidth: 1)
                    )
                }

                Button(action: onAssign) {
                    HStack {
                        Image(systemName: "checkmark")
                        Text("Assign")
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(eligibility.status == .eligible ? Color.green : Color.orange)
                    )
                }
                .disabled(eligibility.status == .notEligible)
            }

            // Reasons Toggle
            if !eligibility.reasons.isEmpty {
                Button(action: {
                    withAnimation {
                        showReasons.toggle()
                    }
                }) {
                    HStack {
                        Text("\(eligibility.reasons.count) reason(s)")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Image(systemName: showReasons ? "chevron.up" : "chevron.down")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                if showReasons {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(eligibility.reasons) { reason in
                            EligibilityReasonView(reason: reason)
                        }
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color(.tertiarySystemBackground))
                    )
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private func riskColor(_ score: Double) -> Color {
        if score < 0.3 {
            return .green
        } else if score < 0.7 {
            return .orange
        } else {
            return .red
        }
    }
}

// MARK: - Trust Ring View

struct TrustRingView: View {
    let trustScore: Double

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.3), lineWidth: 4)

            Circle()
                .trim(from: 0, to: trustScore)
                .stroke(
                    trustColor,
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            Text(String(format: "%.0f", trustScore * 100))
                .font(.caption2)
                .fontWeight(.bold)
                .foregroundColor(trustColor)
        }
        .frame(width: 40, height: 40)
    }

    private var trustColor: Color {
        if trustScore >= 0.8 {
            return .green
        } else if trustScore >= 0.5 {
            return .orange
        } else {
            return .red
        }
    }
}

// MARK: - Eligibility Status Badge

struct EligibilityStatusBadge: View {
    let status: EligibilityStatus

    var body: some View {
        Text(status.label)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(statusColor)
            )
    }

    private var statusColor: Color {
        switch status {
        case .eligible:
            return .green
        case .conditional:
            return .orange
        case .notEligible:
            return .red
        }
    }
}

// MARK: - Eligibility Bar

struct EligibilityBar: View {
    let riskScore: Double
    let trustScore: Double
    let matchScore: Double

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                // Trust portion (green)
                Rectangle()
                    .fill(Color.green)
                    .frame(width: geometry.size.width * trustScore)

                // Match portion (blue)
                Rectangle()
                    .fill(Color.blue)
                    .frame(width: geometry.size.width * matchScore)

                // Risk portion (red)
                Rectangle()
                    .fill(Color.red.opacity(0.5))
                    .frame(width: geometry.size.width * riskScore)

                // Remaining (gray)
                Spacer()
            }
        }
        .frame(height: 6)
        .cornerRadius(3)
    }
}

// MARK: - Chain Event Warning View

struct ChainEventWarningView: View {
    let complianceHeat: Double

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.red)

            Text("High compliance risk detected")
                .font(.caption)
                .foregroundColor(.red)

            Spacer()
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.red.opacity(0.1))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.red.opacity(0.3), lineWidth: 1)
        )
        .glowEffect(color: .red, intensity: complianceHeat)
    }
}

// MARK: - Eligibility Reason View

struct EligibilityReasonView: View {
    let reason: EligibilityReason

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: severityIcon)
                .foregroundColor(severityColor)
                .font(.caption)

            Text(reason.message)
                .font(.caption)
                .foregroundColor(.primary)

            Spacer()
        }
    }

    private var severityIcon: String {
        switch reason.severity {
        case .info: return "info.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "xmark.circle.fill"
        }
    }

    private var severityColor: Color {
        switch reason.severity {
        case .info: return .blue
        case .warning: return .orange
        case .error: return .red
        }
    }
}

// MARK: - Glow Effect Modifier

extension View {
    func glowEffect(color: Color, intensity: Double) -> some View {
        self
            .shadow(color: color.opacity(intensity * 0.5), radius: 8)
            .shadow(color: color.opacity(intensity * 0.3), radius: 16)
    }
}

// MARK: - View Model

@MainActor
class ShiftAssignmentViewModel: ObservableObject {
    @Published var sortedEligibilities: [ProviderEligibility] = []
    @Published var showSuccessAlert = false
    @Published var showErrorAlert = false
    @Published var errorMessage: String?

    private let shift: Shift
    private let eligibilityEngine = EligibilityEngine.shared
    private let networkService = NetworkService.shared
    private var providers: [Provider] = []
    private var cancellables = Set<AnyCancellable>()

    init(shift: Shift) {
        self.shift = shift
    }

    func loadEligibilities() {
        networkService.fetchProviders()
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                        self?.showErrorAlert = true
                    }
                },
                receiveValue: { [weak self] providers in
                    self?.providers = providers
                    self?.calculateEligibilities()
                }
            )
            .store(in: &cancellables)
    }

    private func calculateEligibilities() {
        sortedEligibilities = eligibilityEngine.sortProvidersByEligibility(
            providers: providers,
            shift: shift
        )
    }

    func assignProvider(_ providerId: String) {
        networkService.assignProviderToShift(shiftId: shift.id, providerId: providerId)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                        self?.showErrorAlert = true
                    }
                },
                receiveValue: { [weak self] updatedShift in
                    guard let self = self else { return }

                    // Phase 5 - Task 39: Audit the assignment
                    Task {
                        if let provider = self.getProvider(id: providerId) {
                            do {
                                _ = try await ShiftAuditService.shared.auditProviderAssignment(
                                    shiftId: self.shift.id,
                                    providerId: providerId,
                                    assignedBy: "Current User", // Would get from auth context
                                    trustScore: provider.trustScore,
                                    chainAnchorId: provider.chainAnchorId
                                )
                            } catch {
                                print("Failed to audit assignment: \(error)")
                            }
                        }
                    }

                    // Phase 4 - Task 31: Recalculate trust after reassignment
                    SchedulerNotificationService.shared.recalculateTrustAfterReassignment(shiftId: self.shift.id)

                    self.showSuccessAlert = true
                    // Reload eligibilities to update UI
                    self.loadEligibilities()
                }
            )
            .store(in: &cancellables)
    }

    func autoAssignBestFit() {
        // Find the best eligible provider
        guard let bestFit = sortedEligibilities.first(where: { $0.status == .eligible }) ??
                            sortedEligibilities.first(where: { $0.status == .conditional }) else {
            errorMessage = "No eligible providers found"
            showErrorAlert = true
            return
        }

        assignProvider(bestFit.providerId)
    }

    func getProvider(id: String) -> Provider? {
        return providers.first { $0.id == id }
    }
}

// MARK: - Provider Credential Detail View

struct ProviderCredentialDetailView: View {
    let provider: Provider
    let shift: Shift
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Provider Info
                    VStack(alignment: .leading, spacing: 8) {
                        Text(provider.name)
                            .font(.title2)
                            .fontWeight(.bold)

                        Text(provider.specialty)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    Divider()

                    // Credentials
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Credentials")
                            .font(.headline)

                        ForEach(provider.credentials) { cred in
                            CredentialDetailRow(credential: cred)
                        }
                    }

                    // Board Certifications
                    if !provider.boardCertifications.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Board Certifications")
                                .font(.headline)

                            ForEach(provider.boardCertifications) { cert in
                                BoardCertDetailRow(certification: cert)
                            }
                        }
                    }

                    // Sanctions
                    if !provider.sanctions.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Sanctions")
                                .font(.headline)
                                .foregroundColor(.red)

                            ForEach(provider.sanctions) { sanction in
                                SanctionDetailRow(sanction: sanction)
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Provider Credentials")
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
}

struct CredentialDetailRow: View {
    let credential: ProviderCredential

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(credential.type)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text(credential.issuer)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                if credential.isActive {
                    Label("Active", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundColor(.green)
                } else {
                    Label("Inactive", systemImage: "xmark.circle.fill")
                        .font(.caption)
                        .foregroundColor(.red)
                }

                if let daysUntilExpiry = credential.daysUntilExpiry {
                    Text("Expires in \(daysUntilExpiry) days")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

struct BoardCertDetailRow: View {
    let certification: BoardCertification

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(certification.specialty)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text(certification.board)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            if certification.isActive {
                Label("Active", systemImage: "checkmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(.green)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

struct SanctionDetailRow: View {
    let sanction: Sanction

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(sanction.type)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.red)

                Spacer()

                Text(sanction.source)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if let description = sanction.description {
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.red.opacity(0.1))
        )
    }
}

#Preview {
    NavigationStack {
        ShiftAssignmentView(shift: Shift(
            id: "1",
            unitId: "icu-1",
            unitName: "ICU",
            shiftType: .day,
            startTime: Date(),
            endTime: Date().addingTimeInterval(3600 * 12),
            requiredCredentials: [
                RequiredCredential(id: "1", type: "RN", required: true, description: "Registered Nurse"),
                RequiredCredential(id: "2", type: "ACLS", required: true, description: "Advanced Cardiac Life Support")
            ],
            assignedProviders: [],
            capacity: 4,
            minimumStaff: 2,
            credentialRiskLevel: .low,
            trustScore: nil,
            complianceHeat: nil
        ))
    }
}

