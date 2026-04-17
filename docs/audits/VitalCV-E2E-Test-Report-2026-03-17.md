# VitalCV End-to-End User Test Report

**Date:** March 17, 2026
**Tester perspective:** First-time but sharp user — no engineering context
**Deployment tested:** `vitalcv-ax41ivsge-blockchaincv.vercel.app` (web app) + `vitalcv.com` (marketing site)

---

## Executive Summary

VitalCV has a polished front-end shell with some genuinely impressive pages (employer profiles, opportunity details, developer portal). But a real user cannot get past the login screen, and half the promised features either 404 or error out. The product looks like a demo that was never wired up to a real backend.

**Verdict:** This is a storefront with no store behind it. The windows look great. The door is locked. And some of the rooms don't exist yet.

---

## 1. LOGIN FLOW — TOTAL BLOCKER

### What happened

I clicked "Sign In" on the web app. Three paths, three failures:

**Google OAuth:** Redirected to Google, showed the account picker, I selected christoler@vitalcv.com, got consent screen, clicked Continue — bounced back to VitalCV sign-in page with: **"Sign-ups are currently unavailable. Join the waitlist."** The founder's own @vitalcv.com email cannot get in.

**Google OAuth on marketing site (vitalcv.com):** Completely broken. Redirects to Google error page: **"Access blocked: Authorization Error — Missing required parameter: client_id."** The OAuth client_id is not configured for the marketing site's Clerk instance.

**Email login (both sites):** "Couldn't find your account" for ct@sourcd.xyz. The email isn't registered in either Clerk instance.

### Friction score: 10/10 (impassable)

### What a real user would do: Leave. Immediately. You just told someone who wants to use your product that they can't. No workaround, no fallback, no "request access" flow that actually works. The waitlist link is the only path and it requires trust that someone will follow up.

### Additional auth issues

- Google consent screen says **"Sign in to Clerk"** not "Sign in to VitalCV" — users will wonder what Clerk is
- The web app shows **"Development mode"** in orange at the bottom of the login form — this screams "not real"
- Two separate Clerk instances (marketing vs. app) with different OAuth configs — users who sign up on one can't sign in on the other

---

## 2. CORE NAVIGATION — Mixed Results

| Page | URL | Status | Data? | Notes |
|------|-----|--------|-------|-------|
| Home/Landing | `/` | Works | Static | Terminal animation, pipeline graphic, stats. Looks polished. |
| Explore | `/explore` | Works | 7 roles | Real-looking job cards with pay, location, status badges |
| Employers | `/employers` | Works | 3 employers | Trust scores, hiring badges, specialty tags |
| Search | `/search` | **BROKEN** | None | Suggested query "ICU nurses near Sacramento" returns: "Search unavailable. Try again shortly." |
| Network | `/network` | Partial | 12 nodes | Graph renders. But "Network Telemetry Intelligence" shows: "API 401 — showing cached data" |
| Developers | `/developers` | Works | Static demo | API keys, webhook log, sandbox CTA. All demo data. |
| /findings | `/findings` | **404** | N/A | Route does not exist |
| /intelligence | `/intelligence` | **404** | N/A | Route does not exist |
| /investigations | `/investigations` | **404** | N/A | Route does not exist |
| /providers | `/providers` | **404** | N/A | Route does not exist |

**Summary:** 4 of the 6 routes you asked me to test don't exist. Of the public pages, Search is broken and Network is partially broken (API 401).

---

## 3. REAL USER FLOW — The Good Parts

### Employer Profile (Best Page)

`/employers/bay-area-cardiac-group` is genuinely impressive:

- Verified badge, Trust Score 94, "Hiring Now" status
- Clear-to-start threshold spelled out: "Active CA license + ABIM board cert + active DEA + malpractice insurance"
- Individual credential requirements with L2/L3 verification levels
- Copilot sidebar with suggested questions
- Quick actions: View Open Roles, Check My Readiness, Compare with Others
- Trust Registry data panel

This page makes the product feel real. A clinician looking at this would think: "OK, I know exactly what I need to work here."

### Opportunity Detail (Second Best)

`/opportunities/opp-001` is also strong:

- Full role description with pay range ($310-$380/hr), start timeline, location
- "3 hired recently" social proof
- Credential checklist with L2/L3 levels
- "Clear-to-start" summary bar
- "Apply with VitalCV" sidebar with "Your verified credentials are shared instantly — no forms, no fax"

The value proposition is clear on this page.

### Where the flow breaks

- **Role cards on /explore are NOT clickable.** Clicking the title does nothing. You have to find the "Apply with VitalCV" button — which actually navigates to the detail page, not an apply action. Confusing.
- **"Check My Readiness" and "Share My Readiness" require auth** — which is broken. Dead end.
- **"Apply with VitalCV" doesn't actually let you apply** — there's no apply flow, just a detail page.

---

## 4. COPILOT TEST

### What works

Clicking a suggested question like "What licenses do I need to work here?" returns an instant, specific, useful answer referencing L2/L3 credential levels and primary-source verification. It cites "employer-profile" as its source. This is good.

### What doesn't work

**Free-text input is dead.** I typed "What is the typical onboarding time?" and pressed Enter. Nothing happened. The input cleared. No response. The copilot is a pre-built Q&A widget responding to canned prompts, not a real conversational AI.

### Would it feel useful?

The canned answers are surprisingly good. But the moment a user types their own question and gets silence, the illusion breaks. You went from "this is smart" to "this is a FAQ with extra steps."

---

## 5. GRAPH/NETWORK TEST

The Trust Network page (`/network`) renders a force-directed graph with 12 nodes and 9 edges. Color-coded by type (Clinicians=green, Issuers=blue, Decisions=orange, External=purple). Clicking a node reveals its label ("Acceptance A2"). There's a "GRAPH OPS" performance panel showing render time (216ms).

Below the graph: **"Network Telemetry Intelligence"** section shows **"API 401 — showing cached data"** and **"No telemetry data available."** The graph itself is rendering static/seed data.

The legend shows Issuer status as **"Degraded"** and Credentials count as **0**. Decisions clustering is **"Off"**.

**Verdict:** The visualization technology works. The data behind it is hollow.

---

## 6. BRUTAL FEEDBACK

### Would I trust this system?

**No.** Here's why:

1. **I can't sign in.** The single most important thing a product can do is let me use it. VitalCV won't let me through the door.

2. **"Development mode" is visible.** This is the equivalent of leaving the scaffolding up when you invite investors to tour the building. It tells me this isn't production-ready.

3. **The search doesn't work.** You put suggested queries on the search page. I clicked one. It failed. You set me up to fail with your own demo content.

4. **Four core routes are 404.** /findings, /intelligence, /investigations, /providers — these aren't "coming soon," they simply don't exist. There's no placeholder, no empty state, just a generic Next.js 404 page.

5. **The copilot is a FAQ.** The suggested questions work. Typing your own doesn't. This will disappoint every user who thinks "Ask about Bay Area Cardiac Group" means they can actually ask anything.

### What feels broken vs. just incomplete?

**Broken (fix immediately):**
- Google OAuth on marketing site (missing client_id)
- Waitlist mode blocking all sign-ins including the founder
- Search backend returning errors on suggested queries
- Network telemetry API returning 401

**Incomplete (expected for early stage, but be honest about it):**
- /findings, /intelligence, /investigations, /providers routes don't exist
- Copilot only handles canned questions
- No actual apply flow
- Role cards not clickable (only buttons work)
- All data appears to be seed/demo data (opp-001, 3 employers, 7 roles)

### What would make me say "this is legit"?

1. **Let me sign in.** Everything else is secondary. I need to get inside the product.

2. **One real NPI lookup.** Let me type a real NPI number and see real credential data come back from a primary source. That single moment — seeing real data from a real source — would change everything. Right now it's all demo cards.

3. **One real verification flow.** Show me a credential going from "unverified" to "verified" with a timestamp, source attribution, and audit trail. Even for one provider. That's the product.

4. **Kill the "Development mode" label.** Either switch to production keys or hide this. It undermines every other signal of quality.

5. **Make the copilot actually conversational.** The canned Q&A is decent, but the promise of "Ask about Bay Area Cardiac Group" implies I can ask anything. Either make that true or change the UI to be a FAQ accordion.

### The one thing that's actually good

The employer profile page and opportunity detail page are **genuinely well-designed**. The credential requirement breakdown with L2/L3 levels, the trust score, the "clear-to-start" threshold — these communicate real domain expertise. A clinician would look at this and understand what VitalCV is trying to do. The problem is they can't get past the login screen to experience any of it as a logged-in user.

---

## Summary Scorecard

| Area | Score | Notes |
|------|-------|-------|
| Can I sign in? | 0/10 | Complete blocker. Nobody can get in. |
| Marketing site quality | 7/10 | Looks professional, good copy, but OAuth broken |
| Explore/Jobs | 7/10 | Good cards, but not clickable, only 7 seed roles |
| Employer profiles | 9/10 | Best page. Clear value prop. Trust score works. |
| Opportunity details | 8/10 | Strong. Clear requirements. No actual apply flow. |
| Search | 1/10 | Own suggested queries fail. Backend down. |
| Network graph | 5/10 | Renders, but API 401, cached data, no telemetry |
| Copilot | 4/10 | Canned Qs work. Free text dead. Misleading UI. |
| Developer portal | 6/10 | Good marketing. All demo data. No real sandbox. |
| /findings, /intelligence, /investigations, /providers | 0/10 | Don't exist. |
| **Overall "would I believe this is real?"** | **3/10** | Pretty shell, but too many dead ends to trust it. |
