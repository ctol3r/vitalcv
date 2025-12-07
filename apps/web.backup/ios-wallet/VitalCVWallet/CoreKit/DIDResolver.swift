//
//  DIDResolver.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 3
//  DIDResolver optimized with async caching
//

import Foundation

/// DIDResolver - Resolves DIDs with async caching for performance
public class DIDResolver {
    public static let shared = DIDResolver()

    // MARK: - Cache

    private var cache: [String: CachedDIDDocument] = [:]
    private let cacheQueue = DispatchQueue(label: "did.resolver.cache", attributes: .concurrent)
    private let cacheExpirationInterval: TimeInterval = 3600 // 1 hour

    // MARK: - Resolvers

    private var resolvers: [String: DIDResolverProtocol] = [:]

    private init() {
        setupDefaultResolvers()
    }

    // MARK: - Initialization

    public func initialize() async {
        // Pre-warm cache with frequently accessed DIDs
        // In production, load from persistent storage
    }

    // MARK: - Resolution

    /// Resolve DID to DID Document
    public func resolve(did: String) async -> DIDDocument? {
        // Check cache first
        if let cached = getCached(did: did) {
            return cached.document
        }

        // Determine resolver based on DID method
        let method = extractMethod(from: did)
        guard let resolver = resolvers[method] else {
            return nil
        }

        // Resolve from network
        guard let document = await resolver.resolve(did: did) else {
            return nil
        }

        // Cache result
        setCached(did: did, document: document)

        return document
    }

    /// Resolve multiple DIDs in parallel
    public func resolve(dids: [String]) async -> [String: DIDDocument] {
        await withTaskGroup(of: (String, DIDDocument?).self) { group in
            for did in dids {
                group.addTask {
                    let document = await self.resolve(did: did)
                    return (did, document)
                }
            }

            var results: [String: DIDDocument] = [:]
            for await (did, document) in group {
                if let document = document {
                    results[did] = document
                }
            }
            return results
        }
    }

    /// Prefetch DIDs (useful for credential verification)
    public func prefetch(dids: [String]) async {
        await withTaskGroup(of: Void.self) { group in
            for did in dids {
                group.addTask {
                    _ = await self.resolve(did: did)
                }
            }
        }
    }

    // MARK: - Cache Management

    private func getCached(did: String) -> CachedDIDDocument? {
        return cacheQueue.sync {
            guard let cached = cache[did] else {
                return nil
            }

            // Check expiration
            if Date().timeIntervalSince(cached.cachedAt) > cacheExpirationInterval {
                cache.removeValue(forKey: did)
                return nil
            }

            return cached
        }
    }

    private func setCached(did: String, document: DIDDocument) {
        cacheQueue.async(flags: .barrier) {
            self.cache[did] = CachedDIDDocument(
                document: document,
                cachedAt: Date()
            )
        }
    }

    /// Clear cache
    public func clearCache() {
        cacheQueue.async(flags: .barrier) {
            self.cache.removeAll()
        }
    }

    /// Clear expired cache entries
    public func clearExpiredCache() {
        cacheQueue.async(flags: .barrier) {
            let now = Date()
            self.cache = self.cache.filter { _, cached in
                now.timeIntervalSince(cached.cachedAt) <= self.cacheExpirationInterval
            }
        }
    }

    // MARK: - Resolver Setup

    private func setupDefaultResolvers() {
        // did:key resolver
        resolvers["key"] = DIDKeyResolver()

        // did:web resolver
        resolvers["web"] = DIDWebResolver()

        // did:ion resolver (future)
        // resolvers["ion"] = DIDIonResolver()
    }

    private func extractMethod(from did: String) -> String {
        let components = did.split(separator: ":")
        guard components.count >= 2 else {
            return "unknown"
        }
        return String(components[1])
    }
}

// MARK: - Cached Document

private struct CachedDIDDocument {
    let document: DIDDocument
    let cachedAt: Date
}

// MARK: - DID Document

public struct DIDDocument: Codable {
    public let id: String
    public let verificationMethod: [VerificationMethod]
    public let authentication: [String]
    public let service: [DIDService]?

    public init(id: String, verificationMethod: [VerificationMethod], authentication: [String], service: [DIDService]? = nil) {
        self.id = id
        self.verificationMethod = verificationMethod
        self.authentication = authentication
        self.service = service
    }
}

public struct VerificationMethod: Codable {
    public let id: String
    public let type: String
    public let controller: String
    public let publicKeyJwk: [String: String]?
    public let publicKeyMultibase: String?
}

public struct DIDService: Codable {
    public let id: String
    public let type: String
    public let serviceEndpoint: String
}

// MARK: - Resolver Protocol

private protocol DIDResolverProtocol {
    func resolve(did: String) async -> DIDDocument?
}

// MARK: - DID:key Resolver

private class DIDKeyResolver: DIDResolverProtocol {
    func resolve(did: String) async -> DIDDocument? {
        // did:key is self-contained - extract public key and construct document
        let components = did.split(separator: ":")
        guard components.count >= 3 else {
            return nil
        }

        let publicKeyBase58 = components[2...].joined(separator: ":")

        // Decode base58 and construct verification method
        // Simplified - in production use proper base58 decoding
        let verificationMethod = VerificationMethod(
            id: "\(did)#key-1",
            type: "Ed25519VerificationKey2020",
            controller: did,
            publicKeyJwk: nil,
            publicKeyMultibase: publicKeyBase58
        )

        return DIDDocument(
            id: did,
            verificationMethod: [verificationMethod],
            authentication: ["\(did)#key-1"]
        )
    }
}

// MARK: - DID:web Resolver

private class DIDWebResolver: DIDResolverProtocol {
    func resolve(did: String) async -> DIDDocument? {
        // did:web resolution via HTTPS
        let components = did.split(separator: ":")
        guard components.count >= 3 else {
            return nil
        }

        let domain = components[2...].joined(separator: ":")
        let urlString = "https://\(domain)/.well-known/did.json"

        guard let url = URL(string: urlString) else {
            return nil
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let document = try JSONDecoder().decode(DIDDocument.self, from: data)
            return document
        } catch {
            return nil
        }
    }
}
