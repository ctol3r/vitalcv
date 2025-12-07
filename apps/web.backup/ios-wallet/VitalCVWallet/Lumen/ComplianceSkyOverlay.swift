// ComplianceSkyOverlay.swift

// "Compliance Weather" scaffold

import SwiftUI

struct ComplianceSkyOverlay: View {
    @EnvironmentObject var lumen: LumenContext

    var body: some View {
        Rectangle()
            .fill(Color.lumenComplianceSky(compliance: lumen.snapshot.complianceScore / 100.0))
            .ignoresSafeArea()
            .overlay(
                // TODO: add cloud bands, lightning, haze layers
                EmptyView()
            )
            .allowsHitTesting(false)
    }
}

struct ComplianceSkyOverlay_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            ComplianceSkyOverlay()
            VStack {
                IdentityOrbView()
                Text("Compliance Climate")
                    .foregroundColor(.white)
            }
        }
        .environmentObject(LumenContext())
        .preferredColorScheme(.dark)
    }
}

