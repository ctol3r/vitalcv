# Domain Topology Audit

**B18-TRUTH-03 deliverable.** Diagnostic for verifying VitalCV's
domain topology and ensuring no stale Vercel project can accidentally
receive production traffic. Operator-runnable; does not itself probe.

## §1 — Domains in scope

| Domain | Expected purpose |
|---|---|
| `vitalcv.com` (apex) | Production runtime |
| `www.vitalcv.com` | Redirect to apex (typical) or alias of canonical project |
| `*.vercel.app` aliases on the canonical project | Preview / branch deploys |
| Custom subdomains (e.g., `api.vitalcv.com`) | Backend (Railway) — separate from Vercel |

External verification has confirmed:

- `vcv-web.vercel.app` is **NOT a VitalCV project**. It belongs to an unrelated third-party. **Do not alias, deploy to, or document `vcv-web` as canonical.**

## §2 — Authoritative routing answers (operator-side)

For each domain row in §1, the operator must determine:

| Question | Source of answer |
|---|---|
| Which Vercel project (if any) has this domain attached? | Vercel dashboard → Settings → Domains; OR `vercel domains ls` |
| What DNS records point this domain to Vercel? | DNS provider dashboard (Cloudflare, Route53, etc.); OR `dig +short vitalcv.com` for A/CNAME |
| Is the domain marked "Verified" in Vercel? | Vercel dashboard → the project → Settings → Domains → status next to domain |
| Is the domain attached to MORE THAN ONE Vercel project? | Vercel dashboard → all projects in the team; OR repeat `vercel domains ls` per project — a domain CAN be claimed across projects but only the one Vercel routes to is canonical |

## §3 — Audit probes

### Probe A — DNS resolution

```bash
dig +short vitalcv.com
# Expected: Vercel's load balancer IPs (currently 76.76.21.21 or similar)
# Or: an A record / CNAME pointing to *.vercel-dns.com / cname.vercel-dns.com

dig +short www.vitalcv.com
# Expected: CNAME to vitalcv.com OR to a Vercel alias

dig TXT _vercel.vitalcv.com
# Expected: a verification TXT record if Vercel domain verification was used
```

### Probe B — Vercel-side ownership

```bash
# After authenticating to the right Vercel team:
vercel domains ls
# Look for vitalcv.com → which project ID owns it

vercel projects ls
# Cross-reference project IDs to project names
```

### Probe C — HTTP behavior (no auth required)

```bash
# Direct apex probe:
curl -sI https://vitalcv.com/ | head -20
# Look at `Server:` header — Vercel sends "Vercel" or omits.
# Look at `x-vercel-id:` header — names the region + deployment ID.

# Same for www:
curl -sI https://www.vitalcv.com/ | head -20
# If www returns 301/302 to apex → redirect is configured. OK.
# If www returns 200 with different content from apex → apex/www split, audit.

# Check for x-vercel-id divergence between apex and www:
APEX_ID=$(curl -sI https://vitalcv.com/ | grep -i "x-vercel-id" | tr -d '\r')
WWW_ID=$(curl -sI https://www.vitalcv.com/ | grep -i "x-vercel-id" | tr -d '\r')
echo "APEX: $APEX_ID"
echo "WWW:  $WWW_ID"
# Both should reference the same deployment (or www should redirect to apex)
```

## §4 — Common divergence modes

| Symptom | Likely cause | Resolution |
|---|---|---|
| Apex 402, www 200 with different content | Apex attached to a paused project; www attached to a different (live) project | Detach apex from the paused project; attach to the same project as www OR resume the paused one |
| Apex 200, www 404 | www not attached to any project, or DNS missing | Attach www to the canonical project; OR add a DNS CNAME from www → apex |
| Both apex and www return identical Vercel content but kid says "vcv-es256-dev" | Wrong project serving both; either the deprecated/stale project or a project that doesn't have PR-362's fail-closed guard | Identify the canonical project via `production-restore-sequence.md` §1; reattach apex to it |
| Apex SOMETIMES returns 200, SOMETIMES 402 | Cache divergence between Vercel edges OR domain attached to multiple projects with race conditions | Use `curl -H "Cache-Control: no-cache"` to bypass edge; if 402 persists from origin, the underlying project is paused |
| DNS shows non-Vercel IPs | DNS not pointing to Vercel at all | Update DNS provider records to point to Vercel (`vercel-dns.com` CNAME or Vercel A records) |

## §5 — "Conflicting Vercel projects" check

Multiple Vercel projects can each CLAIM the same domain in their
Settings → Domains. Only the first / verified one actually receives
traffic; the rest are stale claims that survive project archival.

```bash
# In the Vercel dashboard, for EACH project the operator owns:
#   Settings → Domains → does this project list vitalcv.com?
# Record every project that does.

# Only ONE of those projects is actually routing. The others are
# stale claims that should be removed.
```

To clean up stale claims:

1. For each non-canonical project that claims `vitalcv.com`: Settings → Domains → remove the claim.
2. Verify after each removal: `curl -sI https://vitalcv.com/` should still return 200 from the canonical project.

## §6 — Required record

Fill in after the operator probes:

| Field | Value |
|---|---|
| Apex DNS resolution | A / CNAME → |
| Apex Vercel project | |
| WWW DNS resolution | |
| WWW Vercel project | |
| Stale claims on `vitalcv.com` (other projects) | |
| Stale claims on `www.vitalcv.com` (other projects) | |
| Apex `x-vercel-id` header | |
| WWW `x-vercel-id` header | |
| Cache divergence detected? | |

## §7 — What this audit does NOT do

- Does NOT modify DNS.
- Does NOT modify Vercel domain attachments.
- Does NOT resolve the HTTP 402 — that's `pause-root-cause-report.md`.
- Does NOT presume `vcv-web` or any specific name is canonical — only the operator-confirmed value.

The goal is making domain routing **deterministic**: one and only one
Vercel project owns the canonical traffic; no stale claims exist;
DNS and Vercel agree on the routing target.

## §8 — Verdict criteria

Domain topology is **converged** when:

1. `dig +short vitalcv.com` returns a Vercel IP or CNAME.
2. Exactly one Vercel project has `vitalcv.com` attached and verified.
3. `curl -sI https://vitalcv.com/` and `curl -sI https://www.vitalcv.com/` reference the same deployment via `x-vercel-id` header (OR www redirects to apex).
4. No stale project claims exist on either domain.
5. The canonical project (from §6) matches the project found via `production-restore-sequence.md` §1.
6. `curl https://vitalcv.com/api/health` returns `service: "web"` (confirms the right repo is being served).

Until all six hold, domain topology is non-converged and traffic
behavior may be non-deterministic.
