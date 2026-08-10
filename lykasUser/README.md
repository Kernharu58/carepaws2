# lykasUser — CarePaws Mobile App

Public mobile app for adopters, fosters, and volunteers. Expo (SDK 55) /
React Native / Expo Router, styled with NativeWind (Tailwind for React
Native), talking to `lykasServer` over REST and Socket.io.

## Prerequisites

- Node.js 22+
- Expo CLI (`npx expo` — no global install needed)
- A running `lykasServer` instance
- Xcode (iOS Simulator) and/or Android Studio (Android emulator) for
  native testing, or the Expo Go app on a physical device

## Quick start

```bash
cp .env.example .env
# set EXPO_PUBLIC_API_URL to your backend

npm install
npx expo start
```

Scan the QR code with Expo Go, or press `i`/`a` to launch a simulator.

## Environment variables

All variables **must** be prefixed `EXPO_PUBLIC_` to be inlined into the
bundle — anything without that prefix is not available at runtime and
silently resolves to `undefined`. Never put a real secret in one of
these; they end up in the client binary.

- `EXPO_PUBLIC_API_URL` — backend base URL.
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` — shared/web client ID for Google OAuth
  token verification.
- `EXPO_PUBLIC_ANDROID_CLIENT_ID` / `EXPO_PUBLIC_IOS_CLIENT_ID` —
  per-platform client IDs the native Google Sign-In SDK requires (see
  "Google Sign-In" below for why these are separate from the web ID).

## Testing

```bash
npm test          # run once
npm run test:watch
```

Uses `jest-expo` + `@testing-library/react-native`. Network calls go
through a mocked `api` module in each test file — no real backend is
hit. See `__tests__/chat-history-merge.test.tsx` for the trickiest case:
the exact race between the REST chat-history fetch and live Socket.io
messages is exercised as a pure, directly-testable function
(`mergeMessages`, exported from `app/(tabs)/chat.tsx`) rather than only
through full component rendering.

## Linting & typechecking

```bash
npm run lint
npx tsc --noEmit
```

## Project structure

```
app/                    — Expo Router screens, file-based routing (see §6.1/§6.2 of the project spec)
  (auth)/                — logIn, signUp — unauthenticated flows
  (tabs)/                — the main authenticated tab bar shell
  pets/, foster/, health/, baby-book/, appointments/, payment/
                          — nested dynamic routes ([id].tsx, [petId].tsx)
components/             — PetCard, AppointmentCard, ChatMessage, PrimaryButton,
                          TypingIndicator, StatusBadge, StateView, FormInput
context/AuthContext.tsx — session state, login/register/logout
utils/
  api.ts                — Axios client, expo-secure-store token persistence, refresh flow
  colors.ts              — plain TS mirror of tailwind.config.js (native props can't read className)
  format.ts              — currency/date/relative-time helpers
  pushNotifications.ts   — the permission-request + token-registration loop (§6.6)
__tests__/              — chat merge logic, auth screen error states, application form validation
```

## Google Sign-In

The mobile app uses the **native** `@react-native-google-signin/google-signin`
SDK, not a browser-redirect flow (`expo-auth-session`) — this exchanges
tokens without a browser redirect at all, avoiding the whole
redirect-URI class of bugs a redirect flow would introduce. See the
inline comment in `app/(auth)/logIn.tsx` for details. This requires a
native build (EAS Build or a dev client) — it will not work in Expo Go
for the actual Google flow, though every other screen does.

## Token storage

Access and refresh tokens live in `expo-secure-store` (iOS Keychain /
Android Keystore), not `AsyncStorage` — see `utils/api.ts`.
`AsyncStorage` is reserved for genuinely non-sensitive UI state
elsewhere (nothing currently uses it, but that's the intended split if
something like an onboarding-seen flag is added later).

## Push notifications

`utils/pushNotifications.ts` implements the full loop that was
previously just a declared dependency with nothing wired up:
permission request → Expo push token registration → `PUT` onto the
user's record → the backend's `notify()` helper sends to it. Toggled
from the Settings tab.

## Building & deployment

This repo does **not** containerize — Expo/EAS builds natively, so
there's intentionally no Dockerfile here (unlike `lykasServer` and
`lykasAdmin`).

```bash
# One-time: generate your own EAS project (do not reuse the ID in app.json's
# extra.eas.projectId — that's a placeholder, see the comment there)
eas init

eas build --platform ios --profile production
eas build --platform android --profile production
```

Three build profiles are defined in `eas.json`: `development` (dev
client), `staging`, `production` — each pointing at a different
`EXPO_PUBLIC_API_URL`.

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → audit on
every PR and push, and additionally triggers an EAS staging build
(`--no-wait`, so CI doesn't block on the full native build) on pushes
to `staging`/`develop`. This requires an `EXPO_TOKEN` secret configured
in the repo.

## Notable production fixes vs. the original source

- **Push notifications are fully wired** (see above) — the original
  had `expo-notifications` installed but never called anywhere.
- **Tokens live in `expo-secure-store`**, not the unencrypted
  `AsyncStorage`.
- **An error boundary wraps the root layout** (`app/_layout.tsx`) so a
  single screen crash doesn't white-screen the whole app.
- **Chat correctly merges REST history with live Socket.io messages**
  by ID, deduping regardless of arrival order — see `mergeMessages` in
  `app/(tabs)/chat.tsx` and its dedicated test file.
