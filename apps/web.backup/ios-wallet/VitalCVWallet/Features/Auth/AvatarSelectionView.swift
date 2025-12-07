//
//  AvatarSelectionView.swift
//  VitalCVWallet
//
//  Created: Batch 560 - Task 9
//  Avatar selection for personalization
//

import SwiftUI

/// AvatarSelectionView - Avatar selection interface for personalization
/// Allows users to select or customize their avatar
struct AvatarSelectionView: View {
    @State private var selectedAvatar: AvatarOption?
    @State private var customImage: UIImage?
    @State private var showingImagePicker = false

    let onAvatarSelected: (AvatarOption?) -> Void

    private let defaultAvatars: [AvatarOption] = [
        .init(id: "1", emoji: "👤", name: "Default"),
        .init(id: "2", emoji: "👨‍⚕️", name: "Doctor"),
        .init(id: "3", emoji: "👩‍⚕️", name: "Nurse"),
        .init(id: "4", emoji: "🧑‍🔬", name: "Researcher"),
        .init(id: "5", emoji: "👨‍🎓", name: "Student"),
        .init(id: "6", emoji: "👩‍💼", name: "Professional"),
        .init(id: "7", emoji: "🦸", name: "Hero"),
        .init(id: "8", emoji: "🌟", name: "Star")
    ]

    var body: some View {
        VStack(spacing: 24) {
            // Title
            Text("Choose Your Avatar")
                .font(WalletTypography.title2)
                .foregroundColor(.walletTextPrimary)

            Text("Personalize your identity")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)

            // Selected avatar preview
            if let avatar = selectedAvatar {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.walletPrimary.opacity(0.2),
                                    Color.walletPrimary.opacity(0.1)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 120, height: 120)

                    if let customImage = customImage {
                        Image(uiImage: customImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 120, height: 120)
                            .clipShape(Circle())
                    } else {
                        Text(avatar.emoji)
                            .font(.system(size: 60))
                    }
                }
                .overlay(
                    Circle()
                        .stroke(Color.walletPrimary, lineWidth: 3)
                )
            }

            // Avatar grid
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                // Custom image option
                Button(action: {
                    showingImagePicker = true
                }) {
                    ZStack {
                        Circle()
                            .fill(Color.walletCard)
                            .frame(width: 70, height: 70)

                        VStack(spacing: 4) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 24))
                                .foregroundColor(.walletPrimary)

                            Text("Custom")
                                .font(WalletTypography.caption1)
                                .foregroundColor(.walletTextSecondary)
                        }
                    }
                    .overlay(
                        Circle()
                            .stroke(
                                customImage != nil ? Color.walletPrimary : Color.clear,
                                lineWidth: 3
                            )
                    )
                }

                // Default avatars
                ForEach(defaultAvatars) { avatar in
                    AvatarOptionButton(
                        avatar: avatar,
                        isSelected: selectedAvatar?.id == avatar.id
                    ) {
                        selectedAvatar = avatar
                        customImage = nil
                        onAvatarSelected(avatar)
                    }
                }
            }
            .padding(.horizontal)

            // Confirm button
            if selectedAvatar != nil || customImage != nil {
                Button(action: {
                    if customImage != nil {
                        // Create custom avatar option
                        let customAvatar = AvatarOption(
                            id: "custom",
                            emoji: "",
                            name: "Custom",
                            customImage: customImage
                        )
                        onAvatarSelected(customAvatar)
                    } else if let avatar = selectedAvatar {
                        onAvatarSelected(avatar)
                    }
                }) {
                    Text("Confirm Selection")
                        .font(WalletTypography.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.walletPrimary)
                        .cornerRadius(WalletCornerRadius.medium)
                }
                .padding(.horizontal)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding()
        .sheet(isPresented: $showingImagePicker) {
            ImagePicker(image: $customImage)
        }
    }
}

struct AvatarOptionButton: View {
    let avatar: AvatarOption
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack {
                Circle()
                    .fill(isSelected ? Color.walletPrimary.opacity(0.2) : Color.walletCard)
                    .frame(width: 70, height: 70)

                if let customImage = avatar.customImage {
                    Image(uiImage: customImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 70, height: 70)
                        .clipShape(Circle())
                } else {
                    Text(avatar.emoji)
                        .font(.system(size: 40))
                }
            }
            .overlay(
                Circle()
                    .stroke(
                        isSelected ? Color.walletPrimary : Color.clear,
                        lineWidth: 3
                    )
            )
        }
    }
}

struct AvatarOption: Identifiable {
    let id: String
    let emoji: String
    let name: String
    var customImage: UIImage?

    init(id: String, emoji: String, name: String, customImage: UIImage? = nil) {
        self.id = id
        self.emoji = emoji
        self.name = name
        self.customImage = customImage
    }
}

// Image Picker (simplified - in production use proper UIImagePickerController wrapper)
struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = .photoLibrary
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
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

#Preview {
    AvatarSelectionView { avatar in
        print("Avatar selected: \(avatar?.name ?? "none")")
    }
    .padding()
    .background(Color.walletBackground)
}

