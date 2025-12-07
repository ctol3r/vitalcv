//
//  BBSPlusEngine.swift
//  VitalCVWallet
//
//  Created: Batch 129 - Task 21-25
//  BBS+ proof generation in-app with parameter caching and merkle-tree builder
//

import Foundation
import CryptoKit

/// BBSPlusEngine - BBS+ zero-knowledge proof generation
public class BBSPlusEngine {
    public static let shared = BBSPlusEngine()

    private var parameterCache: [String: BBSPlusParameters] = [:]
    private let cacheQueue = DispatchQueue(label: "bbs.parameters.cache")

    private init() {}

    // MARK: - Task 21: BBS+ Proof Generation

    /// Generate BBS+ proof for selective disclosure
    public func generateProof(
        credential: VerifiableCredential,
        revealedAttributes: [String],
        hiddenAttributes: [String]
    ) async throws -> BBSPlusProof {
        // Task 22: Add BBS parameters caching
        let params = try await getOrGenerateParameters(for: credential.id)

        // Task 23: Add reusable merkle-tree builder for hidden attributes
        let merkleTree = try buildMerkleTree(
            attributes: hiddenAttributes,
            credential: credential
        )

        // Generate proof (simplified - in production use actual BBS+ library)
        let proof = BBSPlusProof(
            id: UUID().uuidString,
            credentialId: credential.id,
            revealedAttributes: revealedAttributes,
            hiddenAttributes: hiddenAttributes,
            merkleRoot: merkleTree.root,
            proofValue: generateProofValue(
                params: params,
                revealed: revealedAttributes,
                hidden: hiddenAttributes,
                merkleRoot: merkleTree.root
            ),
            timestamp: Date()
        )

        return proof
    }

    // MARK: - Task 22: BBS Parameters Caching

    /// Get or generate BBS+ parameters for credential
    private func getOrGenerateParameters(for credentialId: String) async throws -> BBSPlusParameters {
        return try await withCheckedThrowingContinuation { continuation in
            cacheQueue.async {
                if let cached = self.parameterCache[credentialId] {
                    continuation.resume(returning: cached)
                    return
                }

                // Generate new parameters
                let params = BBSPlusParameters(
                    credentialId: credentialId,
                    publicKey: self.generatePublicKey(),
                    generator: self.generateGenerator(),
                    timestamp: Date()
                )

                self.parameterCache[credentialId] = params
                continuation.resume(returning: params)
            }
        }
    }

    private func generatePublicKey() -> String {
        // In production, generate actual BBS+ public key
        let keyData = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
        return keyData.base64EncodedString()
    }

    private func generateGenerator() -> String {
        // In production, generate actual BBS+ generator
        let genData = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
        return genData.base64EncodedString()
    }

    // MARK: - Task 23: Merkle Tree Builder

    /// Build merkle tree for hidden attributes
    private func buildMerkleTree(
        attributes: [String],
        credential: VerifiableCredential
    ) throws -> MerkleTree {
        guard !attributes.isEmpty else {
            return MerkleTree(root: "", leaves: [])
        }

        // Create leaf nodes from hidden attributes
        let leaves = attributes.map { attributeKey in
            let attributeValue = credential.credentialSubject.claims[attributeKey] ?? ""
            let leafData = "\(attributeKey):\(attributeValue)".data(using: .utf8)!
            let hash = SHA256.hash(data: leafData)
            return String(data: Data(hash).base64EncodedString().prefix(16))
        }

        // Build tree bottom-up
        var currentLevel = leaves
        var levels: [[String]] = [leaves]

        while currentLevel.count > 1 {
            var nextLevel: [String] = []
            for i in stride(from: 0, to: currentLevel.count, by: 2) {
                let left = currentLevel[i]
                let right = i + 1 < currentLevel.count ? currentLevel[i + 1] : left
                let combined = "\(left)\(right)".data(using: .utf8)!
                let hash = SHA256.hash(data: combined)
                nextLevel.append(String(data: Data(hash).base64EncodedString().prefix(16)))
            }
            levels.append(nextLevel)
            currentLevel = nextLevel
        }

        let root = currentLevel.first ?? ""

        return MerkleTree(root: root, leaves: leaves)
    }

    private func generateProofValue(
        params: BBSPlusParameters,
        revealed: [String],
        hidden: [String],
        merkleRoot: String
    ) -> String {
        // In production, generate actual BBS+ proof value
        let input = "\(params.publicKey)\(revealed.joined())\(hidden.joined())\(merkleRoot)"
        let data = input.data(using: .utf8)!
        let hash = SHA256.hash(data: data)
        return Data(hash).base64EncodedString()
    }

    // MARK: - Cache Management

    /// Clear parameter cache
    public func clearCache() {
        cacheQueue.async {
            self.parameterCache.removeAll()
        }
    }

    /// Clear expired parameters
    public func clearExpiredCache(maxAge: TimeInterval = 3600) {
        cacheQueue.async {
            let now = Date()
            self.parameterCache = self.parameterCache.filter { _, params in
                now.timeIntervalSince(params.timestamp) <= maxAge
            }
        }
    }
}

// MARK: - Models

public struct BBSPlusParameters {
    public let credentialId: String
    public let publicKey: String
    public let generator: String
    public let timestamp: Date
}

public struct BBSPlusProof {
    public let id: String
    public let credentialId: String
    public let revealedAttributes: [String]
    public let hiddenAttributes: [String]
    public let merkleRoot: String
    public let proofValue: String
    public let timestamp: Date
}

public struct MerkleTree {
    public let root: String
    public let leaves: [String]
}

