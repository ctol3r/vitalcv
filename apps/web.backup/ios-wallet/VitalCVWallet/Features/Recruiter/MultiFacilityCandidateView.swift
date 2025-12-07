//
//  MultiFacilityCandidateView.swift
//  VitalCVWallet
//
//  Created: Multi-Facility Credential Passport - Phase 5 - Task 33
//  Recruiter view: Candidate is onboarding-ready for 12 facilities
//

import SwiftUI
import Combine

/// MultiFacilityCandidateView - Recruiter view showing multi-facility candidate status
/// Phase 5 - Task 33
struct MultiFacilityCandidateView: View {
    let clinicianId: String

    @StateObject private var candidateManager = MultiFacilityCandidateManager(clinicianId: "")
    @State private var showingFacilityDetails = false
    @State private var selectedFacility: OnboardingReadyFacility?

    init(clinicianId: String) {
        self.clinicianId = clinicianId
        _candidateManager = StateObject(wrappedValue: MultiFacilityCandidateManager(clinicianId: clinicianId))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    if let candidate = candidateManager.candidateStatus {
                        Text(candidate.candidateName)
                            .font(.title)
                            .fontWeight(.bold)

                        Text("Ready for \(candidate.totalFacilities) facilities")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.horizontal)

                // Phase 5 - Task 34: Facility-level trustScore badges
                if let candidate = candidateManager.candidateStatus {
                    ForEach(candidate.onboardingReadyFacilities) { facility in
                        FacilityReadyCard(
                            facility: facility,
                            onTap: {
                                selectedFacility = facility
                                showingFacilityDetails = true
                            }
                        )
                        .padding(.horizontal)
                    }
                }

                // Phase 5 - Task 37: Multi-facility candidate prioritization indicator
                if let candidate = candidateManager.candidateStatus, candidate.totalFacilities >= 3 {
                    PriorityBadge(totalFacilities: candidate.totalFacilities)
                        .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Multi-Facility Candidate")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingFacilityDetails) {
            if let facility = selectedFacility {
                FacilityDetailsView(facility: facility)
            }
        }
        .onAppear {
            candidateManager.load()
        }
    }
}

struct FacilityReadyCard: View {
    let facility: OnboardingReadyFacility
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 8) {
                    Text(facility.facilityName)
                        .font(.headline)
                        .foregroundColor(.primary)

                    // Phase 5 - Task 34: TrustScore badge
                    HStack {
                        TrustScoreBadge(score: facility.readinessScore)

                        StatusBadge(status: facility.status)
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(radius: 2)
        }
        .buttonStyle(.plain)
    }
}

// Phase 5 - Task 34: Facility-level trustScore badges
struct TrustScoreBadge: View {
    let score: Double

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "shield.checkered")
                .font(.caption)
            Text("\(Int(score * 100))%")
                .font(.caption)
                .fontWeight(.semibold)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(badgeColor.opacity(0.2))
        .foregroundColor(badgeColor)
        .cornerRadius(6)
    }

    private var badgeColor: Color {
        if score >= 0.8 {
            return .green
        } else if score >= 0.6 {
            return .yellow
        } else {
            return .red
        }
    }
}

struct StatusBadge: View {
    let status: OnboardingPhase

    var body: some View {
        Text(status.rawValue.capitalized)
            .font(.caption)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor.opacity(0.2))
            .foregroundColor(statusColor)
            .cornerRadius(6)
    }

    private var statusColor: Color {
        switch status {
        case .approved: return .green
        case .rejected: return .red
        case .verification: return .blue
        case .privileges: return .orange
        default: return .gray
        }
    }
}

struct PriorityBadge: View {
    let totalFacilities: Int

    var body: some View {
        HStack {
            Image(systemName: "star.fill")
                .foregroundColor(.yellow)
            Text("High Priority Candidate")
                .fontWeight(.semibold)
            Spacer()
            Text("\(totalFacilities) facilities")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.yellow.opacity(0.1))
        .cornerRadius(8)
    }
}

struct FacilityDetailsView: View {
    let facility: OnboardingReadyFacility

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(facility.facilityName)
                        .font(.title2)
                        .fontWeight(.bold)
                        .padding(.horizontal)

                    VStack(alignment: .leading, spacing: 12) {
                        DetailRow(label: "Readiness Score", value: "\(Int(facility.readinessScore * 100))%")
                        DetailRow(label: "Status", value: facility.status.rawValue.capitalized)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
            .navigationTitle("Facility Details")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}

class MultiFacilityCandidateManager: ObservableObject {
    @Published var candidateStatus: MultiFacilityCandidateResponse?

    private let clinicianId: String
    private let networkService = NetworkService.shared
    private var cancellables = Set<AnyCancellable>()

    init(clinicianId: String) {
        self.clinicianId = clinicianId
    }

    func load() {
        networkService.getMultiFacilityCandidateStatus(clinicianId: clinicianId)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { _ in },
                receiveValue: { [weak self] status in
                    self?.candidateStatus = status
                }
            )
            .store(in: &cancellables)
    }
}

