# Mobile native build path — runbook

**Answers decision 3 of the [Expo SDK 53 → 57 wave plan](2026-08-08-expo-sdk-53-to-57-wave-plan.md):
add a native build path, or keep accepting JS-only verification.**

**Answer: the path is now configured. It has NOT been exercised.** Read §4
before treating any of this as evidence the app builds.

---

## 1. What landed

| File | Purpose |
|---|---|
| `apps/mobile/eas.json` | three EAS Build profiles — `development`, `preview`, `production` |
| `apps/mobile/.gitignore` | keeps `ios/` and `android/` generated, never committed |
| `expo-system-ui ~57.0.2` | new dependency — see §2, it fixes a live defect |

The app stays on **Continuous Native Generation (CNG)**: `ios/` and `android/`
are generated from `app.json` plus the config plugins, never hand-edited and
never committed. `eas build` regenerates them server-side.

**Why CNG rather than committing the native projects.** In the bare workflow
`app.json`'s `plugins` block stops driving native config, and every future SDK
upgrade becomes a manual native merge instead of a regeneration. The four-step
53 → 57 wave that just completed touched no native file precisely because this
app is CNG. Committing `ios/`/`android/` would have made that wave an order of
magnitude more expensive. The `.gitignore` exists to stop that happening by
accident — before it, `expo prebuild` left both directories untracked-but-not-
ignored, one `git add .` away from a silent, hard-to-reverse switch.

## 2. A live defect this work found

`expo prebuild` reported, on first run:

```
» ios: ios.backgroundColor: Install expo-system-ui to enable this feature
» android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.
```

`app.json` sets `userInterfaceStyle: "dark"`, `backgroundColor: "#080e1a"` and
`primaryColor: "#080e1a"`. **All three were inert** — declared in config,
silently dropped at prebuild, because `expo-system-ui` was not installed. The
wallet's dark theme would not have applied at the native layer.

Installing `expo-system-ui` clears both warnings, and the values now reach the
generated projects — verified by reading them out of the prebuild output rather
than trusting the absence of a warning:

| Platform | File | Value |
|---|---|---|
| Android | `app/src/main/res/values/colors.xml` | `colorPrimary` = `#080e1a`, `activityBackground` = `#080e1a` |
| iOS | `Info.plist` | `UIUserInterfaceStyle` = `Dark` |

This is the third defect of the same shape found in this app in one day, after
the notification trigger (#1144) and the react-navigation fork (#1173):
**declared, plausible, type-clean, and doing nothing.** None of the three was
visible to `tsc` or the test suite. This one was visible only to a native
prebuild — which is the argument for this build path existing at all.

## 3. Running a build

Nothing here runs in the agent sandbox — see §4. From a workstation:

```bash
npm i -g eas-cli          # or: pnpm dlx eas-cli@latest
eas login                 # requires an Expo account with access to the project
cd apps/mobile

# first time only: creates the EAS project and writes extra.eas.projectId
eas init

# a development client — the profile that closes the verification gap
eas build --profile development --platform ios      # simulator build
eas build --profile development --platform android  # apk

# then, on a device or simulator with the dev client installed:
pnpm --filter @vitalcv/mobile-wallet exec expo start --dev-client
```

`eas init` will write an `extra.eas.projectId` into `app.json`. That is
expected and should be committed.

To check the generated native projects locally without EAS:

```bash
cd apps/mobile
EXPO_OFFLINE=1 pnpm exec expo prebuild --no-install --platform all
# inspect ios/ and android/, then:
rm -rf ios android
```

`EXPO_OFFLINE=1` is required behind the agent proxy — see the SDK wave plan's
procedural findings. It is harmless elsewhere.

## 4. What this does NOT prove — read before citing it

**No native build has been produced.** The path is configured; it has never
been walked. Specifically, in this environment:

- **No Android SDK.** `java` exists, `ANDROID_HOME` is unset, no SDK on disk.
- **No Xcode.** Linux container; `xcodebuild` and `pod` absent.
- **`expo.dev` and `api.expo.dev` are unreachable** through the agent proxy
  (connection fails outright), so `eas login` and `eas build` cannot run at all.

What *was* verified: `expo prebuild` completes cleanly for both platforms with
zero advisories, the config plugins all resolve, and the config values reach the
generated projects. That is real — it caught §2 — but it is **project
generation**, not **compilation**. It does not exercise Fabric, Hermes V1, the
iOS 16.4 minimum, or anything at runtime.

So the wave plan's open item is narrowed, not closed:

| | Status |
|---|---|
| Native projects generate cleanly | ✅ verified, both platforms |
| Config reaches native output | ✅ verified by reading generated files |
| App **compiles** natively | ⬜ never attempted |
| Fabric / New Architecture runtime | ⬜ unexercised |
| Runs on a device or simulator | ⬜ never |
| `VALIDATION.md` clinician sessions | ⬜ still "AWAITING EXECUTION" |

**Do not describe this app as working.** The honest claim after this change is:
*its native projects generate correctly from config.* The first `eas build` is
what turns the remaining four rows green, and that has to be run by a human with
an Expo account.

## 5. Cost note

EAS Build's free tier is limited and builds queue. For an app with no store
presence and no users, the proportionate first step is a **single development
build on one platform** — enough to prove it compiles and launches — rather than
wiring builds into CI. Wiring EAS into CI before the app has ever compiled once
would be automating an unproven step.
