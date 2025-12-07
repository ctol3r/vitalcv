# 🎨 V0 Frontend Agent Integration Guide

Quick reference for testing and extending the VitalCV agent UI from Cursor.

## 🚀 Quick Start

```bash
# Auto-configure from backend ngrok
bash scripts/cursor_setup_agent_env.sh

# Or manually create .env.local:
cat > .env.local <<EOF
NEXT_PUBLIC_AGENT_BASE=https://YOUR-NGROK.ngrok-free.app/api/agent
NEXT_PUBLIC_API_URL=https://YOUR-NGROK.ngrok-free.app
NEXT_PUBLIC_AGENT_PREVIEW=1
EOF

# Start dev server
npm run dev
```

Visit: http://localhost:3000/agent

## 📁 Agent Files (Already Built)

### Core Files

```
app/
├── lib/
│   ├── agentClient.ts          # Agent API client
│   └── feedback.ts             # Agent feedback system
├── components/
│   ├── AgentAssistant.tsx      # Main agent UI
│   └── TraceViewer.tsx         # Execution trace viewer
├── agent/
│   └── page.tsx                # Agent playground page
├── verify/
│   └── page.tsx                # Credential verification
└── admin/
    ├── traces/page.tsx         # Trace browser
    └── mcps/page.tsx           # MCP resource browser
```

### API Proxy Routes

```
app/api/
├── _proxy_traces/route.ts      # Proxy to backend traces
└── _proxy_mcps/route.ts        # Proxy to backend MCPs
```

## 🎯 Using the Agent UI

### 1. Agent Playground (`/agent`)

The main testing interface with presets:

**Presets Available:**
- **Verify License** - Test medical license verification
- **Resume → Matches** - Parse resume and find job matches
- **NPI Lookup** - Validate NPI and credentials

**Custom Execution:**
1. Enter task description (natural language)
2. Provide input JSON
3. Add scope hints (comma-separated: `license, npi, matcher`)
4. Click "Execute Agent Task"

### 2. Verify Page (`/verify`)

Simplified credential verification:
- Input: File ID or credential reference
- Input: State (e.g., CA, NY)
- Click "Run" → Agent verifies credential

### 3. Admin Pages

**Traces** (`/admin/traces`)
- View all agent execution traces
- See tool calls, reasoning steps, results
- Debug failed executions

**MCPs** (`/admin/mcps`)
- Browse available MCP resources
- Search knowledge base
- View resource metadata

## 🔧 Extending the UI

### Add a New Preset

Edit `app/components/AgentAssistant.tsx`:

```tsx
<button
  className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
  onClick={() =>
    loadPreset(
      "your task description",
      { yourInput: "data" },
      ["scope1", "scope2"]
    )
  }
>
  Your Preset Name
</button>
```

### Create a Custom Agent Page

```tsx
// app/your-feature/page.tsx
"use client";

import { useState } from "react";
import { solveTask } from "../lib/agentClient";

export default function YourFeature() {
  const [result, setResult] = useState<any>();

  const runAgent = async () => {
    const res = await solveTask(
      "your task",
      { input: "data" },
      ["scopes"]
    );
    setResult(res);
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <button onClick={runAgent}>Run Agent</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
```

### Use Agent Client Directly

```tsx
import { solveTask, searchMcp } from "../lib/agentClient";

// Solve a task
const result = await solveTask(
  "verify medical license",
  { state: "CA", licensePdfId: "file_abc" },
  ["license"]
);

// Search MCP knowledge
const resources = await searchMcp("license requirements", ["license"]);
```

## 🎨 Styling Guide

The UI uses Tailwind CSS. Common patterns:

```tsx
// Container
<div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">

// Input
<input className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />

// Button (primary)
<button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">

// Button (secondary)
<button className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50">

// Success result
<div className="p-4 rounded-lg bg-green-50">

// Error result
<div className="p-4 rounded-lg bg-red-50">
```

## 🧪 Testing Agent Integration

### 1. Unit Test Agent Client

```typescript
// __tests__/agentClient.test.ts
import { solveTask } from '../app/lib/agentClient';

describe('Agent Client', () => {
  it('should solve task', async () => {
    const result = await solveTask(
      'test task',
      { data: 'test' }
    );
    expect(result).toBeDefined();
  });
});
```

### 2. E2E Test with Playwright/Cypress

```typescript
// cypress/e2e/agent.cy.ts
describe('Agent UI', () => {
  it('should execute preset', () => {
    cy.visit('/agent');
    cy.contains('Verify License').click();
    cy.contains('Execute Agent Task').click();
    cy.get('pre').should('contain', 'success');
  });
});
```

### 3. Manual Testing Checklist

- [ ] Visit `/agent` - UI loads
- [ ] Click "Verify License" preset - fields populate
- [ ] Click "Execute Agent Task" - request sent
- [ ] Result appears in green/red box
- [ ] Visit `/admin/traces` - traces visible
- [ ] Visit `/admin/mcps` - resources visible

## 🔍 Troubleshooting

### "Failed to fetch" errors

1. Check `.env.local` exists and has correct ngrok URL
2. Restart dev server after changing env: `npm run dev`
3. Verify backend is accessible: `curl $NEXT_PUBLIC_API_URL/metrics`

### CORS errors

Backend should have CORS enabled. If not:

```typescript
// backend/src/app.ts
import cors from 'cors';
app.use(cors());
```

### Empty results

1. Check browser console for errors
2. Verify `NEXT_PUBLIC_AGENT_BASE` includes `/api/agent`
3. Test backend directly:
   ```bash
   curl -X POST $NEXT_PUBLIC_AGENT_BASE/solve \
     -H "Content-Type: application/json" \
     -d '{"task":"test","input":{}}'
   ```

### Presets not working

Verify scope hints match backend MCP scopes:
- `license` - License verification tools
- `npi` - NPI lookup tools
- `matcher` - Job matching tools

## 📊 Agent Response Structure

```typescript
interface AgentResponse {
  success: boolean;
  result?: any;
  trace?: {
    task: string;
    steps: Array<{
      tool: string;
      input: any;
      output: any;
      reasoning: string;
    }>;
    duration_ms: number;
  };
  error?: string;
}
```

## 🎯 Common Use Cases

### 1. Medical License Verification

```typescript
await solveTask(
  "verify medical license",
  {
    state: "CA",
    licensePdfId: "file_...",
    providerName: "Dr. Smith"
  },
  ["license"]
);
```

### 2. NPI Validation

```typescript
await solveTask(
  "validate NPI and check credentials",
  { npi: "1234567893" },
  ["npi", "license"]
);
```

### 3. Resume Parsing + Matching

```typescript
await solveTask(
  "parse resume and suggest matching jobs",
  {
    resumeText: "MD with 10 years...",
    location: "California"
  },
  ["matcher"]
);
```

### 4. Multi-step Credential Check

```typescript
await solveTask(
  "lookup NPI, verify license, and check for sanctions",
  { npi: "1234567893" },
  ["npi", "license", "sanctions"]
);
```

## 🔗 Backend Endpoints

The agent client calls these endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/agent/solve` | Execute agent task |
| `GET /api/agent/mcp/search` | Search MCP resources |
| `GET /api/agent/mcp/resources` | List available resources |

## 📦 Environment Variables

```bash
# Required
NEXT_PUBLIC_AGENT_BASE=https://abc.ngrok-free.app/api/agent

# Optional
NEXT_PUBLIC_API_URL=https://abc.ngrok-free.app
NEXT_PUBLIC_AGENT_PREVIEW=1
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

## ✨ Features Already Built

✅ Agent client with TypeScript types
✅ Preset task templates
✅ JSON input validation
✅ Scope hint system
✅ Success/error styling
✅ Trace viewer
✅ MCP resource browser
✅ Responsive design
✅ Loading states
✅ Error handling

---

**Quick Links:**
- Backend Setup: `/Users/christoler/backend/CURSOR_AGENT_QUICKSTART.md`
- Agent API: `app/lib/agentClient.ts`
- Main UI: `app/components/AgentAssistant.tsx`

**Created**: 2025-11-03
**Cursor-Ready**: ✅

