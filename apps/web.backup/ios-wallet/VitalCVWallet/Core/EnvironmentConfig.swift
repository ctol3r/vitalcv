//
//  EnvironmentConfig.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 4
//  Global environment configuration
//

import Foundation

struct EnvironmentConfig {
    static let shared = EnvironmentConfig()

    let environment: Environment
    let apiBaseURL: String
    let apiTimeout: TimeInterval
    let enableDebugLogging: Bool
    let enableAnalytics: Bool
    let maxCacheSize: Int
    let credentialRefreshInterval: TimeInterval

    enum Environment: String {
        case development = "development"
        case staging = "staging"
        case production = "production"

        var displayName: String {
            switch self {
            case .development: return "Development"
            case .staging: return "Staging"
            case .production: return "Production"
            }
        }
    }

    private init() {
        // Determine environment from build configuration or environment variable
        if let envString = ProcessInfo.processInfo.environment["APP_ENV"] {
            self.environment = Environment(rawValue: envString) ?? .development
        } else {
            #if DEBUG
            self.environment = .development
            #else
            self.environment = .production
            #endif
        }

        // Configure based on environment
        switch self.environment {
        case .development:
            self.apiBaseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:4000"
            self.apiTimeout = 60.0
            self.enableDebugLogging = true
            self.enableAnalytics = false
            self.maxCacheSize = 50 * 1024 * 1024 // 50MB
            self.credentialRefreshInterval = 300 // 5 minutes

        case .staging:
            self.apiBaseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "https://api-staging.vitalcv.com"
            self.apiTimeout = 30.0
            self.enableDebugLogging = true
            self.enableAnalytics = true
            self.maxCacheSize = 100 * 1024 * 1024 // 100MB
            self.credentialRefreshInterval = 600 // 10 minutes

        case .production:
            self.apiBaseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "https://api.vitalcv.com"
            self.apiTimeout = 30.0
            self.enableDebugLogging = false
            self.enableAnalytics = true
            self.maxCacheSize = 100 * 1024 * 1024 // 100MB
            self.credentialRefreshInterval = 3600 // 1 hour
        }
    }

    func validate() {
        // Validate critical configuration
        assert(!apiBaseURL.isEmpty, "API base URL must be set")
        assert(apiTimeout > 0, "API timeout must be positive")
        assert(maxCacheSize > 0, "Max cache size must be positive")
    }

    var isDevelopment: Bool {
        environment == .development
    }

    var isProduction: Bool {
        environment == .production
    }
}








