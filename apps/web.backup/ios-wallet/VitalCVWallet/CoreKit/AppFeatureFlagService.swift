//
//  AppFeatureFlagService.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 1
//  Feature flag service for experimental features
//

import Foundation
import Combine

/// AppFeatureFlagService - Enables experimental feature flags
@MainActor
public class AppFeatureFlagService: ObservableObject {
    public static let shared = AppFeatureFlagService()

    // MARK: - Published State

    @Published public private(set) var flags: [String: Bool] = [:]

    // MARK: - Feature Flag Keys

    public enum FlagKey: String, CaseIterable {
        // Trust Visualization
        case multiLayerTrustHalo = "multi_layer_trust_halo"
        case trustScoreWheel = "trust_score_wheel"
        case chainSignalStrength = "chain_signal_strength"
        case complianceStreak = "compliance_streak"
        case identityLevelUp = "identity_level_up"

        // Verification Engine
        case multiThreadedQRAnalysis = "multi_threaded_qr_analysis"
        case frameDifferencing = "frame_differencing"
        case chainMetadataPreloader = "chain_metadata_preloader"
        case trustSoakAnimation = "trust_soak_animation"
        case deterministicVerification = "deterministic_verification"

        // Credential Details
        case fieldImportanceRanking = "field_importance_ranking"
        case licenseTypeUI = "license_type_ui"
        case credentialProvenance = "credential_provenance"
        case dynamicFieldExpansion = "dynamic_field_expansion"
        case dragDownDismiss = "drag_down_dismiss"

        // Evidence System
        case evidenceIntegrityStatus = "evidence_integrity_status"
        case imageToPDFWrapper = "image_to_pdf_wrapper"
        case evidenceTagging = "evidence_tagging"
        case scrollPositionSync = "scroll_position_sync"
        case cryptographicDigestCopy = "cryptographic_digest_copy"

        // Chain Integration
        case anchorConfidenceLabel = "anchor_confidence_label"
        case latencyAwareRPC = "latency_aware_rpc"
        case onChainEventSubscription = "on_chain_event_subscription"
        case chainLightingEffect = "chain_lighting_effect"
        case acceleratedAnchorVerification = "accelerated_anchor_verification"

        // Jobs Experience
        case credentialFitScore = "credential_fit_score"
        case swipeableJobPreviews = "swipeable_job_previews"
        case recruiterIdentityVerification = "recruiter_identity_verification"
        case jobToProofMapping = "job_to_proof_mapping"
        case multiRoleApplicationAccelerator = "multi_role_application_accelerator"

        // Chaos Forge (Mythic Layer)
        case identitySupernovas = "identity_supernovas"
        case chainSerpents = "chain_serpents"
        case attestationFoxfire = "attestation_foxfire"
        case proofStarfields = "proof_starfields"
        case trustComets = "trust_comets"
        case didMeteors = "did_meteors"
        case skillGalaxies = "skill_galaxies"
        case astralSourceOfTruth = "astral_source_of_truth"
        case soulRuneGlimmer = "soul_rune_glimmer"
        case cosmicComplianceLanterns = "cosmic_compliance_lanterns"
    }

    // MARK: - Initialization

    private init() {
        loadFlags()
    }

    // MARK: - Public API

    /// Check if a feature flag is enabled
    public func isEnabled(_ flag: FlagKey) -> Bool {
        return flags[flag.rawValue] ?? false
    }

    /// Enable a feature flag
    public func enable(_ flag: FlagKey) {
        flags[flag.rawValue] = true
        saveFlags()
    }

    /// Disable a feature flag
    public func disable(_ flag: FlagKey) {
        flags[flag.rawValue] = false
        saveFlags()
    }

    /// Toggle a feature flag
    public func toggle(_ flag: FlagKey) {
        let current = isEnabled(flag)
        flags[flag.rawValue] = !current
        saveFlags()
    }

    /// Set multiple flags at once
    public func setFlags(_ newFlags: [String: Bool]) {
        flags.merge(newFlags) { _, new in new }
        saveFlags()
    }

    /// Reset all flags to defaults
    public func resetToDefaults() {
        flags = defaultFlags()
        saveFlags()
    }

    // MARK: - Persistence

    private func loadFlags() {
        if let data = UserDefaults.standard.data(forKey: "app_feature_flags"),
           let decoded = try? JSONDecoder().decode([String: Bool].self, from: data) {
            flags = decoded
        } else {
            flags = defaultFlags()
            saveFlags()
        }
    }

    private func saveFlags() {
        if let encoded = try? JSONEncoder().encode(flags) {
            UserDefaults.standard.set(encoded, forKey: "app_feature_flags")
        }
    }

    private func defaultFlags() -> [String: Bool] {
        var defaults: [String: Bool] = [:]

        // Enable core features by default
        defaults[FlagKey.multiLayerTrustHalo.rawValue] = true
        defaults[FlagKey.trustScoreWheel.rawValue] = true
        defaults[FlagKey.chainSignalStrength.rawValue] = true
        defaults[FlagKey.complianceStreak.rawValue] = true
        defaults[FlagKey.identityLevelUp.rawValue] = true

        // Enable verification features
        defaults[FlagKey.multiThreadedQRAnalysis.rawValue] = true
        defaults[FlagKey.chainMetadataPreloader.rawValue] = true
        defaults[FlagKey.trustSoakAnimation.rawValue] = true

        // Disable experimental features by default
        defaults[FlagKey.frameDifferencing.rawValue] = false
        defaults[FlagKey.deterministicVerification.rawValue] = false

        // Disable chaos forge features by default (can be enabled for special builds)
        for flag in [
            FlagKey.identitySupernovas,
            FlagKey.chainSerpents,
            FlagKey.attestationFoxfire,
            FlagKey.proofStarfields,
            FlagKey.trustComets,
            FlagKey.didMeteors,
            FlagKey.skillGalaxies,
            FlagKey.astralSourceOfTruth,
            FlagKey.soulRuneGlimmer,
            FlagKey.cosmicComplianceLanterns
        ] {
            defaults[flag.rawValue] = false
        }

        return defaults
    }
}








