//
//  NavigationCoordinator.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 1
//  Navigation coordination for deep links and routing
//

import SwiftUI
import Combine

@MainActor
class NavigationCoordinator: ObservableObject {
    static let shared = NavigationCoordinator()

    @Published var navigationPath = NavigationPath()
    @Published var presentedSheet: SheetDestination?
    @Published var presentedFullScreenCover: FullScreenDestination?

    private var cancellables = Set<AnyCancellable>()

    private init() {}

    // MARK: - Navigation

    func navigate(to destination: NavigationDestination) {
        navigationPath.append(destination)
    }

    func pop() {
        if !navigationPath.isEmpty {
            navigationPath.removeLast()
        }
    }

    func popToRoot() {
        navigationPath.removeLast(navigationPath.count)
    }

    // MARK: - Sheets

    func presentSheet(_ destination: SheetDestination) {
        presentedSheet = destination
    }

    func dismissSheet() {
        presentedSheet = nil
    }

    // MARK: - Full Screen

    func presentFullScreen(_ destination: FullScreenDestination) {
        presentedFullScreenCover = destination
    }

    func dismissFullScreen() {
        presentedFullScreenCover = nil
    }

    // MARK: - Deep Links

    func handleDeepLink(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return
        }

        switch components.host {
        case "credential":
            if let credentialId = components.queryItems?.first(where: { $0.name == "id" })?.value {
                navigate(to: .credentialDetail(id: credentialId))
            }
        case "verify":
            if let credentialId = components.queryItems?.first(where: { $0.name == "id" })?.value {
                navigate(to: .verifyCredential(id: credentialId))
            }
        case "scan":
            presentSheet(.scan)
        case "job":
            if let jobId = components.queryItems?.first(where: { $0.name == "id" })?.value {
                navigate(to: .jobApplication(id: jobId))
            }
        default:
            break
        }
    }
}

// MARK: - Navigation Destinations

enum NavigationDestination: Hashable {
    case credentialDetail(id: String)
    case verifyCredential(id: String)
    case jobApplication(id: String)
    case recruiterConnect
    case allCredentials
    case settings
}

// MARK: - Sheet Destinations

enum SheetDestination: Identifiable {
    case scan
    case qrShare(credential: VerifiableCredential)
    case selectiveDisclosure(credential: VerifiableCredential)
    case didBackup(did: String)
    case recruiterConnect(id: String)
    case credentialOffer(url: URL) // Phase 1 - Task 4
    case settings
    case zkAuthorize(url: URL) // Zero-Knowledge Authorization Engine - Phase 1 - Task 8

    var id: String {
        switch self {
        case .scan:
            return "scan"
        case .qrShare:
            return "qrShare"
        case .selectiveDisclosure:
            return "selectiveDisclosure"
        case .didBackup:
            return "didBackup"
        case .recruiterConnect:
            return "recruiterConnect"
        case .credentialOffer:
            return "credentialOffer"
        case .settings:
            return "settings"
        case .zkAuthorize:
            return "zkAuthorize"
        }
    }
}

// MARK: - Full Screen Destinations

enum FullScreenDestination: Identifiable {
    case onboarding
    case biometricSetup

    var id: String {
        switch self {
        case .onboarding:
            return "onboarding"
        case .biometricSetup:
            return "biometricSetup"
        }
    }
}

