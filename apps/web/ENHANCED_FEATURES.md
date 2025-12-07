# Enhanced Features: Sliding Panes + Graph Visualization

## 🎨 What's New

This update adds four major enhancements to the NPI claim system:

1. **Craft-Style Sliding Panes** with Framer Motion
2. **Obsidian-Style Network Graph** with interactive controls
3. **Enhanced Theme System** with dark mode and color palettes
4. **Improved Role Switcher** in the header

---

## 🚀 New Features

### 1. Sliding Panes (Framer Motion)

Beautiful, animated side panels for contextual workflows:

- **Smooth animations** powered by Framer Motion
- **Stackable panes** with visual depth (12px offset per pane)
- **Click outside to close** or use the X button
- **Responsive** - full width on mobile, fixed width on desktop
- **Spring physics** for natural motion (stiffness: 280, damping: 28)

**Usage:**

```tsx
import { PaneProvider, usePanes } from '@/components/panes/PaneManager';

function MyComponent() {
  const { push, pop, clear } = usePanes();

  return (
    <button
      onClick={() =>
        push({
          title: 'Claim NPI',
          content: <ClaimWizardPane npi="1234567890" />,
          width: 700,
        })
      }
    >
      Open Pane
    </button>
  );
}

export default function Page() {
  return (
    <PaneProvider>
      <MyComponent />
    </PaneProvider>
  );
}
```

### 2. Network Graph Visualization

Interactive force-directed graph for visualizing credential networks:

- **5 node types**: Holder, Issuer, Verifier, Credential, Job
- **Interactive physics controls**: center force, repel force, link distance
- **Search & Focus**: Find nodes by ID or label, zoom in smoothly
- **Filter by group**: Toggle node types on/off
- **Color-coded**: Blue (holder), Green (issuer), Orange (verifier), Purple (cred), Red (job)
- **Responsive toolbar**: Controls panel with sliders

**Usage:**

```tsx
import VitalGraph from '@/components/graph/VitalGraph';

const data = {
  nodes: [
    { id: 'NPI:123', group: 'holder', label: 'Dr Smith' },
    { id: 'CA-Board', group: 'issuer', label: 'CA Medical' },
  ],
  links: [{ source: 'CA-Board', target: 'NPI:123', weight: 2 }],
};

<VitalGraph data={data} />;
```

### 3. Theme System

Enhanced theming with dark mode and color palettes:

- **Three modes**: System, Light, Dark
- **Three palettes**: Default, Ocean (blue), Violet (purple)
- **Persisted**: localStorage saves preferences
- **Instant switching**: No page reload needed

**ThemePicker Component:**

```tsx
<ThemePicker />
```

### 4. Header with Role Switcher

Unified header with role management:

- **Visual role switcher**: Holder/Issuer/Verifier buttons
- **Active state**: Dark background for selected role
- **Quick navigation**: Links to Start, Network, Workspace
- **Sticky header**: Always visible at top

---

## 📁 New Files Created

### Core Providers

- `app/providers.tsx` - Theme + Role context providers
- `components/ui/ThemePicker.tsx` - Theme and palette selector

### Components

- `components/layout/Header.tsx` - Main app header
- `components/panes/PaneManager.tsx` - Sliding pane system
- `components/claim/ClaimWizardPane.tsx` - Claim wizard for panes
- `components/graph/VitalGraph.tsx` - Network visualization
- `components/ui/slider.tsx` - Range slider for controls

### Pages

- `app/graph/page.tsx` - Network visualization page
- `app/workspace/page.tsx` - Demo workspace with panes

### Updated Files

- `app/layout.tsx` - Integrated Providers and Header
- `app/npi/[npi]/page.tsx` - Opens claim wizard in pane

---

## 🎯 User Flows

### Flow 1: NPI Lookup → Claim (with Pane)

1. Navigate to `/npi/1234567890`
2. View public NPI profile
3. Click "Claim this NPI"
4. **Pane slides in from right** with claim wizard
5. Complete 3-step verification in pane
6. Click outside or X to close

**Auto-open:** `/npi/1234567890?auto=1` opens pane automatically

### Flow 2: Network Visualization

1. Navigate to `/graph`
2. See force-directed graph of NPI network
3. Use toolbar to:
   - Filter by group type
   - Search for specific node
   - Click "Focus" to zoom in
   - Adjust physics with sliders

### Flow 3: Workspace Demo

1. Navigate to `/workspace`
2. Click quick actions to open panes
3. Stack multiple panes to work on different tasks
4. Close panes individually or all at once

---

## 🎨 Design Decisions

### Why Sliding Panes?

- **Context preservation**: Main content stays visible
- **Smooth UX**: Animated transitions feel premium
- **Stackable**: Handle multiple tasks simultaneously
- **Mobile-friendly**: Full-screen on small devices

### Why Force-Directed Graph?

- **Visual relationships**: See connections at a glance
- **Interactive exploration**: Physics-based layout
- **Customizable**: Adjust forces for different layouts
- **Scalable**: Handles large networks efficiently

### Color System

**Node Colors:**

- 🔵 Blue (#0ea5e9) - Holder (clinician)
- 🟢 Green (#22c55e) - Issuer (board, authority)
- 🟠 Orange (#f59e0b) - Verifier (employer)
- 🟣 Purple (#a78bfa) - Credential
- 🔴 Red (#ef4444) - Job posting

**Theme Palettes:**

- **Default**: Native shadcn/ui colors
- **Ocean**: Blue accent (#2196F3, #38BFFF)
- **Violet**: Purple accent (#8B5CF6, #A855F7)

---

## 🔧 Technical Details

### Dependencies Added

```json
{
  "framer-motion": "^11.x",
  "next-themes": "^0.x",
  "react-force-graph-2d": "^1.x",
  "three": "^0.x",
  "clsx": "^2.x"
}
```

### Animation Settings

**Pane Slide:**

- Type: Spring
- Stiffness: 280
- Damping: 28
- Offset: 12px per stacked pane

**Graph:**

- Velocity decay: 0.3
- Cooldown: 100 ticks
- Node size: 6 (rel size)
- Link width: 1-4px (based on weight)

### Performance Optimizations

1. **Dynamic Import**: `react-force-graph-2d` loaded client-side only (no SSR)
2. **Memoized Data**: Graph filters use `useMemo` to avoid recalculation
3. **Context Optimization**: Role/theme contexts use `useMemo` for value
4. **LocalStorage**: Preferences persisted without server roundtrip

---

## 🧪 Testing the New Features

### Test Sliding Panes

```bash
# Open dev server
npm run dev

# Visit these URLs:
http://localhost:3000/npi/1234567890
http://localhost:3000/workspace
```

**Expected behavior:**

- Pane slides in smoothly from right
- Backdrop appears behind pane
- Click backdrop to close
- Stack multiple panes by opening more

### Test Graph

```bash
# Visit graph page
http://localhost:3000/graph
```

**Try:**

- Toggle group checkboxes to filter nodes
- Search for "Dr" and click Focus
- Adjust sliders to see physics changes
- Drag nodes to rearrange

### Test Theme System

**In header:**

1. Select "Dark" theme - page turns dark
2. Select "Ocean" palette - blue accents
3. Select "Light" + "Violet" - purple light theme
4. Refresh page - preferences persist

---

## 📊 Component API Reference

### PaneManager

```tsx
interface PaneAPI {
  push: (pane: { title: string; content: ReactNode; width?: number; key?: string }) => void;
  pop: (key?: string) => void; // close specific or last pane
  clear: () => void; // close all panes
  stack: Pane[]; // current stack
}
```

### VitalGraph

```tsx
interface GraphData {
  nodes: Array<{
    id: string;
    group?: 'holder' | 'issuer' | 'verifier' | 'cred' | 'job';
    label?: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    weight?: number;
  }>;
}

<VitalGraph data={GraphData} />;
```

### useRole (from Providers)

```tsx
const {
  role, // current: 'holder' | 'issuer' | 'verifier'
  setRole, // switch role
  roles, // available roles array
  setRoles, // update available roles
} = useRole();
```

---

## 🚀 Next Steps

### Potential Enhancements

1. **Pane History**: Back/forward navigation within panes
2. **Pane Persistence**: Save open panes to localStorage
3. **Graph Export**: Download graph as image/JSON
4. **Graph Layouts**: Toggle between force/tree/radial layouts
5. **More Palettes**: Add 5-10 color themes
6. **Pane Resize**: Drag to resize pane width
7. **Graph Filtering**: Advanced filters (by date, status, etc)

### Integration Ideas

1. **Credential Details Pane**: Click credential in graph → open detail pane
2. **Multi-NPI Claims**: Stack multiple claim wizards
3. **Issuer Workflow**: Approve attestations in panes
4. **Verifier Dashboard**: Verify multiple credentials in panes
5. **Graph + Pane**: Click node → open related pane

---

## 🎓 Learning Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [next-themes](https://github.com/pacocoursey/next-themes)
- [react-force-graph](https://github.com/vasturiano/react-force-graph)
- [D3 Force Simulation](https://d3js.org/d3-force)

---

## ✅ Checklist

- [x] Install dependencies (framer-motion, next-themes, etc)
- [x] Create Providers with Theme + Role contexts
- [x] Build PaneManager with Framer Motion
- [x] Create ClaimWizardPane for pane usage
- [x] Build VitalGraph with force-directed layout
- [x] Add ThemePicker with dark mode + palettes
- [x] Create new Header with role switcher
- [x] Update layout.tsx with Providers
- [x] Create /graph and /workspace pages
- [x] Update /npi/[npi] to use panes
- [x] Test all features
- [x] Document usage

**Status**: ✅ Complete and production-ready!

---

**Last Updated**: October 24, 2025
**Version**: 2.0 - Enhanced UI Edition
