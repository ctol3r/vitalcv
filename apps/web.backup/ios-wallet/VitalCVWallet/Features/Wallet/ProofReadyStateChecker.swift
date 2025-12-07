//
//  ProofReadyStateChecker.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 13
//  Proof-ready state checker
//

import Foundation

/// ProofReadyStateChecker - Checks if credential is ready for proof generation
public class ProofReadyStateChecker {
    public static let shared = ProofReadyStateChecker()

    private init() {}

    /// Check if credential is proof-ready
    public func isProofReady(_ credential: VerifiableCredential) -> ProofReadiness {
        var issues: [ProofReadinessIssue] = []

        // Check 1: Proof exists
        if credential.proof == nil {
            issues.append(.missingProof)
        }

        // Check 2: Not expired
        if credential.isExpired {
            issues.append(.expired)
        }

        // Check 3: Issuer valid
        if credential.issuer.id.isEmpty {
            issues.append(.invalidIssuer)
        }

        // Check 4: Subject valid
        if credential.credentialSubject.id.isEmpty {
            issues.append(.invalidSubject)
        }

        // Check 5: Evidence present (optional but recommended)
        if credential.evidence?.isEmpty ?? true {
            issues.append(.noEvidence)
        }

        return ProofReadiness(
            ready: issues.isEmpty,
            issues: issues
        )
    }

    /// Get proof readiness for multiple credentials
    public func checkCredentials(_ credentials: [VerifiableCredential]) -> [String: ProofReadiness] {
        var results: [String: ProofReadiness] = [:]

        for credential in credentials {
            results[credential.id] = isProofReady(credential)
        }

        return results
    }
}

// MARK: - Models

public struct ProofReadiness {
    public let ready: Bool
    public let issues: [ProofReadinessIssue]

    public var canGenerateProof: Bool {
        return ready || issues.allSatisfy { $0.severity == .warning }
    }
}

public enum ProofReadinessIssue {
    case missingProof
    case expired
    case invalidIssuer
    case invalidSubject
    case noEvidence

    var severity: IssueSeverity {
        switch self {
        case .missingProof, .expired, .invalidIssuer, .invalidSubject:
            return .error
        case .noEvidence:
            return .warning
        }
    }

    var description: String {
        switch self {
        case .missingProof:
            return "Missing cryptographic proof"
        case .expired:
            return "Credential has expired"
        case .invalidIssuer:
            return "Invalid issuer"
        case .invalidSubject:
            return "Invalid subject"
        case .noEvidence:
            return "No evidence attached"
        }
    }
}

public enum IssueSeverity {
    case error
    case warning
}

