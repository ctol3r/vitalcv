//
//  ZKAuthView.swift
//  VitalCVWallet
//
//  Created: Zero-Knowledge Authorization Engine - Phase 4
//  ZK Authorization UI - Make cryptographic privacy feel human, elegant, and intuitive
//

import SwiftUI

/// ZKAuthView - Main view for ZK authorization with animated trust curtain
public struct ZKAuthView: View {
    @StateObject private var viewModel: ZKAuthViewModel
    @Environment(\.dismiss) private var dismiss

    let request: ZKAuthRequest?
    let url: URL?

    public init(request: ZKAuthRequest? = nil, url: URL? = nil) {
        self.request = request
        self.url = url
        _viewModel = StateObject(wrappedValue: ZKAuthViewModel(request: request, url: url))
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                // Phase 4 - Task 25: Animated trust curtain background
                TrustCurtainBackground(isActive: viewModel.isGeneratingProof)

                ScrollView {
                    VStack(spacing: 24) {
                        // Header
                        VStack(spacing: 8) {
                            Image(systemName: "lock.shield.fill")
                                .font(.system(size: 48))
                                .foregroundColor(.blue)

                            Text("Zero-Knowledge Authorization")
                                .font(.title2)
                                .fontWeight(.bold)

                            Text("Prove your authority without revealing your identity")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 32)

                        // Phase 4 - Task 30: Hidden-field petals
                        if !viewModel.hiddenAttributes.isEmpty {
                            HiddenFieldPetalsView(
                                hiddenAttributes: viewModel.hiddenAttributes,
                                revealedAttributes: viewModel.revealedAttributes
                            )
                            .padding(.horizontal)
                        }

                        // Phase 4 - Task 33: Disclosure preview
                        DisclosurePreviewView(
                            revealedCount: viewModel.revealedAttributes.count,
                            hiddenCount: viewModel.hiddenAttributes.count
                        )
                        .padding(.horizontal)

                        // Phase 4 - Task 31: ZK Proof Strength Meter
                        ZKProofStrengthMeter(
                            strength: viewModel.proofStrength
                        )
                        .padding(.horizontal)

                        // Required attributes
                        if !viewModel.requiredAttributes.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Required Attributes")
                                    .font(.headline)

                                ForEach(viewModel.requiredAttributes, id: \.self) { attribute in
                                    RequiredAttributeRow(attribute: attribute)
                                }
                            }
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(12)
                            .padding(.horizontal)
                        }

                        // Phase 4 - Task 34: Transparent chain screen
                        if viewModel.isVerifyingOnChain {
                            TransparentChainScreen()
                                .padding(.horizontal)
                        }

                        // Phase 4 - Task 35: ZK error states
                        if let error = viewModel.error {
                            ZKErrorView(error: error)
                                .padding(.horizontal)
                        }

                        // Action buttons
                        VStack(spacing: 12) {
                            Button(action: {
                                Task {
                                    await viewModel.generateProof()
                                }
                            }) {
                                HStack {
                                    if viewModel.isGeneratingProof {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    }
                                    Text(viewModel.isGeneratingProof ? "Generating Proof..." : "Generate ZK Proof")
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(viewModel.isGeneratingProof ? Color.gray : Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                            }
                            .disabled(viewModel.isGeneratingProof)

                            Button("Cancel") {
                                dismiss()
                            }
                            .foregroundColor(.secondary)
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 32)
                    }
                }
            }
            .navigationTitle("ZK Authorization")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                viewModel.loadRequest()
            }
            .overlay {
                // Phase 4 - Task 32: Trust ripple animation when proof succeeds
                if viewModel.showTrustRipple {
                    TrustRippleOverlay()
                        .transition(.opacity)
                }
            }
            .onChange(of: viewModel.proofGenerated) { generated in
                if generated {
                    // Phase 4 - Task 32: Trust ripple animation when proof succeeds
                    withAnimation(.easeOut(duration: 1.0)) {
                        viewModel.showTrustRipple = true
                    }

                    // Dismiss after showing success
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Phase 4 - Task 25: Trust Curtain Background

struct TrustCurtainBackground: View {
    let isActive: Bool

    var body: some View {
        ZStack {
            Color(.systemBackground)

            if isActive {
                // Animated gradient curtain
                LinearGradient(
                    colors: [
                        Color.blue.opacity(0.1),
                        Color.purple.opacity(0.1),
                        Color.blue.opacity(0.1)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .opacity(isActive ? 1.0 : 0.0)
                .animation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true), value: isActive)
            }
        }
    }
}

// MARK: - Phase 4 - Task 30: Hidden Field Petals

struct HiddenFieldPetalsView: View {
    let hiddenAttributes: [String]
    let revealedAttributes: [String]

    var body: some View {
        VStack(spacing: 16) {
            Text("Attribute Visibility")
                .font(.headline)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 12) {
                ForEach(hiddenAttributes, id: \.self) { attribute in
                    AttributePetal(
                        attribute: attribute,
                        isRevealed: revealedAttributes.contains(attribute)
                    )
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct AttributePetal: View {
    let attribute: String
    let isRevealed: Bool

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: isRevealed ? "eye.fill" : "eye.slash.fill")
                .font(.title2)
                .foregroundColor(isRevealed ? .green : .gray)

            Text(attribute)
                .font(.caption)
                .multilineTextAlignment(.center)
        }
        .frame(width: 100, height: 80)
        .background(isRevealed ? Color.green.opacity(0.1) : Color.gray.opacity(0.1))
        .cornerRadius(8)
        .scaleEffect(isRevealed ? 1.1 : 1.0)
        .animation(.spring(response: 0.3), value: isRevealed)
    }
}

// MARK: - Phase 4 - Task 33: Disclosure Preview

struct DisclosurePreviewView: View {
    let revealedCount: Int
    let hiddenCount: Int

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "info.circle.fill")
                    .foregroundColor(.blue)
                Text("Disclosure Preview")
                    .font(.headline)
            }

            Text("You are revealing only \(revealedCount) attribute\(revealedCount == 1 ? "" : "s")")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Text("\(hiddenCount) attribute\(hiddenCount == 1 ? "" : "s") remain hidden")
                .font(.caption)
                .foregroundColor(.green)
        }
        .padding()
        .background(Color.blue.opacity(0.1))
        .cornerRadius(12)
    }
}

// MARK: - Phase 4 - Task 31: ZK Proof Strength Meter

struct ZKProofStrengthMeter: View {
    let strength: ZKAuthPriority

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Proof Strength")
                    .font(.headline)
                Spacer()
                Text(strength.rawValue.capitalized)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(strengthColor)
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 8)
                        .cornerRadius(4)

                    Rectangle()
                        .fill(strengthColor)
                        .frame(width: geometry.size.width * strengthValue, height: 8)
                        .cornerRadius(4)
                        .animation(.easeInOut, value: strengthValue)
                }
            }
            .frame(height: 8)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var strengthColor: Color {
        switch strength {
        case .strong:
            return .green
        case .medium:
            return .orange
        case .weak:
            return .red
        }
    }

    private var strengthValue: Double {
        switch strength {
        case .strong:
            return 1.0
        case .medium:
            return 0.6
        case .weak:
            return 0.3
        }
    }
}

// MARK: - Phase 4 - Task 34: Transparent Chain Screen

struct TransparentChainScreen: View {
    @State private var isAnimating = false

    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle())

            Text("Verifying proof on chain...")
                .font(.subheadline)
                .foregroundColor(.secondary)

            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 8, height: 8)
                        .opacity(isAnimating ? 0.3 : 1.0)
                        .animation(
                            Animation.easeInOut(duration: 0.6)
                                .repeatForever()
                                .delay(Double(index) * 0.2),
                            value: isAnimating
                        )
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .onAppear {
            isAnimating = true
        }
    }
}

// MARK: - Phase 4 - Task 35: ZK Error States

struct ZKErrorView: View {
    let error: ZKAuthError

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.red)

            VStack(alignment: .leading, spacing: 4) {
                Text(errorTitle)
                    .font(.headline)

                Text(errorMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding()
        .background(Color.red.opacity(0.1))
        .cornerRadius(12)
    }

    private var errorTitle: String {
        switch error {
        case .expiredChallenge:
            return "Proof Expired"
        case .invalidReveal:
            return "Invalid Challenge"
        case .missingRequiredAttribute:
            return "Missing Attribute"
        default:
            return "Authorization Error"
        }
    }

    private var errorMessage: String {
        switch error {
        case .expiredChallenge:
            return "The authorization challenge has expired. Please request a new one."
        case .invalidReveal:
            return "The revealed attributes do not match the allowed set."
        case .missingRequiredAttribute:
            return "A required attribute is missing from your credentials."
        default:
            return "An error occurred during authorization."
        }
    }
}

// MARK: - Phase 4 - Task 32: Trust Ripple Animation

struct TrustRippleOverlay: View {
    @State private var rippleScale: CGFloat = 0.5
    @State private var rippleOpacity: Double = 1.0

    var body: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()

            Circle()
                .stroke(Color.green, lineWidth: 3)
                .frame(width: 200, height: 200)
                .scaleEffect(rippleScale)
                .opacity(rippleOpacity)
                .overlay {
                    VStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 64))
                            .foregroundColor(.green)

                        Text("Proof Verified")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                    }
                }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 1.0)) {
                rippleScale = 2.0
                rippleOpacity = 0.0
            }
        }
    }
}

// MARK: - Supporting Views

struct RequiredAttributeRow: View {
    let attribute: String

    var body: some View {
        HStack {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)
            Text(attribute)
                .font(.subheadline)
            Spacer()
        }
    }
}

// MARK: - ViewModel

@MainActor
class ZKAuthViewModel: ObservableObject {
    @Published var isGeneratingProof = false
    @Published var proofGenerated = false
    @Published var showTrustRipple = false
    @Published var isVerifyingOnChain = false
    @Published var proofStrength: ZKAuthPriority = .medium
    @Published var error: ZKAuthError?

    @Published var requiredAttributes: [String] = []
    @Published var hiddenAttributes: [String] = []
    @Published var revealedAttributes: [String] = []

    private let request: ZKAuthRequest?
    private let url: URL?
    private let zkAuthEngine = ZKAuthEngine.shared
    private let zkAuthWorkflows = ZKAuthWorkflows.shared

    init(request: ZKAuthRequest? = nil, url: URL? = nil) {
        self.request = request
        self.url = url
    }

    func loadRequest() {
        if let request = request {
            requiredAttributes = request.requiredAttributes
            hiddenAttributes = request.hiddenAttributes
            revealedAttributes = request.allowedReveals
        } else if let url = url {
            // Parse URL to extract request parameters
            parseURL(url)
        }
    }

    private func parseURL(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let queryItems = components.queryItems else {
            return
        }

        // Parse query parameters
        if let required = queryItems.first(where: { $0.name == "required" })?.value {
            requiredAttributes = required.components(separatedBy: ",")
        }
        if let hidden = queryItems.first(where: { $0.name == "hidden" })?.value {
            hiddenAttributes = hidden.components(separatedBy: ",")
        }
        if let allowed = queryItems.first(where: { $0.name == "allowed" })?.value {
            revealedAttributes = allowed.components(separatedBy: ",")
        }
    }

    func generateProof() async {
        guard let did = DIDService.shared.loadDID() else {
            error = .missingRequiredAttribute
            return
        }

        isGeneratingProof = true
        error = nil

        do {
            // Create request if needed
            let authRequest: ZKAuthRequest
            if let request = request {
                authRequest = request
            } else {
                authRequest = try await zkAuthEngine.createAuthRequest(
                    requiredAttributes: requiredAttributes,
                    hiddenAttributes: hiddenAttributes,
                    allowedReveals: revealedAttributes
                )
            }

            // Build revealed fields
            var revealedFields: [String: String] = [:]
            for attr in revealedAttributes {
                revealedFields[attr] = "verified"
            }

            // Generate response
            isVerifyingOnChain = true
            let response = try await zkAuthEngine.generateAuthResponse(
                request: authRequest,
                did: did,
                revealedFields: revealedFields
            )

            // Calculate proof strength
            proofStrength = zkAuthWorkflows.calculateAuthPriority(response: response)

            isVerifyingOnChain = false
            proofGenerated = true
        } catch let err as ZKAuthError {
            error = err
        } catch {
            error = .proofGenerationFailed
        }

        isGeneratingProof = false
    }
}

