//
//  VitalCVAppState.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Task 4
//  VitalCVAppState as @MainActor ObservableObject
//

import Foundation
import Combine

/// VitalCVAppState - Main app state container
@MainActor
class VitalCVAppState: ObservableObject {
    static let shared = VitalCVAppState()

    // MARK: - Authentication State
    @Published var isAuthenticated: Bool = false
    @Published var currentDID: String?
    @Published var biometricEnabled: Bool = false

    // MARK: - Wallet State
    @Published var credentials: [VerifiableCredential] = []
    @Published var selectedCredential: VerifiableCredential?

    // MARK: - Verification State
    @Published var isVerifying: Bool = false
    @Published var verificationResult: VerificationResult?
    @Published var currentVerificationStep: VerificationStep = .idle

    // MARK: - Network State
    @Published var isOnline: Bool = true
    @Published var lastSyncDate: Date?

    // MARK: - UI State
    @Published var activeTab: TabSelection = .home
    @Published var showingCredentialDetail: Bool = false
    @Published var showingQRShare: Bool = false
    @Published var showingVerifyView: Bool = false

    // MARK: - Trust State
    @Published var trustScore: TrustScore?
    @Published var trustLevel: TrustLevel = .unknown

    private var cancellables = Set<AnyCancellable>()

    private init() {
        loadPersistedState()
        setupObservers()
    }

    private func loadPersistedState() {
        // Load persisted authentication state from Keychain
        if let did = KeychainService.shared.loadDID() {
            currentDID = did
            isAuthenticated = true
        }
    }

    private func setupObservers() {
        // Observe network connectivity
        NotificationCenter.default.publisher(for: .networkStatusChanged)
            .sink { [weak self] notification in
                if let isOnline = notification.userInfo?["isOnline"] as? Bool {
                    self?.isOnline = isOnline
                }
            }
            .store(in: &cancellables)
    }

    func authenticate(did: String) {
        currentDID = did
        isAuthenticated = true
        KeychainService.shared.saveDID(did)
    }

    func logout() {
        isAuthenticated = false
        currentDID = nil
        credentials = []
        verificationResult = nil
        trustScore = nil
        trustLevel = .unknown
        KeychainService.shared.deleteDID()
    }

    func addCredential(_ credential: VerifiableCredential) {
        credentials.append(credential)
        persistCredentials()
    }

    func removeCredential(_ credential: VerifiableCredential) {
        credentials.removeAll { $0.id == credential.id }
        persistCredentials()
    }

    func startVerification() {
        isVerifying = true
        currentVerificationStep = .signature
        verificationResult = nil
    }

    func updateVerificationStep(_ step: VerificationStep) {
        currentVerificationStep = step
    }

    func completeVerification(_ result: VerificationResult) {
        isVerifying = false
        verificationResult = result
        currentVerificationStep = .complete

        // Calculate trust level from result
        updateTrustLevel(from: result)
    }

    func updateTrustLevel(from result: VerificationResult) {
        let passedChecks = result.checks.filter { $0.passed }.count
        let totalChecks = result.checks.count

        if result.verified && passedChecks == totalChecks {
            trustLevel = .high
        } else if result.verified && passedChecks >= totalChecks / 2 {
            trustLevel = .medium
        } else {
            trustLevel = .low
        }
    }

    private func persistCredentials() {
        // Persist credentials to secure storage
        if let encoded = try? JSONEncoder().encode(credentials) {
            KeychainService.shared.saveCredentials(encoded)
        }
    }
}

enum VerificationStep {
    case idle
    case signature
    case chainAnchor
    case issuer
    case selectiveDisclosure
    case bbsPlus
    case complete
}

enum TrustLevel {
    case high
    case medium
    case low
    case unknown
}

struct TrustScore {
    let value: Double // 0.0 - 1.0
    let chainScore: Double
    let issuerScore: Double
    let complianceScore: Double
}

