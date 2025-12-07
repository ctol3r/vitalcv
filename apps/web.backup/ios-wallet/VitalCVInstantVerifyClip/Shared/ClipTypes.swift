//
//  ClipTypes.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 1 - Task 5
//  Shared types for App Clip (compatible with main app)
//

import Foundation

// MARK: - QR Payload Types (from main app)

public enum QRPayloadType: String, Codable {
    case jwtVC = "jwt-vc"
    case jwtVP = "jwt-vp"
    case jsonVC = "json-vc"
    case jsonVP = "json-vp"
    case sdJWT = "sd-jwt"
    case oidcOffer = "oidc-offer"
    case oidcRequest = "oidc-request"
    case unknown = "unknown"
}

// QRPayload compatibility - use main app's QRPayload if available
// For App Clip, we'll create a compatible wrapper
public struct QRPayload: Identifiable {
    public let id: String
    public let type: QRPayloadType
    public let rawValue: String?
    public let payload: [String: Any]
    public let header: [String: Any]?
    public let signature: String?
    public let disclosures: [String]?

    public init(
        id: String = UUID().uuidString,
        type: QRPayloadType,
        rawValue: String? = nil,
        payload: [String: Any] = [:],
        header: [String: Any]? = nil,
        signature: String? = nil,
        disclosures: [String]? = nil
    ) {
        self.id = id
        self.type = type
        self.rawValue = rawValue
        self.payload = payload
        self.header = header
        self.signature = signature
        self.disclosures = disclosures
    }

    // Compatibility initializer from main app's QRPayload
    public init(fromMainAppPayload mainPayload: Any) {
        // This would be used if we import the main app's QRPayload
        // For now, create a simplified version
        self.id = UUID().uuidString
        self.type = .unknown
        self.rawValue = nil
        self.payload = [:]
        self.header = nil
        self.signature = nil
        self.disclosures = nil
    }
}

// MARK: - Verification Types

public struct VerifiablePresentation: Codable {
    public let id: String
    public let type: [String]
    public let verifiableCredential: [String]
    public let holder: String
    public let proof: String?
    public let nonce: String?
    public let challenge: String?

    public init(id: String, type: [String], verifiableCredential: [String], holder: String, proof: String?, nonce: String?, challenge: String?) {
        self.id = id
        self.type = type
        self.verifiableCredential = verifiableCredential
        self.holder = holder
        self.proof = proof
        self.nonce = nonce
        self.challenge = challenge
    }
}

// MARK: - Trust Score

public enum TrustLevel {
    case high
    case medium
    case low
}

public struct TrustScore: Codable {
    public let value: Double
    public let checks: [VerificationCheck]
    public let level: TrustLevel

    public init(value: Double, checks: [VerificationCheck], level: TrustLevel) {
        self.value = value
        self.checks = checks
        self.level = level
    }

    enum CodingKeys: String, CodingKey {
        case value, checks, level
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        value = try container.decode(Double.self, forKey: .value)
        checks = try container.decode([VerificationCheck].self, forKey: .checks)
        let levelString = try container.decode(String.self, forKey: .level)
        level = TrustLevel(rawValue: levelString) ?? .low
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(value, forKey: .value)
        try container.encode(checks, forKey: .checks)
        try container.encode(level.rawValue, forKey: .level)
    }
}

extension TrustLevel: Codable {
    public var rawValue: String {
        switch self {
        case .high: return "high"
        case .medium: return "medium"
        case .low: return "low"
        }
    }

    public init?(rawValue: String) {
        switch rawValue {
        case "high": self = .high
        case "medium": self = .medium
        case "low": self = .low
        default: return nil
        }
    }
}

// MARK: - Issuer Metadata

public struct IssuerMetadata: Codable {
    public let trusted: Bool
    public let name: String?

    public init(trusted: Bool, name: String?) {
        self.trusted = trusted
        self.name = name
    }
}

// MARK: - Environment Config

class EnvironmentConfig {
    static let shared = EnvironmentConfig()

    var apiBaseURL: String {
        // Get from environment or default
        return ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "https://api.vitalcv.com"
    }

    private init() {}
}

// MARK: - QR Detector (simplified)

import Vision
import AVFoundation

class QRDetector {
    struct DetectionResult {
        let stringValue: String
        let boundingBox: CGRect
        let isValid: Bool
    }

    private let visionQueue = DispatchQueue(label: "qr.detection", qos: .userInteractive)

    func detectQRCode(in pixelBuffer: CVPixelBuffer, completion: @escaping (DetectionResult?) -> Void) {
        visionQueue.async {
            let request = VNDetectBarcodesRequest { request, error in
                guard error == nil,
                      let results = request.results as? [VNBarcodeObservation],
                      let firstResult = results.first,
                      let payload = firstResult.payloadStringValue else {
                    DispatchQueue.main.async {
                        completion(nil)
                    }
                    return
                }

                let isValid = self.isValidQRFormat(payload)
                let result = DetectionResult(
                    stringValue: payload,
                    boundingBox: firstResult.boundingBox,
                    isValid: isValid
                )

                DispatchQueue.main.async {
                    completion(result)
                }
            }

            request.revision = VNDetectBarcodesRequestRevision3
            request.symbologies = [.QR]

            let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
            do {
                try handler.perform([request])
            } catch {
                DispatchQueue.main.async {
                    completion(nil)
                }
            }
        }
    }

    private func isValidQRFormat(_ payload: String) -> Bool {
        return payload.contains("vc") ||
               payload.contains("vp") ||
               payload.contains("jwt") ||
               payload.contains("openid") ||
               payload.hasPrefix("http") ||
               payload.hasPrefix("https")
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

extension String {
    func base64URLDecodedData() -> Data? {
        var base64 = self
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        // Add padding if needed
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 = base64.padding(toLength: base64.count + 4 - remainder, withPad: "=", startingAt: 0)
        }

        return Data(base64Encoded: base64)
    }
}

import CoreVideo
import UIKit
import Foundation

// MARK: - Missing Type Extensions

// QRPayload id is already defined in struct

// MARK: - VerificationResult Extension (compatible with main app)

extension VerificationResult {
    public init(
        verified: Bool,
        credentialId: String,
        trustScore: TrustScore,
        issuerTrust: IssuerTrustResult,
        chainAnchor: ChainAnchorStatus,
        compliance: ComplianceVerdicts,
        proofResults: ProofResults,
        timestamp: Date
    ) {
        self.verified = verified
        self.credentialId = credentialId
        self.checks = trustScore.checks
        self.timestamp = timestamp
        self.verifier = nil
        self.error = verified ? nil : "Verification failed"
    }
}

// MARK: - IssuerTrustResult

public struct IssuerTrustResult: Codable {
    public let issuerDID: String
    public let trusted: Bool
    public let metadata: IssuerMetadata
    public let schemaValid: Bool
    public let trustPolicyValid: Bool

    public init(issuerDID: String, trusted: Bool, metadata: IssuerMetadata, schemaValid: Bool, trustPolicyValid: Bool) {
        self.issuerDID = issuerDID
        self.trusted = trusted
        self.metadata = metadata
        self.schemaValid = schemaValid
        self.trustPolicyValid = trustPolicyValid
    }
}

// MARK: - ChainAnchorStatus

public struct ChainAnchorStatus: Codable {
    public let confirmed: Bool
    public let blockHeight: Int?
    public let txHash: String?
    public let timestamp: Date?
    public let confirmationCount: Int?
    public let ledgerId: String?

    public init(confirmed: Bool, blockHeight: Int?, txHash: String?, timestamp: Date?, confirmationCount: Int?, ledgerId: String?) {
        self.confirmed = confirmed
        self.blockHeight = blockHeight
        self.txHash = txHash
        self.timestamp = timestamp
        self.confirmationCount = confirmationCount
        self.ledgerId = ledgerId
    }
}

// MARK: - ComplianceVerdicts

public struct ComplianceVerdicts: Codable {
    public let deaStatus: String
    public let licensureStatus: String
    public let sanctionsStatus: String
    public let overallCompliant: Bool

    public init(deaStatus: String, licensureStatus: String, sanctionsStatus: String, overallCompliant: Bool) {
        self.deaStatus = deaStatus
        self.licensureStatus = licensureStatus
        self.sanctionsStatus = sanctionsStatus
        self.overallCompliant = overallCompliant
    }
}

// MARK: - ProofResults

public struct ProofResults: Codable {
    public let issuerTrust: Double
    public let evidenceTrust: Double
    public let chainTrust: Double
    public let overallValid: Bool

    public init(issuerTrust: Double, evidenceTrust: Double, chainTrust: Double, overallValid: Bool) {
        self.issuerTrust = issuerTrust
        self.evidenceTrust = evidenceTrust
        self.chainTrust = chainTrust
        self.overallValid = overallValid
    }
}

// MARK: - VerificationCheck

public struct VerificationCheck: Codable {
    public let name: String
    public let passed: Bool
    public let message: String?

    public init(name: String, passed: Bool, message: String?) {
        self.name = name
        self.passed = passed
        self.message = message
    }
}

// MARK: - VerificationSession

public struct VerificationSession: Codable {
    public let sessionId: String
    public let nonce: String
    public let challenge: String

    public init(sessionId: String, nonce: String, challenge: String) {
        self.sessionId = sessionId
        self.nonce = nonce
        self.challenge = challenge
    }
}

