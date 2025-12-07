//
//  AppIdentityContext.swift
//  VitalCVWallet
//
//  Created: Batch 138-A - Task 1
//  Multi-role state switching context
//

import Foundation
import SwiftUI
import Combine

/// AppIdentityContext - Manages multi-role identity state and switching
@MainActor
public class AppIdentityContext: ObservableObject {
    public static let shared = AppIdentityContext()

    // MARK: - Published State

    /// Current active role
    @Published public var currentRole: UserRole?

    /// All available roles for the current user
    @Published public var availableRoles: [UserRole] = []

    /// Role-specific DID mappings
    @Published public var roleDIDs: [UserRole: String] = [:]

    /// Role-specific credential sets
    @Published public var roleCredentials: [UserRole: [VerifiableCredential]] = [:]

    /// Role switching in progress
    @Published public var isSwitchingRole: Bool = false

    /// Role-specific trust scores
    @Published public var roleTrustScores: [UserRole: Double] = [:]

    /// Role-specific permissions
    @Published public var rolePermissions: [UserRole: Set<String>] = [:]

    // MARK: - Private State

    private var cancellables = Set<AnyCancellable>()
    private let persistenceKey = "app_identity_context"

    // MARK: - Initialization

    private init() {
        loadPersistedState()
        setupObservers()
    }

    // MARK: - Public API

    /// Switch to a different role
    public func switchToRole(_ role: UserRole) async throws {
        guard availableRoles.contains(role) else {
            throw AppIdentityError.roleNotAvailable
        }

        guard currentRole != role else { return }

        isSwitchingRole = true
        defer { isSwitchingRole = false }

        // Save current role state
        if let current = currentRole {
            await saveRoleState(current)
        }

        // Load new role state
        await loadRoleState(role)

        // Update current role
        currentRole = role

        // Persist context
        persistState()

        // Notify observers
        NotificationCenter.default.post(
            name: .roleDidChange,
            object: nil,
            userInfo: ["role": role]
        )
    }

    /// Add a role to available roles
    public func addRole(_ role: UserRole, did: String? = nil) {
        guard !availableRoles.contains(role) else { return }

        availableRoles.append(role)

        if let did = did {
            roleDIDs[role] = did
        }

        // If no current role, set this as current
        if currentRole == nil {
            currentRole = role
        }

        persistState()
    }

    /// Remove a role
    public func removeRole(_ role: UserRole) {
        availableRoles.removeAll { $0 == role }
        roleDIDs.removeValue(forKey: role)
        roleCredentials.removeValue(forKey: role)
        roleTrustScores.removeValue(forKey: role)
        rolePermissions.removeValue(forKey: role)

        // If removing current role, switch to first available
        if currentRole == role {
            currentRole = availableRoles.first
        }

        persistState()
    }

    /// Get credentials for current role
    public var currentRoleCredentials: [VerifiableCredential] {
        guard let role = currentRole else { return [] }
        return roleCredentials[role] ?? []
    }

    /// Get DID for current role
    public var currentRoleDID: String? {
        guard let role = currentRole else { return nil }
        return roleDIDs[role]
    }

    /// Get trust score for current role
    public var currentRoleTrustScore: Double {
        guard let role = currentRole else { return 0.0 }
        return roleTrustScores[role] ?? 0.0
    }

    /// Update credentials for a role
    public func updateCredentials(_ credentials: [VerifiableCredential], for role: UserRole) {
        roleCredentials[role] = credentials
        persistState()
    }

    /// Update trust score for a role
    public func updateTrustScore(_ score: Double, for role: UserRole) {
        roleTrustScores[role] = max(0.0, min(1.0, score))
        persistState()
    }

    /// Update permissions for a role
    public func updatePermissions(_ permissions: Set<String>, for role: UserRole) {
        rolePermissions[role] = permissions
        persistState()
    }

    /// Check if role has permission
    public func hasPermission(_ permission: String, for role: UserRole? = nil) -> Bool {
        let targetRole = role ?? currentRole
        guard let role = targetRole else { return false }
        return rolePermissions[role]?.contains(permission) ?? false
    }

    // MARK: - Private Methods

    private func setupObservers() {
        // Observe credential updates
        NotificationCenter.default.publisher(for: .credentialsDidUpdate)
            .sink { [weak self] notification in
                guard let self = self,
                      let role = self.currentRole,
                      let credentials = notification.userInfo?["credentials"] as? [VerifiableCredential] else {
                    return
                }
                self.updateCredentials(credentials, for: role)
            }
            .store(in: &cancellables)
    }

    private func saveRoleState(_ role: UserRole) async {
        // Save role-specific state to persistent storage
        // This could include credentials, preferences, etc.
    }

    private func loadRoleState(_ role: UserRole) async {
        // Load role-specific state from persistent storage
        // This could include credentials, preferences, etc.
    }

    private func persistState() {
        let context = IdentityContextPersistence(
            currentRole: currentRole,
            availableRoles: availableRoles,
            roleDIDs: roleDIDs,
            roleTrustScores: roleTrustScores
        )

        if let encoded = try? JSONEncoder().encode(context) {
            UserDefaults.standard.set(encoded, forKey: persistenceKey)
        }
    }

    private func loadPersistedState() {
        guard let data = UserDefaults.standard.data(forKey: persistenceKey),
              let context = try? JSONDecoder().decode(IdentityContextPersistence.self, from: data) else {
            return
        }

        currentRole = context.currentRole
        availableRoles = context.availableRoles
        roleDIDs = context.roleDIDs
        roleTrustScores = context.roleTrustScores
    }
}

// MARK: - Supporting Types

private struct IdentityContextPersistence: Codable {
    let currentRole: UserRole?
    let availableRoles: [UserRole]
    let roleDIDs: [String: String] // UserRole rawValue -> DID
    let roleTrustScores: [String: Double] // UserRole rawValue -> Score

    enum CodingKeys: String, CodingKey {
        case currentRole
        case availableRoles
        case roleDIDs
        case roleTrustScores
    }

    init(currentRole: UserRole?, availableRoles: [UserRole], roleDIDs: [UserRole: String], roleTrustScores: [UserRole: Double]) {
        self.currentRole = currentRole
        self.availableRoles = availableRoles
        self.roleDIDs = Dictionary(uniqueKeysWithValues: roleDIDs.map { ($0.rawValue, $1) })
        self.roleTrustScores = Dictionary(uniqueKeysWithValues: roleTrustScores.map { ($0.rawValue, $1) })
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let currentRoleRaw = try? container.decode(String.self, forKey: .currentRole)
        currentRole = currentRoleRaw.flatMap { UserRole(rawValue: $0) }
        let availableRolesRaw = try container.decode([String].self, forKey: .availableRoles)
        availableRoles = availableRolesRaw.compactMap { UserRole(rawValue: $0) }

        let roleDIDsDict = try container.decode([String: String].self, forKey: .roleDIDs)
        var roleDIDsMap: [UserRole: String] = [:]
        for (key, value) in roleDIDsDict {
            if let role = UserRole(rawValue: key) {
                roleDIDsMap[role] = value
            }
        }
        roleDIDs = roleDIDsMap

        let roleTrustScoresDict = try container.decode([String: Double].self, forKey: .roleTrustScores)
        var roleTrustScoresMap: [UserRole: Double] = [:]
        for (key, value) in roleTrustScoresDict {
            if let role = UserRole(rawValue: key) {
                roleTrustScoresMap[role] = value
            }
        }
        roleTrustScores = roleTrustScoresMap
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(currentRole?.rawValue, forKey: .currentRole)
        try container.encode(availableRoles.map { $0.rawValue }, forKey: .availableRoles)
        try container.encode(Dictionary(uniqueKeysWithValues: roleDIDs.map { ($0.rawValue, $1) }), forKey: .roleDIDs)
        try container.encode(Dictionary(uniqueKeysWithValues: roleTrustScores.map { ($0.rawValue, $1) }), forKey: .roleTrustScores)
    }
}

enum AppIdentityError: LocalizedError {
    case roleNotAvailable
    case roleSwitchFailed

    var errorDescription: String? {
        switch self {
        case .roleNotAvailable:
            return "The requested role is not available for this user"
        case .roleSwitchFailed:
            return "Failed to switch roles"
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let roleDidChange = Notification.Name("roleDidChange")
    static let credentialsDidUpdate = Notification.Name("credentialsDidUpdate")
}




