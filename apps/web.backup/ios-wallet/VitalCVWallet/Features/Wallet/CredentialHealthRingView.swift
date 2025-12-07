//
//  CredentialHealthRingView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 12
//  "Credential Health" ring indicator
//

import SwiftUI

/// CredentialHealthRingView - Ring indicator showing credential health status
struct CredentialHealthRingView: View {
    let credential: VerifiableCredential
    @State private var healthScore: Double = 0.0

    var body: some View {
        ZStack {
            // Background ring
            Circle()
                .stroke(Color.walletCard, lineWidth: 8)
                .frame(width: 60, height: 60)

            // Health ring
            Circle()
                .trim(from: 0, to: healthScore)
                .stroke(
                    healthColor,
                    style: StrokeStyle(lineWidth: 8, lineCap: .round)
                )
                .frame(width: 60, height: 60)
                .rotationEffect(.degrees(-90))

            // Health icon
            Image(systemName: healthIcon)
                .font(.system(size: 20))
                .foregroundColor(healthColor)
        }
        .onAppear {
            calculateHealthScore()
        }
    }

    private var healthColor: Color {
        if healthScore >= 0.8 {
            return .walletSuccess
        } else if healthScore >= 0.5 {
            return .walletWarning
        } else {
            return .walletError
        }
    }

    private var healthIcon: String {
        if healthScore >= 0.8 {
            return "checkmark.circle.fill"
        } else if healthScore >= 0.5 {
            return "exclamationmark.triangle.fill"
        } else {
            return "xmark.circle.fill"
        }
    }

    private func calculateHealthScore() {
        var score: Double = 1.0

        // Check expiration
        if credential.isExpired {
            score -= 0.5
        } else if credential.isExpiringSoon {
            score -= 0.2
        }

        // Check proof
        if credential.proof == nil {
            score -= 0.3
        }

        // Check evidence
        if credential.evidence?.isEmpty ?? true {
            score -= 0.1
        }

        withAnimation {
            healthScore = max(0, min(1, score))
        }
    }
}

// MARK: - Health Badge

struct CredentialHealthBadge: View {
    let credential: VerifiableCredential

    var body: some View {
        CredentialHealthRingView(credential: credential)
    }
}

#Preview {
    HStack {
        CredentialHealthRingView(
            credential: VerifiableCredential(
                id: "1",
                type: ["VerifiableCredential"],
                issuer: Issuer(id: "did:example:issuer", name: "Issuer", image: nil),
                issuanceDate: Date(),
                expirationDate: Calendar.current.date(byAdding: .day, value: 30, to: Date()),
                credentialSubject: CredentialSubject(id: "did:example:holder", type: nil, claims: [:]),
                proof: Proof(
                    type: "Ed25519Signature2020",
                    created: Date(),
                    proofPurpose: "assertionMethod",
                    verificationMethod: "did:example:issuer#key-1",
                    jws: "signature"
                ),
                evidence: []
            )
        )
    }
    .padding()
    .background(Color.walletBackground)
}

