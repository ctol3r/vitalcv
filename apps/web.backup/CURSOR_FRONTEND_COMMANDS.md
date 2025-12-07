# 🎨 VitalCV Frontend - Cursor Commands

**Quick reference for frontend development**

---

## ⚡ Quick Start

```bash
# Auto-configure from backend ngrok
cd /Users/christoler/v0-vital-cv-frontend-mvp
bash scripts/cursor_setup_agent_env.sh
npm run dev
```

---

## 🚀 Development

### Start Dev Server

```bash
cd /Users/christoler/v0-vital-cv-frontend-mvp
npm run dev
```

Open: http://localhost:3000

### Build for Production

```bash
npm run build
npm start
```

### Run Tests

```bash
npm test
npm run test:watch
```

### Lint

```bash
npm run lint
```

---

## 🔧 Configuration

### View Current Environment

```bash
cat .env.local
```

### Manual Environment Setup

```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_AGENT_BASE=https://YOUR-NGROK-URL/api/agent
NEXT_PUBLIC_API_URL=https://YOUR-NGROK-URL
NEXT_PUBLIC_AGENT_PREVIEW=1
EOF
```

Replace `YOUR-NGROK-URL` with actual ngrok URL from backend.

### Get Ngrok URL from Backend

```bash
cat /tmp/vitalcv_ngrok_url.txt
```

---

## 🎯 Testing Routes

```bash
# Agent UI
open http://localhost:3000/agent

# Verification
open http://localhost:3000/verify

# Admin - Traces
open http://localhost:3000/admin/traces

# Admin - MCPs
open http://localhost:3000/admin/mcps

# Dashboard
open http://localhost:3000/dashboard

# Profile
open http://localhost:3000/profile

# Wallet
open http://localhost:3000/wallet
```

---

## 🧪 Test Agent Integration

### Browser Console Test

Open http://localhost:3000/agent and paste in browser console:

```javascript
// Test agent client
const result = await fetch(process.env.NEXT_PUBLIC_AGENT_BASE + '/solve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'lookup NPI',
    input: { npi: '1234567893' },
    scopeHints: ['npi']
  })
});
console.log(await result.json());
```

### cURL Test (from terminal)

```bash
# Get agent base URL
AGENT_BASE=$(grep NEXT_PUBLIC_AGENT_BASE .env.local | cut -d= -f2)

# Test solve endpoint
curl -X POST $AGENT_BASE/solve \
  -H "Content-Type: application/json" \
  -d '{
    "task": "test",
    "input": {},
    "scopeHints": []
  }'
```

---

## 📝 Edit Agent UI

### Add New Preset

Edit `app/components/AgentAssistant.tsx`:

```bash
code app/components/AgentAssistant.tsx
```

Find the preset buttons section (around line 50) and add:

```typescript
<button
  className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
  onClick={() =>
    loadPreset(
      "your task description",
      { yourInput: "value" },
      ["scope1", "scope2"]
    )
  }
>
  Your Preset Name
</button>
```

### Modify Agent Client

Edit `app/lib/agentClient.ts`:

```bash
code app/lib/agentClient.ts
```

### Create New Agent Page

```bash
mkdir -p app/your-page
cat > app/your-page/page.tsx <<'EOF'
"use client";

import { useState } from "react";
import { solveTask } from "../lib/agentClient";

export default function YourPage() {
  const [result, setResult] = useState<any>();

  const runAgent = async () => {
    const res = await solveTask(
      "your task",
      { input: "data" }
    );
    setResult(res);
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Your Feature</h1>
      <button
        onClick={runAgent}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Run Agent
      </button>
      {result && (
        <pre className="mt-4 p-4 bg-gray-50 rounded">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
EOF
```

Open: http://localhost:3000/your-page

---

## 🔍 Debugging

### Check Environment Variables

```bash
# In browser console (http://localhost:3000/agent)
console.log({
  agentBase: process.env.NEXT_PUBLIC_AGENT_BASE,
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  preview: process.env.NEXT_PUBLIC_AGENT_PREVIEW
});
```

### View Network Requests

1. Open http://localhost:3000/agent
2. Open DevTools (F12)
3. Go to Network tab
4. Click a preset
5. Click "Execute Agent Task"
6. Check the POST request to `/api/agent/solve`

### Check API Response

```bash
# Get the ngrok URL from .env.local
AGENT_BASE=$(grep NEXT_PUBLIC_AGENT_BASE .env.local | cut -d= -f2)

# Test it
curl $AGENT_BASE/solve \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"task":"test"}' | jq
```

---

## 🎨 Component Files

```bash
# Agent components
code app/components/AgentAssistant.tsx
code app/components/TraceViewer.tsx

# Agent library
code app/lib/agentClient.ts
code app/lib/feedback.ts

# Agent pages
code app/agent/page.tsx
code app/verify/page.tsx
code app/admin/traces/page.tsx
code app/admin/mcps/page.tsx
```

---

## 📦 Dependencies

### Install/Update

```bash
npm install
```

### Add New Dependency

```bash
npm install package-name
```

### Agent-Related Packages (Already Installed)

- `axios` - HTTP client
- `swr` - Data fetching
- `zod` - Validation
- `@radix-ui/*` - UI components
- `tailwindcss` - Styling

---

## 🔄 Common Workflows

### Workflow 1: Backend Changed

```bash
# 1. Backend updated ngrok URL
cd /Users/christoler/backend
bash scripts/cursor_status.sh  # Get new URL

# 2. Reconfigure frontend
cd /Users/christoler/v0-vital-cv-frontend-mvp
bash scripts/cursor_setup_agent_env.sh

# 3. Restart dev server
# Ctrl+C in dev server terminal, then:
npm run dev
```

### Workflow 2: Add New Feature

```bash
# 1. Create new page
mkdir -p app/my-feature
code app/my-feature/page.tsx

# 2. Import agent client
# Add to page.tsx:
# import { solveTask } from "../lib/agentClient";

# 3. Test at http://localhost:3000/my-feature
```

### Workflow 3: Debug Agent Errors

```bash
# 1. Check environment
cat .env.local

# 2. Test backend directly
curl $(grep NEXT_PUBLIC_AGENT_BASE .env.local | cut -d= -f2)/solve \
  -X POST -H "Content-Type: application/json" -d '{"task":"test"}'

# 3. Check browser console
# Open DevTools → Console

# 4. Check network tab
# DevTools → Network → Look for failed requests
```

---

## 🆘 Troubleshooting

### Port 3000 Already in Use

```bash
lsof -ti :3000 | xargs kill -9
npm run dev
```

### Environment Not Loading

```bash
# Delete and recreate
rm .env.local
bash scripts/cursor_setup_agent_env.sh

# Restart Next.js (required for env changes)
# Ctrl+C, then:
npm run dev
```

### Agent Requests Failing

```bash
# 1. Check .env.local has correct URL
cat .env.local | grep AGENT_BASE

# 2. Test that URL
curl -I $(grep NEXT_PUBLIC_AGENT_BASE .env.local | cut -d= -f2 | sed 's|/api/agent||')

# 3. Check CORS (should see 200 OK)
```

### Stale Cache

```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

---

## 📚 Documentation

```bash
# Frontend guide
code CURSOR_AGENT_FRONTEND.md

# This file
code CURSOR_FRONTEND_COMMANDS.md

# Backend commands
code /Users/christoler/backend/CURSOR_COMMANDS.md
```

---

**🔖 Quick Access**: `Cmd+P` → "CURSOR_FRONTEND" → Enter

