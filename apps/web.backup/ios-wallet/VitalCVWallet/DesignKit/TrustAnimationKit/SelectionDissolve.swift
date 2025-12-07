//
//  SelectionDissolve.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 5, Task 36
//  Selection dissolve for SD-JWT hidden attributes
//

import SwiftUI

/// SelectionDissolve - Dissolve animation for selections
struct SelectionDissolve: ViewModifier {
    let isSelected: Bool
    @State private var selectionProgress: Double = 0.0

    func body(content: Content) -> some View {
        content
            .scaleEffect(1.0 + (isSelected ? 0.05 : 0.0))
            .opacity(0.7 + (selectionProgress * 0.3))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(
                        isSelected ? Color.trustEmerald.opacity(selectionProgress) : Color.clear,
                        lineWidth: 2
                    )
            )
            .onChange(of: isSelected) { selected in
                animateSelection(selected: selected)
            }
    }

    private func animateSelection(selected: Bool) {
        withAnimation(TrustMotionConfig.responsiveSpring) {
            selectionProgress = selected ? 1.0 : 0.0
        }

        if selected {
            TrustHapticEngine.shared.stepCompleted()
        }
    }
}

/// SDJWTHiddenAttributeView - View for hidden attributes with dissolve
struct SDJWTHiddenAttributeView: View {
    let attribute: HiddenAttribute
    @State private var isRevealed = false
    @State private var isSelected = false

    struct HiddenAttribute: Identifiable {
        let id: UUID
        let name: String
        let value: String
        let isRequired: Bool
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(attribute.name)
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                Spacer()

                if attribute.isRequired {
                    Text("Required")
                        .font(WalletTypography.caption)
                        .foregroundColor(.trustAmber)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(Color.trustAmber.opacity(0.1))
                        )
                }
            }

            if isRevealed {
                Text(attribute.value)
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            } else {
                Text("••••••••")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary.opacity(0.5))
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.walletCard)
        )
        .modifier(SelectionDissolve(isSelected: isSelected))
        .onTapGesture {
            toggleSelection()
        }
        .gesture(
            LongPressGesture(minimumDuration: 0.5)
                .onEnded { _ in
                    revealAttribute()
                }
        )
    }

    private func toggleSelection() {
        isSelected.toggle()
    }

    private func revealAttribute() {
        guard !isRevealed else { return }

        isRevealed = true
        TrustHapticEngine.shared.stepCompleted()
        TrustTickSound.shared.playTick()
    }
}

extension View {
    /// Adds selection dissolve animation for SD-JWT attributes
    func selectionDissolve(isSelected: Bool) -> some View {
        modifier(SelectionDissolve(isSelected: isSelected))
    }
}

