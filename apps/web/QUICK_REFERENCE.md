# VitalCV - Quick Reference Card

## 🚀 Getting Started

```bash
npm run dev
# Open http://localhost:3000
```

---

## 📍 Key Routes

| Route               | Description                     |
| ------------------- | ------------------------------- |
| `/`                 | Landing page                    |
| `/start`            | NPI search entry                |
| `/npi/[npi]`        | Public NPI profile + claim pane |
| `/npi/[npi]?auto=1` | Auto-open claim pane            |
| `/claim/[npi]`      | Standalone claim wizard         |
| `/graph`            | Network visualization           |
| `/workspace`        | Pane demo workspace             |
| `/wallet`           | Credential wallet               |
| `/issuer`           | Issuer dashboard                |
| `/verify`           | Verifier page                   |

---

## 🎨 Components Quick Reference

### Sliding Panes

```tsx
import { PaneProvider, usePanes } from '@/components/panes/PaneManager';

const { push, pop, clear } = usePanes();

push({
  title: 'My Pane',
  content: <YourComponent />,
  width: 700, // optional, default 520
});
```

### Network Graph

```tsx
import VitalGraph from '@/components/graph/VitalGraph';

const data = {
  nodes: [{ id: 'n1', group: 'holder', label: 'Name' }],
  links: [{ source: 'n1', target: 'n2', weight: 2 }],
};

<VitalGraph data={data} />;
```

### Theme Picker

```tsx
import { ThemePicker } from '@/components/ui/ThemePicker';
<ThemePicker />;
```

### Role Switcher

```tsx
import { useRole } from '@/app/providers';
const { role, setRole, roles } = useRole();
```

### Claim Wizard (Pane Version)

```tsx
import { ClaimWizardPane } from '@/components/claim/ClaimWizardPane';
<ClaimWizardPane npi="1234567890" />;
```

### Claim Status Chip

```tsx
import { ClaimStatusChip } from '@/components/ClaimStatusChip';
<ClaimStatusChip level={2} showLabel={true} />;
```

---

## 🎯 Common Tasks

### Open a Pane

```tsx
function MyComponent() {
  const { push } = usePanes();

  return (
    <button
      onClick={() =>
        push({
          title: 'Title',
          content: <div>Content</div>,
        })
      }
    >
      Open Pane
    </button>
  );
}
```

### Change Theme

```tsx
import { useTheme } from 'next-themes';
const { theme, setTheme } = useTheme();
setTheme('dark'); // 'light', 'dark', or 'system'
```

### Switch Role

```tsx
const { setRole } = useRole();
setRole('issuer'); // 'holder', 'issuer', or 'verifier'
```

### Track Telemetry

```tsx
import { useTelemetry } from '@/hooks/use-telemetry';
const { track } = useTelemetry();
track('claim_start', { npi: '1234567890' }, duration);
```

---

## 🔧 API Endpoints

### GET `/api/npi/lookup?npi=1234567890`

Fetch NPI from NPPES registry

### POST `/api/claim/basic`

```json
{ "npi": "1234567890", "email": "user@example.com" }
```

### POST `/api/claim/verify-pin`

```json
{ "npi": "1234567890", "pin": "123456" }
```

### POST `/api/claim/doc` (multipart)

```
npi: "1234567890"
file0: <File>
file1: <File>
```

### POST `/api/issuer/attest-request`

```json
{ "npi": "1234567890" }
```

---

## 🎨 Color Palette

### Node Types

- 🔵 **Holder**: #0ea5e9 (sky blue)
- 🟢 **Issuer**: #22c55e (green)
- 🟠 **Verifier**: #f59e0b (amber)
- 🟣 **Credential**: #a78bfa (violet)
- 🔴 **Job**: #ef4444 (red)

### Claim Levels

- ⚪ **L0**: Gray (unclaimed)
- 🔵 **L1**: Blue (email verified)
- 🟣 **L2**: Purple (identity verified)
- 🟢 **L3**: Green (issuer attested)

### Theme Palettes

- **Default**: Standard colors
- **Ocean**: Blue accent (#2196F3)
- **Violet**: Purple accent (#8B5CF6)

---

## 🧪 Testing

### Test NPIs (real from NPPES)

- `1801921148` - Individual physician
- `1538102066` - Nurse practitioner
- `1043233337` - Hospital (Type 2)

### Test Claims

```bash
# 1. Open dev server
npm run dev

# 2. Visit NPI page
http://localhost:3000/npi/1801921148

# 3. Click "Claim this NPI"
# Pane slides in

# 4. Enter email
# Check console for PIN

# 5. Verify PIN
# Proceed to Level 2
```

### Test Graph

```bash
# Visit graph page
http://localhost:3000/graph

# Try:
- Toggle group checkboxes
- Search "Dr" and click Focus
- Adjust physics sliders
- Drag nodes
```

---

## 📦 File Locations

### Core Types

- `lib/npi-types.ts` - All type definitions
- `lib/npi-client.ts` - API client

### Components

- `components/panes/PaneManager.tsx` - Sliding panes
- `components/graph/VitalGraph.tsx` - Network graph
- `components/claim/ClaimWizardPane.tsx` - Claim wizard
- `components/layout/Header.tsx` - App header

### Pages

- `app/start/page.tsx` - Entry point
- `app/npi/[npi]/page.tsx` - Profile + claim
- `app/graph/page.tsx` - Network view
- `app/workspace/page.tsx` - Demo workspace

### Config

- `app/providers.tsx` - Theme + Role contexts
- `app/layout.tsx` - Root layout

---

## 🐛 Debugging

### Check Role

```tsx
const { role, roles } = useRole();
console.log('Current role:', role);
console.log('Available roles:', roles);
```

### Check Theme

```tsx
const { theme } = useTheme();
console.log('Current theme:', theme);
```

### Check Pane Stack

```tsx
const { stack } = usePanes();
console.log('Open panes:', stack.length);
```

### Check Session

```tsx
const { session } = useSession();
console.log('Session:', session);
```

### Console Shortcuts

```javascript
// View localStorage
localStorage.getItem('vitalcv_role');
localStorage.getItem('vitalcv_palette');
localStorage.getItem('vital-cv-session');

// Clear all
localStorage.clear();
```

---

## ⚡ Performance Tips

1. **Graph**: Limit to <100 nodes for smooth 60fps
2. **Panes**: Close unused panes to free memory
3. **Images**: Compress before upload (<500KB)
4. **Theme**: System theme avoids flash
5. **localStorage**: Clear old data periodically

---

## 🎓 Learning Resources

- **Framer Motion**: https://www.framer.com/motion/
- **next-themes**: https://github.com/pacocoursey/next-themes
- **react-force-graph**: https://github.com/vasturiano/react-force-graph
- **NPPES API**: https://npiregistry.cms.hhs.gov/api-page
- **Next.js**: https://nextjs.org/docs

---

## 📞 Need Help?

1. Check `ENHANCED_FEATURES.md` for detailed docs
2. Check `NPI_QUICK_START.md` for testing guide
3. Check `COMPLETE_IMPLEMENTATION_SUMMARY.md` for overview
4. Check browser console for errors
5. Check Network tab for API calls

---

## ✅ Quick Checklist

Before committing:

- [ ] `npm run lint` passes
- [ ] No console errors
- [ ] Panes open/close smoothly
- [ ] Theme switches work
- [ ] Graph renders correctly
- [ ] Mobile responsive
- [ ] Accessibility tested

---

**Quick Reference v2.0** | Last Updated: Oct 24, 2025
