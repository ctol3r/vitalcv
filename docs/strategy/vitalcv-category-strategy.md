---
title: "VitalCV Category Strategy"
status: "Founder-approved strategic direction"
owner: "Chris Toler"
date: "2026-08-04"
amended: "2026-08-14"
canonical_for:
  - Product positioning
  - Homepage messaging
  - Brand architecture
  - Product roadmap
  - Go-to-market sequencing
  - Claude Code planning
supersedes:
  - Credentialing-first acquisition positioning
  - Résumé-builder positioning
  - Customer-facing wallet/passport/dossier terminology
review_trigger:
  - Beachhead market selected
  - First employer design partners signed
  - Material product or regulatory change
---

# VitalCV Category Strategy

> **Founder amendment — 2026-08-14.** VitalCV now uses an explicit dual-audience
> position. The clinician-facing category remains the portable professional
> identity and employment network. The employer-facing category is **the
> Clinician Hire-to-Start Platform**. The initial market is employed physicians
> and advanced practice providers at health systems, the buyer is provider
> recruitment leadership, and the primary success event is an authorized
> employer's confirmation of the actual first day. This amendment supersedes
> the APP-only beachhead and any older success event that stops at employer
> review or offer acceptance.

## Canonical decision

For clinicians, VitalCV is **the portable professional identity and employment
network for clinicians**.

For employers, VitalCV is **the Clinician Hire-to-Start Platform**:

> From opportunity to confirmed first day.

> A clinician builds one trusted profile, uses it to find work, applies without starting over, and carries it to every future employer.

The reusable clinician profile is the product. NPI resolution is the wedge.
Matching, trust infrastructure, evidence receipts, employer packets, acceptance
intelligence, remaining requirements, and start attestation support the
transaction but should not compete for the clinician's attention.

For employers, VitalCV owns the joined case, next action, blocker ownership,
milestone history, and outcome clock. The ATS remains the recruiting record.
Credentialing platforms, CVOs, and institutions retain credentialing,
enrollment, privileging, monitoring, and compliance authority. VitalCV
integrates with those systems and never overrules them.

## Founder operating mandate

1. **Build once.** Start with the clinician’s NPI and create a reusable, source-attributed professional profile.
2. **Match intelligently.** Show relevant opportunities based on specialty, location, schedule, preferences, and career goals.
3. **Apply without starting over.** Let the clinician review and send the exact profile information an employer will receive.
4. **Carry it forward.** Preserve the profile, permissions, corrections, and outcomes for the next opportunity.
5. **Make employer acceptance the network effect.** Learn what each organization accepts, requests, and reuses under specific hiring conditions.

## Customer-facing architecture

- **VitalCV** — the company and network
- **Your VitalCV profile** — the reusable professional identity
- **VitalCV Jobs** — the opportunity marketplace
- **Apply with VitalCV** — the canonical transaction

Everything else is infrastructure unless a user needs it to complete a task.

## Primary brand promises

**Clinician**

> Build once. Move forward without starting over.

**Employer**

> VitalCV is the Clinician Hire-to-Start Platform. From opportunity to confirmed first day.

**Economic**

> Reduce the time and friction between interest and start date.

## North-star metric

> **Employer-confirmed clinician starts enabled by a VitalCV profile**

Track two clocks separately: opportunity/application to confirmed first day,
and head-start acceptance to confirmed first day. Do not publish a speed or
savings claim until at least 12 complete, valid start spans exist, and report
excluded incomplete cases.

---

# Full Strategy Memo

The memo below is retained as the source strategy. Where it conflicts with the
2026-08-14 amendment above, the amendment controls.

# The verdict

VitalCV should **not** become a better résumé builder.

It should become **the portable professional identity and employment network for clinicians**:

> A clinician builds one trusted profile, uses it to find work, applies without starting over, and carries it to every future employer.

That is a potential category. “Healthcare CV builder” is a feature.

No strategy can guarantee a billion-dollar company. But the market is large enough: Doximity reported $644.9 million in fiscal 2026 revenue; Incredible Health reached a $1.65 billion valuation as a healthcare hiring marketplace; Medallion has raised $130 million around provider operations; and DataSpring, formerly CAQH, already conditions healthcare organizations to expect providers to maintain reusable information profiles. The opening is the bridge none of them fully owns: **clinician-controlled identity that flows directly into hiring and starting work.** ([Doximity][1])

## What I found

I reviewed the public site, employer experience, Trust Center, Evidence Network, repository architecture, design guidelines, homepage implementation, product doctrine, roadmap issues, and current security issues. I did not authenticate into the private signed-in experience, so that portion of the assessment is based on the public code and product documentation. ([VitalCV][2])

### The good

**The NPI is an excellent wedge.** It creates an immediate, healthcare-specific action with almost no user effort.

**“No account needed to start” is strong.** It lets the product demonstrate value before asking for commitment.

**The trust architecture is unusually thoughtful.** VitalCV distinguishes source-backed information, self-attested information, unavailable data, access-required sources, and employer decisions. It also gives clinicians explicit sharing and correction controls. That honesty can become a major brand advantage. ([VitalCV][3])

**The career direction is better than the old credentialing-first story.** The live homepage now connects the NPI to a profile, relevant work, application, employer review, and reuse. ([VitalCV][2])

### The central problem

You have built too many concepts before establishing one product in the customer’s mind.

The repository exposes a large vocabulary: wallet, passport, packet, dossier, receipt, recognition, snapshot, holder, evidence network, MATCHA, career intelligence, readiness, activation, and more. Its route tree reflects the same sprawl. ([GitHub][4])

The product doctrine says the canonical action is:

> Clinician presents verified authority → employer accepts it → progress continues without re-verification.

That is intellectually powerful—but it is not how a clinician wakes up thinking. A clinician thinks:

> I need a better job. I do not want to fill all this out again.

The infrastructure should make that experience possible. It should not become the marketing language.

## Keep, change, kill

| Keep                              | Change                                                          | Kill from the main story                     |
| --------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| NPI-first entry                   | “Source-backed” instead of broadly “verified”                   | Blockchain terminology                       |
| Free clinician profile            | Jobs as the immediate reward for profile completion             | Wallet/passport/dossier proliferation        |
| No account before preview         | Employer message from credentialing to faster hiring and starts | Technical trust vocabulary in the hero       |
| Clinician-controlled sharing      | One canonical profile object                                    | Cinematic storytelling before utility        |
| Transparent sources and freshness | Three simple verbs: Build, Match, Apply                         | Separate brands for internal mechanisms      |
| Reusable career record            | One design system and one navigation model                      | Abstract phrases that require interpretation |

The Trust Center currently shows only three of six source lanes returning data, with state licenses access-gated and employment and board certification not connected. That makes “fully verified clinician profile” an overclaim today. “Source-backed where available” is more credible—and credibility matters more than excitement in healthcare. ([VitalCV][3])

## Your proposed message

Your version is much clearer than much of the current live language.

The problem is the final phrase:

> “Your clinician profile. Your next job. One place.”

“One place” is generic. LinkedIn, Indeed, Doximity, and every applicant-tracking system can say it.

The more defensible promise is **continuity**:

> **Your clinician profile. Ready for every move.**

That communicates both the next job and the lifelong reusable asset.

Here is the version I would ship.

> **Superseded where conflicting — 2026-08-08 (founder decision, Wave 1078).**
> The homepage draft below is no longer the shipped hero. Live since UX-V1
> (#1190) is **"Enter your NPI. VitalCV does the rest."** — see the *Homepage
> message* section of `vitalcv-strategy-operating-brief.md`, which is the
> authority for homepage copy. The reasoning above still stands: "Ready for
> every move" remains the clinician **promise**, and continuity is still the
> defensible claim. Only its use as the homepage H1 changed.

# Your clinician profile. Ready for every move.

Start with your NPI. Build a reusable professional profile, find roles that fit, and apply without entering the same information again.

**Build my free profile**

Free for clinicians · No account needed to preview · You choose what gets shared

## Start with what is already known

Enter your NPI and VitalCV fills in professional information available from public sources. See where each item came from, review it, and add what is missing.

## Find work that fits

Tell us what matters to you—specialty, location, schedule, and career goals. See relevant opportunities and why they may fit.

## Apply with your profile

Preview exactly what an employer will receive, then send your VitalCV profile instead of rebuilding your professional history from scratch.

## Keep it for your next move

Update your profile once and reuse it for future applications and employer requests throughout your career.

**Build my free profile**

### Hiring clinicians?

Review candidates using source-attributed information and spend less time chasing details they have already provided.

**See VitalCV for employers**

Once you select the initial specialty and buyer, this should be tightened further around that market rather than speaking to every possible clinician.

## The brand architecture

Give customers only four things to remember:

**VitalCV**
The company and network.

**Your VitalCV profile**
The reusable professional identity.

**VitalCV Jobs**
The opportunity marketplace.

**Apply with VitalCV**
The canonical transaction.

Everything else becomes infrastructure.

MATCHA can be the internal matching system. Evidence receipts can operate behind the scenes. Packets can be generated for employers. None of those need to compete for the customer’s attention.

The brand promise should be:

> **Build once. Move forward without starting over.**

The employer promise should be:

> **Hire from information the clinician has already reviewed and approved.**

The economic promise should be:

> **Reduce the time and friction between interest and start date.**

## The product experience that wins

The homepage does not need to feel like a film. It needs to make one extraordinary moment happen quickly.

### 1. Enter an NPI

One field. One button.

### 2. Reveal an immediate profile preview

Within seconds, show:

* Name
* Specialty
* Practice location
* NPI status
* Three or four populated professional facts
* A visible source label beside each fact

This is the magic trick.

### 3. Show meaningful incompleteness

Do not give users a generic “42% complete.”

Say:

> Add two details to see matching roles.

or:

> Confirm your location preference to find opportunities.

Progress must always lead to value.

### 4. Reveal matched opportunities

Show three real roles with:

* Why it fits
* Location and schedule
* Compensation when available
* Information still required
* Whether the employer accepts a VitalCV profile

### 5. Let the clinician apply transparently

Before sharing, show the exact profile sections the employer will receive.

The button should say:

> **Apply with my VitalCV profile**

That phrase should eventually become recognizable across employer career sites.

### 6. Turn employer acceptance into the network effect

After an employer accepts the profile information, record:

* What they accepted
* What additional information they requested
* What became outdated
* What accelerated the process
* Whether the clinician started

The deepest moat is not merely verified data. It is **acceptance intelligence**: which organizations accept which evidence for which roles under which conditions.

## Simplify the UI

The repository shows multiple overlapping design systems, visual packages, scene components, motion systems, glass treatments, graph styles, and rapid homepage rewrites. The design documentation aims for “Apple simplicity,” but the implementation is carrying much more visual and conceptual machinery than a conversion funnel needs. ([GitHub][5])

The public information architecture should be:

**Public**

* Clinicians
* Employers
* Trust
* Sign in

**Clinician app**

* Profile
* Jobs
* Applications

**Employer app**

* Roles
* Candidates
* Starts

Nothing else deserves top-level navigation.

Use cinematic motion only for one moment: the NPI transforming into a living profile. Everywhere else, speed, legibility, and confidence win.

## Choose a beachhead

Do not launch as “for every healthcare professional.”

Start where four conditions overlap:

1. The clinician usually has an NPI.
2. Hiring delays are expensive.
3. Professional information is fragmented.
4. Employers hire repeatedly.

My preferred beachhead would be **physicians and advanced practice providers for multi-site medical groups, health systems, or specialist staffing organizations**.

Choose one narrower starting segment inside that—for example:

* Hospital-based advanced practice providers
* Behavioral health prescribers
* Locum physicians
* Primary-care physicians in shortage markets
* Radiology or anesthesia groups

HRSA projects substantial physician shortages through 2038, with particularly pronounced pressure in nonmetropolitan areas. That makes “help qualified clinicians move into needed roles faster” both commercially meaningful and socially important. ([HRSA Data][6])

## The business model

Keep clinicians free. Their participation creates the network.

Employers should pay for outcomes and workflow:

**Platform subscription**
Role creation, candidate review, collaboration, integrations, and reporting.

**Successful-start fee**
A fee when a clinician hired through VitalCV begins work.

**Integration and API revenue**
ATS, HRIS, credentialing, and workforce-system connections.

**Premium workforce products**
Licensure planning, expiration monitoring, relocation coordination, and high-touch onboarding.

Illustrative pricing experiments—not final prices—might test annual employer contracts from roughly $25,000 for a focused group to $250,000 or more for an enterprise, paired with a per-start fee. Do not optimize pricing first. Prove that VitalCV creates starts that would otherwise take longer or require substantially more administrative effort.

## The moat

Your moat is not AI.

AI will become inexpensive and universal. Use it to draft summaries, explain gaps, normalize information, recommend next actions, and match roles.

The moat is the compound network:

1. **Clinician identity graph**
   Source-attributed professional information anchored by the NPI.

2. **Consent graph**
   What each clinician approved, shared, corrected, or withdrew.

3. **Employer acceptance graph**
   What each employer accepts for a specific role and workflow.

4. **Outcome graph**
   Which profiles, facts, requirements, and interventions led to interviews, offers, and starts.

5. **Integration graph**
   Connections into the systems employers already use.

The repository’s planned Clinician Enrichment Graph is directionally right, but it must serve this transaction rather than becoming a research project. Its own roadmap still shows important enrichment and source-connection work unfinished. ([GitHub][7])

## What must happen before aggressive growth

There are unresolved P0 security issues documented publicly, including authorization concerns around verifier offer mutation and NPI-based application-history exposure. The current-state document also identifies trust in unverified headers, shadow-mode RBAC, and in-memory rate limiting. Fix these before asking enterprise employers to trust the platform with meaningful workflow or candidate data. ([GitHub][8])

The live legal language also describes VitalCV as a pilot and says the posted terms are an informational summary rather than the final legal agreement. Before serious employer expansion, have counsel produce final Terms, Privacy documentation, enterprise agreements, security disclosures, and any required data-processing or healthcare-specific agreements. ([VitalCV][9])

Finally, clean up the public repository story. A public repo can build trust, but a sprawling public backlog full of P0s, internal mandates, unfinished product concepts, and hundreds of competing directions reads as operational noise.

Either:

* Make the core monorepo private and publish a polished SDK, trust specification, and selected open-source components, or
* Keep it public but radically curate the issues, README, security process, architecture documentation, and roadmap.

## The next 90 days

### Days 1–30: Ruthless simplification

Choose one beachhead, one canonical profile, one employer buyer, and one success event.

Freeze new concept creation. Remove or hide customer-facing passport, wallet, dossier, snapshot, receipt, recognition, and packet terminology.

Fix the P0 security issues. Finalize the legal foundation. Instrument the complete funnel.

### Days 31–60: Build the one perfect loop

Ship:

> NPI → useful preview → claim profile → set preferences → see real role → apply with profile → employer reviews

Recruit five to ten employer design partners in the same segment. Do not spread them across unrelated specialties.

### Days 61–90: Prove economic value

Measure:

* NPI-to-preview success rate
* Preview-to-claimed-profile conversion
* Time to first useful profile
* Profile-to-application conversion
* Application completion rate
* Employer time to first review
* Repeated-data-entry avoided
* Offer-to-start time
* Starts per employer
* Clinician profile reuse

Your north-star metric should eventually be:

> **Clinician starts enabled by a reused VitalCV profile**

Not profiles created. Not verifications run. Not packets generated.

## The decisive idea

VitalCV already contains the ingredients of several companies: a profile builder, a trust network, a credentialing assistant, a job marketplace, an AI career agent, and an employer operations system.

That is not yet an advantage. It is a lack of choice.

Make one thing unmistakable:

> **VitalCV is the profile clinicians carry from opportunity to opportunity—and the fastest way for employers to turn qualified interest into a successful start.**

Keep the NPI wedge. Keep the trust engine. Hide the machinery. Make the reusable profile the product. Make the clinician start the transaction.

[1]: https://investors.doximity.com/news/news-details/2026/Doximity-Announces-Fourth-Quarter-and-Fiscal-Year-2026-Financial-Results/default.aspx?utm_source=chatgpt.com "Doximity Announces Fourth Quarter and Fiscal Year 2026 ..."
[2]: https://vitalcv.com/ "vitalcv.com"
[3]: https://vitalcv.com/trust "Trust Center — VitalCV — VitalCV"
[4]: https://github.com/ctol3r/vitalcv/tree/main/apps/web/app "vitalcv/apps/web/app at main · ctol3r/vitalcv · GitHub"
[5]: https://github.com/ctol3r/vitalcv/blob/main/apps/web/DESIGN_GUIDELINES.md "vitalcv/apps/web/DESIGN_GUIDELINES.md at main · ctol3r/vitalcv · GitHub"
[6]: https://data.hrsa.gov/topics/health-workforce/workforce-projections?utm_source=chatgpt.com "Workforce Projections"
[7]: https://github.com/ctol3r/vitalcv/issues/983 "Implement the Clinician Enrichment Graph · Issue #983 · ctol3r/vitalcv · GitHub"
[8]: https://github.com/ctol3r/vitalcv/issues "Issues · ctol3r/vitalcv · GitHub"
[9]: https://vitalcv.com/terms "Terms of Service — VitalCV"
