//
//  NavigationRouter.swift
//  VitalCVWallet
//
//  Created: Batch 140-A - Task 6
//  Navigation router with screen enums for unified routing
//

import SwiftUI

/// NavigationRouter - Unified navigation routing system
/// Provides screen enums and routing logic for app navigation
@MainActor
class NavigationRouter: ObservableObject {
    static let shared = NavigationRouter()

    @Published var currentScreen: AppScreen = .wallet
    @Published var navigationPath = NavigationPath()
    @Published var selectedTab: MainTab = .wallet

    private init() {}

    /// Navigate to a specific screen
    func navigate(to screen: AppScreen) {
        currentScreen = screen

        // Update tab selection if applicable
        if let tab = MainTab.from(screen: screen) {
            selectedTab = tab
        }

        // Add to navigation path if it's a detail screen
        if screen.isDetailScreen {
            navigationPath.append(screen)
        }
    }

    /// Navigate back
    func goBack() {
        if !navigationPath.isEmpty {
            navigationPath.removeLast()
        }
    }

    /// Navigate to root
    func goToRoot() {
        navigationPath.removeLast(navigationPath.count)
        currentScreen = .wallet
        selectedTab = .wallet
    }

    /// Switch to a main tab
    func switchTab(_ tab: MainTab) {
        selectedTab = tab
        currentScreen = tab.defaultScreen
    }
}

// MARK: - App Screen Enum

/// AppScreen - All possible screens in the app
enum AppScreen: Hashable, Identifiable {
    case wallet
    case walletDetail(credentialId: String)
    case verify
    case verifyResult(credentialId: String)
    case jobs
    case jobDetail(jobId: String)
    case jobApplication(jobId: String)
    case settings
    case settingsDetail(setting: SettingSection)
    case credentialOffer(url: URL)
    case recruiter
    case recruiterCandidate(candidateId: String)
    case scan
    case onboarding
    case scheduler(shiftId: String) // Phase 5 - Task 38
    case resume

    var id: String {
        switch self {
        case .wallet:
            return "wallet"
        case .walletDetail(let id):
            return "walletDetail-\(id)"
        case .verify:
            return "verify"
        case .verifyResult(let id):
            return "verifyResult-\(id)"
        case .jobs:
            return "jobs"
        case .jobDetail(let id):
            return "jobDetail-\(id)"
        case .jobApplication(let id):
            return "jobApplication-\(id)"
        case .settings:
            return "settings"
        case .settingsDetail(let setting):
            return "settingsDetail-\(setting.id)"
        case .credentialOffer(let url):
            return "credentialOffer-\(url.absoluteString)"
        case .recruiter:
            return "recruiter"
        case .recruiterCandidate(let id):
            return "recruiterCandidate-\(id)"
        case .scan:
            return "scan"
        case .onboarding:
            return "onboarding"
        case .scheduler(let shiftId):
            return "scheduler-\(shiftId)"
        case .resume:
            return "resume"
        }
    }

    var isDetailScreen: Bool {
        switch self {
        case .wallet, .verify, .jobs, .settings, .recruiter, .scan, .onboarding, .scheduler, .resume:
            return false
        default:
            return true
        }
    }

    var title: String {
        switch self {
        case .wallet:
            return "Wallet"
        case .walletDetail:
            return "Credential"
        case .verify:
            return "Verify"
        case .verifyResult:
            return "Verification Result"
        case .jobs:
            return "Jobs"
        case .jobDetail:
            return "Job Details"
        case .jobApplication:
            return "Apply"
        case .settings:
            return "Settings"
        case .settingsDetail(let setting):
            return setting.title
        case .credentialOffer:
            return "Credential Offer"
        case .recruiter:
            return "Recruiter"
        case .recruiterCandidate:
            return "Candidate"
        case .scan:
            return "Scan"
        case .onboarding:
            return "Welcome"
        case .scheduler:
            return "Scheduler"
        case .resume:
            return "Smart Resume"
        }
    }
}

// MARK: - Main Tab Enum

/// MainTab - Main tab bar tabs
enum MainTab: String, CaseIterable, Identifiable {
    case wallet = "Wallet"
    case verify = "Verify"
    case jobs = "Jobs"
    case settings = "Settings"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .wallet:
            return "wallet.fill"
        case .verify:
            return "checkmark.shield.fill"
        case .jobs:
            return "briefcase.fill"
        case .settings:
            return "gearshape.fill"
        }
    }

    var defaultScreen: AppScreen {
        switch self {
        case .wallet:
            return .wallet
        case .verify:
            return .verify
        case .jobs:
            return .jobs
        case .settings:
            return .settings
        }
    }

    static func from(screen: AppScreen) -> MainTab? {
        switch screen {
        case .wallet, .walletDetail:
            return .wallet
        case .verify, .verifyResult:
            return .verify
        case .jobs, .jobDetail, .jobApplication:
            return .jobs
        case .settings, .settingsDetail:
            return .settings
        default:
            return nil
        }
    }
}

// MARK: - Setting Section

enum SettingSection: String, Identifiable, Hashable {
    case profile = "Profile"
    case security = "Security"
    case privacy = "Privacy"
    case notifications = "Notifications"
    case about = "About"

    var id: String { rawValue }
    var title: String { rawValue }
}

