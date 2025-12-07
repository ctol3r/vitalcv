//
//  ProofVerificationView.swift
//  VitalCVWallet
//
//  Created: Phase 4 - Task 25
//  Create ProofVerificationView with animated steps
//

import SwiftUI
import Combine

struct ProofVerificationView: View {
    let qrCode: String
    @StateObject private var viewModel = ProofVerificationViewModel()
    @Environment(\.dismiss) var dismiss
    @State private var showAuditTrail = false

    var body: some View {
        NavigationView {
            ZStack {
                // Background
                Color.walletBackground
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: WalletSpacing.lg) {
                        // Identity orb with glow (Phase 5 - Task 35)
                        IdentityOrbView(isVerifying: viewModel.isVerifying)
                            .frame(width: 120, height: 120)
                            .padding(.top, WalletSpacing.xl)

                        // Verification steps
                        VStack(spacing: WalletSpacing.md) {
                            VerificationStepView(
                                step: .signature,
                                status: viewModel.stepStatuses[.signature] ?? .pending,
                                title: "Signature Verification",
                                description: "Validating cryptographic signature"
                            )

                            VerificationStepView(
                                step: .chainAnchor,
                                status: viewModel.stepStatuses[.chainAnchor] ?? .pending,
                                title: "Chain Anchor Check",
                                description: "Verifying blockchain anchor"
                            )

                            VerificationStepView(
                                step: .issuer,
                                status: viewModel.stepStatuses[.issuer] ?? .pending,
                                title: "Issuer Verification",
                                description: "Checking issuer trust status"
                            )

                            VerificationStepView(
                                step: .selectiveDisclosure,
                                status: viewModel.stepStatuses[.selectiveDisclosure] ?? .pending,
                                title: "SD-JWT Validation",
                                description: "Validating selective disclosure"
                            )

                            VerificationStepView(
                                step: .bbsPlus,
                                status: viewModel.stepStatuses[.bbsPlus] ?? .pending,
                                title: "BBS+ Proof Validation",
                                description: "Verifying zero-knowledge proof"
                            )
                        }
                        .padding(.horizontal, WalletSpacing.md)

                        // Trust score badge (Task 32)
                        if let trustScore = viewModel.trustScore {
                            TrustScoreBadge(score: trustScore)
                                .padding(.horizontal, WalletSpacing.md)
                        }

                        // Risk reasoning UI (Task 31)
                        if !viewModel.riskReasons.isEmpty {
                            RiskReasoningView(reasons: viewModel.riskReasons)
                                .padding(.horizontal, WalletSpacing.md)
                        }

                        // Evidence timeline (Phase 5 - Task 37)
                        if viewModel.verificationComplete {
                            EvidenceTimelineView(evidence: viewModel.evidence)
                                .padding(.horizontal, WalletSpacing.md)
                        }

                        // Action buttons
                        VStack(spacing: WalletSpacing.md) {
                            // Share proof button (Task 33)
                            Button(action: {
                                viewModel.shareProof()
                            }) {
                                HStack {
                                    Image(systemName: "square.and.arrow.up")
                                    Text("Share Proof")
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.walletPrimary)
                                .foregroundColor(.white)
                                .cornerRadius(WalletCornerRadius.medium)
                            }

                            // View audit trail button (Task 34)
                            Button(action: {
                                showAuditTrail = true
                            }) {
                                HStack {
                                    Image(systemName: "list.bullet.rectangle")
                                    Text("View Audit Trail")
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.walletCard)
                                .foregroundColor(.walletText)
                                .cornerRadius(WalletCornerRadius.medium)
                            }
                        }
                        .padding(.horizontal, WalletSpacing.md)
                        .padding(.bottom, WalletSpacing.xl)
                    }
                }
            }
            .navigationTitle("Verification")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                viewModel.startVerification(qrCode: qrCode)
            }
            .sheet(isPresented: $showAuditTrail) {
                AuditTrailView(auditTrail: viewModel.auditTrail)
            }
        }
    }
}

// MARK: - Verification Step View

struct VerificationStepView: View {
    let step: VerificationStep
    let status: StepStatus
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            // Status icon
            ZStack {
                Circle()
                    .fill(statusColor.opacity(0.2))
                    .frame(width: 44, height: 44)

                Group {
                    switch status {
                    case .pending:
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: statusColor))
                    case .inProgress:
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: statusColor))
                    case .completed:
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(statusColor)
                    case .failed:
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(statusColor)
                    }
                }
            }

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(title)
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletTextPrimary)

                Text(description)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            Spacer()
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .walletShadow(WalletShadow.small)
    }

    private var statusColor: Color {
        switch status {
        case .pending:
            return .gray
        case .inProgress:
            return .walletInfo
        case .completed:
            return .walletSuccess
        case .failed:
            return .walletError
        }
    }
}

enum StepStatus {
    case pending
    case inProgress
    case completed
    case failed
}

// MARK: - Trust Score Badge (Task 32)

struct TrustScoreBadge: View {
    let score: TrustScore

    var body: some View {
        VStack(spacing: WalletSpacing.sm) {
            Text("Trust Score")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)

            HStack(spacing: WalletSpacing.md) {
                // Overall score
                VStack {
                    Text("\(Int(score.value * 100))%")
                        .font(WalletTypography.largeTitle)
                        .foregroundColor(trustColor)

                    Text("Overall")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }

                Divider()
                    .frame(height: 60)

                // Breakdown
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    TrustScoreRow(label: "Chain", score: score.chainScore)
                    TrustScoreRow(label: "Issuer", score: score.issuerScore)
                    TrustScoreRow(label: "Compliance", score: score.complianceScore)
                }
            }
            .padding()
            .background(trustColor.opacity(0.1))
            .cornerRadius(WalletCornerRadius.medium)
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }

    private var trustColor: Color {
        if score.value >= 0.8 {
            return .walletSuccess
        } else if score.value >= 0.5 {
            return .walletWarning
        } else {
            return .walletError
        }
    }
}

struct TrustScoreRow: View {
    let label: String
    let score: Double

    var body: some View {
        HStack {
            Text(label)
                .font(WalletTypography.caption)
            Spacer()
            Text("\(Int(score * 100))%")
                .font(WalletTypography.caption)
                .fontWeight(.semibold)
        }
    }
}

// MARK: - Risk Reasoning View (Task 31)

struct RiskReasoningView: View {
    let reasons: [RiskReason]

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Risk Factors")
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            ForEach(reasons) { reason in
                HStack(alignment: .top, spacing: WalletSpacing.sm) {
                    Image(systemName: reason.icon)
                        .foregroundColor(reason.severity.color)

                    VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                        Text(reason.title)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextPrimary)

                        Text(reason.description)
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                    }
                }
                .padding()
                .background(reason.severity.color.opacity(0.1))
                .cornerRadius(WalletCornerRadius.small)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .walletShadow(WalletShadow.small)
    }
}

struct RiskReason: Identifiable {
    let id = UUID()
    let title: String
    let description: String
    let severity: RiskSeverity
    let icon: String

    enum RiskSeverity {
        case high
        case medium
        case low

        var color: Color {
            switch self {
            case .high: return .walletError
            case .medium: return .walletWarning
            case .low: return .walletInfo
            }
        }
    }
}

// MARK: - Evidence Timeline View (Phase 5 - Task 37)

struct EvidenceTimelineView: View {
    let evidence: [Evidence]

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Evidence Timeline")
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            ForEach(evidence) { item in
                EvidenceTimelineItem(evidence: item)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .walletShadow(WalletShadow.small)
    }
}

struct EvidenceTimelineItem: View {
    let evidence: Evidence
    @State private var isVisible = false

    var body: some View {
        HStack(alignment: .top, spacing: WalletSpacing.sm) {
            // Timeline dot
            Circle()
                .fill(Color.walletPrimary)
                .frame(width: 8, height: 8)
                .padding(.top, 4)

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(evidence.type)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextPrimary)

                if let description = evidence.description {
                    Text(description)
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }

                Text(evidence.timestamp, style: .relative)
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .opacity(isVisible ? 1 : 0)
        .offset(x: isVisible ? 0 : -20)
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                isVisible = true
            }
        }
    }
}

// MARK: - Audit Trail View (Task 34)

struct AuditTrailView: View {
    let auditTrail: [AuditTrailEntry]
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            List {
                ForEach(auditTrail) { entry in
                    VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                        Text(entry.event)
                            .font(WalletTypography.headline)

                        Text(entry.timestamp, style: .date)
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)

                        if let blockHeight = entry.blockHeight {
                            Text("Block: \(blockHeight)")
                                .font(WalletTypography.caption)
                                .foregroundColor(.walletTextSecondary)
                        }

                        if let txHash = entry.txHash {
                            Text("TX: \(txHash.prefix(16))...")
                                .font(WalletTypography.caption)
                                .foregroundColor(.walletTextSecondary)
                        }
                    }
                    .padding(.vertical, WalletSpacing.xs)
                }
            }
            .navigationTitle("Audit Trail")
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
}

struct AuditTrailEntry: Identifiable {
    let id = UUID()
    let event: String
    let timestamp: Date
    let blockHeight: Int?
    let txHash: String?
}

// MARK: - Identity Orb View (Phase 5 - Task 35)

struct IdentityOrbView: View {
    let isVerifying: Bool
    @State private var pulse: CGFloat = 1.0

    var body: some View {
        ZStack {
            // Glow effect
            if isVerifying {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.blue.opacity(0.6),
                                Color.blue.opacity(0.2),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 20,
                            endRadius: 60
                        )
                    )
                    .frame(width: 120, height: 120)
                    .scaleEffect(pulse)
                    .blur(radius: 10)
            }

            // Main orb
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color.blue, Color.purple],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 100, height: 100)
                .overlay(
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundColor(.white)
                        .font(.system(size: 40))
                )
        }
        .onAppear {
            if isVerifying {
                withAnimation(
                    Animation.easeInOut(duration: 1.5)
                        .repeatForever(autoreverses: true)
                ) {
                    pulse = 1.3
                }
            }
        }
    }
}

// MARK: - ViewModel

@MainActor
class ProofVerificationViewModel: ObservableObject {
    @Published var isVerifying: Bool = false
    @Published var stepStatuses: [VerificationStep: StepStatus] = [:]
    @Published var trustScore: TrustScore?
    @Published var riskReasons: [RiskReason] = []
    @Published var verificationComplete: Bool = false
    @Published var evidence: [Evidence] = []
    @Published var auditTrail: [AuditTrailEntry] = []

    private let proofEngine = CredProofEngine.shared
    private let trustCalculator = TrustScoreCalculator.shared
    private let verifyInitService = VerifyInitService.shared
    private let verifySubmitService = VerifySubmitService.shared

    func startVerification(qrCode: String) {
        isVerifying = true

        // Initialize all steps as pending
        stepStatuses = [
            .signature: .pending,
            .chainAnchor: .pending,
            .issuer: .pending,
            .selectiveDisclosure: .pending,
            .bbsPlus: .pending
        ]

        Task {
            await performVerification(qrCode: qrCode)
        }
    }

    private func performVerification(qrCode: String) async {
        var allChecks: [VerificationCheck] = []
        var chainStatus: ChainAnchorStatus?
        var issuerMetadata: IssuerMetadata?
        var credential: VerifiableCredential?

        // Parse QR code to get credential
        do {
            // Try to parse as OIDC4VP request first
            if let vpRequest = try? OIDC4VPRequest.parse(from: qrCode) {
                // Handle OIDC4VP flow
                let initResponse = try await verifyInitService.initializeVerification(request: vpRequest)
                // TODO: Build and submit VP
            } else if let data = qrCode.data(using: .utf8),
                      let cred = try? JSONDecoder().decode(VerifiableCredential.self, from: data) {
                credential = cred
            }
        } catch {
            await MainActor.run {
                self.riskReasons.append(RiskReason(
                    title: "Invalid QR Format",
                    description: "Could not parse QR code: \(error.localizedDescription)",
                    severity: .high,
                    icon: "exclamationmark.triangle"
                ))
            }
        }

        guard let cred = credential else {
            await MainActor.run {
                self.isVerifying = false
            }
            return
        }

        // Step 1: Signature verification (Task 26)
        await updateStep(.signature, status: .inProgress)
        do {
            let result = try await proofEngine.validateCredential(cred)
            allChecks.append(contentsOf: result.checks)

            let stepStatus: StepStatus = result.valid ? .completed : .failed
            await updateStep(.signature, status: stepStatus)

            if !result.valid {
                await MainActor.run {
                    self.riskReasons.append(RiskReason(
                        title: "Signature Verification Failed",
                        description: "Cryptographic signature validation failed",
                        severity: .high,
                        icon: "xmark.shield"
                    ))
                }
            }
        } catch {
            await updateStep(.signature, status: .failed)
            await MainActor.run {
                self.riskReasons.append(RiskReason(
                    title: "Signature Verification Error",
                    description: error.localizedDescription,
                    severity: .high,
                    icon: "exclamationmark.triangle"
                ))
            }
        }

        // Step 2: Chain anchor check (Task 27)
        await updateStep(.chainAnchor, status: .inProgress)
        if let anchorId = cred.chainAnchorId {
            // Check chain anchor via backend
            do {
                let status = try await AppServicesContainer.shared.chain.checkAnchorStatus(anchorId: anchorId)
                chainStatus = status
                let stepStatus: StepStatus = (status == .confirmed) ? .completed : .failed
                await updateStep(.chainAnchor, status: stepStatus)

                if status == .confirmed {
                    // Add chain ripple animation (Phase 5 - Task 36)
                    await MainActor.run {
                        // Animation will be triggered in UI
                    }
                } else {
                    await MainActor.run {
                        self.riskReasons.append(RiskReason(
                            title: "Chain Anchor Check Failed",
                            description: "Blockchain anchor verification failed",
                            severity: .medium,
                            icon: "link.badge.plus"
                        ))
                    }
                }
            } catch {
                await updateStep(.chainAnchor, status: .failed)
                await MainActor.run {
                    self.riskReasons.append(RiskReason(
                        title: "Chain Anchor Check Failed",
                        description: "Could not verify blockchain anchor",
                        severity: .medium,
                        icon: "link.badge.plus"
                    ))
                }
            }
        } else {
            // No chain anchor
            await updateStep(.chainAnchor, status: .completed)
            await MainActor.run {
                self.riskReasons.append(RiskReason(
                    title: "No Chain Anchor",
                    description: "Credential is not anchored to blockchain",
                    severity: .low,
                    icon: "info.circle"
                ))
            }
        }

        // Step 3: Issuer verification (Task 28)
        await updateStep(.issuer, status: .inProgress)
        do {
            let metadata = try await IssuerMetadataFetcher.shared.fetchMetadata(for: cred.issuer.id)
            issuerMetadata = metadata

            let stepStatus: StepStatus = metadata.trusted ? .completed : .failed
            await updateStep(.issuer, status: stepStatus)

            if !metadata.trusted {
                await MainActor.run {
                    self.riskReasons.append(RiskReason(
                        title: "Untrusted Issuer",
                        description: "Issuer is not in trusted registry",
                        severity: .medium,
                        icon: "person.crop.circle.badge.questionmark"
                    ))
                }
            }
        } catch {
            await updateStep(.issuer, status: .failed)
            await MainActor.run {
                self.riskReasons.append(RiskReason(
                    title: "Issuer Verification Failed",
                    description: "Could not fetch issuer metadata",
                    severity: .medium,
                    icon: "exclamationmark.triangle"
                ))
            }
        }

        // Step 4: SD-JWT validation (Task 29)
        await updateStep(.selectiveDisclosure, status: .inProgress)
        let proofFormat = proofEngine.detectProofFormat(credential: cred)
        if proofFormat == .sdJwt {
            do {
                let result = try await proofEngine.validateSDJWT(cred)
                allChecks.append(contentsOf: result.checks)
                await updateStep(.selectiveDisclosure, status: result.valid ? .completed : .failed)
            } catch {
                await updateStep(.selectiveDisclosure, status: .failed)
            }
        } else {
            // Not SD-JWT format
            await updateStep(.selectiveDisclosure, status: .completed)
        }

        // Step 5: BBS+ validation (Task 30)
        await updateStep(.bbsPlus, status: .inProgress)
        if proofFormat == .bbsPlus {
            do {
                let result = try await proofEngine.validateBBSPlus(cred)
                allChecks.append(contentsOf: result.checks)
                await updateStep(.bbsPlus, status: result.valid ? .completed : .failed)
            } catch {
                await updateStep(.bbsPlus, status: .failed)
            }
        } else {
            // Not BBS+ format
            await updateStep(.bbsPlus, status: .completed)
        }

        // Calculate trust score
        let score = trustCalculator.calculateTrustScore(
            chainStatus: chainStatus,
            issuerMetadata: issuerMetadata,
            verificationChecks: allChecks
        )

        // Build evidence timeline
        let evidenceItems = cred.evidence ?? []

        // Build audit trail
        var auditEntries: [AuditTrailEntry] = [
            AuditTrailEntry(
                event: "Verification Started",
                timestamp: Date(),
                blockHeight: nil,
                txHash: nil
            )
        ]

        if let chain = chainStatus, let height = chain.blockHeight {
            auditEntries.append(AuditTrailEntry(
                event: "Chain Anchor Verified",
                timestamp: chain.timestamp ?? Date(),
                blockHeight: height,
                txHash: chain.txHash
            ))
        }

        auditEntries.append(AuditTrailEntry(
            event: "Verification Completed",
            timestamp: Date(),
            blockHeight: nil,
            txHash: nil
        ))

        // Play haptic feedback based on trust level
        let trustLevel = trustCalculator.trustLevel(from: score)
        switch trustLevel {
        case .high:
            HapticFeedback.play(.verifiedStrong)
        case .medium:
            HapticFeedback.play(.verifiedWeak)
        case .low:
            HapticFeedback.play(.trustLost)
        case .unknown:
            break
        }

        await MainActor.run {
            self.trustScore = score
            self.evidence = evidenceItems
            self.auditTrail = auditEntries
            self.verificationComplete = true
            self.isVerifying = false
        }
    }

    private func updateStep(_ step: VerificationStep, status: StepStatus) async {
        await MainActor.run {
            stepStatuses[step] = status
        }

        // Add delay for animation
        try? await Task.sleep(nanoseconds: 500_000_000)
    }

    func shareProof() {
        // TODO: Implement DPoP-bound proof sharing (Task 33)
    }
}

