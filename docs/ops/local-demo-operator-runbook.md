# Local demo operator runbook

One command brings the VitalCV demo back online without Vercel,
without DNS changes, and without spend.

For the umbrella context (why Vercel is gone, what comes next, the
production cutover plan), see
[vercel-exit-emergency-plan.md](./vercel-exit-emergency-plan.md).

For the manual tunnel walkthrough (what the operator script does
under the hood), see
[cloudflare-tunnel-founder-demo-runbook.md](./cloudflare-tunnel-founder-demo-runbook.md).

## Why Vercel is bypassed

`https://vitalcv.com` currently returns:

```
HTTP/2 402
server: Vercel
x-vercel-error: DEPLOYMENT_DISABLED
```

The founder decision is final: no more Vercel dependency, no paid
recovery path. The operator script in this doc gets a working
public URL up via `cloudflared` quick-tunnel, fed by a local
`pnpm dev` server.

## The one command

From any terminal:

```bash
cd ~/vitalcv         # or the canonical worktree
bash scripts/vitalcv-demo-operator.sh
```

The script will:

1. Repair `PATH` so Homebrew + npm-global binaries resolve in
   stripped shells.
2. Verify `pnpm`, `cloudflared`, `lsof`, and `curl` are present.
3. Run `scripts/kill-shadow-vitalcv-runtimes.sh` to clean up any
   left-over vitalcv-omega4f-trigger processes and stale pm2
   services named `vitalcv-web` or `vitalcv-tunnel`. It does
   **not** touch `ai.openclaw.gateway` or generic node
   processes.
4. Pick the best demo worktree it can find (`/tmp/vitalcv-demo-
   spine-openevidence` → `/tmp/vitalcv-demo-spine` → any git
   worktree matching `demo`/`openevidence`/`launch` → `~/vitalcv`).
5. Print the worktree, branch, and short SHA so you can confirm
   you're demoing the right code.
6. Install dependencies only if `node_modules` is missing or if
   you passed `--install`.
7. Prebuild `@vitalcv/trust-state` and `@vitalcv/shared`.
8. Start `pnpm --filter @vitalcv/web dev` in the background,
   logging to `.vitalcv-demo-app.log`.
9. Wait for `http://localhost:3030` to respond (max 120 s).
10. Start `cloudflared tunnel --url http://localhost:3030`,
    logging to `.vitalcv-demo-tunnel.log`.
11. Extract the assigned `https://*.trycloudflare.com` URL,
    write it to `.vitalcv-demo-url`, and print it.
12. Run `scripts/check-public-surface.sh` against the public URL
    and print the PASS / WARN / FAIL table.
13. Sit and watch the two child processes until you press
    Ctrl-C — at which point the `trap` cleans both of them up.

## Expected route statuses

Against `https://<random>.trycloudflare.com`:

| Route | Expected | Notes |
|-------|----------|-------|
| `/` | PASS (2xx or redirect) | redirect to `/launch` is fine |
| `/launch` | PASS on a demo branch · WARN on plain `main` | the OpenEvidence demo-spine PRs ship `/launch`; if you're on `origin/main` without those merges, a 404 here is reported as WARN, not FAIL |
| `/demo` | PASS on a demo branch · WARN on plain `main` | same as above |
| `/demo/employer` | PASS on a demo branch · WARN on plain `main` | same |
| `/demo/clinician` | PASS on a demo branch · WARN on plain `main` | same |
| `/api/health` | PASS or WARN | informational only — the route is not required for a founder walk |

The script does not exit with a failure for WARN states. A FAIL
only happens on 5xx, on unreachable, or on 4xx for a route that
must work (e.g. `/`).

## How to stop

Three options, pick whichever is in front of you:

1. Press **Ctrl-C** in the operator terminal. The `trap` kills
   both child processes and exits.
2. Run the explicit kill command printed at the bottom of the
   operator output:
   ```
   kill <app_pid> <tunnel_pid>
   ```
3. From any terminal:
   ```bash
   bash scripts/kill-shadow-vitalcv-runtimes.sh
   ```
   This is the broader cleanup — it stops the named pm2 services
   and any `vitalcv-omega4f-trigger` processes. It also prints
   listeners on `:3000` and `:3030` but does NOT kill them
   automatically.

## How to switch to the demo branch

If you're getting WARN on `/launch` and `/demo/*`, the demo
spine isn't in your current worktree. Either:

- check out one of the demo-spine PR branches into a new
  worktree:
  ```bash
  git worktree add -B demo-preview /tmp/vitalcv-demo-spine \
    origin/wave/demo-spine-openevidence-execution
  cd /tmp/vitalcv-demo-spine
  pnpm install --frozen-lockfile
  ```
  Re-run the operator from this tree; the auto-detection picks
  it up first by name.

- or merge the demo-spine PRs into `main` (per the pilot-funnel
  merge board) and re-run the operator.

## Recovery — I closed the terminal and lost the URL

The operator writes the URL and PIDs to discoverable files in the
chosen app directory:

| File | Contents |
|------|----------|
| `.vitalcv-demo-url` | the active trycloudflare URL (single line) |
| `.vitalcv-demo-operator.log` | every step the operator script ran, with timestamps |
| `.vitalcv-demo-app.log` | raw `pnpm dev` output |
| `.vitalcv-demo-tunnel.log` | raw `cloudflared` output |

If the URL file is present and the PIDs in the operator log are
still alive (`kill -0 <pid>`), the tunnel is still up. Just
share the URL.

If the PIDs are dead, the tunnel URL is dead too. Re-run the
operator.

## Known limitations

- **The trycloudflare URL is temporary.** Each operator invocation
  yields a fresh `https://<random>.trycloudflare.com` subdomain.
  Don't paste it into anything that needs to outlive the
  session.
- **The script does not survive laptop sleep.** macOS will pause
  the dev server when the lid closes, and the tunnel will drop
  shortly after. Disable sleep on the active machine during a
  long demo.
- **No SLA, no IP allow-list, no CDN.** The latency is
  laptop-to-Cloudflare-edge-to-viewer. Acceptable for a 1-on-1
  walkthrough, not for sustained traffic. For a real production
  surface, follow
  [cloudflare-production-cutover-plan.md](./cloudflare-production-cutover-plan.md).
- **No DNS mutation.** The script never touches `vitalcv.com`.
  Pointing the production domain at Cloudflare Pages is a
  separate, founder-approved action covered by the cutover
  plan.
- **No Vercel API calls.** The script is engineered to operate
  while the Vercel account is disabled. Don't add Vercel CLI
  calls to it.
- **No secrets read or written.** The script does not look at
  `.env*` files, does not paste tokens into Cloudflare, and does
  not call the Slack webhooks. Slack delivery for `/api/leads`
  still works at runtime if the env var is set in the shell that
  launches `pnpm dev`, but the script never sets it for you.

## Constraints the script will not violate

- No sudo.
- No DNS mutation.
- No Vercel CLI / API calls.
- No paid services.
- No Prisma migration or database mutation.
- No package dependency additions.
- No killing of `ai.openclaw.gateway`.
- No killing of unrelated `node` processes — only pm2 services
  named `vitalcv-web` / `vitalcv-tunnel` and processes whose
  command line contains the literal `vitalcv-omega4f-trigger`.
- No automatic kill of `:3000` or `:3030` listeners. Those are
  printed but the operator decides what to do with them.

## Owner

Chris Toler (founder). This runbook is the canonical reference
for the operator script. Edits go through a PR; do not modify
the script's safety contract section without a Codex review.
