//
//  DeviceCapabilityChecker.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 3
//  Device capability detection (camera, biometrics, NFC future)
//

import Foundation
import AVFoundation
import LocalAuthentication
import CoreNFC

@MainActor
class DeviceCapabilityChecker: ObservableObject {
    static let shared = DeviceCapabilityChecker()

    @Published var cameraAvailable: Bool = false
    @Published var cameraAuthorized: Bool = false
    @Published var biometricsAvailable: Bool = false
    @Published var biometricsType: BiometricType = .none
    @Published var nfcAvailable: Bool = false
    @Published var nfcEnabled: Bool = false

    struct Capabilities {
        let camera: CameraCapability
        let biometrics: BiometricCapability
        let nfc: NFCCapability

        struct CameraCapability {
            let available: Bool
            let authorized: Bool
            let authorizationStatus: AVAuthorizationStatus
        }

        struct BiometricCapability {
            let available: Bool
            let type: BiometricType
        }

        struct NFCCapability {
            let available: Bool
            let enabled: Bool
        }
    }

    enum BiometricType {
        case none
        case touchID
        case faceID
        case opticID
    }

    private init() {
        checkAllCapabilities()
    }

    func checkAllCapabilities() async {
        await checkCamera()
        await checkBiometrics()
        await checkNFC()
    }

    func checkCamera() async {
        // Check if camera hardware exists
        let hasCamera = AVCaptureDevice.default(for: .video) != nil
        cameraAvailable = hasCamera

        if hasCamera {
            let status = AVCaptureDevice.authorizationStatus(for: .video)
            cameraAuthorized = status == .authorized

            if status == .notDetermined {
                let granted = await AVCaptureDevice.requestAccess(for: .video)
                cameraAuthorized = granted
            }
        }
    }

    func checkBiometrics() async {
        let context = LAContext()
        var error: NSError?

        let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        biometricsAvailable = canEvaluate

        if canEvaluate {
            switch context.biometryType {
            case .none:
                biometricsType = .none
            case .touchID:
                biometricsType = .touchID
            case .faceID:
                biometricsType = .faceID
            case .opticID:
                biometricsType = .opticID
            @unknown default:
                biometricsType = .none
            }
        } else {
            biometricsType = .none
        }
    }

    func checkNFC() async {
        // NFC availability check (iOS 11+)
        if #available(iOS 11.0, *) {
            nfcAvailable = NFCNDEFReaderSession.readingAvailable
            // NFC enabled status requires actual session attempt
            nfcEnabled = NFCNDEFReaderSession.readingAvailable
        } else {
            nfcAvailable = false
            nfcEnabled = false
        }
    }

    func getCapabilities() -> Capabilities {
        let cameraStatus = AVCaptureDevice.authorizationStatus(for: .video)

        return Capabilities(
            camera: Capabilities.CameraCapability(
                available: cameraAvailable,
                authorized: cameraAuthorized,
                authorizationStatus: cameraStatus
            ),
            biometrics: Capabilities.BiometricCapability(
                available: biometricsAvailable,
                type: biometricsType
            ),
            nfc: Capabilities.NFCCapability(
                available: nfcAvailable,
                enabled: nfcEnabled
            )
        )
    }

    func requestCameraPermission() async -> Bool {
        guard cameraAvailable else { return false }

        let status = AVCaptureDevice.authorizationStatus(for: .video)
        if status == .notDetermined {
            return await AVCaptureDevice.requestAccess(for: .video)
        }
        return status == .authorized
    }
}








