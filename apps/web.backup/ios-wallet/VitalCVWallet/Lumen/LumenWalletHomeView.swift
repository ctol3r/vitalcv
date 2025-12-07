// LumenWalletHomeView.swift

// Combining orb, orbital layout, compliance sky, and skill galaxy

import SwiftUI

struct LumenWalletHomeView: View {
    @EnvironmentObject var lumen: LumenContext

    // In real app, this would come from your credential store
    let sampleNodes: [OrbitalNode] = [
        .init(title: "CA Physician License", trust: 0.94, expiryProximity: 0.3),
        .init(title: "DEA X12345", trust: 0.87, expiryProximity: 0.6),
        .init(title: "Board Cert – Family Med", trust: 0.98, expiryProximity: 0.1),
        .init(title: "NPI Type 1", trust: 0.99, expiryProximity: 0.0),
        .init(title: "ACLS", trust: 0.92, expiryProximity: 0.4),
        .init(title: "Telemedicine Privileges", trust: 0.78, expiryProximity: 0.5)
    ]

    var body: some View {
        ZStack {
            ComplianceSkyOverlay()
            SkillGalaxyBackground()

            VStack(spacing: 24) {
                Spacer(minLength: 40)

                IdentityOrbView()
                    .padding(.bottom, 8)

                Text("Your Vital Identity")
                    .font(.title2.weight(.semibold))
                    .foregroundColor(.white.opacity(0.9))

                Text("A living view of your licenses, credentials, and trust across the system.")
                    .font(.footnote)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                Spacer()

                OrbitalLayout(nodes: sampleNodes)
                    .frame(height: 360)

                Spacer()
            }
            .padding(.bottom, 24)
        }
        .preferredColorScheme(.dark)
    }
}

struct LumenWalletHomeView_Previews: PreviewProvider {
    static var previews: some View {
        LumenWalletHomeView()
            .environmentObject(LumenContext())
    }
}

