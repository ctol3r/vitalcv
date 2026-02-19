# vitalcv.com Domain Migration: Squarespace → Vercel

## Overview

Migrate `vitalcv.com` from Squarespace hosting to a Next.js static marketing site deployed on Vercel.

**Scope:** Marketing site only (`vitalcv.com` and `www.vitalcv.com`).

**Out of scope (DO NOT TOUCH):**

- Backend APIs, credentialing services, OpenID enforcement
- `app.vitalcv.com` (deployed separately)
- MX records (Google Workspace email)
- SPF / DKIM / DMARC records

---

## Pre-Migration Checklist

- [ ] `apps/marketing/` builds successfully: `pnpm --filter @vitalcv/marketing build`
- [ ] Vercel project created and linked to monorepo
- [ ] Root directory set to `apps/marketing` in Vercel project settings
- [ ] `vercel.json` at `apps/marketing/vercel.json` validated
- [ ] Preview deployment verified on Vercel-assigned URL
- [ ] Content reviewed: all marketing sections render correctly
- [ ] Google Search Console ownership verified for `vitalcv.com`
- [ ] Record current Squarespace DNS values (screenshot or export)

---

## Current DNS Records (Squarespace)

Before making any changes, document the exact current values:

| Type  | Host        | Value                       | Purpose           |
|-------|-------------|-----------------------------|--------------------|
| A     | @           | Squarespace IP (e.g. 198.185.x.x) | Website hosting   |
| AAAA  | @           | Squarespace IPv6            | Website hosting    |
| CNAME | www         | Squarespace CNAME proxy     | www redirect       |
| MX    | @           | Google Workspace MX records | Email routing      |
| TXT   | @           | `v=spf1 include:_spf.google.com ~all` | SPF        |
| TXT   | google._domainkey | DKIM key              | DKIM signing       |
| CNAME | em*.*       | Google verification         | Workspace verify   |

---

## DNS Changes

### Step 1: Records to REMOVE

| Type  | Host | Action                  |
|-------|------|--------------------------|
| A     | @    | Delete Squarespace A record(s) |
| AAAA  | @    | Delete Squarespace AAAA record(s) |

### Step 2: Records to ADD

| Type  | Host | New Value                 | Purpose            |
|-------|------|----------------------------|--------------------|
| A     | @    | `76.76.21.21`             | Vercel apex domain |
| CNAME | www  | `cname.vercel-dns.com`    | Vercel www redirect|

### Step 3: Records to PRESERVE (DO NOT MODIFY)

| Type  | Host               | Purpose                        |
|-------|--------------------|--------------------------------|
| MX    | @                  | Google Workspace email routing |
| TXT   | @                  | SPF for Google Workspace       |
| TXT   | google._domainkey  | DKIM for Google Workspace      |
| CNAME | em*.*              | Google Workspace verification  |
| TXT   | _dmarc (if exists) | DMARC policy                   |

**CRITICAL:** Triple-check MX, SPF, and DKIM records remain unchanged. Email continuity is non-negotiable.

---

## Migration Steps

### Phase A: Deploy to Vercel (Zero DNS changes)

1. Create a new Vercel project linked to the VitalCV monorepo
2. Set project settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/marketing`
   - **Build Command:** `pnpm --filter @vitalcv/marketing build`
   - **Output Directory:** `apps/marketing/out`
   - **Install Command:** `npm install -g pnpm@10.6.1 && pnpm install --frozen-lockfile`
3. Trigger a deployment
4. Verify the preview URL loads the marketing site correctly
5. Check all pages, CTAs, and links work

### Phase B: Add Custom Domain in Vercel

1. In Vercel → Project Settings → Domains
2. Add `vitalcv.com` (apex domain)
3. Add `www.vitalcv.com` (will auto-redirect to apex)
4. Vercel displays required DNS records — confirm they match the values above

### Phase C: Update DNS (The Critical Window)

**Recommended timing:** Low-traffic window (e.g. Sunday 2–6 AM ET)

1. Log into DNS provider (domain registrar or Squarespace DNS panel)
2. **Delete** all Squarespace A records for `@`
3. **Delete** all Squarespace AAAA records for `@`
4. **Add** A record: `@ → 76.76.21.21`
5. **Update** CNAME: `www → cname.vercel-dns.com`
6. **VERIFY** MX records are unchanged
7. **VERIFY** TXT records (SPF/DKIM) are unchanged
8. Save changes

### Phase D: Post-DNS Verification

1. **DNS propagation:** Check via `dig vitalcv.com A` and `dig www.vitalcv.com CNAME`
   - Typical propagation: 5–30 minutes; can take up to 48 hours
2. **Website:** Navigate to `https://vitalcv.com` — new marketing site should load
3. **WWW redirect:** `https://www.vitalcv.com` should redirect to `https://vitalcv.com`
4. **SSL:** Vercel auto-provisions Let's Encrypt certificate — verify HTTPS works
5. **Email:** Send a test email to/from a Google Workspace account to confirm delivery
6. **App subdomain:** Verify `app.vitalcv.com` still works (should be unaffected)
7. **Search Console:** Verify no crawl errors in Google Search Console

---

## SSL Expectations

- Vercel automatically provisions SSL via Let's Encrypt
- Certificate covers both `vitalcv.com` and `www.vitalcv.com`
- Provisioning happens after DNS propagation (typically within minutes)
- During the brief propagation window, HTTPS may show a warning — this resolves automatically
- No manual certificate management required

---

## Downtime Avoidance Strategy

1. **Pre-deploy on Vercel:** Ensure the marketing site is live on a Vercel preview URL before any DNS changes
2. **Low TTL (if possible):** Lower DNS TTL to 300s (5 min) 24–48 hours before migration to reduce propagation lag
3. **Batch DNS changes:** Make all changes (delete old, add new) in a single session
4. **Keep Squarespace active:** Do not cancel Squarespace until 30 days post-migration
5. **Monitor:** Watch DNS propagation using tools like `dig`, `nslookup`, or https://dnschecker.org

**Expected downtime:** Near-zero if Vercel preview deployment is verified before DNS switch. Some users may see the old site briefly during propagation.

---

## Rollback Plan

If issues arise after DNS changes:

| Step | Action                                          |
|------|-------------------------------------------------|
| 1    | Delete Vercel A record (`76.76.21.21`)          |
| 2    | Re-add Squarespace A/AAAA records               |
| 3    | Revert `www` CNAME to Squarespace value         |
| 4    | Verify MX/SPF/DKIM remain intact                |
| 5    | Wait for DNS propagation (typically 5–15 min)    |

**Safety net:** Keep Squarespace account active for 30 days after migration.

If rollback is needed, Squarespace will resume serving the old site once DNS points back.

---

## Post-Migration Checklist

- [ ] `https://vitalcv.com` loads new marketing site
- [ ] `https://www.vitalcv.com` redirects to apex
- [ ] SSL certificate valid (check padlock icon)
- [ ] Email send/receive works via Google Workspace
- [ ] `app.vitalcv.com` unchanged and functional
- [ ] Submit updated sitemap (`https://vitalcv.com/sitemap.xml`) to Google Search Console
- [ ] Monitor Search Console for 404s or crawl errors (7-day window)
- [ ] Verify Google Analytics / tracking codes migrated (if applicable)
- [ ] Cancel Squarespace subscription after 30-day observation period

---

## Vercel Configuration Summary

**File:** `apps/marketing/vercel.json`

```json
{
  "framework": "nextjs",
  "installCommand": "npm install -g pnpm@10.6.1 && pnpm install --frozen-lockfile",
  "buildCommand": "npm install -g pnpm@10.6.1 && pnpm --filter @vitalcv/marketing build",
  "outputDirectory": "apps/marketing/out"
}
```

**Build output:** Static export (`output: 'export'` in `next.config.mjs`) — served from CDN with no server-side rendering overhead.
