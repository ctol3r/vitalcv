//
//  LoadingView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 27
//  Beautiful loading state animations
//

import SwiftUI

struct LoadingView: View {
    let message: String?
    @State private var rotation: Double = 0

    var body: some View {
        VStack(spacing: WalletSpacing.lg) {
            ZStack {
                Circle()
                    .stroke(Color.walletPrimary.opacity(0.2), lineWidth: 4)
                    .frame(width: 60, height: 60)

                Circle()
                    .trim(from: 0, to: 0.7)
                    .stroke(Color.walletPrimary, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .frame(width: 60, height: 60)
                    .rotationEffect(.degrees(rotation))
                    .animation(
                        Animation.linear(duration: 1)
                            .repeatForever(autoreverses: false),
                        value: rotation
                    )
            }

            if let message = message {
                Text(message)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .onAppear {
            rotation = 360
        }
    }
}

struct SkeletonView: View {
    let width: CGFloat?
    let height: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: WalletCornerRadius.small)
            .fill(Color.gray.opacity(0.2))
            .frame(width: width, height: height)
            .shimmer()
    }
}

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.clear,
                        Color.white.opacity(0.3),
                        Color.clear
                    ]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase)
            )
            .onAppear {
                withAnimation(
                    Animation.linear(duration: 1.5)
                        .repeatForever(autoreverses: false)
                ) {
                    phase = 300
                }
            }
    }
}

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

#Preview {
    VStack(spacing: WalletSpacing.lg) {
        LoadingView(message: "Loading credentials...")

        SkeletonView(width: 200, height: 20)
        SkeletonView(width: 150, height: 20)
        SkeletonView(width: nil, height: 100)
    }
    .padding()
}

