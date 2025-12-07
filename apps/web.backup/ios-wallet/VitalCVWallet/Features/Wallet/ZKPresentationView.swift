//
//  ZKPresentationView.swift
//  VitalCVWallet
//
//  Created: Advanced Chain Anchoring & ZK-Proof Identity ARC - Phase 3
//  ZK Presentation UI with hidden field petals and revealed field bars
//

import SwiftUI

/// ZKPresentationView - Main view for ZK credential presentation
public struct ZKPresentationView: View {
    @StateObject private var viewModel: ZKPresentationViewModel
    @State private var showingProofExplanation = false

    public init(credential: VerifiableCredential) {
        _viewModel = StateObject(wrappedValue: ZKPresentationViewModel(credential: credential))
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: WalletSpacing.lg) {
                // Header
                headerSection

                // Task 20: Hidden field petals vs revealed field bars
                attributeDisplaySection

                // Task 21: Proof Strength Meter
                proofStrengthMeter

                // Generate proof button
                generateProofButton

                // Task 22: Why this proof is valid explanation
                proofExplanationButton
            }
            .padding(WalletSpacing.lg)
        }
        .navigationTitle("ZK Presentation")
        .sheet(isPresented: $showingProofExplanation) {
            ProofExplanationSheet(viewModel: viewModel)
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Zero-Knowledge Credential")
                .font(WalletTypography.title2)
                .foregroundColor(.walletTextPrimary)

            Text("Select which attributes to reveal")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)

            // Disclosure mode selector
            Picker("Disclosure Mode", selection: $viewModel.disclosureMode) {
                Text("Zero").tag(DisclosureMode.zero)
                Text("Minimum").tag(DisclosureMode.minimum)
                Text("Partial").tag(DisclosureMode.partial)
                Text("Full").tag(DisclosureMode.full)
            }
            .pickerStyle(.segmented)
            .onChange(of: viewModel.disclosureMode) { _ in
                viewModel.initializeAttributes()
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }

    // MARK: - Task 20: Attribute Display Section

    private var attributeDisplaySection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Attributes")
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            // Revealed attributes (bars)
            if !viewModel.revealedAttributes.isEmpty {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    Text("Revealed")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)

                    ForEach(viewModel.revealedAttributes, id: \.self) { attribute in
                        RevealedAttributeBar(
                            attribute: attribute,
                            value: viewModel.credential.credentialSubject.claims[attribute] ?? "",
                            onToggle: {
                                viewModel.toggleAttribute(attribute)
                            }
                        )
                    }
                }
            }

            // Hidden attributes (petals)
            if !viewModel.hiddenAttributes.isEmpty {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    Text("Hidden (ZK Proof)")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)

                    HiddenAttributePetals(
                        attributes: viewModel.hiddenAttributes,
                        onToggle: { attribute in
                            viewModel.toggleAttribute(attribute)
                        }
                    )
                }
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }

    // MARK: - Task 21: Proof Strength Meter

    private var proofStrengthMeter: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            HStack {
                Text("Proof Strength")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletTextPrimary)

                Spacer()

                Text("\(Int(viewModel.proofStrength * 100))%")
                    .font(WalletTypography.title3)
                    .foregroundColor(proofStrengthColor)
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.walletTextSecondary.opacity(0.1))
                        .frame(height: 12)

                    // Progress
                    RoundedRectangle(cornerRadius: 8)
                        .fill(proofStrengthGradient)
                        .frame(width: geometry.size.width * CGFloat(viewModel.proofStrength), height: 12)
                }
            }
            .frame(height: 12)

            Text(proofStrengthDescription)
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }

    private var proofStrengthColor: Color {
        if viewModel.proofStrength >= 0.8 {
            return .walletSuccess
        } else if viewModel.proofStrength >= 0.5 {
            return .walletWarning
        } else {
            return .walletError
        }
    }

    private var proofStrengthGradient: LinearGradient {
        LinearGradient(
            colors: [
                proofStrengthColor.opacity(0.6),
                proofStrengthColor
            ],
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    private var proofStrengthDescription: String {
        if viewModel.proofStrength >= 0.8 {
            return "Strong ZK proof with high trust score"
        } else if viewModel.proofStrength >= 0.5 {
            return "Moderate ZK proof strength"
        } else {
            return "Weak proof - consider revealing more attributes"
        }
    }

    // MARK: - Generate Proof Button

    private var generateProofButton: some View {
        Button(action: {
            Task {
                await viewModel.generateProof()
            }
        }) {
            HStack {
                if viewModel.isGeneratingProof {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Image(systemName: "lock.shield.fill")
                    Text("Generate ZK Proof")
                }
            }
            .font(WalletTypography.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                viewModel.isGeneratingProof
                    ? Color.walletTextSecondary
                    : Color.walletPrimary
            )
            .cornerRadius(WalletCornerRadius.medium)
        }
        .disabled(viewModel.isGeneratingProof)
    }

    // MARK: - Task 22: Proof Explanation Button

    private var proofExplanationButton: some View {
        Button(action: {
            showingProofExplanation = true
        }) {
            HStack {
                Image(systemName: "info.circle.fill")
                Text("Why this proof is valid")
            }
            .font(WalletTypography.subheadline)
            .foregroundColor(.walletPrimary)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.walletPrimary.opacity(0.1))
            .cornerRadius(WalletCornerRadius.medium)
        }
    }
}

// MARK: - Revealed Attribute Bar

struct RevealedAttributeBar: View {
    let attribute: String
    let value: String
    let onToggle: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(attribute.capitalized)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)

                Text(value)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextPrimary)
            }

            Spacer()

            Button(action: onToggle) {
                Image(systemName: "eye.slash.fill")
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding()
        .background(Color.walletSuccess.opacity(0.1))
        .cornerRadius(WalletCornerRadius.small)
    }
}

// MARK: - Hidden Attribute Petals

struct HiddenAttributePetals: View {
    let attributes: [String]
    let onToggle: (String) -> Void

    var body: some View {
        FlowLayout(spacing: WalletSpacing.sm) {
            ForEach(attributes, id: \.self) { attribute in
                HiddenAttributePetal(
                    attribute: attribute,
                    onTap: {
                        onToggle(attribute)
                    }
                )
            }
        }
    }
}

struct HiddenAttributePetal: View {
    let attribute: String
    let onTap: () -> Void
    @State private var isPulsing = false

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                Image(systemName: "eye.slash")
                    .font(.system(size: 12))

                Text(attribute.capitalized)
                    .font(WalletTypography.caption2)
            }
            .foregroundColor(.walletTextSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(Color.walletPrimary.opacity(0.1))
                    .overlay(
                        Capsule()
                            .stroke(
                                Color.walletPrimary.opacity(isPulsing ? 0.6 : 0.3),
                                lineWidth: 1
                            )
                    )
            )
            .scaleEffect(isPulsing ? 1.05 : 1.0)
            .animation(
                Animation.easeInOut(duration: 1.5)
                    .repeatForever(autoreverses: true),
                value: isPulsing
            )
        }
        .onAppear {
            isPulsing = true
        }
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.replacingUnspecifiedDimensions().width,
            subviews: subviews,
            spacing: spacing
        )
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.frames[index].minX,
                                     y: bounds.minY + result.frames[index].minY),
                         proposal: .unspecified)
        }
    }

    struct FlowResult {
        var size: CGSize = .zero
        var frames: [CGRect] = []

        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var currentX: CGFloat = 0
            var currentY: CGFloat = 0
            var lineHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)

                if currentX + size.width > maxWidth && currentX > 0 {
                    currentX = 0
                    currentY += lineHeight + spacing
                    lineHeight = 0
                }

                frames.append(CGRect(x: currentX, y: currentY, width: size.width, height: size.height))
                lineHeight = max(lineHeight, size.height)
                currentX += size.width + spacing
            }

            self.size = CGSize(
                width: maxWidth,
                height: currentY + lineHeight
            )
        }
    }
}

// MARK: - Task 22: Proof Explanation Sheet

struct ProofExplanationSheet: View {
    @ObservedObject var viewModel: ZKPresentationViewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: WalletSpacing.lg) {
                    explanationSection
                    proofDetailsSection
                    trustScoreSection
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("Proof Validity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var explanationSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Why this proof is valid")
                .font(WalletTypography.title3)
                .foregroundColor(.walletTextPrimary)

            Text("This zero-knowledge proof demonstrates that you possess valid credentials without revealing sensitive information.")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }

    private var proofDetailsSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Proof Details")
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            if let proof = viewModel.proof {
                DetailRow(label: "Revealed Attributes", value: "\(proof.revealedAttributes.count)")
                DetailRow(label: "Hidden Attributes", value: "\(proof.hiddenAttributes.count)")
                DetailRow(label: "Proof Strength", value: "\(Int(viewModel.proofStrength * 100))%")
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }

    private var trustScoreSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Trust Score")
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            Text("Based on chain anchor verification and ZK proof complexity")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)

            Text("\(Int(viewModel.trustScore * 100))%")
                .font(WalletTypography.title)
                .foregroundColor(.walletPrimary)
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}








