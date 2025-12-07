//
//  WalletHomeViewModel.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 2
//  Updated: ARC A - Task 1
//  MVVM ViewModel for wallet home with WalletStateStore integration
//

import Foundation
import Combine
import SwiftUI

@MainActor
class WalletHomeViewModel: ObservableObject {
    // MARK: - Published State

    @Published var credentialItems: [CredentialListItem] = []
    @Published var isLoading: Bool = false
    @Published var syncError: Error?
    @Published var selectedFilter: CredentialFilter = .all
    @Published var searchText: String = ""
    @Published var groupedCredentials: [(category: CredentialCategory, items: [CredentialListItem])] = []

    // MARK: - Private Properties

    private let walletStateStore = WalletStateStore.shared
    private var cancellables = Set<AnyCancellable>()

    enum CredentialFilter: String, CaseIterable {
        case all = "All"
        case active = "Active"
        case expiring = "Expiring"
        case revoked = "Revoked"

        var id: String { rawValue }
    }

    // MARK: - Initialization

    init() {
        // Observe wallet state store
        walletStateStore.$credentials
            .map { credentials in
                credentials.map { credential in
                    CredentialListItem(from: credential)
                }
            }
            .assign(to: \.credentialItems, on: self)
            .store(in: &cancellables)

        // Observe loading state
        walletStateStore.$isLoading
            .assign(to: \.isLoading, on: self)
            .store(in: &cancellables)

        // Observe sync errors
        walletStateStore.$lastSyncError
            .assign(to: \.syncError, on: self)
            .store(in: &cancellables)

        // Update grouped credentials when items or filter changes
        Publishers.CombineLatest($credentialItems, $selectedFilter)
            .map { [weak self] items, filter in
                self?.applyFilter(items, filter: filter) ?? []
            }
            .map { $0.groupedAndSorted() }
            .assign(to: \.groupedCredentials, on: self)
            .store(in: &cancellables)

        // Initial sync
        Task {
            await walletStateStore.syncWithBackend()
        }
    }

    // MARK: - Filtering

    private func applyFilter(_ items: [CredentialListItem], filter: CredentialFilter) -> [CredentialListItem] {
        switch filter {
        case .all:
            return items
        case .active:
            return items.filter { !$0.isExpired }
        case .expiring:
            return items.filter { $0.isExpiringSoon }
        case .revoked:
            // TODO: Add revoked status to CredentialListItem when backend supports it
            return []
        }
    }

    // MARK: - Actions

    func refresh() async {
        await walletStateStore.syncWithBackend()
    }

    func startPeriodicSync() {
        walletStateStore.startPeriodicSync()
    }

    func stopPeriodicSync() {
        walletStateStore.stopPeriodicSync()
    }

    // MARK: - Task 29: Global Search with Debounce

    @Published var debouncedSearchText: String = ""
    private var searchDebounceTimer: Timer?

    init() {
        // Observe wallet state store
        walletStateStore.$credentials
            .map { credentials in
                credentials.map { credential in
                    CredentialListItem(from: credential)
                }
            }
            .assign(to: \.credentialItems, on: self)
            .store(in: &cancellables)

        // Observe loading state
        walletStateStore.$isLoading
            .assign(to: \.isLoading, on: self)
            .store(in: &cancellables)

        // Observe sync errors
        walletStateStore.$lastSyncError
            .assign(to: \.syncError, on: self)
            .store(in: &cancellables)

        // Task 29: Debounced search
        $searchText
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .assign(to: \.debouncedSearchText, on: self)
            .store(in: &cancellables)

        // Update grouped credentials when items or filter changes
        Publishers.CombineLatest3($credentialItems, $selectedFilter, $debouncedSearchText)
            .map { [weak self] items, filter, search in
                var filtered = self?.applyFilter(items, filter: filter) ?? []

                // Apply search filter
                if !search.isEmpty {
                    let query = search.lowercased()
                    filtered = filtered.filter { item in
                        item.title.lowercased().contains(query) ||
                        item.subtitle.lowercased().contains(query) ||
                        item.issuerName.lowercased().contains(query)
                    }
                }

                return filtered
            }
            .map { $0.groupedAndSorted() }
            .assign(to: \.groupedCredentials, on: self)
            .store(in: &cancellables)

        // Initial sync
        Task {
            await walletStateStore.syncWithBackend()
        }
    }

    // MARK: - Task 30: Filtering by Category (already in grouping)
    // Task 31: Sorting by "most important first" (already in groupedAndSorted)

    // MARK: - Task 32: Recently Verified Section

    var recentlyVerified: [CredentialListItem] {
        credentialItems
            .filter { $0.lastVerifiedDate != nil }
            .sorted { ($0.lastVerifiedDate ?? Date.distantPast) > ($1.lastVerifiedDate ?? Date.distantPast) }
            .prefix(5)
            .map { $0 }
    }

    // MARK: - Search

    var filteredBySearch: [CredentialListItem] {
        guard !debouncedSearchText.isEmpty else { return credentialItems }

        let query = debouncedSearchText.lowercased()
        return credentialItems.filter { item in
            item.title.lowercased().contains(query) ||
            item.subtitle.lowercased().contains(query) ||
            item.issuerName.lowercased().contains(query)
        }
    }
}

