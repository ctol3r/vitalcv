//
//  ClipEntryView.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 1 - Task 8
//  Initial loading + scan view for App Clip
//

import SwiftUI

struct ClipEntryView: View {
    @EnvironmentObject var clipState: AppClipState
    @State private var isLoading = true
    @State private var showScanView = false

    var body: some View {
        ZStack {
            if isLoading {
                // Initial loading state
                LoadingView()
                    .onAppear {
                        // Brief loading animation
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            withAnimation {
                                isLoading = false
                                showScanView = true
                            }
                        }
                    }
            } else if let qrPayload = clipState.invocationPayload {
                // Task 11 & 12: Route based on payload type
                if qrPayload.type == .oidcRequest {
                    OIDC4VPRequestLoaderView(payload: qrPayload)
                } else {
                    VerifyView(payload: qrPayload)
                }
            } else if showScanView {
                // Task 13: Fallback "scan manually" option
                ScanManualView()
            }
        }
    }
}

// MARK: - Loading View

struct LoadingView: View {
    @State private var rotation: Double = 0

    var body: some View {
        ZStack {
            Color.walletBackground.ignoresSafeArea()

            VStack(spacing: 20) {
                // App Clip logo/icon
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 60))
                    .foregroundColor(.walletPrimary)
                    .rotationEffect(.degrees(rotation))
                    .onAppear {
                        withAnimation(
                            Animation.linear(duration: 1.0)
                                .repeatForever(autoreverses: false)
                        ) {
                            rotation = 360
                        }
                    }

                Text("VitalCV Instant Verify")
                    .font(WalletTypography.title)
                    .foregroundColor(.walletTextPrimary)

                Text("Scanning...")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
            }
        }
    }
}

// MARK: - Manual Scan View

struct ScanManualView: View {
    @EnvironmentObject var clipState: AppClipState
    @State private var showScanner = false

    var body: some View {
        ZStack {
            Color.walletBackground.ignoresSafeArea()

            VStack(spacing: 24) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 80))
                    .foregroundColor(.walletPrimary)

                Text("Scan QR Code")
                    .font(WalletTypography.title)
                    .foregroundColor(.walletTextPrimary)

                Text("Position the QR code within the frame to verify credentials instantly")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Button(action: {
                    showScanner = true
                }) {
                    HStack {
                        Image(systemName: "camera.fill")
                        Text("Start Scanning")
                    }
                    .font(WalletTypography.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.walletPrimary)
                    .cornerRadius(WalletCornerRadius.medium)
                }
                .padding(.horizontal)
            }
        }
        .fullScreenCover(isPresented: $showScanner) {
            VerifyView(payload: nil)
        }
    }
}




