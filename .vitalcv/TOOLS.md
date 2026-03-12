# TOOLS.md — VitalCV Environment & Tooling Map
_Last updated: 2026-03-12._

---

## Repository

- **Root:** `/Users/christoler/vitalcv`
- **Type:** pnpm monorepo with turbo
- **Frontend:** `apps/web` — Next.js 15, React 19, Tailwind v4, Framer Motion, Clerk
- **Backend:** `apps/api/backend` — Express, Prisma, TypeScript
- **Shared packages:** `packages/` (embed-sdk, issuer-sdk, verifier-sdk, wallet-sdk)

---

## Build Commands

```bash
# API
pnpm --filter @vitalcv/api build
cd apps/api/backend && npx prisma generate

# Frontend
pnpm --filter web build

# Run dev
pnpm --filter @vitalcv/api dev        # port 4000
pnpm --filter web dev                 # port 3000

# Tests
pnpm --filter @vitalcv/api test
```

---

## Key File Locations

| What | Where |
|---|---|
| Prisma schema | `apps/api/backend/prisma/schema.prisma` |
| Migration SQL (dry-run) | `docs/migrations/` |
| API routes registration | `apps/api/backend/src/app.ts` |
| Feature flags | `apps/web/lib/features.ts` |
| Design tokens (CSS) | `apps/web/app/globals.css`, `apps/web/styles/` |
| Global layout | `apps/web/app/layout.tsx` |
| Homepage | `apps/web/app/page.tsx` |
| Navbar | `apps/web/components/Navbar.tsx` |
| Footer | `apps/web/components/Footer.tsx` |
| VitalCV canonical knowledge | `.vitalcv/` (this directory) |
| PSV adapters | `apps/api/backend/src/services/psv-adapters/adapters/` |
| MATCHA service | `apps/api/backend/src/services/matcha/` |
| Trust graph (frontend) | `apps/web/components/graph/` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Auth | Clerk (x-clerk-user-id header pattern) |
| ORM | Prisma (PostgreSQL) |
| API | Express.js |
| Credential format | SD-JWT VC, W3C VC, OID4VCI/VP |
| Signing | ES256 (jose library) |
| Monorepo | pnpm workspaces + turbo |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |
| Deployment | Vercel (frontend), `vercel.json` configured |
| Build output | `apps/web/.next` |

---

## Tailwind v4 Rules

- **No `tailwind.config.ts`** — all config in `globals.css` via `@theme`
- **No cross-file `@apply` of custom classes** — use direct CSS property declarations
- Design tokens defined in `apps/web/styles/vitalTokens.css`
- Dark surface tokens: `--vt-surface-ops-base`, `--vt-ops-from/via/to`
- Glass surfaces: `bg-white/3`, `border-white/8` pattern

---

## Next.js Proxy Pattern (CORS)

All API calls from frontend must use **relative paths** (`/api/...`), not `${getApiBase()}/api/...`.
Proxy routes live at `apps/web/app/api/[route]/route.ts`.
Proxy pattern:
```typescript
const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
// Forward Clerk headers:
req.headers.forEach((v, k) => { if (k.startsWith('x-clerk-')) headers[k] = v; });
```

---

## Prisma Conventions

- Schema at `apps/api/backend/prisma/schema.prisma`
- Run `prisma generate` from `apps/api/backend/` (not repo root)
- Json fields: always `JSON.parse(JSON.stringify(value))` for InputJsonValue compat
- New models → add dry-run SQL to `docs/migrations/`
- Do NOT run `prisma migrate dev` without explicit approval (live DB)

---

## Auth Pattern

- Clerk user ID passed as `x-clerk-user-id` request header
- Backend extracts: `const id = req.headers['x-clerk-user-id'] as string`
- Protected routes throw `HttpError(401, ...)` if missing
- Role resolution via `User.role` from DB

---

## External Services (from codebase evidence)

| Service | Purpose | Config Key |
|---|---|---|
| Clerk | Auth | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |
| PostgreSQL | Database | `DATABASE_URL` |
| OpenAI | OCR / AI features | `OPENAI_API_KEY`, `OCR_PROVIDER=openai` |
| NPPES API | NPI lookup | Public, no key |
| Stripe | Billing | `STRIPE_SECRET_KEY` |
| Vercel | Deployment | Project configured |

---

## Safe Operating Assumptions

- Never run destructive migrations without explicit approval
- Never push to `main` without build passing
- Never delete branches with unique files
- `static-role-routes` branch is off-limits
- Prisma dry-run SQL always goes to `docs/migrations/` before any schema change is used in prod
