//
//  AIAssistantFloatingButton.swift
//  VitalCVWallet
//
//  Created: AI Clinical Assistant - Phase 2
//  Floating "Ask VitalCV" button across the app
//

import SwiftUI

struct AIAssistantFloatingButton: View {
    @State private var isPresented = false
    @State private var pulseAnimation = false

    var body: some View {
        Button(action: {
            isPresented = true
        }) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.headline)
                Text("Ask VitalCV")
                    .font(.headline)
            }
            .foregroundColor(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(
                LinearGradient(
                    colors: [Color.walletPrimary, Color.walletPrimary.opacity(0.8)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(30)
            .shadow(color: Color.walletPrimary.opacity(0.4), radius: 10, x: 0, y: 4)
            .scaleEffect(pulseAnimation ? 1.05 : 1.0)
            .trustGlow(radius: 15, strength: 0.6, color: .walletPrimary)
        }
        .sheet(isPresented: $isPresented) {
            AssistantChatView()
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                pulseAnimation = true
            }
        }
    }
}

// MARK: - Floating Button Modifier

extension View {
    func aiAssistantFloatingButton() -> some View {
        ZStack(alignment: .bottomTrailing) {
            self

            VStack {
                Spacer()
                HStack {
                    Spacer()
                    AIAssistantFloatingButton()
                        .padding()
                }
            }
        }
    }
}

