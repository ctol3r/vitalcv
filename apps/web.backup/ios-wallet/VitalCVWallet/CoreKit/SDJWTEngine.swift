//
//  SDJWTEngine.swift
//  VitalCVWallet
//
//  Created: Batch 129 - Task 16-20
//  SD-JWT selective disclosure engine with salt + digests handling
//

import Foundation
import CryptoKit

/// SDJWTEngine - SD-JWT selective disclosure processing
public class SDJWTEngine {
    public static let shared = SDJWTEngine()

    private init() {}

    // MARK: - Task 18: Salt + Digests Handling

    /// Generate salt for SD-JWT disclosure
    public func generateSalt() -> String {
        let saltData = Data((0..<16).map { _ in UInt8.random(in: 0...255) })
        return saltData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Compute disclosure digest
    public func computeDigest(salt: String, claimKey: String, claimValue: String) -> String {
        // Format: base64url(salt || claim_key || claim_value)
        let input = "\(salt)\(claimKey)\(claimValue)"
        let data = input.data(using: .utf8)!
        let hash = SHA256.hash(data: data)
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Create SD-JWT disclosure
    public func createDisclosure(
        salt: String,
        claimKey: String,
        claimValue: String
    ) -> SDJWTDisclosure {
        let digest = computeDigest(salt: salt, claimKey: claimKey, claimValue: claimValue)

        return SDJWTDisclosure(
            salt: salt,
            claimKey: claimKey,
            claimValue: claimValue,
            digest: digest
        )
    }

    /// Parse SD-JWT to extract disclosures
    public func parseSDJWT(_ sdjwt: String) throws -> SDJWTStructure {
        // SD-JWT format: header.payload.disclosure1.disclosure2...~signature
        let parts = sdjwt.components(separatedBy: "~")
        guard parts.count >= 2 else {
            throw SDJWTError.invalidFormat
        }

        let signature = parts.last!
        let payloadAndDisclosures = parts.dropLast().joined(separator: "~")
        let payloadParts = payloadAndDisclosures.components(separatedBy: ".")

        guard payloadParts.count >= 2 else {
            throw SDJWTError.invalidFormat
        }

        let header = payloadParts[0]
        let payload = payloadParts[1]
        let disclosures = Array(payloadParts.dropFirst(2))

        // Decode disclosures
        let parsedDisclosures = try disclosures.map { disclosureString in
            try parseDisclosure(disclosureString)
        }

        return SDJWTStructure(
            header: header,
            payload: payload,
            disclosures: parsedDisclosures,
            signature: signature
        )
    }

    private func parseDisclosure(_ disclosureString: String) throws -> SDJWTDisclosure {
        // Disclosure is base64url encoded JSON array: [salt, claim_key, claim_value]
        guard let data = Data(base64Encoded: disclosureString, options: .ignoreUnknownCharacters),
              let array = try? JSONSerialization.jsonObject(with: data) as? [Any],
              array.count == 3,
              let salt = array[0] as? String,
              let claimKey = array[1] as? String,
              let claimValue = array[2] as? String else {
            throw SDJWTError.invalidDisclosure
        }

        let digest = computeDigest(salt: salt, claimKey: claimKey, claimValue: claimValue)

        return SDJWTDisclosure(
            salt: salt,
            claimKey: claimKey,
            claimValue: claimValue,
            digest: digest
        )
    }

    /// Generate selective disclosure presentation
    public func generateSelectiveDisclosure(
        sdjwt: String,
        revealedClaims: [String]
    ) throws -> String {
        let structure = try parseSDJWT(sdjwt)

        // Filter disclosures to only include revealed claims
        let revealedDisclosures = structure.disclosures.filter { disclosure in
            revealedClaims.contains(disclosure.claimKey)
        }

        // Rebuild SD-JWT with only revealed disclosures
        let disclosureStrings = revealedDisclosures.map { disclosure in
            // Encode as [salt, claim_key, claim_value]
            let array: [Any] = [disclosure.salt, disclosure.claimKey, disclosure.claimValue]
            let data = try! JSONSerialization.data(withJSONObject: array)
            return data.base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
        }

        // Reconstruct: header.payload.disclosure1.disclosure2...~signature
        let disclosuresPart = disclosureStrings.joined(separator: ".")
        return "\(structure.header).\(structure.payload).\(disclosuresPart)~\(structure.signature)"
    }
}

// MARK: - Models

public struct SDJWTDisclosure {
    public let salt: String
    public let claimKey: String
    public let claimValue: String
    public let digest: String
}

public struct SDJWTStructure {
    public let header: String
    public let payload: String
    public let disclosures: [SDJWTDisclosure]
    public let signature: String
}

public enum SDJWTError: Error {
    case invalidFormat
    case invalidDisclosure
    case missingSalt
    case digestMismatch
}

