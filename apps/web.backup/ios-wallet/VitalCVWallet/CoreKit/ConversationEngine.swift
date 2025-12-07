//
//  ConversationEngine.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 1
//  Multi-entity dialogue engine for credential conversations
//

import Foundation
import Combine

/// Core conversation engine for multi-actor credential dialogues
public class ConversationEngine: ObservableObject {
    public static let shared = ConversationEngine()

    private let networkService: NetworkService
    private let dpopSigner: DPoPSigner
    private let didService: DIDService

    private var networkServiceBaseURL: String {
        return networkService.baseURL
    }

    @Published public var activeConversations: [Conversation] = []
    @Published public var messageHistory: [String: [ConversationMessage]] = [:]

    private init() {
        self.networkService = NetworkService.shared
        self.dpopSigner = DPoPSigner.shared
        self.didService = DIDService.shared
    }

    // MARK: - Conversation Management

    /// Start a new conversation with specified actors
    public func startConversation(
        context: ConversationContext,
        actors: [ConversationActor],
        initialMessage: String? = nil
    ) async throws -> Conversation {
        let conversationId = UUID().uuidString
        let conversation = Conversation(
            id: conversationId,
            context: context,
            actors: actors,
            status: .active,
            createdAt: Date()
        )

        // Sign conversation with DPoP + DID
        let signedContext = try await signConversationContext(context)

        // Send to backend
        let request = ConversationRequest(
            conversationId: conversationId,
            context: signedContext,
            actors: actors,
            message: initialMessage
        )

        let response = try await sendConversationRequest(request)

        // Update conversation with response
        var updatedConversation = conversation
        updatedConversation.status = response.status
        updatedConversation.lastMessageAt = Date()

        await MainActor.run {
            activeConversations.append(updatedConversation)
            if let firstMessage = response.messages.first {
                messageHistory[conversationId] = [firstMessage]
            }
        }

        return updatedConversation
    }

    /// Send a message in an existing conversation
    public func sendMessage(
        conversationId: String,
        message: String,
        fromActor: ConversationActor
    ) async throws -> ConversationMessage {
        guard let conversation = activeConversations.first(where: { $0.id == conversationId }) else {
            throw ConversationError.conversationNotFound
        }

        let messageRequest = MessageRequest(
            conversationId: conversationId,
            message: message,
            fromActor: fromActor,
            context: conversation.context
        )

        let response = try await sendMessageRequest(messageRequest)

        await MainActor.run {
            if messageHistory[conversationId] == nil {
                messageHistory[conversationId] = []
            }
            messageHistory[conversationId]?.append(response)
        }

        return response
    }

    /// Route message to multiple actors for multi-turn reasoning
    public func routeMessage(
        conversationId: String,
        message: String,
        targetActors: [ConversationActor]
    ) async throws -> [ConversationMessage] {
        let routingRequest = RoutingRequest(
            conversationId: conversationId,
            message: message,
            targetActors: targetActors
        )

        let responses = try await sendRoutingRequest(routingRequest)

        await MainActor.run {
            if messageHistory[conversationId] == nil {
                messageHistory[conversationId] = []
            }
            messageHistory[conversationId]?.append(contentsOf: responses)
        }

        return responses
    }

    // MARK: - Chain-Attested Signing

    private func signConversationContext(_ context: ConversationContext) async throws -> SignedConversationContext {
        // Get DID
        let did = try await didService.getOrCreateDID()

        // Create DPoP token
        let url = URL(string: "\(networkServiceBaseURL)/ai/conversation")!
        let dpopToken = try dpopSigner.generateDPoPToken(method: "POST", url: url)

        // Create signature payload (simplified - in production use proper DID signing)
        let payload = try JSONEncoder().encode(context)
        let signature = payload.base64EncodedString() // Simplified signature

        return SignedConversationContext(
            context: context,
            did: did,
            dpopToken: dpopToken,
            signature: signature,
            timestamp: Date()
        )
    }

    // MARK: - Network Requests

    private func sendConversationRequest(_ request: ConversationRequest) async throws -> ConversationResponse {
        let url = URL(string: "\(networkServiceBaseURL)/ai/conversation")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue(request.context.dpopToken, forHTTPHeaderField: "DPoP")
        urlRequest.setValue("Bearer \(request.context.did)", forHTTPHeaderField: "Authorization")

        urlRequest.httpBody = try JSONEncoder().encode(request)

        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        return try JSONDecoder().decode(ConversationResponse.self, from: data)
    }

    private func sendMessageRequest(_ request: MessageRequest) async throws -> ConversationMessage {
        let url = URL(string: "\(networkServiceBaseURL)/ai/conversation/\(request.conversationId)/message")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        urlRequest.httpBody = try JSONEncoder().encode(request)

        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        return try JSONDecoder().decode(ConversationMessage.self, from: data)
    }

    private func sendRoutingRequest(_ request: RoutingRequest) async throws -> [ConversationMessage] {
        let url = URL(string: "\(networkServiceBaseURL)/ai/conversation/\(request.conversationId)/route")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        urlRequest.httpBody = try JSONEncoder().encode(request)

        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        return try JSONDecoder().decode([ConversationMessage].self, from: data)
    }
}

// MARK: - Errors

enum ConversationError: LocalizedError {
    case conversationNotFound
    case invalidContext
    case signingFailed
    case networkError(String)

    var errorDescription: String? {
        switch self {
        case .conversationNotFound:
            return "Conversation not found"
        case .invalidContext:
            return "Invalid conversation context"
        case .signingFailed:
            return "Failed to sign conversation context"
        case .networkError(let message):
            return "Network error: \(message)"
        }
    }
}

