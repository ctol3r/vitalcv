# VitalCV Troubleshooting Guide

## 🔧 Common Issues & Solutions

---

## Issue: CORS Errors

### Symptoms (CORS Errors)

```text
Access to fetch at 'http://localhost:4000/...' from origin 'http://localhost:3005'
has been blocked by CORS policy
```

### Solutions (CORS Errors)

#### 1. Check Backend CORS Configuration

```javascript
// In backend server.js or app.js
app.use(
  cors({
    origin: 'http://localhost:3005',
    credentials: true,
  }),
);
```

#### 2. Verify Environment Variables

```bash
# Frontend .env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# Backend .env
FRONTEND_URL=http://localhost:3005
```

#### 3. Check Port Availability

```bash
# Backend should be on 4000
lsof -i :4000

# Frontend should be on 3005
lsof -i :3005
```

---

## Issue: Backend Not Responding

### Symptoms (Backend Not Responding)

- Red "Offline" banner appears
- 500/502 errors in console
- "Failed to fetch" errors

### Solutions (Backend Not Responding)

#### 1. Verify Backend is Running

```bash
# Test health endpoint
curl http://localhost:4000/healthz

# Should return: {"status":"ok"}
```

#### 2. Check Backend Logs

```bash
cd ../chai-vc-platform
npm run dev

# Look for:
# ✓ Server listening on port 4000
# ✓ Database connected (if applicable)
```

#### 3. Restart Backend

```bash
# Kill existing process
pkill -f "node.*4000"

# Restart
npm run dev
```

---

## Issue: Frontend Won't Start

### Symptoms (Frontend Won't Start)

- `Error: Port 3005 is already in use`
- Build errors
- Module not found errors

### Solutions (Frontend Won't Start)

#### 1. Port Already in Use

```bash
# Find process using port 3005
lsof -i :3005

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3006 pnpm dev
```

#### 2. Clear Next.js Cache

```bash
rm -rf .next
pnpm dev
```

#### 3. Reinstall Dependencies

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## Issue: Build Failures

### Symptoms (Build Failures)

- `Type error: ...` during build
- `Module not found` errors
- Failed production build

### Solutions (Build Failures)

#### 1. Type Errors

```bash
# Check TypeScript errors
npx tsc --noEmit

# Fix errors or use:
# (temporary, not recommended for production)
npm run build:ignore-errors
```

#### 2. Missing Dependencies

```bash
# Install missing packages
pnpm add <package-name>

# Or install all
pnpm install
```

#### 3. Environment Variables

```bash
# Ensure .env.local exists
cp .env.example .env.local

# Required variables:
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

---

## Issue: Database/Storage Errors

### Symptoms (Database/Storage Errors)

- "Cannot connect to database"
- "Storage error" messages
- Lost session data

### Solutions (Database/Storage Errors)

#### 1. In-Memory Storage (Development)

```bash
# Backend uses in-memory storage by default
# Data lost on restart is normal
# Re-issue credentials after backend restart
```

#### 2. localStorage Quota Exceeded

```javascript
// Clear localStorage
localStorage.clear();
sessionStorage.clear();
location.reload();
```

#### 3. IndexedDB Issues

```bash
# Open DevTools > Application > Storage
# Clear Site Data
# Or use Developer Toolbar (Ctrl+Shift+D)
```

---

## Issue: Authentication/Session Problems

### Symptoms (Authentication/Session Problems)

- Can't log in
- Session expires immediately
- "Unauthorized" errors

### Solutions (Authentication/Session Problems)

#### 1. Clear Session Data

```javascript
// Open browser console
localStorage.removeItem('vital_cv_session');
document.cookie.split(';').forEach((c) => {
  document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC';
});
location.reload();
```

#### 2. Check Cookie Settings

```javascript
// In session.ts, ensure:
SameSite=Lax (development)
SameSite=Strict (production)
Secure=true (production only)
```

#### 3. Verify JWT/Session Config

```bash
# Backend JWT secret should be set
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret
```

---

## Issue: NPI Lookup Fails

### Symptoms (NPI Lookup Fails)

- "NPI not found" errors
- Timeout after 10 seconds
- Empty NPPES data

### Solutions (NPI Lookup Fails)

#### 1. Check NPPES API

```bash
# Test NPPES directly
curl "https://npiregistry.cms.hhs.gov/api/?number=1234567890&version=2.1"
```

#### 2. Use Mock Data (Development)

```javascript
// In npi-client.ts
export async function lookupNpi(npi: string) {
  if (process.env.NODE_ENV === 'development') {
    return mockNpiData[npi] || generateMockNpi(npi);
  }
  // ... real API call
}
```

#### 3. Increase Timeout

```javascript
// In npi-client.ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000); // 15s
```

---

## Issue: Styling/UI Problems

### Symptoms (Styling/UI Problems)

- Tailwind classes not applying
- Dark mode not working
- Layout broken

### Solutions (Styling/UI Problems)

#### 1. Rebuild Tailwind

```bash
# Clear PostCSS cache
rm -rf .next
pnpm dev
```

#### 2. Check Tailwind Config

```javascript
// tailwind.config.ts should include:
content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'];
```

#### 3. Dark Mode Issues

```javascript
// Ensure ThemeProvider is in layout
import { ThemeProvider } from 'next-themes';

<ThemeProvider attribute="class">{children}</ThemeProvider>;
```

---

## Issue: PWA Not Installing

### Symptoms (PWA Not Installing)

- No install prompt
- Service worker not registering
- Manifest errors

### Solutions (PWA Not Installing)

#### 1. Check Manifest

```bash
# Verify manifest is accessible
curl http://localhost:3005/manifest.json

# Should return valid JSON
```

#### 2. HTTPS Required (Production)

```bash
# PWA requires HTTPS in production
# Use ngrok for testing:
ngrok http 3005
```

#### 3. Service Worker Registration

```javascript
// In app/layout.tsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

---

## Issue: Performance Problems

### Symptoms (Performance Problems)

- Slow page loads
- Laggy interactions
- High memory usage

### Solutions (Performance Problems)

#### 1. Check Bundle Size

```bash
pnpm run analyze

# Look for large dependencies
# Consider code splitting
```

#### 2. Optimize Images

```javascript
// Use Next.js Image component
import Image from 'next/image';

<Image
  src="/logo.png"
  width={200}
  height={200}
  priority // for above-fold images
/>;
```

#### 3. Reduce Client-Side JavaScript

```javascript
// Use server components where possible
// Mark client components with 'use client'
// Dynamic import heavy components
const HeavyComponent = dynamic(() => import('./Heavy'));
```

---

## Issue: Testing Failures

### Symptoms (Testing Failures)

- Jest tests failing
- Storybook won't start
- E2E tests timing out

### Solutions (Testing Failures)

#### 1. Jest Issues

```bash
# Clear Jest cache
npx jest --clearCache

# Run specific test
pnpm test -- --testPathPattern=MyTest
```

#### 2. Storybook Issues

```bash
# Clear Storybook cache
rm -rf node_modules/.cache

# Rebuild
pnpm run build-storybook
```

#### 3. Playwright Issues

```bash
# Install browsers
npx playwright install

# Update Playwright
pnpm add -D @playwright/test@latest
```

---

## Developer Toolbar Commands

Press `Ctrl+Shift+D` to open the Developer Toolbar:

- **Measure API Latency**: Test backend response time
- **Toggle Debug Mode**: Enable verbose logging
- **Clear Cache & Reload**: Fresh start
- **Log State**: Dump current state to console

---

## Port Reference

| Service   | Port | URL                     |
| --------- | ---- | ----------------------- |
| Frontend  | 3005 | <http://localhost:3005> |
| Backend   | 4000 | <http://localhost:4000> |
| Storybook | 6006 | <http://localhost:6006> |

---

## Environment Variables

### Frontend (.env.local)

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_BETA=false
NODE_ENV=development
```

### Backend (.env)

```bash
PORT=4000
FRONTEND_URL=http://localhost:3005
JWT_SECRET=your-secret-key
NODE_ENV=development
```

---

## Getting Help

1. **Check Console**: Browser DevTools → Console tab
2. **Check Network**: DevTools → Network tab
3. **Check Logs**: Terminal running backend/frontend
4. **GitHub Issues**: Open an issue with error details
5. **Developer Toolbar**: Use built-in debugging tools

---

## Emergency Reset

When all else fails:

```bash
# 1. Stop all services
pkill -f "node.*4000"
pkill -f "node.*3005"

# 2. Clear everything
rm -rf node_modules .next
rm -rf apps/web/.next

# 3. Fresh install (run from the monorepo root)
pnpm install

# 4. Restart
pnpm --filter @vitalcv/api dev &
PORT=3005 pnpm --filter @vitalcv/web dev
```

---

**Still stuck? Check the [Demo Script](./DEMO_SCRIPT.md) for working examples.**
