//
//  APIErrorMapper.swift
//  VitalCVWallet
//
//  Created: Batch 566 - Task 3
//  APIErrorMapper for user-friendly error messages
//

import Foundation

/// APIErrorMapper - Maps technical API errors to user-friendly messages
public class APIErrorMapper {
    public static let shared = APIErrorMapper()

    private init() {}

    // MARK: - Error Mapping

    /// Map API error to user-friendly message
    public func mapError(_ error: Error, context: String? = nil) -> UserFriendlyError {
        // Handle APIError
        if let apiError = error as? APIError {
            return mapAPIError(apiError, context: context)
        }

        // Handle URLError
        if let urlError = error as? URLError {
            return mapURLError(urlError, context: context)
        }

        // Handle DecodingError
        if let decodingError = error as? DecodingError {
            return mapDecodingError(decodingError, context: context)
        }

        // Handle server error responses
        if let serverError = extractServerError(from: error) {
            return mapServerError(serverError, context: context)
        }

        // Generic fallback
        return UserFriendlyError(
            title: "Something went wrong",
            message: "We encountered an issue. Please try again.",
            action: .retry,
            technicalDetails: error.localizedDescription,
            context: context
        )
    }

    // MARK: - API Error Mapping

    private func mapAPIError(_ error: APIError, context: String?) -> UserFriendlyError {
        switch error {
        case .invalidURL:
            return UserFriendlyError(
                title: "Invalid Request",
                message: "The request could not be processed. Please check your connection and try again.",
                action: .retry,
                technicalDetails: "Invalid URL",
                context: context
            )

        case .networkError(let underlyingError):
            return mapNetworkError(underlyingError, context: context)

        case .decodingError(let underlyingError):
            return mapDecodingError(underlyingError, context: context)

        case .encodingError(let underlyingError):
            return UserFriendlyError(
                title: "Request Error",
                message: "Unable to prepare your request. Please try again.",
                action: .retry,
                technicalDetails: underlyingError.localizedDescription,
                context: context
            )

        case .serverError(let code, let message):
            return mapServerErrorCode(code, message: message, context: context)

        case .unauthorized:
            return UserFriendlyError(
                title: "Session Expired",
                message: "Your session has expired. Please sign in again.",
                action: .signIn,
                technicalDetails: "Unauthorized",
                context: context
            )

        case .notFound:
            return UserFriendlyError(
                title: "Not Found",
                message: "The requested resource could not be found.",
                action: .none,
                technicalDetails: "404 Not Found",
                context: context
            )
        }
    }

    // MARK: - URL Error Mapping

    private func mapURLError(_ error: URLError, context: String?) -> UserFriendlyError {
        switch error.code {
        case .notConnectedToInternet:
            return UserFriendlyError(
                title: "No Internet Connection",
                message: "Please check your internet connection and try again.",
                action: .retry,
                technicalDetails: "Network connection unavailable",
                context: context
            )

        case .timedOut:
            return UserFriendlyError(
                title: "Request Timed Out",
                message: "The request took too long. Please try again.",
                action: .retry,
                technicalDetails: "Request timeout",
                context: context
            )

        case .cannotFindHost, .cannotConnectToHost:
            return UserFriendlyError(
                title: "Cannot Connect",
                message: "Unable to reach the server. Please check your connection.",
                action: .retry,
                technicalDetails: error.localizedDescription,
                context: context
            )

        case .networkConnectionLost:
            return UserFriendlyError(
                title: "Connection Lost",
                message: "Your connection was interrupted. Please try again.",
                action: .retry,
                technicalDetails: "Network connection lost",
                context: context
            )

        case .dnsLookupFailed:
            return UserFriendlyError(
                title: "Connection Error",
                message: "Unable to resolve server address. Please check your connection.",
                action: .retry,
                technicalDetails: "DNS lookup failed",
                context: context
            )

        default:
            return UserFriendlyError(
                title: "Connection Error",
                message: "Unable to connect. Please try again.",
                action: .retry,
                technicalDetails: error.localizedDescription,
                context: context
            )
        }
    }

    private func mapNetworkError(_ error: Error, context: String?) -> UserFriendlyError {
        if let urlError = error as? URLError {
            return mapURLError(urlError, context: context)
        }

        return UserFriendlyError(
            title: "Network Error",
            message: "Unable to connect to the server. Please check your internet connection.",
            action: .retry,
            technicalDetails: error.localizedDescription,
            context: context
        )
    }

    // MARK: - Decoding Error Mapping

    private func mapDecodingError(_ error: DecodingError, context: String?) -> UserFriendlyError {
        let message: String

        switch error {
        case .typeMismatch(let type, let context):
            message = "Data format mismatch. Expected \(type)."
        case .valueNotFound(let type, let context):
            message = "Missing required data: \(type)."
        case .keyNotFound(let key, let context):
            message = "Missing field: \(key.stringValue)."
        case .dataCorrupted(let context):
            message = "Data is corrupted or invalid."
        @unknown default:
            message = "Unable to process the response."
        }

        return UserFriendlyError(
            title: "Data Error",
            message: message,
            action: .retry,
            technicalDetails: error.localizedDescription,
            context: context
        )
    }

    // MARK: - Server Error Mapping

    private func mapServerErrorCode(_ code: Int, message: String?, context: String?) -> UserFriendlyError {
        let title: String
        let userMessage: String
        let action: ErrorAction

        switch code {
        case 400:
            title = "Invalid Request"
            userMessage = message ?? "The request was invalid. Please try again."
            action = .retry

        case 401:
            title = "Unauthorized"
            userMessage = "Your session has expired. Please sign in again."
            action = .signIn

        case 403:
            title = "Access Denied"
            userMessage = "You don't have permission to perform this action."
            action = .none

        case 404:
            title = "Not Found"
            userMessage = "The requested resource was not found."
            action = .none

        case 429:
            title = "Too Many Requests"
            userMessage = "You've made too many requests. Please wait a moment and try again."
            action = .retry

        case 500...599:
            title = "Server Error"
            userMessage = message ?? "The server encountered an error. Please try again later."
            action = .retry

        default:
            title = "Error"
            userMessage = message ?? "An error occurred. Please try again."
            action = .retry
        }

        return UserFriendlyError(
            title: title,
            message: userMessage,
            action: action,
            technicalDetails: "HTTP \(code): \(message ?? "")",
            context: context
        )
    }

    private func extractServerError(from error: Error) -> (code: Int, message: String?)? {
        // Try to extract HTTP status code from error
        // This would need to be implemented based on your error structure
        return nil
    }

    private func mapServerError(_ error: (code: Int, message: String?), context: String?) -> UserFriendlyError {
        return mapServerErrorCode(error.code, message: error.message, context: context)
    }
}

// MARK: - Models

public struct UserFriendlyError {
    public let title: String
    public let message: String
    public let action: ErrorAction
    public let technicalDetails: String?
    public let context: String?

    public init(
        title: String,
        message: String,
        action: ErrorAction,
        technicalDetails: String? = nil,
        context: String? = nil
    ) {
        self.title = title
        self.message = message
        self.action = action
        self.technicalDetails = technicalDetails
        self.context = context
    }
}

public enum ErrorAction {
    case retry
    case signIn
    case contactSupport
    case none
}

