# VitalCV Wallet — App Store Submission Runbook

The fastest path from this repo to a public iOS App Store listing.

## Time budget (clean start)

| Phase | Wall time | Blocking? |
|-------|-----------|-----------|
| Apple Developer enrollment | 24–48h (Apple side) | YES — start now |
| Expo + EAS setup | 15 min | After Apple |
| App Store Connect record | 30 min | After Apple |
| First EAS cloud build | 20–40 min | Automated |
| TestFlight processing | 15–60 min | Apple side |
| Internal TestFlight testing | Same day | — |
| App Store Review (public) | 24–48h typical | Apple side |

**Realistic minimum end-to-end: ~3 days.** Most of that is Apple wall-clock.
**Engineering work after enrollment is approved: ~1 hour.**

---

## Phase 0 — Right now (parallel, blocking)

Do these in parallel; nothing in this repo blocks them.

1. **Enroll in Apple Developer Program** — https://developer.apple.com/programs/enroll/
   - $99/yr. If enrolling as an org, you need a D-U-N-S number (free, ~24h via Dun & Bradstreet).
   - Individual enrollment is faster (often same-day) but the app will be published under your personal name.

2. **Create an Expo account + install EAS CLI**
   ```bash
   npm install -g eas-cli
   npx eas-cli login
   ```

3. **Prepare assets** (need these regardless):
   - 1024×1024 PNG app icon (no transparency, no rounded corners)
   - At least one 6.5" iPhone screenshot (1290×2796) — can be generated from simulator
   - Privacy policy URL hosted somewhere (vitalcv.com/privacy is fine)
   - Short description (≤170 chars), full description (≤4000 chars)

---

## Phase 1 — Once Apple Developer is approved (~1 hour total)

```bash
cd apps/mobile

# 1. Link this app to an EAS project (writes projectId into app.json)
npx eas-cli init

# 2. Configure iOS credentials (EAS handles signing certs + provisioning profiles automatically)
npx eas-cli credentials -p ios

# 3. In a browser: App Store Connect → My Apps → "+" → New App
#    - Platform: iOS
#    - Name: VitalCV Wallet
#    - Bundle ID: com.vitalcv.wallet  (matches app.json)
#    - SKU: vitalcv-wallet-ios
#    Copy the resulting "Apple ID" (numeric) — you'll need it.

# 4. Fill placeholders in apps/mobile/eas.json:
#    - appleId: your Apple Developer email
#    - ascAppId: the numeric ID from step 3
#    - appleTeamId: from developer.apple.com/account → Membership
#    Also fill `owner` in app.json with your Expo username.
```

---

## Phase 2 — Ship (one command)

```bash
cd apps/mobile
./scripts/ship-ios.sh production
```

This:
1. Verifies placeholders are filled
2. Typechecks + runs tests
3. Builds on EAS cloud (no Mac required)
4. Submits the resulting `.ipa` to App Store Connect → TestFlight

After ~30 min, the build appears in TestFlight. Add internal testers
(up to 100, no review needed) — they get the build immediately.

---

## Phase 3 — Public App Store release

In App Store Connect:
1. Add screenshots, description, keywords, support URL, privacy policy URL
2. Fill App Privacy questionnaire (this app collects: NPI, biometric data on-device only, no analytics)
3. Set age rating
4. Select the TestFlight build → "Submit for Review"
5. Apple typically responds in 24–48h

---

## What this repo's gate says (override notes)

`apps/mobile/ROLE.md` lists a 4-item deployment gate: 3 clinician validation
sessions, zero freeze triggers, web/mobile posture parity, no score without
verified evidence.

For ASAP shipping, the path-of-least-resistance is:
- Ship to **TestFlight only** (not public store) until the gate clears.
  TestFlight is technically "shipped" and downloadable by invite, but does
  not require Apple public review on each build.
- Use TestFlight invitations to run the 3 clinician validation sessions.
- Once gate clears, promote the same build to public via "Submit for Review."

This is the fastest *defensible* path.

---

## Things still needed in this repo before first build will succeed

- [ ] App icon at `apps/mobile/assets/icon.png` (1024×1024)
- [ ] Splash at `apps/mobile/assets/splash.png` (1284×2778 recommended)
- [ ] Adaptive icon foreground at `apps/mobile/assets/adaptive-icon.png` (Android, but Expo expects it)
- [ ] EAS projectId written into `app.json` by `eas-cli init`
- [ ] Placeholders in `eas.json` filled (Apple ID, ASC App ID, Team ID)

Everything else (signing certs, provisioning profiles, push entitlements)
EAS handles automatically on first build.
