//
//  AutopilotStatusCard.swift
//  VitalCVWallet
//
//  Status card displayed when autopilot is enabled
//

import SwiftUI

struct AutopilotStatusCard: View {
    @EnvironmentObject var lumen: LumenContext

    var nextAction: String {
        switch lumen.snapshot.hasCriticalIssues {
        case true: return "Fix 1 Issue"
        case false: return "You're All Set"
        }
    }

    var body: some View {
        VStack(spacing: 16) {
            Text(nextAction)
                .font(.largeTitle.bold())
                .foregroundColor(.white)

            Text("VitalCV is running everything in the background.")
                .foregroundColor(.white.opacity(0.7))
                .font(.subheadline)

            IdentityOrbView()
                .frame(width: 160, height: 160)
                .lumenPressEffect()
                .onTapGesture {
                    // Tap orb → refresh everything
                    lumen.triggerTrustPulse()
                }

            AutopilotQuickSummary()
        }
        .padding()
        .background(Color.black.opacity(0.5))
        .cornerRadius(24)
        .padding(.horizontal, 24)
    }
}

struct AutopilotStatusCard_Previews: PreviewProvider {
    static var previews: some View {
        AutopilotStatusCard()
            .environmentObject(LumenContext())
            .padding()
            .background(Color.black)
            .preferredColorScheme(.dark)
    }
}






