//
//  AppStateContainer.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 5
//  Global UI state container using Combine
//

import Foundation
import Combine

@MainActor
class AppStateContainer: ObservableObject {
    static let shared = AppStateContainer()

    // Authentication state
    @Published var isAuthenticated: Bool = false
    @Published var currentUserDid: String?
    @Published var biometricEnabled: Bool = false

    // Wallet state
    @Published var credentials: [VerifiableCredential] = []
    @Published var selectedCredential: VerifiableCredential?
    @Published var isLoading: Bool = false

    // UI state
    @Published var activeTab: TabSelection = .home
    @Published var showingCredentialDetail: Bool = false
    @Published var showingQRShare: Bool = false

    // Network state
    @Published var isOnline: Bool = true
    @Published var lastSyncDate: Date?

    private var cancellables = Set<AnyCancellable>()

    private init() {
        loadPersistedState()
        setupObservers()
    }

    private func loadPersistedState() {
        // Load persisted authentication state from Keychain
        if let did = KeychainService.shared.loadDID() {
            currentUserDid = did
            isAuthenticated = true
        }
    }

    private func setupObservers() {
        // Observe network connectivity
        NotificationCenter.default.publisher(for: .networkStatusChanged)
            .sink { [weak self] notification in
                if let isOnline = notification.userInfo?["isOnline"] as? Bool {
                    self?.isOnline = isOnline
                }
            }
            .store(in: &cancellables)
    }

    func authenticate(did: String) {
        currentUserDid = did
        isAuthenticated = true
        KeychainService.shared.saveDID(did)
    }

    func logout() {
        isAuthenticated = false
        currentUserDid = nil
        credentials = []
        KeychainService.shared.deleteDID()
    }

    func addCredential(_ credential: VerifiableCredential) {
        credentials.append(credential)
        persistCredentials()
    }

    func removeCredential(_ credential: VerifiableCredential) {
        credentials.removeAll { $0.id == credential.id }
        persistCredentials()
    }

    private func persistCredentials() {
        // Persist credentials to secure storage
        if let encoded = try? JSONEncoder().encode(credentials) {
            KeychainService.shared.saveCredentials(encoded)
        }
    }
}

enum TabSelection {
    case home
    case credentials
    case scan
    case profile
}

