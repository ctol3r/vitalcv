//
//  ZKEvidenceVerifiedMarker.swift
//  VitalCVWallet
//
//  Created: Zero-Knowledge Authorization Engine - Phase 4, Task 36
//  Recruiter/hospital-facing ZK Evidence Verified marker
//

import SwiftUI

/// ZKEvidenceVerifiedMarker - Marker showing ZK evidence has been verified
public struct ZKEvidenceVerifiedMarker: View {
    let proofStrength: ZKAuthPriority
    let verifiedAt: Date

    public init(proofStrength: ZKAuthPriority, verifiedAt: Date = Date()) {
        self.proofStrength = proofStrength
        self.verifiedAt = verifiedAt
    }

    public var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.shield.fill")
                .foregroundColor(markerColor)

            VStack(alignment: .leading, spacing: 2) {
                Text("ZK Evidence Verified")
                    .font(.caption)
                    .fontWeight(.semibold)

                Text("\(proofStrength.rawValue.capitalized) proof • \(verifiedAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(markerColor.opacity(0.1))
        .cornerRadius(8)
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(markerColor.opacity(0.3), lineWidth: 1)
        }
    }

    private var markerColor: Color {
        switch proofStrength {
        case .strong:
            return .green
        case .medium:
            return .orange
        case .weak:
            return .red
        }
    }
}

// MARK: - Preview

struct ZKEvidenceVerifiedMarker_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            ZKEvidenceVerifiedMarker(proofStrength: .strong)
            ZKEvidenceVerifiedMarker(proofStrength: .medium)
            ZKEvidenceVerifiedMarker(proofStrength: .weak)
        }
        .padding()
    }
}

