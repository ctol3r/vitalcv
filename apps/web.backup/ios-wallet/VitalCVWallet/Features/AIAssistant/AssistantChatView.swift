//
//  AssistantChatView.swift
//  VitalCVWallet
//
//  Created: AI Clinical Assistant - Phase 2
//  Main chat interface for AI Assistant
//

import SwiftUI

struct AssistantChatView: View {
    @StateObject private var engine = AIAssistantEngine.shared
    @StateObject private var viewModel = AssistantChatViewModel()
    @State private var messageText: String = ""
    @FocusState private var isTextFieldFocused: Bool

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Chat messages
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            // Welcome message
                            if viewModel.messages.isEmpty {
                                welcomeSection
                            }

                            // Messages
                            ForEach(viewModel.messages) { message in
                                MessageBubbleView(message: message)
                                    .id(message.id)
                            }

                            // Loading indicator
                            if viewModel.isLoading {
                                LoadingMessageView()
                            }
                        }
                        .padding()
                    }
                    .onChange(of: viewModel.messages.count) { _ in
                        if let lastMessage = viewModel.messages.last {
                            withAnimation {
                                proxy.scrollTo(lastMessage.id, anchor: .bottom)
                            }
                        }
                    }
                }

                // Topic chips
                if viewModel.messages.isEmpty {
                    topicChipsSection
                }

                // Quick prompts
                if viewModel.messages.isEmpty {
                    quickPromptsSection
                }

                // Input area
                inputArea
            }
            .navigationTitle("AI Assistant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Clear") {
                        viewModel.clearMessages()
                    }
                }
            }
            .onAppear {
                Task {
                    await engine.loadContext()
                }
            }
        }
    }

    // MARK: - Welcome Section

    private var welcomeSection: some View {
        VStack(spacing: 16) {
            // Identity Orb Avatar
            IdentityOrbAvatar(trustScore: engine.context?.trustScore.current)
                .frame(width: 80, height: 80)

            Text("Ask VitalCV")
                .font(.title2)
                .fontWeight(.bold)

            Text("I can help you understand your credentials, compliance, career growth, and more.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding(.vertical, 40)
    }

    // MARK: - Topic Chips

    private var topicChipsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Topics")
                .font(.headline)
                .padding(.horizontal)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    TopicChip(title: "Credentials", icon: "badge.checkmark", intent: .explainCredential)
                    TopicChip(title: "Compliance", icon: "shield.checkered", intent: .explainCompliance)
                    TopicChip(title: "Skills", icon: "star.fill", intent: .skillGapAnalysis)
                    TopicChip(title: "Jobs", icon: "briefcase.fill", intent: .explainJobMatch)
                    TopicChip(title: "Telemedicine", icon: "video.fill", intent: .explain)
                    TopicChip(title: "Growth", icon: "chart.line.uptrend.xyaxis", intent: .growthRoadmap)
                    TopicChip(title: "Chain", icon: "link", intent: .explainChain)
                }
                .padding(.horizontal)
            }
        }
        .padding(.vertical)
    }

    // MARK: - Quick Prompts

    private var quickPromptsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Questions")
                .font(.headline)
                .padding(.horizontal)

            VStack(spacing: 8) {
                QuickPromptButton(
                    title: "Why is my trustScore lower?",
                    intent: .explainTrustScore
                ) {
                    sendQuickPrompt("Why is my trustScore lower?", intent: .explainTrustScore)
                }

                QuickPromptButton(
                    title: "How do I improve DEA readiness?",
                    intent: .explainCompliance
                ) {
                    sendQuickPrompt("How do I improve DEA readiness?", intent: .explainCompliance)
                }

                QuickPromptButton(
                    title: "What roles fit me best?",
                    intent: .explainJobMatch
                ) {
                    sendQuickPrompt("What roles fit me best?", intent: .explainJobMatch)
                }

                QuickPromptButton(
                    title: "What should I renew next?",
                    intent: .recommend
                ) {
                    sendQuickPrompt("What should I renew next?", intent: .recommend)
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical)
    }

    // MARK: - Input Area

    private var inputArea: some View {
        VStack(spacing: 0) {
            Divider()

            HStack(spacing: 12) {
                TextField("Ask a question...", text: $messageText, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .focused($isTextFieldFocused)
                    .lineLimit(1...4)

                Button(action: sendMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(messageText.isEmpty ? .secondary : .walletPrimary)
                }
                .disabled(messageText.isEmpty || viewModel.isLoading)
            }
            .padding()
        }
        .background(Color(.systemBackground))
    }

    // MARK: - Actions

    private func sendMessage() {
        guard !messageText.isEmpty else { return }

        let question = messageText
        messageText = ""
        isTextFieldFocused = false

        Task {
            await viewModel.sendMessage(question: question, engine: engine)
        }
    }

    private func sendQuickPrompt(_ question: String, intent: AIAssistantIntent) {
        Task {
            await viewModel.sendMessage(question: question, intent: intent, engine: engine)
        }
    }
}

// MARK: - Identity Orb Avatar

struct IdentityOrbAvatar: View {
    let trustScore: Double?

    var body: some View {
        ZStack {
            Circle()
                .fill(orbColor)
                .frame(width: 80, height: 80)

            Circle()
                .stroke(orbColor.opacity(0.3), lineWidth: 2)
                .frame(width: 80, height: 80)

            Image(systemName: "sparkles")
                .font(.title)
                .foregroundColor(.white)
        }
        .trustGlow(trustScore: trustScore)
    }

    private var orbColor: Color {
        guard let score = trustScore else { return .walletPrimary }
        if score >= 0.8 {
            return .walletSuccess
        } else if score >= 0.6 {
            return .walletWarning
        } else {
            return .walletError
        }
    }
}

// MARK: - Topic Chip

struct TopicChip: View {
    let title: String
    let icon: String
    let intent: AIAssistantIntent

    var body: some View {
        Button(action: {
            // Handle topic selection
        }) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.walletPrimary.opacity(0.1))
            .foregroundColor(.walletPrimary)
            .cornerRadius(20)
        }
    }
}

// MARK: - Quick Prompt Button

struct QuickPromptButton: View {
    let title: String
    let intent: AIAssistantIntent
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .font(.subheadline)
                    .foregroundColor(.primary)
                Spacer()
                Image(systemName: "arrow.right.circle.fill")
                    .foregroundColor(.walletPrimary)
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
    }
}

// MARK: - Message Bubble View

struct MessageBubbleView: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.isFromUser {
                Spacer(minLength: 40)
            } else {
                // Assistant avatar
                Circle()
                    .fill(Color.walletPrimary.opacity(0.2))
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: "sparkles")
                            .font(.caption)
                            .foregroundColor(.walletPrimary)
                    )
            }

            VStack(alignment: message.isFromUser ? .trailing : .leading, spacing: 8) {
                Text(message.text)
                    .font(.body)
                    .padding()
                    .background(message.isFromUser ? Color.walletPrimary : Color(.systemGray5))
                    .foregroundColor(message.isFromUser ? .white : .primary)
                    .cornerRadius(16)
                    .trustGlow(trustScore: message.isFromUser ? nil : 0.85)

                // Structured data
                if let structured = message.structuredData {
                    StructuredAnswerView(data: structured)
                }

                // CTAs
                if !message.ctas.isEmpty {
                    CTAsView(ctas: message.ctas)
                }

                // Timestamp
                Text(message.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if !message.isFromUser {
                Spacer(minLength: 40)
            }
        }
    }
}

// MARK: - Structured Answer View

struct StructuredAnswerView: View {
    let data: AIAssistantResponse.StructuredAnswer

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(data.sections.enumerated()), id: \.offset) { index, section in
                VStack(alignment: .leading, spacing: 8) {
                    Text(section.title)
                        .font(.headline)

                    Text(section.content)
                        .font(.body)

                    if let items = section.items {
                        ForEach(items, id: \.self) { item in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.walletSuccess)
                                    .font(.caption)
                                Text(item)
                                    .font(.subheadline)
                            }
                        }
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(12)
            }
        }
    }
}

// MARK: - CTAs View

struct CTAsView: View {
    let ctas: [AIAssistantResponse.CallToAction]

    var body: some View {
        VStack(spacing: 8) {
            ForEach(Array(ctas.enumerated()), id: \.offset) { index, cta in
                Button(action: {
                    handleCTAAction(cta.action)
                }) {
                    Text(cta.label)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(cta.priority == .primary ? .white : .walletPrimary)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(cta.priority == .primary ? Color.walletPrimary : Color.walletPrimary.opacity(0.1))
                        .cornerRadius(12)
                }
            }
        }
    }

    private func handleCTAAction(_ action: AIAssistantResponse.CallToAction.CTAAction) {
        // Handle CTA actions
        switch action {
        case .renew:
            // Navigate to renewal
            break
        case .verify:
            // Navigate to verification
            break
        case .apply:
            // Navigate to job application
            break
        case .viewDetails:
            // Show details
            break
        case .updateCredential:
            // Update credential
            break
        case .requestReference:
            // Request reference
            break
        case .scheduleCME:
            // Schedule CME
            break
        case .viewJob:
            // View job
            break
        case .viewCompliance:
            // View compliance
            break
        }
    }
}

// MARK: - Loading Message View

struct LoadingMessageView: View {
    @State private var animationPhase: Double = 0

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(Color.walletPrimary.opacity(0.2))
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: "sparkles")
                        .font(.caption)
                        .foregroundColor(.walletPrimary)
                )

            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(Color.walletPrimary)
                        .frame(width: 8, height: 8)
                        .opacity(animationPhase > Double(index) * 0.3 ? 1.0 : 0.3)
                }
            }
            .padding()
            .background(Color(.systemGray5))
            .cornerRadius(16)

            Spacer(minLength: 40)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.0).repeatForever()) {
                animationPhase = 1.0
            }
        }
    }
}

// MARK: - Chat Message Model

struct ChatMessage: Identifiable {
    let id: String
    let text: String
    let isFromUser: Bool
    let timestamp: Date
    let structuredData: AIAssistantResponse.StructuredAnswer?
    let ctas: [AIAssistantResponse.CallToAction]

    init(
        id: String = UUID().uuidString,
        text: String,
        isFromUser: Bool,
        timestamp: Date = Date(),
        structuredData: AIAssistantResponse.StructuredAnswer? = nil,
        ctas: [AIAssistantResponse.CallToAction] = []
    ) {
        self.id = id
        self.text = text
        self.isFromUser = isFromUser
        self.timestamp = timestamp
        self.structuredData = structuredData
        self.ctas = ctas
    }
}

// MARK: - Chat View Model

@MainActor
class AssistantChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isLoading: Bool = false

    func sendMessage(
        question: String,
        intent: AIAssistantIntent? = nil,
        engine: AIAssistantEngine
    ) async {
        // Add user message
        let userMessage = ChatMessage(text: question, isFromUser: true)
        messages.append(userMessage)

        isLoading = true

        do {
            // Classify intent if not provided
            let classifiedIntent = intent ?? engine.classifyIntent(from: question)

            // Create query
            let query = AIAssistantQuery(
                intent: classifiedIntent,
                question: question,
                context: nil,
                mode: .full, // Can be made configurable
                userId: "user", // TODO: Get from auth
                did: DIDService.shared.getDID() ?? ""
            )

            // Query engine
            let response = try await engine.query(query)

            // Add assistant message
            let assistantMessage = ChatMessage(
                text: response.answer,
                isFromUser: false,
                structuredData: response.structuredData,
                ctas: response.ctas
            )
            messages.append(assistantMessage)

            // Haptic feedback
            HapticFeedback.shared.play(.softTick)

        } catch {
            let errorMessage = ChatMessage(
                text: "Sorry, I encountered an error: \(error.localizedDescription)",
                isFromUser: false
            )
            messages.append(errorMessage)
        }

        isLoading = false
    }

    func clearMessages() {
        messages.removeAll()
    }
}

