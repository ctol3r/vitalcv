//
//  TestModeService.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 52
//  On-device test mode
//

import Foundation

class TestModeService {
    static let shared = TestModeService()

    @Published var isTestMode: Bool = false

    private init() {
        #if DEBUG
        isTestMode = true
        #endif
    }

    func enableTestMode() {
        isTestMode = true
    }

    func disableTestMode() {
        isTestMode = false
    }

    func generateTestCredential() -> VerifiableCredential {
        return VerifiableCredential(
            id: "test-\(UUID().uuidString)",
            type: ["VerifiableCredential", "TestCredential"],
            issuer: Issuer(id: "did:test:issuer", name: "Test Issuer", image: nil),
            issuanceDate: Date(),
            expirationDate: Calendar.current.date(byAdding: .year, value: 1, to: Date()),
            credentialSubject: CredentialSubject(
                id: "did:test:holder",
                type: "Person",
                claims: [
                    "name": "Test User",
                    "email": "test@example.com"
                ]
            ),
            proof: Proof(
                type: "Ed25519Signature2020",
                created: Date(),
                proofPurpose: "assertionMethod",
                verificationMethod: "did:test:issuer#key-1",
                jws: "test-signature"
            ),
            evidence: nil
        )
    }

    func resetTestData() {
        AppStateContainer.shared.credentials = []
        AppStateContainer.shared.currentUserDid = nil
        KeychainService.shared.deleteDID()
        KeychainService.shared.deleteCredentials()
    }
}

extension TestModeService: ObservableObject {}








