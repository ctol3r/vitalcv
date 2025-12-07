//
//  ComplianceTaskDetailView.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 3, Tasks 17-24
//  Task details with explanations, trust score deltas, action buttons, and guided flows
//

import SwiftUI

/// ComplianceTaskDetailView - Detailed view for individual compliance tasks
struct ComplianceTaskDetailView: View {
    let task: ComplianceTask
    @Environment(\.dismiss) private var dismiss

    @StateObject private var engine = ComplianceTaskEngine.shared
    @StateObject private var credentialStore = CredentialStore.shared

    @State private var showingActionFlow = false
    @State private var showingHelpFAQ = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: WalletSpacing.lg) {
                    // Header with icon and urgency
                    TaskHeaderView(task: task)

                    // Why this matters (Task 18)
                    WhyThisMattersView(task: task)

                    // Trust score delta (Task 19)
                    TrustScoreDeltaView(task: task)

                    // Linked credential (Task 20)
                    if let credentialId = task.credentialId {
                        LinkedCredentialView(credentialId: credentialId)
                    }

                    // Action buttons (Task 21)
                    ActionButtonsView(
                        task: task,
                        onAction: { actionRoute in
                            handleAction(actionRoute)
                        }
                    )

                    // Need Help? FAQ (Task 23)
                    HelpFAQView(task: task)
                }
                .padding(WalletSpacing.md)
            }
            .navigationTitle("Task Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingActionFlow) {
                ActionFlowView(task: task) {
                    Task {
                        await engine.markTaskComplete(task.id)
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingHelpFAQ) {
                HelpFAQSheet(task: task)
            }
        }
    }

    private func handleAction(_ actionRoute: ActionRoute) {
        switch actionRoute {
        case .renewLicense, .uploadEvidence, .reverifyCredential, .updateDEA, .updateMATE, .checkSanctions, .refreshAnchor, .completeCME:
            showingActionFlow = true
        case .viewCredential:
            if let credentialId = task.credentialId {
                // Navigate to credential detail
                NavigationRouter.shared.navigate(to: .walletDetail(credentialId: credentialId))
                dismiss()
            }
        case .viewJob:
            if let jobId = task.metadata["jobId"] {
                // Navigate to job detail
                NavigationRouter.shared.navigate(to: .jobDetail(jobId: jobId))
                dismiss()
            }
        case .contactRecruiter:
            // Open recruiter contact
            if let recruiterId = task.metadata["recruiterId"] {
                NavigationRouter.shared.navigate(to: .recruiterCandidate(candidateId: recruiterId))
                dismiss()
            }
        }
    }
}

// MARK: - Task Header

struct TaskHeaderView: View {
    let task: ComplianceTask

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            ZStack {
                Circle()
                    .fill(urgencyColor.opacity(0.15))
                    .frame(width: 64, height: 64)

                Image(systemName: task.type.icon)
                    .font(.title)
                    .foregroundColor(urgencyColor)
            }

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(task.title)
                    .font(WalletTypography.title2)
                    .foregroundColor(.walletTextPrimary)

                HStack {
                    Text(urgencyText)
                        .font(WalletTypography.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(urgencyColor)
                        )

                    if let dueDate = task.dueDate {
                        Text(dueDate, style: .date)
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                    }
                }
            }

            Spacer()
        }
        .padding(WalletSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(Color.walletCard)
                .walletShadow(WalletShadow.medium)
        )
    }

    private var urgencyColor: Color {
        switch task.urgency {
        case .low: return .walletInfo
        case .medium: return .walletWarning
        case .high: return .walletError
        case .critical: return .purple
        }
    }

    private var urgencyText: String {
        task.urgency.rawValue.uppercased()
    }
}

// MARK: - Why This Matters (Task 18)

struct WhyThisMattersView: View {
    let task: ComplianceTask

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Why This Matters")
                .font(WalletTypography.title3)
                .foregroundColor(.walletTextPrimary)

            Text(task.description)
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)

            // Additional context based on task type
            if let additionalContext = additionalContext {
                Text(additionalContext)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
                    .padding(WalletSpacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: WalletCornerRadius.small)
                            .fill(Color.walletInfo.opacity(0.1))
                    )
            }
        }
        .padding(WalletSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(Color.walletCard)
                .walletShadow(WalletShadow.small)
        )
    }

    private var additionalContext: String? {
        switch task.type {
        case .licenseRenewal:
            return "An expired license prevents you from practicing medicine and can result in job loss or legal issues."
        case .dea:
            return "DEA registration is required to prescribe controlled substances. Expiration means you cannot prescribe."
        case .mate:
            return "MATE Act training is mandatory for DEA registration. Without it, you cannot renew your DEA."
        case .cme:
            return "CME requirements vary by state. Non-compliance can result in license suspension."
        case .evidenceMissing:
            return "Missing evidence reduces trust in your credentials. Recruiters may question your qualifications."
        case .anchorStale:
            return "Stale anchors reduce cryptographic trust. Refresh to maintain maximum trust score."
        case .sanctionsCheck:
            return "Regular sanctions checks are required for hospital credentialing and insurance enrollment."
        default:
            return nil
        }
    }
}

// MARK: - Trust Score Delta (Task 19)

struct TrustScoreDeltaView: View {
    let task: ComplianceTask

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Trust Impact")
                .font(WalletTypography.title3)
                .foregroundColor(.walletTextPrimary)

            HStack(spacing: WalletSpacing.md) {
                // Trust score boost
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    HStack {
                        Image(systemName: "arrow.up.circle.fill")
                            .foregroundColor(.walletSuccess)
                        Text("Trust Score")
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)
                    }

                    Text("+\(Int(task.trustImpactScore * 100))%")
                        .font(WalletTypography.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.walletSuccess)
                }

                Spacer()

                // Match score impact (if negative)
                if let matchImpact = task.matchScoreImpact, matchImpact < 0 {
                    VStack(alignment: .trailing, spacing: WalletSpacing.xs) {
                        HStack {
                            Text("Match Score")
                                .font(WalletTypography.subheadline)
                                .foregroundColor(.walletTextSecondary)
                            Image(systemName: "arrow.down.circle.fill")
                                .foregroundColor(.walletError)
                        }

                        Text("\(Int(abs(matchImpact) * 100))%")
                            .font(WalletTypography.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.walletError)
                    }
                }
            }

            Text("Completing this task will boost your trust score and improve your job match potential.")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
                .padding(.top, WalletSpacing.xs)
        }
        .padding(WalletSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.walletSuccess.opacity(0.1),
                            Color.walletInfo.opacity(0.05)
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .walletShadow(WalletShadow.small)
        )
    }
}

// MARK: - Linked Credential (Task 20)

struct LinkedCredentialView: View {
    let credentialId: String
    @StateObject private var credentialStore = CredentialStore.shared

    var body: some View {
        if let credential = credentialStore.getCredential(id: credentialId) {
            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                Text("Related Credential")
                    .font(WalletTypography.title3)
                    .foregroundColor(.walletTextPrimary)

                Button(action: {
                    NavigationRouter.shared.navigate(to: .walletDetail(credentialId: credentialId))
                }) {
                    HStack {
                        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                            Text(credential.credentialSubject.type ?? "Credential")
                                .font(WalletTypography.headline)
                                .foregroundColor(.walletTextPrimary)

                            if let expirationDate = credential.expirationDate {
                                Text("Expires: \(expirationDate, style: .date)")
                                    .font(WalletTypography.caption)
                                    .foregroundColor(.walletTextSecondary)
                            }
                        }

                        Spacer()

                        Image(systemName: "chevron.right")
                            .foregroundColor(.walletTextSecondary)
                    }
                    .padding(WalletSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                            .fill(Color.walletCard)
                            .walletShadow(WalletShadow.small)
                    )
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
    }
}

// MARK: - Action Buttons (Task 21)

struct ActionButtonsView: View {
    let task: ComplianceTask
    let onAction: (ActionRoute) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Actions")
                .font(WalletTypography.title3)
                .foregroundColor(.walletTextPrimary)

            VStack(spacing: WalletSpacing.sm) {
                // Primary action
                Button(action: {
                    onAction(task.actionRoute)
                }) {
                    HStack {
                        Image(systemName: actionIcon(for: task.actionRoute))
                        Text(task.actionRoute.displayName)
                            .fontWeight(.semibold)
                    }
                    .font(WalletTypography.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(WalletSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                            .fill(Color.walletPrimary)
                    )
                }

                // Secondary actions (if applicable)
                if task.type == .evidenceMissing {
                    Button(action: {
                        onAction(.viewCredential)
                    }) {
                        HStack {
                            Image(systemName: "doc.text.fill")
                            Text("View Credential Details")
                        }
                        .font(WalletTypography.body)
                        .foregroundColor(.walletPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(WalletSpacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                                .stroke(Color.walletPrimary, lineWidth: 2)
                        )
                    }
                }
            }
        }
    }

    private func actionIcon(for route: ActionRoute) -> String {
        switch route {
        case .renewLicense: return "arrow.clockwise.circle.fill"
        case .uploadEvidence: return "square.and.arrow.up.fill"
        case .reverifyCredential: return "checkmark.shield.fill"
        case .updateDEA: return "shield.fill"
        case .updateMATE: return "book.fill"
        case .checkSanctions: return "magnifyingglass"
        case .refreshAnchor: return "link.circle.fill"
        case .completeCME: return "graduationcap.fill"
        case .viewCredential: return "doc.text.fill"
        case .viewJob: return "briefcase.fill"
        case .contactRecruiter: return "person.2.fill"
        }
    }
}

// MARK: - Help FAQ (Task 23)

struct HelpFAQView: View {
    let task: ComplianceTask
    @State private var showingFAQ = false

    var body: some View {
        Button(action: {
            showingFAQ = true
        }) {
            HStack {
                Image(systemName: "questionmark.circle.fill")
                Text("Need Help?")
                    .font(WalletTypography.headline)
                Spacer()
                Image(systemName: "chevron.right")
            }
            .foregroundColor(.walletPrimary)
            .padding(WalletSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .fill(Color.walletPrimary.opacity(0.1))
            )
        }
        .buttonStyle(PlainButtonStyle())
        .sheet(isPresented: $showingFAQ) {
            HelpFAQSheet(task: task)
        }
    }
}

struct HelpFAQSheet: View {
    let task: ComplianceTask
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: WalletSpacing.lg) {
                    Text("Frequently Asked Questions")
                        .font(WalletTypography.title2)
                        .padding(.horizontal, WalletSpacing.md)
                        .padding(.top, WalletSpacing.md)

                    ForEach(faqItems, id: \.question) { item in
                        FAQItemView(item: item)
                            .padding(.horizontal, WalletSpacing.md)
                    }
                }
            }
            .navigationTitle("Help")
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

    private var faqItems: [FAQItem] {
        switch task.type {
        case .licenseRenewal:
            return [
                FAQItem(
                    question: "How long does license renewal take?",
                    answer: "License renewal typically takes 2-4 weeks, but can vary by state. Start early to avoid delays."
                ),
                FAQItem(
                    question: "What documents do I need?",
                    answer: "You'll need your current license, CME certificates, and any required fees. Check your state board's website for specifics."
                ),
                FAQItem(
                    question: "What happens if my license expires?",
                    answer: "An expired license means you cannot practice medicine. You may face job loss, legal issues, and need to complete additional requirements to reinstate."
                )
            ]
        case .dea:
            return [
                FAQItem(
                    question: "How do I renew my DEA registration?",
                    answer: "DEA registration can be renewed online at the DEA website. You'll need your current registration number and payment information."
                ),
                FAQItem(
                    question: "What is the renewal period?",
                    answer: "DEA registrations are valid for 3 years and must be renewed before expiration."
                )
            ]
        case .evidenceMissing:
            return [
                FAQItem(
                    question: "What evidence is required?",
                    answer: "Evidence typically includes certificates, transcripts, or verification documents that prove your credential is valid."
                ),
                FAQItem(
                    question: "How do I upload evidence?",
                    answer: "Use the upload button to select documents. Our system will process and verify them automatically."
                )
            ]
        default:
            return [
                FAQItem(
                    question: "Need more help?",
                    answer: "Contact our support team for assistance with this task."
                )
            ]
        }
    }
}

struct FAQItem {
    let question: String
    let answer: String
}

struct FAQItemView: View {
    let item: FAQItem

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text(item.question)
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            Text(item.answer)
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
        }
        .padding(WalletSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(Color.walletCard)
                .walletShadow(WalletShadow.small)
        )
    }
}

// MARK: - Action Flow View (Task 22)

struct ActionFlowView: View {
    let task: ComplianceTask
    let onComplete: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var currentStep = 0

    var body: some View {
        NavigationStack {
            VStack {
                // Step indicator
                ProgressView(value: Double(currentStep), total: Double(steps.count - 1))
                    .padding()

                // Current step content
                steps[currentStep]

                Spacer()

                // Navigation buttons
                HStack {
                    if currentStep > 0 {
                        Button("Back") {
                            withAnimation {
                                currentStep -= 1
                            }
                        }
                    }

                    Spacer()

                    Button(currentStep == steps.count - 1 ? "Complete" : "Next") {
                        if currentStep == steps.count - 1 {
                            onComplete()
                        } else {
                            withAnimation {
                                currentStep += 1
                            }
                        }
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
            }
            .navigationTitle(flowTitle)
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var flowTitle: String {
        switch task.actionRoute {
        case .uploadEvidence: return "Upload Evidence"
        case .renewLicense: return "Renew License"
        default: return "Complete Task"
        }
    }

    private var steps: [AnyView] {
        switch task.actionRoute {
        case .uploadEvidence:
            return [
                AnyView(EvidenceUploadStep1()),
                AnyView(EvidenceUploadStep2()),
                AnyView(EvidenceUploadStep3()),
                AnyView(EvidenceUploadStep4())
            ]
        default:
            return [
                AnyView(Text("Complete this task"))
            ]
        }
    }
}

// Guided flow steps for evidence upload (Task 22)
struct EvidenceUploadStep1: View {
    var body: some View {
        VStack {
            Text("Step 1: Select Document")
                .font(WalletTypography.title2)
            // Document picker would go here
        }
    }
}

struct EvidenceUploadStep2: View {
    var body: some View {
        VStack {
            Text("Step 2: OCR Processing")
                .font(WalletTypography.title2)
            // OCR processing indicator
        }
    }
}

struct EvidenceUploadStep3: View {
    var body: some View {
        VStack {
            Text("Step 3: Digest Generation")
                .font(WalletTypography.title2)
            // Digest generation
        }
    }
}

struct EvidenceUploadStep4: View {
    var body: some View {
        VStack {
            Text("Step 4: Chain Anchor")
                .font(WalletTypography.title2)
            // Chain anchoring
        }
    }
}

#Preview {
    ComplianceTaskDetailView(
        task: ComplianceTask(
            type: .licenseRenewal,
            urgency: .high,
            dueDate: Date(),
            trustImpactScore: 0.15,
            actionRoute: .renewLicense,
            title: "Medical License Renewal",
            description: "Your medical license expires soon.",
            category: .credential
        )
    )
}

