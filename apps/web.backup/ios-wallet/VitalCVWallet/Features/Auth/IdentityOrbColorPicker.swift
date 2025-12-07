//
//  IdentityOrbColorPicker.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 14
//  Identity-orb color picker for personalization
//

import SwiftUI

/// IdentityOrbColorPicker - Color picker for customizing identity orb
struct IdentityOrbColorPicker: View {
    @Binding var selectedColor: Color
    @State private var hue: Double = 0.6
    @State private var saturation: Double = 0.8
    @State private var brightness: Double = 0.9

    let presetColors: [PresetColor] = [
        PresetColor(name: "Ocean", color: Color(red: 0.2, green: 0.4, blue: 0.8)),
        PresetColor(name: "Forest", color: Color(red: 0.2, green: 0.6, blue: 0.3)),
        PresetColor(name: "Sunset", color: Color(red: 0.9, green: 0.4, blue: 0.2)),
        PresetColor(name: "Lavender", color: Color(red: 0.6, green: 0.4, blue: 0.8)),
        PresetColor(name: "Amber", color: Color(red: 0.9, green: 0.6, blue: 0.2)),
        PresetColor(name: "Rose", color: Color(red: 0.9, green: 0.3, blue: 0.5)),
        PresetColor(name: "Sky", color: Color(red: 0.3, green: 0.7, blue: 0.9)),
        PresetColor(name: "Emerald", color: Color(red: 0.2, green: 0.8, blue: 0.4))
    ]

    var body: some View {
        VStack(spacing: WalletSpacing.lg) {
            // Preview orb
            IdentityOrbPreview(color: selectedColor)

            // Preset colors
            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                Text("Preset Colors")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: WalletSpacing.md) {
                    ForEach(presetColors) { preset in
                        PresetColorButton(
                            preset: preset,
                            isSelected: selectedColor == preset.color
                        ) {
                            selectedColor = preset.color
                            updateHSB(from: preset.color)
                        }
                    }
                }
            }

            // Custom color sliders
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                Text("Customize")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                ColorSlider(
                    label: "Hue",
                    value: $hue,
                    range: 0...1,
                    color: Color(hue: hue, saturation: 1, brightness: 1)
                )

                ColorSlider(
                    label: "Saturation",
                    value: $saturation,
                    range: 0...1,
                    color: Color.gray
                )

                ColorSlider(
                    label: "Brightness",
                    value: $brightness,
                    range: 0...1,
                    color: Color.gray
                )
            }
        }
        .padding(WalletSpacing.lg)
        .onChange(of: hue) { _ in updateColor() }
        .onChange(of: saturation) { _ in updateColor() }
        .onChange(of: brightness) { _ in updateColor() }
        .onAppear {
            updateHSB(from: selectedColor)
        }
    }

    private func updateColor() {
        selectedColor = Color(hue: hue, saturation: saturation, brightness: brightness)
    }

    private func updateHSB(from color: Color) {
        // Extract HSB from UIColor (simplified)
        let uiColor = UIColor(color)
        var h: CGFloat = 0
        var s: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0

        uiColor.getHue(&h, saturation: &s, brightness: &b, alpha: &a)

        hue = Double(h)
        saturation = Double(s)
        brightness = Double(b)
    }
}

// MARK: - Identity Orb Preview

struct IdentityOrbPreview: View {
    let color: Color

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            color.opacity(0.9),
                            color.opacity(0.5),
                            color.opacity(0.2)
                        ],
                        center: .center,
                        startRadius: 20,
                        endRadius: 80
                    )
                )
                .frame(width: 120, height: 120)
                .overlay(
                    Circle()
                        .stroke(color.opacity(0.3), lineWidth: 2)
                        .frame(width: 140, height: 140)
                )
                .shadow(color: color.opacity(0.3), radius: 20, x: 0, y: 10)
        }
    }
}

// MARK: - Preset Color

struct PresetColor: Identifiable {
    let id = UUID()
    let name: String
    let color: Color
}

// MARK: - Preset Color Button

struct PresetColorButton: View {
    let preset: PresetColor
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: WalletSpacing.xs) {
                Circle()
                    .fill(preset.color)
                    .frame(width: 50, height: 50)
                    .overlay(
                        Circle()
                            .stroke(
                                isSelected ? Color.walletPrimary : Color.clear,
                                lineWidth: 3
                            )
                    )
                    .shadow(color: preset.color.opacity(0.3), radius: 8, x: 0, y: 4)

                Text(preset.name)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
        }
    }
}

// MARK: - Color Slider

struct ColorSlider: View {
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            HStack {
                Text(label)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)

                Spacer()

                Text("\(Int(value * 100))%")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            Slider(value: $value, in: range)
                .tint(color)
        }
    }
}

#Preview {
    IdentityOrbColorPicker(selectedColor: .constant(.walletPrimary))
}

