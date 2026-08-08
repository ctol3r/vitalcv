# DIRECTION A — OPERATIONAL CALM

Question: What if VitalCV felt like the calmest, most capable operating system in healthcare hiring?
It should feel expensive without being flashy. Avoid generic healthcare-blue SaaS entirely.

## Palette (deliberate break from current teal / violet / paper)
- Ground: porcelain bone `#F1F0EC`; secondary ground `#E9E8E3`; solid panel white `#FFFFFF`.
- Ink: near-black graphite `#191B1C`; secondary ink `#5B5E5C`; hairline rule `#D6D5CF`.
- ONE accent: deep spruce green `#175E4C` (VitalCV-does-work / done states, primary CTA).
- State supporting tones (muted, small doses only): needs-you amber `#8A6A1F` on `#F4EDDB`;
  waiting/neutral `#6B6E6A` on `#ECECE7`; approval spruce-tint `#DFEAE4`.
- No gradients anywhere. Solid grounds, hairline rules, precise shadows barely-there or none.

## Type
- Google Fonts: "Instrument Sans" (400/500/600) for everything display + body — calm, humanist,
  precise. "IBM Plex Mono" (400/500) for micro-labels, states, timestamps, NPI glyphs.
- Display scale restrained: hero h1 ~56-64px/1.05 desktop, 34-38px mobile, -0.02em. Body 16-17px/1.6.
- Micro-labels: 11px mono uppercase, +0.08em tracking.

## Layout grammar
- 12-col grid, 32px gutters, max-width ~1360 with full-bleed hairline rules that run edge-to-edge.
- The page reads as a calm operations surface made humane: lots of air, every rule intentional.
- Cards are NOT rounded bento boxes: radius 0–2px, 1px `#D6D5CF` borders, solid white on bone.
- Section labels: small mono index ("01 — How it works" style is allowed but keep humane).

## Eyebrow (per master spec)
- 64px, bone ground (solid from the start), 1px bottom rule full width.
- Left: "VitalCV" wordmark, Instrument Sans 600, 18px, tight. Middle: two quiet items only —
  "For clinicians" / "For employers" (12px, sentence case, quiet). Right: "Sign in" (quiet text) +
  one square-corner spruce instrument "Start with your NPI" (44px tall) + no menu (nav is light
  enough). On scroll: nothing moves; the rule below simply holds. Over the dark footer band (if
  any): keep bone. Mobile: wordmark + spruce CTA (shortened "Start") + "Menu" text control opening
  a full-height calm index (not a sheet with pills).

## Hero
- Left 6 cols: h1 "Enter your NPI. VitalCV does the rest." Supporting: "We find what we can, show
  you exactly what remains, and handle the administrative work that can safely be handled." Primary
  action: real NPI entry field (mono placeholder "Your 10-digit NPI", square corners, spruce submit
  "Start"). Subtle employer entry: one quiet line under, "Hiring clinicians? See how VitalCV keeps
  a hire moving →" linking to /employers.
- Right 5-6 cols: a QUIET humane work ledger — an abstracted "today" panel: 4-5 rows of work with
  states (Done by VitalCV ·, Ready for your approval, Needs you, Waiting on employer), rendered as
  calm console rows with mono timestamps and small state marks. Clearly an illustration (labels
  like "What a week with VitalCV looks like" — honest framing, not fake live data). Rows resolve
  gently once on scroll-in (320ms each, staggered).

## How-it-works explainer (the 5 beats from the master brief)
- A vertical operations sequence inside one wide panel: left rail = the 5 beat labels; right = one
  abstract surface where: masked NPI seed enters → source facts assemble as labeled skeleton rows
  (NPPES · State board record · Practice info) → remaining items appear with owner labels → items
  migrate between four state columns (Done by VitalCV / Ready for approval / Needs you / Waiting on
  employer) → one approval pause + confirm → resolves to role + first-day progress meter.
- Driven by scroll (each beat advances as its label enters view) + a "Replay" text button.
  Single-shot, 320ms transitions, generous pauses. Reduced motion: all five beats rendered as a
  static annotated sequence, fully readable.

## Remaining sections: ownership model (4 calm columns, few example items), outcome/jobs (one strong
row: "All of this exists so you start sooner." + role card abstraction + progress-to-first-day),
employer doorway (bone-2 band, one sentence + quiet CTA), final CTA (repeat NPI field), footer
(one hairline, tiny mono, minimal links: For employers · Sign in · Privacy · Terms).

## Feeling checklist
Calm. Capable. Nothing shouting. The agent is present as completed work, not personality.
