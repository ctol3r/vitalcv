//
//  FacilityOnboardingView.swift
//  VitalCVWallet
//
//  Created: Multi-Facility Credential Passport - Phase 4 - Task 25
//  Make onboarding at any facility instant, beautiful, and safe
//

import SwiftUI
import Combine

/// FacilityOnboardingView - Main onboarding flow view
/// Phase 4 - Tasks 25-32: Facility Onboarding Flow
struct FacilityOnboardingView: View {
    let facilityId: String
    let facilityName: String
    let facilityLogo: String?

    @StateObject private var onboardingStatus: FacilityOnboardingStatusManager
    @StateObject private var requirementEngine = FacilityRequirementEngine.shared
    @StateObject private var passportBuilder = PassportBuilder.shared

    @State private var selectedPhase: OnboardingPhase = .requirements
    @State private var showingEvidenceUpload = false
    @State private var selectedRequirement: String?

    init(facilityId: String, facilityName: String, facilityLogo: String? = nil) {
        self.facilityId = facilityId
        self.facilityName = facilityName
        self.facilityLogo = facilityLogo
        _onboardingStatus = StateObject(wrappedValue: FacilityOnboardingStatusManager(facilityId: facilityId))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Phase 4 - Task 25: Facility-branded header
                FacilityBrandedHeader(
                    facilityName: facilityName,
                    logo: facilityLogo,
                    trustScore: onboardingStatus.status?.trustScore ?? 0.0
                )
                .padding(.horizontal)

                // Phase 4 - Task 26: Progress bar: Requirements → Verification → Privileges → Finalize
                OnboardingProgressBar(
                    currentPhase: onboardingStatus.status?.currentPhase ?? .requirements,
                    progress: onboardingStatus.status?.progress ?? 0.0
                )
                .padding(.horizontal)

                // Current phase content
                switch onboardingStatus.status?.currentPhase ?? .requirements {
                case .requirements:
                    RequirementsPhaseView(
                        facilityId: facilityId,
                        requirementEngine: requirementEngine,
                        onRequirementSelected: { requirementId in
                            selectedRequirement = requirementId
                            showingEvidenceUpload = true
                        }
                    )
                case .verification:
                    VerificationPhaseView(facilityId: facilityId)
                case .privileges:
                    PrivilegesPhaseView(
                        facilityId: facilityId,
                        requirementEngine: requirementEngine
                    )
                case .finalize:
                    FinalizePhaseView(facilityId: facilityId)
                case .approved, .rejected:
                    CompletionPhaseView(
                        status: onboardingStatus.status,
                        facilityName: facilityName
                    )
                }

                // Phase 4 - Task 31: Timeline: onboarding history per facility
                if let timeline = onboardingStatus.status?.timeline {
                    OnboardingTimelineView(timeline: timeline)
                        .padding(.horizontal)
                }
            }
        }
        .navigationTitle("Onboarding")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingEvidenceUpload) {
            if let requirementId = selectedRequirement {
                EvidenceUploadView(
                    facilityId: facilityId,
                    requirementId: requirementId,
                    onUploadComplete: {
                        showingEvidenceUpload = false
                        onboardingStatus.refresh()
                    }
                )
            }
        }
        .onAppear {
            onboardingStatus.load()
            // Privileges will be loaded when needed
        }
    }
}

// MARK: - Facility Branded Header
// Phase 4 - Task 25

struct FacilityBrandedHeader: View {
    let facilityName: String
    let logo: String?
    let trustScore: Double

    var body: some View {
        VStack(spacing: 12) {
            if let logoUrl = logo, let url = URL(string: logoUrl) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } placeholder: {
                    Image(systemName: "building.2")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)
                }
                .frame(height: 60)
            } else {
                Image(systemName: "building.2")
                    .font(.system(size: 48))
                    .foregroundColor(.blue)
            }

            Text(facilityName)
                .font(.title2)
                .fontWeight(.bold)

            // Phase 4 - Task 28: Real-time trustScore display
            HStack {
                Image(systemName: "shield.checkered")
                    .foregroundColor(trustScoreColor)
                Text("Trust Score: \(Int(trustScore * 100))%")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var trustScoreColor: Color {
        if trustScore >= 0.8 {
            return .green
        } else if trustScore >= 0.6 {
            return .yellow
        } else {
            return .red
        }
    }
}

// MARK: - Onboarding Progress Bar
// Phase 4 - Task 26

struct OnboardingProgressBar: View {
    let currentPhase: OnboardingPhase
    let progress: Double

    private var phases: [OnboardingPhase] {
        [.requirements, .verification, .privileges, .finalize]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color(.systemGray4))

                    Rectangle()
                        .fill(progressColor)
                        .frame(width: geometry.size.width * CGFloat(progress))
                }
            }
            .frame(height: 8)
            .cornerRadius(4)

            // Phase labels
            HStack {
                ForEach(phases, id: \.self) { phase in
                    VStack {
                        Circle()
                            .fill(phaseColor(phase))
                            .frame(width: 24, height: 24)
                            .overlay(
                                Image(systemName: phaseIcon(phase))
                                    .font(.system(size: 12))
                                    .foregroundColor(.white)
                            )
                        Text(phaseLabel(phase))
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    if phase != phases.last {
                        Spacer()
                    }
                }
            }
        }
    }

    private func phaseColor(_ phase: OnboardingPhase) -> Color {
        let currentIndex = phases.firstIndex(of: currentPhase) ?? -1
        let phaseIndex = phases.firstIndex(of: phase) ?? -1

        if phaseIndex < currentIndex {
            return .green
        } else if phaseIndex == currentIndex {
            return .blue
        } else {
            return .gray
        }
    }

    private func phaseIcon(_ phase: OnboardingPhase) -> String {
        switch phase {
        case .requirements: return "doc.text"
        case .verification: return "checkmark.shield"
        case .privileges: return "key"
        case .finalize: return "checkmark.circle"
        default: return "circle"
        }
    }

    private func phaseLabel(_ phase: OnboardingPhase) -> String {
        switch phase {
        case .requirements: return "Requirements"
        case .verification: return "Verification"
        case .privileges: return "Privileges"
        case .finalize: return "Finalize"
        default: return ""
        }
    }

    private var progressColor: Color {
        if progress >= 0.8 {
            return .green
        } else if progress >= 0.5 {
            return .blue
        } else {
            return .orange
        }
    }
}

// MARK: - Phase Views

struct RequirementsPhaseView: View {
    let facilityId: String
    @ObservedObject var requirementEngine: FacilityRequirementEngine
    let onRequirementSelected: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Requirements")
                .font(.headline)
                .padding(.horizontal)

            if let requirements = requirementEngine.facilityRequirements[facilityId], !requirements.isEmpty {
                ForEach(requirements) { requirement in
                    RequirementCard(
                        requirement: requirement,
                        delta: requirementEngine.requirementDeltas[facilityId]?.first(where: { $0.requirementId == requirement.id }),
                        onAction: {
                            onRequirementSelected(requirement.id)
                        }
                    )
                    .padding(.horizontal)
                }
            } else {
                Text("Loading requirements...")
                    .foregroundColor(.secondary)
                    .padding()
            }
        }
        .onAppear {
            // Deltas will be loaded automatically by requirementEngine
            _ = requirementEngine.detectRequirementDeltas(facilityId: facilityId, clinicianId: "current_user_id")
        }
    }
}

struct VerificationPhaseView: View {
    let facilityId: String

    var body: some View {
        VStack {
            Text("Verification Phase")
                .font(.headline)
            // Verification UI components
        }
        .padding()
    }
}

struct PrivilegesPhaseView: View {
    let facilityId: String
    @ObservedObject var requirementEngine: FacilityRequirementEngine

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Privileges")
                .font(.headline)
                .padding(.horizontal)

            if let privileges = requirementEngine.facilityPrivileges[facilityId] {
                ForEach(privileges) { privilege in
                    PrivilegeCard(privilege: privilege)
                        .padding(.horizontal)
                }
            }
        }
    }
}

struct FinalizePhaseView: View {
    let facilityId: String

    var body: some View {
        VStack {
            Text("Finalize")
                .font(.headline)
            // Finalization UI
        }
        .padding()
    }
}

struct CompletionPhaseView: View {
    let status: FacilityOnboardingStatus?
    let facilityName: String

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: status?.currentPhase == .approved ? "checkmark.circle.fill" : "xmark.circle.fill")
                .font(.system(size: 64))
                .foregroundColor(status?.currentPhase == .approved ? .green : .red)

            Text(status?.currentPhase == .approved ? "Approved!" : "Rejected")
                .font(.title)
                .fontWeight(.bold)

            if let completedAt = status?.completedAt {
                Text("Completed: \(completedAt, style: .date)")
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }
}

// MARK: - Supporting Views

struct RequirementCard: View {
    let requirement: FacilityRequirement
    let delta: RequirementDelta?
    let onAction: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(requirement.name)
                    .font(.headline)
                Text(requirement.description)
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let delta = delta {
                    Text("Missing: \(delta.missingEvidence.joined(separator: ", "))")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }

            Spacer()

            // Phase 4 - Task 27: Evidence upload button (tap → camera)
            Button(action: onAction) {
                Image(systemName: "camera.fill")
                    .font(.title3)
                    .foregroundColor(.blue)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
        .shadow(radius: 2)
    }
}

struct PrivilegeCard: View {
    let privilege: FacilityPrivilege

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(privilege.privilegeType.rawValue.uppercased())
                    .font(.headline)
                if let dept = privilege.department {
                    Text(dept)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            if privilege.active {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
    }
}

// MARK: - Evidence Upload View
// Phase 4 - Task 27

struct EvidenceUploadView: View {
    let facilityId: String
    let requirementId: String
    let onUploadComplete: () -> Void

    @State private var showingCamera = false
    @State private var selectedImage: UIImage?
    @State private var isUploading = false
    @State private var cancellables = Set<AnyCancellable>()

    var body: some View {
        NavigationView {
            VStack {
                if let image = selectedImage {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxHeight: 300)
                } else {
                    Button(action: {
                        showingCamera = true
                    }) {
                        VStack {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 48))
                            Text("Take Photo")
                        }
                    }
                }

                if selectedImage != nil {
                    Button(action: uploadEvidence) {
                        if isUploading {
                            ProgressView()
                        } else {
                            Text("Upload Evidence")
                        }
                    }
                    .disabled(isUploading)
                }
            }
            .padding()
            .navigationTitle("Upload Evidence")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingCamera) {
                ImagePicker(image: $selectedImage)
            }
        }
    }

    private func uploadEvidence() {
        guard let image = selectedImage,
              let imageData = image.jpegData(compressionQuality: 0.8) else {
            return
        }

        isUploading = true
        var cancellable: AnyCancellable?
        cancellable = NetworkService.shared.uploadOnboardingEvidence(
            facilityId: facilityId,
            requirementId: requirementId,
            evidence: imageData,
            fileName: "evidence_\(requirementId).jpg"
        )
        .receive(on: DispatchQueue.main)
        .sink(
            receiveCompletion: { completion in
                isUploading = false
                if case .failure(let error) = completion {
                    print("Upload error: \(error)")
                } else {
                    onUploadComplete()
                }
                cancellable?.cancel()
            },
            receiveValue: { _ in
                onUploadComplete()
                cancellable?.cancel()
            }
        )
        if let cancellable = cancellable {
            cancellables.insert(cancellable)
        }
    }
}

struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.presentationMode) var presentationMode

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = .camera
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.image = image
            }
            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}

// MARK: - Onboarding Timeline View
// Phase 4 - Task 31

struct OnboardingTimelineView: View {
    let timeline: [OnboardingEvent]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Timeline")
                .font(.headline)

            ForEach(timeline) { event in
                TimelineEventRow(event: event)
            }
        }
    }
}

struct TimelineEventRow: View {
    let event: OnboardingEvent

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(phaseColor)
                .frame(width: 8, height: 8)
                .offset(y: 4)

            VStack(alignment: .leading, spacing: 4) {
                Text(event.action)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text(event.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(event.actor.capitalized)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
    }

    private var phaseColor: Color {
        switch event.phase {
        case .requirements: return .blue
        case .verification: return .purple
        case .privileges: return .orange
        case .finalize: return .green
        default: return .gray
        }
    }
}

// MARK: - Onboarding Status Manager

class FacilityOnboardingStatusManager: ObservableObject {
    @Published var status: FacilityOnboardingStatus?
    private let facilityId: String
    private let networkService = NetworkService.shared
    var cancellables = Set<AnyCancellable>()

    init(facilityId: String) {
        self.facilityId = facilityId
    }

    func load() {
        networkService.getFacilityOnboardingStatus(facilityId: facilityId, clinicianId: "current_user_id")
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { _ in },
                receiveValue: { [weak self] status in
                    self?.status = status
                }
            )
            .store(in: &cancellables)
    }

    func refresh() {
        load()
    }
}

