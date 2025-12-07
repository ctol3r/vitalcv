//
//  NavigationCoordinator.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 4
//  NavigationStack coordinator with modal & sheet variants
//

import SwiftUI

@MainActor
class NavigationCoordinator: ObservableObject {
    static let shared = NavigationCoordinator()

    @Published var path = NavigationPath()
    @Published var presentedSheet: SheetDestination?
    @Published var presentedFullScreenCover: FullScreenDestination?

    enum SheetDestination: Identifiable {
        case credentialDetail(VerifiableCredential)
        case qrShare(VerifiableCredential)
        case scan
        case settings
        case profile
        case issuerConnections
        case applyWithCredential(VerifiableCredential)

        var id: String {
            switch self {
            case .credentialDetail(let cred): return "credential-\(cred.id)"
            case .qrShare(let cred): return "qr-\(cred.id)"
            case .scan: return "scan"
            case .settings: return "settings"
            case .profile: return "profile"
            case .issuerConnections: return "issuer-connections"
            case .applyWithCredential(let cred): return "apply-\(cred.id)"
            }
        }
    }

    enum FullScreenDestination: Identifiable {
        case qrScanner
        case verification
        case onboarding

        var id: String {
            switch self {
            case .qrScanner: return "qr-scanner"
            case .verification: return "verification"
            case .onboarding: return "onboarding"
            }
        }
    }

    private init() {}

    func navigate(to destination: SheetDestination) {
        presentedSheet = destination
    }

    func presentFullScreen(_ destination: FullScreenDestination) {
        presentedFullScreenCover = destination
    }

    func dismissSheet() {
        presentedSheet = nil
    }

    func dismissFullScreen() {
        presentedFullScreenCover = nil
    }

    func navigateBack() {
        if !path.isEmpty {
            path.removeLast()
        }
    }

    func navigateToRoot() {
        path.removeLast(path.count)
    }
}








