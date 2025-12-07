//
//  Stacked3DWalletView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 11
//  3D stacked wallet view with gyroscope tilt
//

import SwiftUI
import CoreMotion

/// Stacked3DWalletView - 3D stacked wallet view with gyroscope tilt
struct Stacked3DWalletView: View {
    let credentials: [VerifiableCredential]
    @State private var tiltX: Double = 0
    @State private var tiltY: Double = 0
    @State private var selectedIndex: Int = 0

    private let motionManager = CMMotionManager()

    var body: some View {
        ZStack {
            ForEach(Array(credentials.enumerated()), id: \.element.id) { index, credential in
                CredentialCard3D(
                    credential: credential,
                    index: index,
                    selectedIndex: selectedIndex,
                    tiltX: tiltX,
                    tiltY: tiltY
                )
                .zIndex(Double(credentials.count - index))
                .onTapGesture {
                    withAnimation {
                        selectedIndex = index
                    }
                }
            }
        }
        .onAppear {
            startGyroscope()
        }
        .onDisappear {
            stopGyroscope()
        }
    }

    private func startGyroscope() {
        guard motionManager.isDeviceMotionAvailable else { return }

        motionManager.deviceMotionUpdateInterval = 0.1
        motionManager.startDeviceMotionUpdates(to: .main) { motion, error in
            guard let motion = motion else { return }

            // Get attitude (tilt)
            let attitude = motion.attitude
            tiltX = attitude.roll * 10 // Scale for visual effect
            tiltY = attitude.pitch * 10
        }
    }

    private func stopGyroscope() {
        motionManager.stopDeviceMotionUpdates()
    }
}

// MARK: - 3D Credential Card

struct CredentialCard3D: View {
    let credential: VerifiableCredential
    let index: Int
    let selectedIndex: Int
    let tiltX: Double
    let tiltY: Double

    private var offset: CGFloat {
        CGFloat(index - selectedIndex) * 20
    }

    private var scale: CGFloat {
        index == selectedIndex ? 1.0 : 0.9
    }

    private var rotationX: Double {
        index == selectedIndex ? tiltY : 0
    }

    private var rotationY: Double {
        index == selectedIndex ? -tiltX : 0
    }

    var body: some View {
        CredentialCard(credential: credential)
            .frame(width: 300, height: 200)
            .offset(x: offset, y: CGFloat(index) * 10)
            .scaleEffect(scale)
            .rotation3DEffect(
                .degrees(rotationX),
                axis: (x: 1, y: 0, z: 0)
            )
            .rotation3DEffect(
                .degrees(rotationY),
                axis: (x: 0, y: 1, z: 0)
            )
            .shadow(
                color: .black.opacity(0.3),
                radius: 10,
                x: CGFloat(tiltX / 10),
                y: CGFloat(tiltY / 10)
            )
    }
}

#Preview {
    Stacked3DWalletView(
        credentials: [
            VerifiableCredential(
                id: "1",
                type: ["VerifiableCredential"],
                issuer: Issuer(id: "did:example:issuer", name: "Issuer", image: nil),
                issuanceDate: Date(),
                expirationDate: nil,
                credentialSubject: CredentialSubject(id: "did:example:holder", type: nil, claims: [:]),
                proof: nil,
                evidence: nil
            )
        ]
    )
    .frame(width: 400, height: 600)
    .background(Color.walletBackground)
}

