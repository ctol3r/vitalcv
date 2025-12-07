//
//  AutopilotToggleBar.swift
//  VitalCVWallet
//
//  Autopilot toggle bar with AppStorage persistence
//

import SwiftUI

struct AutopilotToggleBar: View {
    @AppStorage("autopilot_enabled") var autopilotEnabled: Bool = true

    var body: some View {
        HStack {
            Text("Autopilot")
                .font(.headline)
                .foregroundColor(.white)

            Spacer()

            Toggle("", isOn: $autopilotEnabled)
                .labelsHidden()
                .tint(Color.green.opacity(0.85))
        }
        .padding()
        .background(Color.black.opacity(0.4))
        .cornerRadius(16)
        .padding(.horizontal)
    }
}

struct AutopilotToggleBar_Previews: PreviewProvider {
    static var previews: some View {
        AutopilotToggleBar()
            .padding()
            .background(Color.black)
            .preferredColorScheme(.dark)
    }
}






