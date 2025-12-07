// SkillGalaxyBackground.swift

// Simple skill constellation backdrop scaffold

import SwiftUI

struct SkillStar: Identifiable {
    let id = UUID()
    let position: CGPoint
    let brightness: Double
}

struct SkillGalaxyBackground: View {
    let stars: [SkillStar]

    init(count: Int = 80, in size: CGSize = CGSize(width: 400, height: 800)) {
        var tmp: [SkillStar] = []
        for _ in 0..<count {
            let x = Double.random(in: 0..<size.width)
            let y = Double.random(in: 0..<size.height)
            let b = Double.random(in: 0.1...1.0)
            tmp.append(SkillStar(position: CGPoint(x: x, y: y), brightness: b))
        }
        self.stars = tmp
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(stars) { star in
                    Circle()
                        .fill(Color.white.opacity(star.brightness))
                        .frame(width: max(1, star.brightness * 2),
                               height: max(1, star.brightness * 2))
                        .position(
                            x: star.position.x.truncatingRemainder(dividingBy: geo.size.width),
                            y: star.position.y.truncatingRemainder(dividingBy: geo.size.height)
                        )
                }
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

struct SkillGalaxyBackground_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            SkillGalaxyBackground()
            IdentityOrbView()
        }
        .environmentObject(LumenContext())
        .background(Color.black)
        .preferredColorScheme(.dark)
    }
}

