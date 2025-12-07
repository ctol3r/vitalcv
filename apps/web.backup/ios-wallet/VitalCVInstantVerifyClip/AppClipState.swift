//
//  AppClipState.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 1 - Task 9, 10
//  App Clip state management and invocation handling
//

import Foundation
import SwiftUI

@MainActor
class AppClipState: ObservableObject {
    static let shared = AppClipState()

    @Published var invocationPayload: QRPayload?
    @Published var handoffData: HandoffData?
    @Published var verificationResult: VerificationResult?

    private init() {}

    // MARK: - Task 9 & 10: Invocation Handler

    func handleInvocation(url: URL) {
        // Parse URL parameters
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let queryItems = components.queryItems else {
            return
        }

        // Extract QR payload from URL
        if let qrParam = queryItems.first(where: { $0.name == "qr" })?.value,
           let qrData = qrParam.removingPercentEncoding {
            // Task 10: Parse QR payload
            parseQRPayload(qrData)
        } else if let vcParam = queryItems.first(where: { $0.name == "vc" })?.value,
                  let vcData = vcParam.removingPercentEncoding {
            // Direct VC in URL
            parseQRPayload(vcData)
        } else if let vpParam = queryItems.first(where: { $0.name == "vp" })?.value,
                  let vpData = vpParam.removingPercentEncoding {
            // Direct VP in URL
            parseQRPayload(vpData)
        }
    }

    private func parseQRPayload(_ payload: String) {
        do {
            let parsed = try QRTypeDetector.shared.parsePayload(payload)
            invocationPayload = parsed
        } catch {
            print("Failed to parse QR payload: \(error)")
        }
    }

    // MARK: - Task 14: Handoff Data Creation

    func createHandoffData(credentialId: String? = nil, vpReceipt: String? = nil) -> HandoffData {
        let handoff = HandoffData(
            credentialId: credentialId,
            vpReceipt: vpReceipt,
            timestamp: Date(),
            verificationResult: verificationResult
        )
        handoffData = handoff
        return handoff
    }

    // MARK: - Task 15 & 16: Full App Transition

    func prepareForFullAppTransition() -> URL? {
        guard let handoff = handoffData else { return nil }

        // Create deep link to full app with handoff data
        var components = URLComponents()
        components.scheme = "vitalcv"
        components.host = "clip-handoff"

        var queryItems: [URLQueryItem] = []
        if let credentialId = handoff.credentialId {
            queryItems.append(URLQueryItem(name: "credentialId", value: credentialId))
        }
        if let vpReceipt = handoff.vpReceipt {
            queryItems.append(URLQueryItem(name: "vpReceipt", value: vpReceipt))
        }
        queryItems.append(URLQueryItem(name: "timestamp", value: String(handoff.timestamp.timeIntervalSince1970)))

        components.queryItems = queryItems

        return components.url
    }
}

// MARK: - Handoff Data Model

struct HandoffData: Codable {
    let credentialId: String?
    let vpReceipt: String?
    let timestamp: Date
    let verificationResult: VerificationResult?
}




