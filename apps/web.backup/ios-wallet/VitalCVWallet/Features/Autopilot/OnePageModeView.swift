//
//  OnePageModeView.swift
//  VitalCVWallet
//
//  Ultimate simplicity - one page mode view
//

import SwiftUI

struct OnePageModeView: View {
    @EnvironmentObject var lumen: LumenContext

    var body: some View {
        ZStack {
            ComplianceSkyOverlay()
            SkillGalaxyBackground()

            VStack(spacing: 22) {

                IdentityOrbView()
                    .frame(width: 160, height: 160)
                    .padding(.top, 40)

                Text(oneLineStatus)
                    .font(.title.bold())
                    .foregroundColor(.white)

                Text(subStatus)
                    .font(.footnote)
                    .foregroundColor(.white.opacity(0.7))

                if let action = nextAction {
                    OneTapFixButton(title: action)
                        .padding(.horizontal, 60)
                        .padding(.top, 12)
                }

                Spacer(minLength: 40)
            }
        }
    }

    var oneLineStatus: String {
        lumen.snapshot.hasCriticalIssues ? "One Issue To Fix" : "You're Ready"
    }

    var subStatus: String {
        lumen.snapshot.hasCriticalIssues
            ? "VitalCV has identified exactly one thing you should address."
            : "Everything is in good standing."
    }

    var nextAction: String? {
        lumen.snapshot.hasCriticalIssues ? "Fix Issue" : nil
    }
}

struct OneTapFixButton: View {
    let title: String

    var body: some View {
        Button(action: {
            // TODO: Implement fix action
            print("Fix action triggered")
        }) {
            Text(title)
                .font(.headline)
                .foregroundColor(.black)
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.white)
                .cornerRadius(12)
        }
    }
}

struct OnePageModeView_Previews: PreviewProvider {
    static var previews: some View {
        OnePageModeView()
            .environmentObject(LumenContext())
    }
}






