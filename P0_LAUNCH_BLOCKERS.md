# P0 Launch Blockers

This list is limited to blockers that could stop real users from completing the launch path.

## Blocker 1: Static cutover not yet verified

- The Cloudflare Pages configuration exists.
- The static-first boundary has been defined.
- The actual cutover has not been executed or proven live.

## Blocker 2: Dynamic passport hydration still owns the first trust moment

- Passport is still a live hydration surface.
- If the backend source path stalls, the user waits before seeing value.

## Blocker 3: Legacy runtime assumptions still exist in the app tree

- Many routes still contain `localhost:4000` fallbacks.
- That is acceptable only while the minimal backend remains on the live API origin.
- It is a blocker if any of those fallbacks are allowed to win in production.

## Blocker 4: Launch path has not been smoke-tested on real devices

- Mobile width still needs a live pass.
- Tablet width still needs a live pass.
- Desktop still needs a post-cutover pass.

## Blocker 5: Secondary CTAs still widen the surface area

- The homepage still exposes pilot/contact/employer paths that are not part of the strict clinician signup wedge.
- That is not a runtime failure, but it is a launch clarity risk.

## Blocker 6: Static-first build output has not been proven end-to-end

- The app now has Cloudflare-compatible config.
- A successful build and deploy still need to be verified after migration.

## Blocker 7: Public credibility depends on honest trust states

- Passport and onboarding must remain calm and truthful.
- Any stale or degraded state must read as honest guidance, not error theater.

## Immediate next actions

1. Verify the static build on the new Cloudflare path.
2. Smoke-test homepage, signup, passport, and onboarding on mobile and desktop.
3. Confirm no production path falls back to localhost.
4. Trim secondary CTAs only if they interfere with the primary launch flow.
