I need you to perform a comprehensive overhaul of the VitalCV web application (Next.js 14+ App Router, Tailwind, Clerk, TypeScript). Here are the exact issues and fixes needed, in priority order. Work through them methodically, testing each fix before moving to the next.

## CRITICAL BUG 1: Scroll Dead-Zone on Every Page
Every page has a ~600px blank gap when scrolling. The sticky nav re-anchors too late, creating massive dead space.
DIAGNOSTIC STEPS:
1. Open app/layout.tsx and identify the header component import
2. Open the header/nav component — check its CSS positioning. Look for `sticky top-0` vs `fixed`
3. Search the entire codebase for "scroll-snap" — remove any scroll-snap-type on body or main containers
4. Find the "Current source coverage" bar component (the one showing NPPES CHECKED / OIG CHECKED / CMS PECOS PENDING / CA State Board ACCESS REQUIRED) — check if it's also sticky
5. On the homepage, find the hero section wrapper — check for min-h-screen, h-screen, or min-height: 100vh that forces excess height
6. The fix likely involves: (a) removing scroll-snap, (b) removing min-h-screen from the hero, (c) making the source coverage bar position:relative instead of sticky, or adjusting its top offset to sit directly below the nav with no gap
EXPECTED RESULT: All pages scroll smoothly. No blank gaps anywhere.

## CRITICAL BUG 2: Dark Mode Does Nothing
The dark mode toggle adds class="dark" to <html> but nothing visual changes.
DIAGNOSTIC STEPS:
1. Check tailwind.config.ts — confirm darkMode: 'class' is set
2. Check globals.css for a .dark {} selector that remaps CSS custom properties
3. The <html> element already has 200+ CSS custom properties defined inline with --vds-dark-* variants. The problem is these dark variants aren't being USED by anything.
4. There are two approaches:
APPROACH A (recommended): In globals.css, add `.dark { }` block that remaps all the semantic color variables (--background, --foreground, --card, --border, --muted, --accent, etc.) from their light values to dark values using the already-defined --vds-dark-* tokens
APPROACH B: Go through every component and add dark: Tailwind variant classes
Do Approach A first. Search for where the light theme variables are defined (look for something like `--background: oklch(0.985...`) and create a parallel `.dark` block that overrides each one.
EXPECTED RESULT: Toggling the moon icon switches the entire site between light cream and dark navy/charcoal themes.

## CRITICAL BUG 3: Page Always Errored
The page permanently shows "Unable to load status data."
DIAGNOSTIC STEPS:
1. Open app/status/page.tsx
2. Find the API call that fetches status data — what endpoint is it hitting?
3. Check if the endpoint exists in the API routes
4. If the endpoint is on the Railway backend, check if it's CORS-configured for vitalcv.com
5. Add error handling with: retry button, auto-retry with exponential backoff (3 attempts), and fallback to showing "Status checks are currently offline" with a last-checked timestamp

## SEO OVERHAUL (All Pages)
Every page is missing OG tags, Twitter cards, canonical URLs, structured data, robots meta, and theme-color.
1. In app/layout.tsx, set comprehensive default metadata using Next.js Metadata API:
- metadataBase: new URL('https://vitalcv.com')
- Default title template: '%s | VitalCV'
- Default description targeting "healthcare credentialing verification" keywords
- Default OG image (you'll need to note that a /public/og-image.png needs to be created — use 1200x630 dimensions)
- twitter card: summary_large_image
- robots: index, follow
- theme-color: '#2C3E2D' (the dark green from the nav)
2. Add page-specific metadata exports to each page:
/passport — title: "Check Clinician Readiness", description about NPI readiness checks
/explore — title: "Explore Healthcare Roles", description about role matching
/employers — title: "For Healthcare Employers", description about credentialing decisions
/developers — title: "Developer API Documentation", description about wedge API
/pilot — title: "Start an Employer Pilot", description about pilot program
/compliance — title: "Compliance & Security", description about HIPAA/NIST alignment
— title: "Source Status", description about live source health
/updates — title: "Product Updates", description about changelog
3. Create app/sitemap.ts with all public routes
4. Create app/robots.ts allowing / and disallowing /api/, /internal/, /review/

## /PASSPORT PAGE REDESIGN
The main conversion page (/passport) is 70% empty with a monospace heading and bare NPI input. Redesign it to include:
1. Better heading: "Check Your Readiness" with a subheading explaining what happens ("Enter your NPI to instantly verify your credentialing status across NPPES, OIG/LEIE, PECOS, and state medical boards")
2. NPI input with Luhn checksum validation, 10-digit mask, and real-time visual feedback
3. Below the input, a brief explanation of each source with small icons:
- NPPES: "Identity verification from the National Plan and Provider Enumeration System"
- OIG/LEIE: "Exclusion check against the Office of Inspector General's List of Excluded Individuals"
- PECOS: "Medicare enrollment verification from Provider Enrollment, Chain, and Ownership System"
- FSMB: "State medical board licensure verification via the Federation of State Medical Boards"
4. A sample readiness card showing what results look like (use a mock/demo layout)
5. Privacy text: "VitalCV only checks publicly available data. No PHI is stored."
6. The layout should use the right side of the page (currently 70% empty) for either: an illustration, the sample card, or trust signals

## /COMPLIANCE PAGE LAYOUT FIX
The compliance page content is crammed into the left 35% of the viewport.
1. Wrap all content in a max-w-5xl mx-auto container
2. Make the security posture cards (HIPAA/NIST/Data Min) a responsive 3-column grid
3. Make the resources section a proper card grid
4. Ensure the "Security questions?" callout spans full content width

## /EXPLORE UX IMPROVEMENTS
1. Make the "Filters" button expand to show filter options (location, specialty, type, pay range)
2. Add a search/filter bar above the role cards
3. Change "View proof" links to point to working pages (either create stub employer profiles at /employers/[slug] or change the link destination)
4. Make "Calculate Fit" contextual — pass the role ID as a query param to /passport so the readiness check can be matched against that role's requirements

## FOOTER & NAV CONSISTENCY
1. Unify the footer to include ALL nav items plus supplementary links
2. Move the git commit hash from the public footer to either /updates only or a hidden /debug page
3. Add "About" and "Pricing" to both nav and footer (create stub pages if they don't exist)
4. Add a skip-to-content link as the first focusable element in the layout

## DEVELOPER PAGE IMPROVEMENTS
1. Note that the API host should be migrated to api.vitalcv.com (create an issue/TODO)
2. Add request/response examples for each endpoint
3. Add authentication documentation section
4. Link the SDK packages to their actual npm/github locations (or add TODO comments)
5. Add an interactive "Try it" section with a pre-filled curl command and copy button
