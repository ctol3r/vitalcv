# Autopilot UI Scaffolding

This directory contains the complete autopilot UI scaffolding system for VitalCV Wallet iOS app.

## 📦 Components Created

### 1. **AutopilotToggleBar.swift**
Simple toggle bar with AppStorage persistence for autopilot on/off state.

**Features:**
- Uses `@AppStorage("autopilot_enabled")` for persistence
- Clean toggle UI with green tint
- Dark mode optimized

### 2. **AutopilotStatusCard.swift**
Status card displayed when autopilot is enabled.

**Features:**
- Displays dynamic status based on `lumen.snapshot.hasCriticalIssues`
- Shows Identity Orb with tap gesture for refresh
- Includes quick summary of credential status
- Uses `LumenContext` for state management

### 3. **AutopilotQuickSummary.swift**
Quick summary rows showing credential verification status.

**Features:**
- Shows status indicators for:
  - Credentials Verified
  - Telemedicine Ready
  - CME Status OK
  - DEA Active
  - Licenses Synced
- Green status dots for visual feedback

### 4. **ManualModeActions.swift**
Manual mode view displayed when autopilot is disabled.

**Features:**
- Swipeable card for credential actions
- Shows example CA Physician License with expiry info
- Integrates with `LumenSwipeableCard` component

### 5. **LumenSwipeableCard.swift**
Reusable swipeable card component for manual mode.

**Features:**
- Supports multiple swipe actions (verify, renew, custom)
- Smooth drag gesture handling
- Action buttons revealed on swipe
- Customizable action colors and styles

### 6. **AutopilotHomeView.swift**
Main container view that orchestrates autopilot UI.

**Features:**
- Conditional rendering based on autopilot toggle state
- Integrates `ComplianceSkyOverlay` and `SkillGalaxyBackground`
- Shows `AutopilotStatusCard` when enabled
- Shows `ManualModeActions` when disabled

### 7. **OnePageModeView.swift**
Ultra-simplified single-page view for minimal UI.

**Features:**
- One-line status message
- Single action button when issues exist
- Clean, focused design
- Perfect for quick status checks

## 🎨 Design Features

- **Dark Mode**: All components optimized for dark theme
- **Lumen Integration**: Uses `LumenContext` for trust/compliance state
- **Animations**: Smooth transitions and interactions
- **Accessibility**: Proper labels and semantic structure

## 🔧 Integration

### Using AutopilotHomeView

```swift
import SwiftUI

struct YourContentView: View {
    @StateObject private var lumen = LumenContext()

    var body: some View {
        AutopilotHomeView()
            .environmentObject(lumen)
    }
}
```

### Using OnePageModeView

```swift
struct SimplifiedView: View {
    @StateObject private var lumen = LumenContext()

    var body: some View {
        OnePageModeView()
            .environmentObject(lumen)
    }
}
```

## 📝 Next Steps

1. **AutopilotEngine**: Create the backend engine that powers the autopilot (100 tasks mentioned in spec)
2. **Action Handlers**: Implement actual actions for verify/renew buttons
3. **Data Binding**: Connect summary rows to real credential data
4. **Notifications**: Add push notifications for autopilot updates
5. **Testing**: Add unit tests for state management

## 🔗 Dependencies

- `LumenContext` - Trust/compliance state management
- `IdentityOrbView` - Core identity visualization
- `ComplianceSkyOverlay` - Background overlay
- `SkillGalaxyBackground` - Starfield background
- `LumenModifiers` - Glow and press effects

## 📚 Related Files

- `Lumen/LumenContext.swift` - State management
- `Lumen/LumenModifiers.swift` - View modifiers
- `Lumen/IdentityOrbView.swift` - Identity orb component
- `Lumen/ComplianceSkyOverlay.swift` - Sky overlay
- `Lumen/SkillGalaxyBackground.swift` - Galaxy background






