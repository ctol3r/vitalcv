//
//  NotificationSettingsView.swift
//  VitalCVWallet
//
//  Created: Notifications 2.0 - Phase 4 & 5
//  Settings for sound, haptics, and notification preferences
//

import SwiftUI

struct NotificationSettingsView: View {
    @StateObject private var soundEngine = SoundEngine.shared
    @State private var selectedPreviewType: SoundEngine.SoundType = .trustUp
    @State private var showingPreview = false

    var body: some View {
        Form {
            // Sound Settings
            Section("Sound") {
                Toggle("Sound Enabled", isOn: $soundEngine.isSoundEnabled)
                    .onChange(of: soundEngine.isSoundEnabled) { _ in
                        soundEngine.savePreferences()
                    }

                if soundEngine.isSoundEnabled {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Volume Sensitivity")
                            .font(.subheadline)

                        Slider(
                            value: $soundEngine.volumeSensitivity,
                            in: 0.0...1.0
                        ) {
                            Text("Volume")
                        } minimumValueLabel: {
                            Image(systemName: "speaker.fill")
                                .font(.caption)
                        } maximumValueLabel: {
                            Image(systemName: "speaker.wave.3.fill")
                                .font(.caption)
                        }
                        .onChange(of: soundEngine.volumeSensitivity) { _ in
                            soundEngine.savePreferences()
                        }

                        Text("\(Int(soundEngine.volumeSensitivity * 100))%")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            // Haptic Settings
            Section("Haptics") {
                Toggle("Vibration Only Mode", isOn: $soundEngine.isVibrationOnlyMode)
                    .onChange(of: soundEngine.isVibrationOnlyMode) { _ in
                        soundEngine.savePreferences()
                    }

                Toggle("Heartbeat Sync", isOn: $soundEngine.heartbeatSyncEnabled)
                    .onChange(of: soundEngine.heartbeatSyncEnabled) { _ in
                        soundEngine.savePreferences()
                    }
            }

            // Notification Preferences
            Section("Notification Preferences") {
                NavigationLink("Quiet Mode Schedule") {
                    QuietModeScheduleView()
                }
            }

            // Sound & Haptic Preview
            Section("Preview") {
                Picker("Notification Type", selection: $selectedPreviewType) {
                    ForEach(SoundEngine.SoundType.allCases, id: \.self) { type in
                        Text(typeName(type)).tag(type)
                    }
                }

                Button(action: {
                    previewNotification(selectedPreviewType)
                }) {
                    HStack {
                        Image(systemName: "play.circle.fill")
                        Text("Preview Sound & Haptic")
                    }
                }
            }
        }
        .navigationTitle("Notification Settings")
    }

    // MARK: - Helpers

    private func typeName(_ type: SoundEngine.SoundType) -> String {
        switch type {
        case .trustUp:
            return "Trust Up"
        case .anchorConfirmed:
            return "Anchor Confirmed"
        case .warning:
            return "Warning"
        case .failure:
            return "Failure"
        case .messageReceived:
            return "Message Received"
        }
    }

    private func previewNotification(_ type: SoundEngine.SoundType) {
        // Get corresponding haptic
        let hapticType: HapticFeedback.FeedbackType = {
            switch type {
            case .trustUp:
                return .trustHapticStrong
            case .anchorConfirmed:
                return .anchorDropHaptic
            case .warning:
                return .warningHapticLow
            case .failure:
                return .dangerHapticSharp
            case .messageReceived:
                return .messagePingHaptic
            }
        }()

        // Play preview
        soundEngine.play(type, withHaptic: hapticType)

        // Show visual preview
        showingPreview = true
    }
}

// MARK: - Quiet Mode Schedule View

struct QuietModeScheduleView: View {
    @AppStorage("quietModeEnabled") private var quietModeEnabled = false
    @AppStorage("quietModeStart") private var quietModeStart = 22 // 10 PM
    @AppStorage("quietModeEnd") private var quietModeEnd = 7 // 7 AM

    var body: some View {
        Form {
            Toggle("Enable Quiet Mode", isOn: $quietModeEnabled)

            if quietModeEnabled {
                Section("Schedule") {
                    DatePicker(
                        "Start Time",
                        selection: Binding(
                            get: {
                                Calendar.current.date(bySettingHour: quietModeStart, minute: 0, second: 0, of: Date()) ?? Date()
                            },
                            set: { date in
                                quietModeStart = Calendar.current.component(.hour, from: date)
                            }
                        ),
                        displayedComponents: .hourAndMinute
                    )

                    DatePicker(
                        "End Time",
                        selection: Binding(
                            get: {
                                Calendar.current.date(bySettingHour: quietModeEnd, minute: 0, second: 0, of: Date()) ?? Date()
                            },
                            set: { date in
                                quietModeEnd = Calendar.current.component(.hour, from: date)
                            }
                        ),
                        displayedComponents: .hourAndMinute
                    )
                }

                Section {
                    Text("During quiet mode, only gentle visual cues will be shown. Sound and haptics will be disabled.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .navigationTitle("Quiet Mode")
    }
}








