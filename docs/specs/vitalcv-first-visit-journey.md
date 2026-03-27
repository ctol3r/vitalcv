# First-Visit Journey Doctrine

## First 3 User Questions
Every entry point into VitalCV must immediately and clearly answer these three questions for a first-time visitor:
1. **What is this?** (A verifiable credential network / infrastructure for source-of-truth professional data.)
2. **Is it trustworthy?** (Yes, because everything is tethered to primary sources with timestamps, not self-reported text.)
3. **What do I do next?** (Clear path to claim a profile or start verification for hiring/credentialing.)

## Calls to Action
A page should not overwhelm the user with choices.
- **One Primary CTA:** Aimed at the core conversion action (e.g., "Start Verification", "Claim Profile"). It must be unambiguous.
- **One Secondary CTA:** Aimed at low-friction exploration or documentation (e.g., "View Example Profile", "Read the Docs").

## Allowed Preview States
When showing unauthenticated users a preview of what VitalCV provides, strictly adhere to these states:
- **Verified Data:** Shown with clear, calm badges indicating the ultimate source and time of verification.
- **Pending/Missing Data:** Shown explicitly as "Unverified" or "Pending Source Sync". We do not use fake loading bars or skeleton loaders to feign activity that isn't happening.
- **Redacted Information:** PII or sensitive info must be cleanly redacted (e.g., `•••• 1234`) with a lock or shield icon, explaining that the data is verified behind the scenes but obscured for privacy.

## Synthetic Routes (Demotion/Removal)
- **Definition:** Synthetic routes are aggregate pages (like "Top Doctors in Texas") generated primarily for SEO.
- **Rule:** We do not rely on dashboard sludge or synthetic SEO bait to build trust. If a directory page exists, it must prioritize truth over traffic.
- **When to Demote:** If a synthetic route has less than an 80% profile fill rate or lacks primary source verification for its key nodes, it must be demoted from sitemaps and internal navigation.
- **When to Remove:** If a route presents unverified, scraped data alongside verified data without a sharp, unmistakable visual distinction, or if it generates "empty states" that degrade the brand's trust posture, it must be completely removed. We only render what is true.
