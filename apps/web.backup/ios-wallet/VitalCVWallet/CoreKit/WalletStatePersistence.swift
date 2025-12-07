//
//  WalletStatePersistence.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 5
//  Wallet-state persistence with autosave
//

import Foundation
import Combine

/// WalletStatePersistence - Manages wallet state persistence with autosave
@MainActor
public class WalletStatePersistence: ObservableObject {
    public static let shared = WalletStatePersistence()

    // MARK: - State

    @Published public var credentials: [VerifiableCredential] = []
    @Published public var lastSavedDate: Date?
    @Published public var isDirty: Bool = false

    // MARK: - Configuration

    private let autosaveInterval: TimeInterval = 5.0 // 5 seconds
    private let persistenceURL: URL

    private var autosaveTimer: Timer?
    private var cancellables = Set<AnyCancellable>()

    private init() {
        // Setup persistence URL
        guard let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            fatalError("Unable to access documents directory")
        }
        self.persistenceURL = documentsURL.appendingPathComponent("wallet_state.json")

        setupAutosave()
        loadState()
    }

    // MARK: - State Management

    /// Add credential and mark as dirty
    public func addCredential(_ credential: VerifiableCredential) {
        credentials.append(credential)
        isDirty = true
        triggerAutosave()
    }

    /// Remove credential and mark as dirty
    public func removeCredential(_ credential: VerifiableCredential) {
        credentials.removeAll { $0.id == credential.id }
        isDirty = true
        triggerAutosave()
    }

    /// Update credential and mark as dirty
    public func updateCredential(_ credential: VerifiableCredential) {
        if let index = credentials.firstIndex(where: { $0.id == credential.id }) {
            credentials[index] = credential
            isDirty = true
            triggerAutosave()
        }
    }

    /// Replace all credentials
    public func setCredentials(_ newCredentials: [VerifiableCredential]) {
        credentials = newCredentials
        isDirty = true
        triggerAutosave()
    }

    /// Save state immediately
    public func save() async throws {
        try await performSave()
    }

    // MARK: - Persistence

    private func loadState() {
        guard FileManager.default.fileExists(atPath: persistenceURL.path) else {
            return
        }

        do {
            let data = try Data(contentsOf: persistenceURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601

            let state = try decoder.decode(PersistedWalletState.self, from: data)
            self.credentials = state.credentials
            self.lastSavedDate = state.savedAt
            self.isDirty = false
        } catch {
            print("Failed to load wallet state: \(error.localizedDescription)")
        }
    }

    private func performSave() async throws {
        let state = PersistedWalletState(
            credentials: credentials,
            savedAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted

        let data = try encoder.encode(state)
        try data.write(to: persistenceURL, options: .atomic)

        await MainActor.run {
            lastSavedDate = Date()
            isDirty = false
        }
    }

    // MARK: - Autosave

    private func setupAutosave() {
        // Observe state changes
        $credentials
            .dropFirst()
            .sink { [weak self] _ in
                Task { @MainActor in
                    self?.isDirty = true
                    self?.triggerAutosave()
                }
            }
            .store(in: &cancellables)

        // Setup periodic autosave
        autosaveTimer = Timer.scheduledTimer(withTimeInterval: autosaveInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.autosaveIfNeeded()
            }
        }
    }

    private func triggerAutosave() {
        // Debounce autosave - will save after autosaveInterval
        Task {
            try? await Task.sleep(nanoseconds: UInt64(autosaveInterval * 1_000_000_000))
            await autosaveIfNeeded()
        }
    }

    private func autosaveIfNeeded() async {
        guard isDirty else { return }

        do {
            try await performSave()
        } catch {
            print("Autosave failed: \(error.localizedDescription)")
        }
    }

    /// Force immediate save (useful before app termination)
    public func forceSave() async {
        do {
            try await performSave()
        } catch {
            print("Force save failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Backup & Restore

    /// Export wallet state for backup
    public func exportState() throws -> Data {
        let state = PersistedWalletState(
            credentials: credentials,
            savedAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted

        return try encoder.encode(state)
    }

    /// Import wallet state from backup
    public func importState(from data: Data) throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let state = try decoder.decode(PersistedWalletState.self, from: data)
        self.credentials = state.credentials
        self.isDirty = true

        // Save imported state
        Task {
            try await save()
        }
    }

    /// Clear all persisted state
    public func clearState() {
        credentials = []
        isDirty = true

        // Delete persistence file
        try? FileManager.default.removeItem(at: persistenceURL)

        // Save empty state
        Task {
            try? await save()
        }
    }
}

// MARK: - Persisted State Model

private struct PersistedWalletState: Codable {
    let credentials: [VerifiableCredential]
    let savedAt: Date
}

// MARK: - Chain Anchor Service (Placeholder)

public class ChainAnchorService {
    public static let shared = ChainAnchorService()

    private init() {}

    public func initialize() async {
        // Initialize chain service
    }

    public func checkAnchorStatus(anchorId: String) async throws -> ChainAnchorStatus {
        // Check anchor status on chain
        return ChainAnchorStatus.confirmed
    }

    public func anchorCredential(_ credential: VerifiableCredential) async throws -> ChainAnchor {
        // Anchor credential to chain
        return ChainAnchor(
            id: UUID().uuidString,
            credentialId: credential.id,
            txHash: "0x\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))",
            blockNumber: 12345,
            timestamp: Date()
        )
    }
}

public struct ChainAnchor {
    public let id: String
    public let credentialId: String
    public let txHash: String
    public let blockNumber: Int
    public let timestamp: Date
}

public enum ChainAnchorStatus {
    case pending
    case confirmed
    case failed
    case unknown
}

// MARK: - Model Extensions

extension VerifiableCredential {
    var chainAnchorId: String? {
        // Extract chain anchor ID from credential evidence or claims
        // In production, this would be stored in a metadata field
        return evidence?.first(where: { $0.type == "chainAnchor" })?.id
    }
}

