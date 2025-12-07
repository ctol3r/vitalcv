//
//  DeepLinkHandler.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 39
//  "Apply to job" deep link handler
//

import Foundation
import SwiftUI

class DeepLinkHandler {
    static let shared = DeepLinkHandler()

    private init() {}

    func handleURL(_ url: URL) -> DeepLinkAction? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }

        switch components.scheme {
        case "vitalcv":
            return handleVitalCVLink(components)
        case "https", "http":
            return handleHTTPSLink(components)
        default:
            return nil
        }
    }

    private func handleVitalCVLink(_ components: URLComponents) -> DeepLinkAction? {
        guard let host = components.host else {
            return nil
        }

        switch host {
        case "credential":
            if let id = components.queryItems?.first(where: { $0.name == "id" })?.value {
                return .credentialDetail(id: id)
            }
        case "verify":
            if let id = components.queryItems?.first(where: { $0.name == "id" })?.value {
                return .verifyCredential(id: id)
            }
        case "job":
            if let id = components.queryItems?.first(where: { $0.name == "id" })?.value {
                return .jobApplication(id: id)
            }
        case "recruiter":
            if let id = components.queryItems?.first(where: { $0.name == "id" })?.value {
                return .recruiterConnect(id: id)
            }
        case "offer":
            // Phase 1 - Task 4: Handle credential offer deep link
            if components.queryItems?.contains(where: { $0.name == "credential_offer" }) == true {
                return .credentialOffer(url: components.url!)
            }
        case "scan":
            return .scan
        case "scheduler":
            // Phase 5 - Task 38: Handle scheduler deep link
            if let shiftId = components.path.components(separatedBy: "/").last, !shiftId.isEmpty {
                return .scheduler(shiftId: shiftId)
            }
        case "passport":
            // Phase 1 - Task 8: Handle passport deep link
            if let facilityId = components.queryItems?.first(where: { $0.name == "facilityId" })?.value {
                return .passport(facilityId: facilityId)
            }
            return .passportList
        case "conversation":
            // AI Credential Conversation Engine - Phase 1 - Task 8: Handle conversation deep link
            if let conversationId = components.queryItems?.first(where: { $0.name == "id" })?.value {
                return .conversation(id: conversationId)
            }
            return .conversationList
        case "chain":
            // Chain Orchestration Layer - Phase 1 - Task 8: Handle chain orchestrator deep link
            if components.path.contains("orchestrator") {
                // Let ChainOrchestrator handle it
                Task { @MainActor in
                    _ = ChainOrchestrator.shared.handleDeepLink(components.url!)
                }
                return .chainOrchestrator(url: components.url!)
            }
        case "zk":
            // Phase 1 - Task 8: Handle ZK authorization deep link
            if components.path.contains("authorize") {
                return .zkAuthorize(url: components.url!)
            }
        case "financial":
            // Financial Identity Engine - Phase 1 - Task 8: Handle financial deep link
            if let clinicianId = components.queryItems?.first(where: { $0.name == "clinicianId" })?.value {
                return .financialIdentity(clinicianId: clinicianId)
            }
            return .financialIdentityList
        default:
            return nil
        }

        return nil
    }

    private func handleHTTPSLink(_ components: URLComponents) -> DeepLinkAction? {
        // Handle universal links
        if components.host?.contains("vitalcv.com") == true {
            if components.path.contains("/job/") {
                let jobId = components.path.components(separatedBy: "/").last
                if let id = jobId {
                    return .jobApplication(id: id)
                }
            }
        }

        return nil
    }
}

enum DeepLinkAction {
    case credentialDetail(id: String)
    case verifyCredential(id: String)
    case jobApplication(id: String)
    case recruiterConnect(id: String)
    case credentialOffer(url: URL) // Phase 1 - Task 4
    case scan
    case scheduler(shiftId: String) // Phase 5 - Task 38
    case passport(facilityId: String) // Phase 1 - Task 8
    case passportList // Phase 1 - Task 8
    case conversation(id: String) // AI Credential Conversation Engine - Phase 1 - Task 8
    case conversationList // AI Credential Conversation Engine - Phase 1 - Task 8
    case chainOrchestrator(url: URL) // Chain Orchestration Layer - Phase 1 - Task 8
    case zkAuthorize(url: URL) // Zero-Knowledge Authorization Engine - Phase 1 - Task 8
    case financialIdentity(clinicianId: String) // Financial Identity Engine - Phase 1 - Task 8
    case financialIdentityList // Financial Identity Engine - Phase 1 - Task 8
}

