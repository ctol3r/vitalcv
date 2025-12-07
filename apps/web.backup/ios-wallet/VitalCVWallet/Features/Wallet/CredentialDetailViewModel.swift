//
//  CredentialDetailViewModel.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 2, 16-20
//  MVVM ViewModel for credential details
//

import Foundation
import Combine

@MainActor
class CredentialDetailViewModel: ObservableObject {
    let credential: VerifiableCredential

    @Published var isEvidenceExpanded: Bool = false
    @Published var timelineEvents: [TimelineEvent] = []
    @Published var chainAnchorStatus: ChainAnchorStatus = .unknown

    init(credential: VerifiableCredential) {
        self.credential = credential
        buildTimeline()
        checkChainAnchorStatus()
    }

    // Task 17: Timeline view (issued → anchored → verified)
    private func buildTimeline() {
        var events: [TimelineEvent] = []

        // Issuance event
        events.append(TimelineEvent(
            type: .issued,
            date: credential.issuanceDate,
            title: "Credential Issued",
            description: "Issued by \(credential.issuer.name ?? credential.issuer.id)"
        ))

        // Chain anchor event (if applicable)
        if let proof = credential.proof {
            events.append(TimelineEvent(
                type: .anchored,
                date: proof.created,
                title: "Anchored to Chain",
                description: "Transaction: \(proof.verificationMethod)"
            ))
        }

        // Evidence events
        if let evidence = credential.evidence {
            for ev in evidence {
                events.append(TimelineEvent(
                    type: .evidence,
                    date: ev.timestamp,
                    title: ev.type,
                    description: ev.description ?? ev.source
                ))
            }
        }

        // Sort by date
        timelineEvents = events.sorted { $0.date < $1.date }
    }

    // Task 19: Chain anchor status indicator
    private func checkChainAnchorStatus() {
        if credential.proof != nil {
            // In production, check actual chain status
            chainAnchorStatus = .confirmed
        } else {
            chainAnchorStatus = .notAnchored
        }
    }
}

struct TimelineEvent: Identifiable {
    let id = UUID()
    let type: EventType
    let date: Date
    let title: String
    let description: String

    enum EventType {
        case issued
        case anchored
        case verified
        case evidence
        case revoked

        var icon: String {
            switch self {
            case .issued: return "checkmark.circle.fill"
            case .anchored: return "link.circle.fill"
            case .verified: return "shield.checkmark.fill"
            case .evidence: return "doc.text.fill"
            case .revoked: return "xmark.circle.fill"
            }
        }

        var color: Color {
            switch self {
            case .issued: return .walletSuccess
            case .anchored: return .walletInfo
            case .verified: return .walletPrimary
            case .evidence: return .walletInfo
            case .revoked: return .walletError
            }
        }
    }
}

enum ChainAnchorStatus {
    case unknown
    case notAnchored
    case pending
    case confirmed
    case failed

    var displayText: String {
        switch self {
        case .unknown: return "Unknown"
        case .notAnchored: return "Not Anchored"
        case .pending: return "Pending Confirmation"
        case .confirmed: return "Confirmed on Chain"
        case .failed: return "Anchoring Failed"
        }
    }

    var color: Color {
        switch self {
        case .unknown: return .walletTextSecondary
        case .notAnchored: return .walletWarning
        case .pending: return .walletInfo
        case .confirmed: return .walletSuccess
        case .failed: return .walletError
        }
    }
}








