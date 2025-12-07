//
//  ProofSessionManager.swift
//  VitalCVWallet
//
//  Created: Batch 136-A - Task 3
//  Proof session token binding per verification
//

import Foundation
import CryptoKit
import Combine

/// ProofSessionManager - Manages proof session tokens with binding per verification
public class ProofSessionManager {
    public static let shared = ProofSessionManager()

    // MARK: - Properties

    private var activeSessions: [String: ProofSession] = [:]
    private let queue = DispatchQueue(label: "com.vitalcv.proof.session", attributes: .concurrent)
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        // Cleanup expired sessions periodically
        startSessionCleanup()
    }

    // MARK: - Session Management

    /// Create a new proof session for a verification
    public func createSession(for verificationId: String, credentialId: String) -> ProofSession {
        return queue.sync(flags: .barrier) {
            // Generate session token
            let sessionToken = generateSessionToken()

            // Create session with binding
            let session = ProofSession(
                id: UUID().uuidString,
                verificationId: verificationId,
                credentialId: credentialId,
                token: sessionToken,
                createdAt: Date(),
                expiresAt: Date().addingTimeInterval(300) // 5 minutes
            )

            activeSessions[verificationId] = session

            return session
        }
    }

    /// Get session token for a verification
    public func getSessionToken(for verificationId: String) -> String? {
        return queue.sync {
            guard let session = activeSessions[verificationId],
                  session.expiresAt > Date() else {
                return nil
            }
            return session.token
        }
    }

    /// Validate session token for a verification
    public func validateSession(verificationId: String, token: String) -> Bool {
        return queue.sync {
            guard let session = activeSessions[verificationId] else {
                return false
            }

            // Check expiration
            guard session.expiresAt > Date() else {
                activeSessions.removeValue(forKey: verificationId)
                return false
            }

            // Validate token
            return session.token == token
        }
    }

    /// Bind session token to DPoP proof
    public func bindToDPoP(verificationId: String, dpopToken: String) -> String? {
        return queue.sync {
            guard let session = activeSessions[verificationId] else {
                return nil
            }

            // Create binding hash
            let bindingData = "\(session.token).\(dpopToken)".data(using: .utf8)!
            let bindingHash = SHA256.hash(data: bindingData)
            let bindingString = bindingHash.compactMap { String(format: "%02x", $0) }.joined()

            // Update session with binding
            var updatedSession = session
            updatedSession.dpopBinding = bindingString
            activeSessions[verificationId] = updatedSession

            return bindingString
        }
    }

    /// Complete and remove session
    public func completeSession(verificationId: String) {
        queue.async(flags: .barrier) { [weak self] in
            self?.activeSessions.removeValue(forKey: verificationId)
        }
    }

    /// Get all active sessions
    public func getActiveSessions() -> [ProofSession] {
        return queue.sync {
            let now = Date()
            return activeSessions.values.filter { $0.expiresAt > now }
        }
    }

    // MARK: - Private Methods

    private func generateSessionToken() -> String {
        // Generate cryptographically secure random token
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }

    private func startSessionCleanup() {
        // Cleanup every 60 seconds
        Timer.publish(every: 60, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.cleanupExpiredSessions()
            }
            .store(in: &cancellables)
    }

    private func cleanupExpiredSessions() {
        queue.async(flags: .barrier) { [weak self] in
            guard let self = self else { return }
            let now = Date()
            self.activeSessions = self.activeSessions.filter { $0.value.expiresAt > now }
        }
    }
}

// MARK: - Supporting Types

public struct ProofSession: Identifiable, Codable {
    public let id: String
    public let verificationId: String
    public let credentialId: String
    public let token: String
    public let createdAt: Date
    public let expiresAt: Date
    public var dpopBinding: String?

    public init(id: String, verificationId: String, credentialId: String, token: String, createdAt: Date, expiresAt: Date, dpopBinding: String? = nil) {
        self.id = id
        self.verificationId = verificationId
        self.credentialId = credentialId
        self.token = token
        self.createdAt = createdAt
        self.expiresAt = expiresAt
        self.dpopBinding = dpopBinding
    }
}

// MARK: - Extensions

extension Data {
    func base64URLEncodedString() -> String {
        return base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}








