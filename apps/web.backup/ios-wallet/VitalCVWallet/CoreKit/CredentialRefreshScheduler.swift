//
//  CredentialRefreshScheduler.swift
//  VitalCVWallet
//
//  Created: Batch 566 - Task 4
//  CredentialRefreshScheduler for automatic credential updates
//

import Foundation
import Combine

/// CredentialRefreshScheduler - Manages automatic credential refresh
public class CredentialRefreshScheduler {
    public static let shared = CredentialRefreshScheduler()

    private var refreshTimers: [String: Timer] = [:]
    private var cancellables = Set<AnyCancellable>()
    private let walletCore = WalletCore.shared

    private init() {
        // Start monitoring credentials
        startMonitoring()
    }

    // MARK: - Scheduling

    /// Schedule refresh for a credential
    public func scheduleRefresh(
        for credentialId: String,
        refreshInterval: TimeInterval = 24 * 60 * 60, // Default: 24 hours
        immediate: Bool = false
    ) {
        // Cancel existing timer if any
        cancelRefresh(for: credentialId)

        // Immediate refresh if requested
        if immediate {
            Task {
                await refreshCredential(credentialId)
            }
        }

        // Schedule periodic refresh
        let timer = Timer.scheduledTimer(withTimeInterval: refreshInterval, repeats: true) { [weak self] _ in
            Task { [weak self] in
                await self?.refreshCredential(credentialId)
            }
        }

        refreshTimers[credentialId] = timer
    }

    /// Cancel refresh for a credential
    public func cancelRefresh(for credentialId: String) {
        refreshTimers[credentialId]?.invalidate()
        refreshTimers.removeValue(forKey: credentialId)
    }

    /// Refresh all scheduled credentials
    public func refreshAll() async {
        let credentialIds = Array(refreshTimers.keys)
        await withTaskGroup(of: Void.self) { group in
            for credentialId in credentialIds {
                group.addTask {
                    await self.refreshCredential(credentialId)
                }
            }
        }
    }

    // MARK: - Credential Refresh

    private func refreshCredential(_ credentialId: String) async {
        guard let credential = await walletCore.getCredential(id: credentialId) else {
            // Credential no longer exists, cancel refresh
            await MainActor.run {
                cancelRefresh(for: credentialId)
            }
            return
        }

        // Check if refresh is needed
        guard shouldRefresh(credential) else {
            return
        }

        do {
            // Fetch updated credential from issuer
            let updatedCredential = try await fetchUpdatedCredential(credential)

            // Update in wallet
            await walletCore.updateCredential(updatedCredential)

            // Log refresh
            Logger.shared.logInfo("Credential refreshed: \(credentialId)")

        } catch {
            // Log error but don't cancel schedule
            Logger.shared.logError(error, context: "Credential refresh: \(credentialId)")
        }
    }

    private func shouldRefresh(_ credential: VerifiableCredential) -> Bool {
        // Refresh if expiring soon (within 30 days)
        if credential.isExpiringSoon {
            return true
        }

        // Refresh if expired
        if credential.isExpired {
            return true
        }

        // Refresh if last refresh was more than 7 days ago
        if let lastRefresh = getLastRefreshDate(for: credential.id) {
            let daysSinceRefresh = Calendar.current.dateComponents([.day], from: lastRefresh, to: Date()).day ?? 0
            return daysSinceRefresh >= 7
        }

        // First refresh
        return true
    }

    private func fetchUpdatedCredential(_ credential: VerifiableCredential) async throws -> VerifiableCredential {
        // Fetch from issuer endpoint
        // This would integrate with the issuer's refresh endpoint
        let networkService = NetworkService.shared

        // For now, return the credential as-is
        // In production, this would make an API call to refresh
        return credential
    }

    // MARK: - Monitoring

    private func startMonitoring() {
        // Monitor app state changes
        NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
            .sink { [weak self] _ in
                Task {
                    await self?.refreshAll()
                }
            }
            .store(in: &cancellables)

        // Monitor credential additions
        // This would integrate with WalletCore to observe credential changes
    }

    // MARK: - Refresh History

    private func getLastRefreshDate(for credentialId: String) -> Date? {
        let key = "credential_refresh_\(credentialId)"
        return UserDefaults.standard.object(forKey: key) as? Date
    }

    private func saveRefreshDate(for credentialId: String) {
        let key = "credential_refresh_\(credentialId)"
        UserDefaults.standard.set(Date(), forKey: key)
    }
}

// MARK: - Logger Extension

extension Logger {
    static let shared = Logger()

    func logInfo(_ message: String) {
        print("[INFO] \(message)")
    }

    func logError(_ error: Error, context: String) {
        print("[ERROR] \(context): \(error.localizedDescription)")
    }
}

class Logger {
    static let shared = Logger()

    func logInfo(_ message: String) {
        print("[INFO] \(message)")
    }

    func logError(_ error: Error, context: String) {
        print("[ERROR] \(context): \(error.localizedDescription)")
    }
}

