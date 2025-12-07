//
//  VitalCVKit.swift
//  VitalCVWallet
//
//  Created: Batch 551 - Task 1
//  VitalCVKit module for shared mobile core logic
//

import Foundation
import SwiftUI
import Combine

/// VitalCVKit - Shared mobile core logic module
/// Provides unified access to core services, utilities, and shared functionality
@MainActor
public enum VitalCVKit {

    // MARK: - Core Services

    /// Network service for API communication
    public static let network = AsyncNetworkService.shared

    /// DID service for identity management
    public static let did = DIDService.shared

    /// Keychain service for secure storage
    public static let keychain = KeychainService.shared

    /// Security service for device integrity checks
    public static let security = SecurityService.shared

    /// Error handler for unified error management
    public static let errorHandler = ErrorHandler.shared

    /// Network reachability monitor
    public static let reachability = NetworkReachabilityMonitor.shared

    // MARK: - Configuration

    /// Configure VitalCVKit with custom settings
    public static func configure(
        apiBaseURL: String? = nil,
        enableDebugLogging: Bool = false
    ) {
        if let apiBaseURL = apiBaseURL {
            AsyncNetworkService.shared.baseURL = apiBaseURL
        }

        if enableDebugLogging {
            Logger.shared.enableDebugMode()
        }
    }

    // MARK: - Initialization

    /// Initialize VitalCVKit (call on app launch)
    public static func initialize() async {
        await reachability.startMonitoring()
        await security.initialize()
    }

    // MARK: - Cleanup

    /// Cleanup resources (call on app termination)
    public static func cleanup() {
        reachability.stopMonitoring()
    }
}

// MARK: - Logger

public class Logger {
    public static let shared = Logger()

    private var debugModeEnabled = false

    private init() {}

    public func enableDebugMode() {
        debugModeEnabled = true
    }

    public func log(_ message: String, level: LogLevel = .info) {
        guard debugModeEnabled || level != .debug else { return }

        let prefix = level.emoji
        print("\(prefix) [VitalCVKit] \(message)")
    }

    public func logError(_ error: Error, context: String? = nil) {
        let contextMsg = context.map { " in \($0)" } ?? ""
        log("Error\(contextMsg): \(error.localizedDescription)", level: .error)
    }
}

public enum LogLevel {
    case debug, info, warning, error

    var emoji: String {
        switch self {
        case .debug: return "🔍"
        case .info: return "ℹ️"
        case .warning: return "⚠️"
        case .error: return "❌"
        }
    }
}

