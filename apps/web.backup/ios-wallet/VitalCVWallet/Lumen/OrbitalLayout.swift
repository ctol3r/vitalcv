// OrbitalLayout.swift

// Basic orbital layout scaffold for credentials around the identity orb

import SwiftUI

struct OrbitalNode: Identifiable {
    let id: UUID = UUID()
    let title: String
    let trust: Double   // 0...1
    let expiryProximity: Double // 0...1 (1 = very near expiry)
}

struct OrbitalLayout: View {
    @EnvironmentObject var lumen: LumenContext
    let nodes: [OrbitalNode]

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Center orb anchor point
                IdentityOrbView()
                    .position(x: geo.size.width / 2, y: geo.size.height / 2)

                ForEach(Array(nodes.enumerated()), id: \.1.id) { index, node in
                    OrbitingNodeView(node: node, index: index, count: nodes.count)
                        .environmentObject(lumen)
                        .frame(width: 80, height: 80)
                }
            }
        }
    }
}

struct OrbitingNodeView: View {
    @EnvironmentObject var lumen: LumenContext
    let node: OrbitalNode
    let index: Int
    let count: Int

    var angle: Angle {
        let fraction = Double(index) / Double(max(count, 1))
        return .degrees(fraction * 360.0)
    }

    var body: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width/2, y: geo.size.height/2)
            let radius = lumen.physics.orbitBaseRadius
                + lumen.physics.orbitRadiusVariance * node.expiryProximity

            let radians = angle.radians
            let x = center.x + CGFloat(cos(radians)) * radius
            let y = center.y + CGFloat(sin(radians)) * radius

            CredentialOrbCard(node: node)
                .position(x: x, y: y)
        }
    }
}

struct CredentialOrbCard: View {
    let node: OrbitalNode

    var body: some View {
        let color = Color.lumenTrustColor(trust: node.trust)
        VStack(spacing: 6) {
            Circle()
                .fill(
                    RadialGradient(colors: [color.opacity(0.9), Color.black],
                                   center: .center,
                                   startRadius: 3,
                                   endRadius: 40)
                )
                .lumenGlow(color: color, radius: 18, opacity: 0.85)

            Text(node.title)
                .font(.caption2)
                .foregroundColor(.white.opacity(0.9))
                .lineLimit(2)
                .multilineTextAlignment(.center)
        }
    }
}

struct OrbitalLayout_Previews: PreviewProvider {
    static var previews: some View {
        OrbitalLayout(nodes: [
            .init(title: "CA Medical License", trust: 0.93, expiryProximity: 0.2),
            .init(title: "DEA X1234", trust: 0.88, expiryProximity: 0.5),
            .init(title: "Board Cert FM", trust: 0.95, expiryProximity: 0.1),
            .init(title: "NPI Type 1", trust: 0.99, expiryProximity: 0.0)
        ])
        .environmentObject(LumenContext())
        .background(Color.black)
        .preferredColorScheme(.dark)
    }
}

