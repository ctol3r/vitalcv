//
//  SecureQRParser.swift
//  VitalCVWallet
//
//  Created: Batch 560 - Task 3
//  SecureQRParser - QR code parsing with threat detection
//

import Foundation
import AVFoundation
import Vision

/// SecureQRParser - Secure QR code parsing with threat detection
/// Detects malicious QR codes, phishing attempts, and suspicious patterns
@MainActor
public class SecureQRParser: ObservableObject {
    public static let shared = SecureQRParser()

    // MARK: - Published State

    @Published public private(set) var lastScanResult: QRScanResult?
    @Published public private(set) var threatDetected: Bool = false

    // MARK: - Private Properties

    private let threatDetector = QRThreatDetector()
    private var scanHistory: [QRScanResult] = []
    private let maxHistorySize = 100

    private init() {}

    // MARK: - QR Parsing

    /// Parse QR code string with threat detection
    public func parse(_ qrString: String, source: QRSource = .unknown) async -> QRParseResult {
        // Detect threats
        let threats = await threatDetector.detectThreats(in: qrString)

        // Parse content
        let content = parseContent(qrString)

        let result = QRParseResult(
            rawString: qrString,
            content: content,
            threats: threats,
            source: source,
            timestamp: Date()
        )

        // Store in history
        let scanResult = QRScanResult(
            string: qrString,
            content: content,
            threats: threats,
            timestamp: Date()
        )
        scanHistory.append(scanResult)
        if scanHistory.count > maxHistorySize {
            scanHistory.removeFirst()
        }

        lastScanResult = scanResult
        threatDetected = !threats.isEmpty

        return result
    }

    /// Parse QR code from image
    public func parse(from image: UIImage) async -> QRParseResult? {
        guard let ciImage = CIImage(image: image) else {
            return nil
        }

        let request = VNDetectBarcodesRequest { [weak self] request, error in
            guard let self = self,
                  let observations = request.results as? [VNBarcodeObservation],
                  let firstObservation = observations.first,
                  let payload = firstObservation.payloadStringValue else {
                return
            }

            Task { @MainActor in
                _ = await self.parse(payload, source: .camera)
            }
        }

        let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
        try? handler.perform([request])

        // Wait for async result
        try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds

        return lastScanResult.map { scanResult in
            QRParseResult(
                rawString: scanResult.string,
                content: parseContent(scanResult.string),
                threats: scanResult.threats,
                source: .camera,
                timestamp: scanResult.timestamp
            )
        }
    }

    // MARK: - Content Parsing

    private func parseContent(_ qrString: String) -> QRContent {
        // Check if it's a URL
        if let url = URL(string: qrString), url.scheme != nil {
            return .url(url)
        }

        // Check if it's a deep link
        if qrString.hasPrefix("vitalcv://") || qrString.hasPrefix("vitalcvwallet://") {
            return .deepLink(qrString)
        }

        // Check if it's a credential offer (OIDC4VCI)
        if qrString.contains("openid-credential-offer://") || qrString.contains("credential_offer") {
            return .credentialOffer(qrString)
        }

        // Check if it's a verification request (OIDC4VP)
        if qrString.contains("openid-verification://") || qrString.contains("verification_request") {
            return .verificationRequest(qrString)
        }

        // Check if it's JSON
        if let data = qrString.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return .json(json)
        }

        // Default to plain text
        return .plainText(qrString)
    }

    // MARK: - History

    /// Get scan history
    public func getHistory(limit: Int = 10) -> [QRScanResult] {
        return Array(scanHistory.suffix(limit))
    }

    /// Clear scan history
    public func clearHistory() {
        scanHistory.removeAll()
        lastScanResult = nil
        threatDetected = false
    }
}

// MARK: - Threat Detection

private actor QRThreatDetector {
    private let suspiciousDomains = [
        "bit.ly", "tinyurl.com", "t.co", "goo.gl", // URL shorteners
        "phishing", "malware", "virus" // Suspicious keywords
    ]

    private let maliciousPatterns = [
        #"javascript:"#,
        #"data:text/html"#,
        #"<script"#,
        #"eval\("#,
        #"base64"#
    ]

    func detectThreats(in qrString: String) async -> [QRThreat] {
        var threats: [QRThreat] = []

        // Check for URL shorteners
        if let url = URL(string: qrString),
           let host = url.host {
            for domain in suspiciousDomains {
                if host.contains(domain) {
                    threats.append(.suspiciousDomain(domain))
                }
            }
        }

        // Check for malicious patterns
        for pattern in maliciousPatterns {
            if qrString.range(of: pattern, options: .regularExpression) != nil {
                threats.append(.maliciousPattern(pattern))
            }
        }

        // Check for suspicious length (too long might be obfuscated)
        if qrString.count > 2000 {
            threats.append(.suspiciousLength)
        }

        // Check for encoded content (base64, hex, etc.)
        if qrString.range(of: #"^[A-Za-z0-9+/=]+$"#, options: .regularExpression) != nil,
           qrString.count > 100 {
            threats.append(.encodedContent)
        }

        // Check for IP addresses (potential phishing)
        if qrString.range(of: #"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"#, options: .regularExpression) != nil {
            threats.append(.ipAddress)
        }

        return threats
    }
}

// MARK: - Models

public struct QRParseResult {
    public let rawString: String
    public let content: QRContent
    public let threats: [QRThreat]
    public let source: QRSource
    public let timestamp: Date

    public var isSafe: Bool {
        return threats.isEmpty
    }

    public var threatLevel: ThreatLevel {
        if threats.isEmpty {
            return .safe
        } else if threats.contains(where: { $0.isCritical }) {
            return .critical
        } else {
            return .warning
        }
    }
}

public struct QRScanResult {
    public let string: String
    public let content: QRContent
    public let threats: [QRThreat]
    public let timestamp: Date
}

public enum QRContent {
    case url(URL)
    case deepLink(String)
    case credentialOffer(String)
    case verificationRequest(String)
    case json([String: Any])
    case plainText(String)
}

public enum QRThreat {
    case suspiciousDomain(String)
    case maliciousPattern(String)
    case suspiciousLength
    case encodedContent
    case ipAddress

    public var isCritical: Bool {
        switch self {
        case .maliciousPattern:
            return true
        default:
            return false
        }
    }

    public var description: String {
        switch self {
        case .suspiciousDomain(let domain):
            return "Suspicious domain: \(domain)"
        case .maliciousPattern(let pattern):
            return "Malicious pattern detected: \(pattern)"
        case .suspiciousLength:
            return "Suspiciously long QR code content"
        case .encodedContent:
            return "Encoded content detected (potential obfuscation)"
        case .ipAddress:
            return "IP address detected (potential phishing)"
        }
    }
}

public enum QRSource {
    case camera
    case image
    case clipboard
    case manual
    case unknown
}

public enum ThreatLevel {
    case safe
    case warning
    case critical
}

