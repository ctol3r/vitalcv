//
//  PassportPreviewView.swift
//  VitalCVWallet
//
//  Created: Multi-Facility Credential Passport - Phase 3 - Task 23
//  Preview passport before submission
//

import SwiftUI

/// PassportPreviewView - Preview passport packet before submission
/// Phase 3 - Task 23
struct PassportPreviewView: View {
    let facilityId: String
    let facilityName: String
    let packet: PassportPacket

    @StateObject private var passportBuilder = PassportBuilder.shared
    @StateObject private var passportEngine = CredentialPassportEngine.shared

    @State private var readinessScore: PassportReadinessScore?
    @State private var isSubmitting = false
    @State private var showingSubmissionSuccess = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text(facilityName)
                        .font(.title)
                        .fontWeight(.bold)

                    Text("Passport Preview")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal)

                // Phase 3 - Task 21: Readiness Score
                if let score = readinessScore {
                    ReadinessScoreCard(score: score)
                        .padding(.horizontal)
                }

                // Sections
                SectionView(title: "Credentials", count: packet.credentials.count) {
                    ForEach(packet.credentials) { credential in
                        CredentialSummaryRow(credential: credential)
                    }
                }

                SectionView(title: "Licensure", count: packet.licensure.count) {
                    ForEach(packet.licensure) { record in
                        LicensureRow(record: record)
                    }
                }

                SectionView(title: "DEA/MATE", count: packet.deaMate.count) {
                    ForEach(packet.deaMate) { record in
                        DEAMATERow(record: record)
                    }
                }

                SectionView(title: "CME Credits", count: packet.cme.count) {
                    ForEach(packet.cme) { record in
                        CMERow(record: record)
                    }
                }

                SectionView(title: "Training Portfolio", count: packet.trainingPortfolio.trainings.count) {
                    Text("Total Hours: \(Int(packet.trainingPortfolio.totalHours))")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    ForEach(packet.trainingPortfolio.trainings) { training in
                        TrainingRow(training: training)
                    }
                }

                SectionView(title: "Endorsements", count: packet.endorsements.count) {
                    ForEach(packet.endorsements) { endorsement in
                        EndorsementRow(endorsement: endorsement)
                    }
                }

                // Submit button
                Button(action: submitPassport) {
                    if isSubmitting {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text("Submit Passport")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
                .disabled(isSubmitting)
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .navigationTitle("Passport Preview")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            loadReadinessScore()
        }
        .alert("Submission Successful", isPresented: $showingSubmissionSuccess) {
            Button("OK") {
                // Navigate back
            }
        } message: {
            Text("Your passport has been submitted and anchored to the chain.")
        }
    }

    private func loadReadinessScore() {
        passportBuilder.calculateReadinessScore(facilityId: facilityId, clinicianId: packet.clinicianId)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { _ in },
                receiveValue: { score in
                    readinessScore = score
                }
            )
            .store(in: &passportBuilder.cancellables)
    }

    private func submitPassport() {
        isSubmitting = true
        passportBuilder.submitAndAnchorPassport(facilityId: facilityId, packet: packet)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { completion in
                    isSubmitting = false
                    if case .failure(let error) = completion {
                        print("Submission error: \(error)")
                    }
                },
                receiveValue: { response in
                    if response.success {
                        showingSubmissionSuccess = true
                    }
                    isSubmitting = false
                }
            )
            .store(in: &passportBuilder.cancellables)
    }
}

// MARK: - Supporting Views

struct ReadinessScoreCard: View {
    let score: PassportReadinessScore

    var body: some View {
        VStack(spacing: 12) {
            Text("Readiness Score")
                .font(.headline)

            Text("\(Int(score.score))")
                .font(.system(size: 48, weight: .bold))
                .foregroundColor(scoreColor)

            Text("out of 100")
                .font(.subheadline)
                .foregroundColor(.secondary)

            // Breakdown
            VStack(alignment: .leading, spacing: 8) {
                ScoreBreakdownRow(label: "Identity", value: score.breakdown.identity)
                ScoreBreakdownRow(label: "Licensure", value: score.breakdown.licensure)
                ScoreBreakdownRow(label: "DEA", value: score.breakdown.dea)
                ScoreBreakdownRow(label: "Training", value: score.breakdown.training)
                ScoreBreakdownRow(label: "CME", value: score.breakdown.cme)
            }
            .padding(.top)

            if !score.missingItems.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Missing Items:")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    ForEach(score.missingItems, id: \.self) { item in
                        Text("• \(item)")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
                .padding(.top)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var scoreColor: Color {
        if score.score >= 90 {
            return .green
        } else if score.score >= 70 {
            return .yellow
        } else {
            return .red
        }
    }
}

struct ScoreBreakdownRow: View {
    let label: String
    let value: Double

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
            Spacer()
            ProgressView(value: value)
                .frame(width: 100)
            Text("\(Int(value * 100))%")
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 40, alignment: .trailing)
        }
    }
}

struct SectionView<Content: View>: View {
    let title: String
    let count: Int
    let content: Content

    init(title: String, count: Int, @ViewBuilder content: () -> Content) {
        self.title = title
        self.count = count
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.headline)
                Spacer()
                Text("\(count)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)

            VStack(alignment: .leading, spacing: 8) {
                content
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(8)
            .padding(.horizontal)
        }
    }
}

struct CredentialSummaryRow: View {
    let credential: VerifiableCredential

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(credential.issuer.name ?? "Unknown Issuer")
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text(credential.issuanceDate, style: .date)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            if credential.isExpired {
                Text("Expired")
                    .font(.caption)
                    .foregroundColor(.red)
            } else if credential.isExpiringSoon {
                Text("Expiring Soon")
                    .font(.caption)
                    .foregroundColor(.orange)
            }
        }
        .padding(.vertical, 4)
    }
}

struct LicensureRow: View {
    let record: LicensureRecord

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(record.state) - \(record.type)")
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text("License #\(record.licenseNumber)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            if record.active {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            }
        }
        .padding(.vertical, 4)
    }
}

struct DEAMATERow: View {
    let record: DEAMATERecord

    var body: some View {
        HStack {
            Text(record.type.rawValue.uppercased())
                .font(.subheadline)
                .fontWeight(.medium)
            Spacer()
            Text(record.number)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct CMERow: View {
    let record: CMERecord

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(record.title)
                    .font(.subheadline)
                Text("\(record.credits) credits")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Text(record.completedDate, style: .date)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct TrainingRow: View {
    let training: TrainingRecord

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(training.title)
                    .font(.subheadline)
                if let facility = training.facility {
                    Text(facility)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            Text("\(Int(training.hours))h")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct EndorsementRow: View {
    let endorsement: Endorsement

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(endorsement.endorserName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text("\(endorsement.endorserTitle) at \(endorsement.endorserFacility)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            if endorsement.verified {
                Image(systemName: "checkmark.shield.fill")
                    .foregroundColor(.green)
            }
        }
        .padding(.vertical, 4)
    }
}

