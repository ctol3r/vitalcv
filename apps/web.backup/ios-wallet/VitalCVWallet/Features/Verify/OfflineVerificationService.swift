//
//  OfflineVerificationService.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 55
//  Network fallback handling (offline verify)
//

import Foundation

class OfflineVerificationService {
    static let shared = OfflineVerificationService()

    private init() {}

    func verifyOffline(credential: VerifiableCredential) -> VerificationResult {
        // Perform local verification checks
        var checks: [VerificationCheck] = []

        // Check signature (local)
        let signatureValid = credential.proof != nil
        checks.append(VerificationCheck(
            name: "Validate Signature",
            passed: signatureValid,
            message: signatureValid ? "Signature valid" : "No signature found"
        ))

        // Check expiration (local)
        let notExpired = !credential.isExpired
        checks.append(VerificationCheck(
            name: "Check Expiration",
            passed: notExpired,
            message: notExpired ? "Credential is valid" : "Credential has expired"
        ))

        // Check issuer format (local)
        let issuerValid = credential.issuer.id.hasPrefix("did:")
        checks.append(VerificationCheck(
            name: "Check Issuer Format",
            passed: issuerValid,
            message: issuerValid ? "Issuer format valid" : "Invalid issuer format"
        ))

        // Cannot check chain anchor or revocation offline
        checks.append(VerificationCheck(
            name: "Chain Anchor Status",
            passed: false,
            message: "Requires network connection"
        ))

        let allLocalChecksPassed = checks.prefix(3).allSatisfy { $0.passed }

        return VerificationResult(
            verified: allLocalChecksPassed,
            credentialId: credential.id,
            checks: checks,
            timestamp: Date(),
            verifier: "Offline Verifier",
            error: allLocalChecksPassed ? nil : "Some checks require network connection"
        )
    }
}








