//
//  ErrorHandler.swift
//  VitalCVWallet
//
//  Created: Batch 551 - Task 4
//  Unified ErrorHandler with readable messages
//

import Foundation
import SwiftUI

/// Unified error handler for readable, user-friendly error messages
@MainActor
public class ErrorHandler: ObservableObject {
    public static let shared = ErrorHandler()

    @Published public var currentError: AppError?
    @Published public var errorHistory: [AppError] = []

    private let maxHistoryCount = 50

    private init() {}

    // MARK: - Error Handling

    /// Handle an error and present a user-friendly message
    public func handle(_ error: Error, context: String? = nil) {
        let appError = AppError.from(error, context: context)
        currentError = appError
        addToHistory(appError)

        Logger.shared.logError(error, context: context)
    }

    /// Handle an error with a custom message
    public func handle(_ error: Error, message: String) {
        let appError = AppError.custom(message: message, underlying: error)
        currentError = appError
        addToHistory(appError)
    }

    /// Clear current error
    public func clearError() {
        currentError = nil
    }

    private func addToHistory(_ error: AppError) {
        errorHistory.insert(error, at: 0)
        if errorHistory.count > maxHistoryCount {
            errorHistory = Array(errorHistory.prefix(maxHistoryCount))
        }
    }
}

// MARK: - App Error

public struct AppError: Identifiable, Equatable {
    public let id = UUID()
    public let title: String
    public let message: String
    public let code: String?
    public let timestamp: Date
    public let context: String?

    public init(
        title: String,
        message: String,
        code: String? = nil,
        context: String? = nil
    ) {
        self.title = title
        self.message = message
        self.code = code
        self.timestamp = Date()
        self.context = context
    }

    public static func from(_ error: Error, context: String? = nil) -> AppError {
        if let apiError = error as? APIError {
            return AppError(
                title: "Network Error",
                message: apiError.userFriendlyMessage,
                code: apiError.code,
                context: context
            )
        }

        if let decodingError = error as? DecodingError {
            return AppError(
                title: "Data Error",
                message: "Unable to process the response. Please try again.",
                code: "DECODING_ERROR",
                context: context
            )
        }

        if let urlError = error as? URLError {
            return AppError(
                title: "Connection Error",
                message: urlError.userFriendlyMessage,
                code: "URL_ERROR_\(urlError.code.rawValue)",
                context: context
            )
        }

        // Generic error
        return AppError(
            title: "Error",
            message: error.localizedDescription.isEmpty
                ? "An unexpected error occurred. Please try again."
                : error.localizedDescription,
            code: nil,
            context: context
        )
    }

    public static func custom(message: String, underlying: Error? = nil) -> AppError {
        return AppError(
            title: "Error",
            message: message,
            code: underlying != nil ? "CUSTOM_ERROR" : nil,
            context: nil
        )
    }
}

// MARK: - API Error Extensions

extension APIError {
    var userFriendlyMessage: String {
        switch self {
        case .invalidURL:
            return "Invalid request. Please check your connection and try again."
        case .networkError(let error):
            if let urlError = error as? URLError {
                return urlError.userFriendlyMessage
            }
            return "Unable to connect to the server. Please check your internet connection."
        case .decodingError:
            return "Unable to process the response. Please try again later."
        case .encodingError:
            return "Unable to prepare your request. Please try again."
        case .serverError(let code, let message):
            if let message = message, !message.isEmpty {
                return message
            }
            return "Server error (\(code)). Please try again later."
        case .unauthorized:
            return "Your session has expired. Please sign in again."
        case .notFound:
            return "The requested resource was not found."
        }
    }

    var code: String {
        switch self {
        case .invalidURL: return "INVALID_URL"
        case .networkError: return "NETWORK_ERROR"
        case .decodingError: return "DECODING_ERROR"
        case .encodingError: return "ENCODING_ERROR"
        case .serverError(let code, _): return "SERVER_ERROR_\(code)"
        case .unauthorized: return "UNAUTHORIZED"
        case .notFound: return "NOT_FOUND"
        }
    }
}

// MARK: - URLError Extensions

extension URLError {
    var userFriendlyMessage: String {
        switch self.code {
        case .notConnectedToInternet:
            return "No internet connection. Please check your network settings."
        case .timedOut:
            return "Request timed out. Please try again."
        case .cannotFindHost:
            return "Unable to reach the server. Please check your connection."
        case .cannotConnectToHost:
            return "Unable to connect to the server. It may be temporarily unavailable."
        case .networkConnectionLost:
            return "Connection lost. Please check your internet connection."
        case .dnsLookupFailed:
            return "Unable to resolve server address. Please check your connection."
        case .httpTooManyRedirects:
            return "Too many redirects. Please try again later."
        case .resourceUnavailable:
            return "Resource unavailable. Please try again later."
        case .badServerResponse:
            return "Server returned an invalid response. Please try again."
        default:
            return "Connection error. Please try again."
        }
    }
}

// MARK: - Error View Modifier

struct ErrorAlertModifier: ViewModifier {
    @ObservedObject var errorHandler: ErrorHandler

    func body(content: Content) -> some View {
        content
            .alert(item: $errorHandler.currentError) { error in
                Alert(
                    title: Text(error.title),
                    message: Text(error.message),
                    dismissButton: .default(Text("OK")) {
                        errorHandler.clearError()
                    }
                )
            }
    }
}

extension View {
    public func errorAlert() -> some View {
        modifier(ErrorAlertModifier(errorHandler: ErrorHandler.shared))
    }
}

