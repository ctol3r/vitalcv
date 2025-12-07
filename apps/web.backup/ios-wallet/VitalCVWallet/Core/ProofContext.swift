//
//  ProofContext.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 3
//  Shared state object for proof verification context
//

import Foundation
import SwiftUI
import Combine

/// ProofContext - Shared state object for proof verification operations
@MainActor
public class ProofContext: ObservableObject {
    public static let shared = ProofContext()

    // MARK: - Published State

    /// Currently active verification session
    @Published public var activeVerification: VerificationSession?

    /// Queue of pending verifications
    @Published public var verificationQueue: [VerificationSession] = []

    /// History of completed verifications
    @Published public var verificationHistory: [VerificationResult] = []

    /// Current proof being analyzed
    @Published public var currentProof: VerifiableCredential?

    /// Verification progress (0.0 to 1.0)
    @Published public var verificationProgress: Double = 0.0

    /// Current verification status
    @Published public var verificationStatus: VerificationStatus = .idle

    /// Trust score for current verification
    @Published public var currentTrustScore: Double = 0.0

    /// Chain anchor status for current verification
    @Published public var chainAnchorStatus: ChainAnchorStatus?

    /// Verification errors
    @Published public var verificationErrors: [VerificationError] = []

    /// Verification warnings
    @Published public var verificationWarnings: [VerificationWarning] = []

    // MARK: - Configuration

    /// Deterministic verification mode (for reproducibility)
    @Published public var deterministicMode: Bool = false

    /// Trust soak animation enabled
    @Published public var trustSoakEnabled: Bool = true

    /// Frame differencing enabled for QR spoof detection
    @Published public var frameDifferencingEnabled: Bool = false

    // MARK: - Private State

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        loadConfiguration()
    }

    // MARK: - Public API

    /// Start a new verification session
    public func startVerification(
        credential: VerifiableCredential,
        options: VerificationOptions = VerificationOptions()
    ) {
        let session = VerificationSession(
            id: UUID().uuidString,
            credential: credential,
            startedAt: Date(),
            options: options
        )

        activeVerification = session
        verificationStatus = .analyzing
        verificationProgress = 0.0
        currentProof = credential
        verificationErrors = []
        verificationWarnings = []
        currentTrustScore = 0.0
        chainAnchorStatus = nil
    }

    /// Update verification progress
    public func updateProgress(_ progress: Double) {
        verificationProgress = max(0.0, min(1.0, progress))
    }

    /// Add verification error
    public func addError(_ error: VerificationError) {
        verificationErrors.append(error)
    }

    /// Add verification warning
    public func addWarning(_ warning: VerificationWarning) {
        verificationWarnings.append(warning)
    }

    /// Update trust score
    public func updateTrustScore(_ score: Double) {
        currentTrustScore = max(0.0, min(1.0, score))
    }

    /// Update chain anchor status
    public func updateChainAnchorStatus(_ status: ChainAnchorStatus) {
        chainAnchorStatus = status
    }

    /// Complete verification with result
    public func completeVerification(_ result: VerificationResult) {
        guard let session = activeVerification else { return }

        verificationHistory.append(result)
        activeVerification = nil
        verificationStatus = result.verified ? .verified : .failed
        verificationProgress = 1.0

        // Keep last 100 results
        if verificationHistory.count > 100 {
            verificationHistory.removeFirst()
        }
    }

    /// Cancel current verification
    public func cancelVerification() {
        activeVerification = nil
        verificationStatus = .cancelled
        verificationProgress = 0.0
        currentProof = nil
        verificationErrors = []
        verificationWarnings = []
    }

    /// Clear verification history
    public func clearHistory() {
        verificationHistory = []
    }

    /// Get verification result by ID
    public func getVerificationResult(id: String) -> VerificationResult? {
        verificationHistory.first { $0.id == id }
    }

    // MARK: - Configuration

    private func loadConfiguration() {
        deterministicMode = UserDefaults.standard.bool(forKey: "proof_context_deterministic_mode")
        trustSoakEnabled = UserDefaults.standard.object(forKey: "proof_context_trust_soak") as? Bool ?? true
        frameDifferencingEnabled = UserDefaults.standard.bool(forKey: "proof_context_frame_differencing")
    }

    public func saveConfiguration() {
        UserDefaults.standard.set(deterministicMode, forKey: "proof_context_deterministic_mode")
        UserDefaults.standard.set(trustSoakEnabled, forKey: "proof_context_trust_soak")
        UserDefaults.standard.set(frameDifferencingEnabled, forKey: "proof_context_frame_differencing")
    }
}

// MARK: - Supporting Types

public struct VerificationSession: Identifiable {
    public let id: String
    public let credential: VerifiableCredential
    public let startedAt: Date
    public let options: VerificationOptions
}

public struct VerificationOptions {
    public let requireChainAnchor: Bool
    public let requireIssuerVerification: Bool
    public let minimumTrustScore: Double
    public let enableFrameDifferencing: Bool
    public let enableTrustSoak: Bool

    public init(
        requireChainAnchor: Bool = false,
        requireIssuerVerification: Bool = true,
        minimumTrustScore: Double = 0.7,
        enableFrameDifferencing: Bool = false,
        enableTrustSoak: Bool = true
    ) {
        self.requireChainAnchor = requireChainAnchor
        self.requireIssuerVerification = requireIssuerVerification
        self.minimumTrustScore = minimumTrustScore
        self.enableFrameDifferencing = enableFrameDifferencing
        self.enableTrustSoak = enableTrustSoak
    }
}

public enum VerificationStatus {
    case idle
    case analyzing
    case verifying
    case checkingChain
    case calculatingTrust
    case verified
    case failed
    case cancelled
}

public struct VerificationError: Identifiable {
    public let id = UUID()
    public let code: String
    public let message: String
    public let timestamp: Date

    public init(code: String, message: String, timestamp: Date = Date()) {
        self.code = code
        self.message = message
        self.timestamp = timestamp
    }
}

public struct VerificationWarning: Identifiable {
    public let id = UUID()
    public let code: String
    public let message: String
    public let severity: WarningSeverity
    public let timestamp: Date

    public init(code: String, message: String, severity: WarningSeverity = .medium, timestamp: Date = Date()) {
        self.code = code
        self.message = message
        self.severity = severity
        self.timestamp = timestamp
    }
}

public enum WarningSeverity {
    case low
    case medium
    case high
}

// Extend VerificationResult to include ID
extension VerificationResult {
    public var id: String {
        credentialId
    }
}








