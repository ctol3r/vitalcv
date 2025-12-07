//
//  ShiftCredentialPackView.swift
//  VitalCVWallet
//
//  Created: Hospital Scheduling & Shift Credentialing - Phase 5, Task 37
//  Shift Credential Pack summary (trustScore + anchors)
//

import SwiftUI

struct ShiftCredentialPackView: View {
    let shift: Shift

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text(shift.unitName)
                        .font(.title)
                        .fontWeight(.bold)

                    Text(shift.shiftType.rawValue)
                        .font(.headline)
                        .foregroundColor(.secondary)
                }
                .padding()

                Divider()

                // Overall Trust Score
                if let trustScore = shift.trustScore {
                    TrustScoreCard(score: trustScore)
                        .padding()
                }

                // Chain Anchors
                ChainAnchorsSection(shift: shift)
                    .padding()

                // Assigned Providers
                AssignedProvidersSection(providers: shift.assignedProviders)
                    .padding()
            }
        }
        .navigationTitle("Credential Pack")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Trust Score Card

struct TrustScoreCard: View {
    let score: Double

    var body: some View {
        VStack(spacing: 12) {
            Text("Overall Trust Score")
                .font(.headline)
                .foregroundColor(.secondary)

            Text(String(format: "%.0f", score * 100))
                .font(.system(size: 56, weight: .bold))
                .foregroundColor(trustColor)

            ProgressView(value: score, total: 1.0)
                .tint(trustColor)
                .frame(height: 10)

            Text(trustDescription)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var trustColor: Color {
        if score >= 0.8 {
            return .green
        } else if score >= 0.5 {
            return .orange
        } else {
            return .red
        }
    }

    private var trustDescription: String {
        if score >= 0.8 {
            return "High trust - All credentials verified"
        } else if score >= 0.5 {
            return "Moderate trust - Some credentials need attention"
        } else {
            return "Low trust - Credentials require verification"
        }
    }
}

// MARK: - Chain Anchors Section

struct ChainAnchorsSection: View {
    let shift: Shift

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Chain Anchors")
                .font(.headline)

            if shift.assignedProviders.isEmpty {
                Text("No providers assigned")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else {
                ForEach(shift.assignedProviders) { assignment in
                    ChainAnchorRow(assignment: assignment)
                }
            }
        }
    }
}

struct ChainAnchorRow: View {
    let assignment: ProviderAssignment

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.providerName)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                if let anchorId = assignment.chainAnchorId {
                    Text(anchorId.prefix(16) + "...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .monospaced()
                } else {
                    Text("No anchor")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text("Trust: \(Int(assignment.trustScore * 100))")
                    .font(.caption)
                    .foregroundColor(.secondary)

                StatusBadge(status: assignment.verificationStatus)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.tertiarySystemBackground))
        )
    }
}

struct StatusBadge: View {
    let status: VerificationStatus

    var body: some View {
        Text(status.rawValue.capitalized)
            .font(.caption2)
            .foregroundColor(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                Capsule()
                    .fill(statusColor)
            )
    }

    private var statusColor: Color {
        switch status {
        case .verified:
            return .green
        case .pending:
            return .orange
        case .expired, .revoked:
            return .red
        }
    }
}

// MARK: - Assigned Providers Section

struct AssignedProvidersSection: View {
    let providers: [ProviderAssignment]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Assigned Providers")
                .font(.headline)

            ForEach(providers) { provider in
                ProviderSummaryRow(assignment: provider)
            }
        }
    }
}

struct ProviderSummaryRow: View {
    let assignment: ProviderAssignment

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.providerName)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text("Assigned: \(formattedDate)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text("\(Int(assignment.trustScore * 100))")
                    .font(.headline)
                    .foregroundColor(trustColor(assignment.trustScore))

                Text("Trust")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: assignment.assignedAt)
    }

    private func trustColor(_ score: Double) -> Color {
        if score >= 0.8 {
            return .green
        } else if score >= 0.5 {
            return .orange
        } else {
            return .red
        }
    }
}

#Preview {
    NavigationStack {
        ShiftCredentialPackView(shift: Shift(
            id: "1",
            unitId: "icu-1",
            unitName: "ICU",
            shiftType: .day,
            startTime: Date(),
            endTime: Date().addingTimeInterval(3600 * 12),
            requiredCredentials: [],
            assignedProviders: [
                ProviderAssignment(
                    id: "1",
                    providerId: "p1",
                    providerName: "Dr. Smith",
                    assignedAt: Date(),
                    assignedBy: "Admin",
                    trustScore: 0.85,
                    chainAnchorId: "0x1234567890abcdef",
                    verificationStatus: .verified
                )
            ],
            capacity: 4,
            minimumStaff: 2,
            credentialRiskLevel: .low,
            trustScore: 0.85,
            complianceHeat: 0.2
        ))
    }
}

