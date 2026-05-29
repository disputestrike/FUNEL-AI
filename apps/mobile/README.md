# @funnel/mobile

GoFunnelAI iOS + Android — monitor leads, respond fast, run RevTry follow-ups,
and voice-edit funnels on the go.

This app is **not** for building funnels from scratch — that workflow stays
on desktop and voice. Mobile is for the moments when a lead just came in and
you have three minutes between meetings.

## Stack

- **Expo SDK 51** + **React Native 0.74** + **TypeScript**
- **Expo Router** — file-based routing in `app/`
- **NativeWind** — Tailwind for React Native, tokens mirror doc 22
- **React Query** — server state, caching, optimistic updates
- **Zustand** — auth + lightweight client state
- **react-native-mmkv** — fast (synchronous) offline cache
- **expo-notifications** — push (Expo push tokens, custom sounds, channels)
- **expo-haptics** — tactile feedback on real moments only
- **expo-local-authentication** — Face ID / Touch ID unlock
- **expo-av** — voice command recording

## Running locally

```bash
# from the repo root
pnpm --filter @funnel/mobile install
pnpm --filter @funnel/mobile start          # opens Expo dev menu
pnpm --filter @funnel/mobile ios            # iOS simulator
pnpm --filter @funnel/mobile android        # Android emulator
```

Run on a physical device with the Expo Go app for fast iteration, or build a
development client with `eas build --profile development` for full native
modules (biometric, push, MMKV all need a dev client; they won't work in
Expo Go).

## Environment variables

Set in `eas.json` per channel. For local dev create `.env.local`:

```
EXPO_PUBLIC_API_BASE_URL=https://api-staging.gofunnelai.com
EXPO_PUBLIC_WS_URL=wss://api-staging.gofunnelai.com/realtime
```

Any var prefixed `EXPO_PUBLIC_` is inlined at build time. Server-side secrets
do **not** belong here.

## Project layout

```
app/                       expo-router file-based screens
  _layout.tsx              providers, theme, auth gate, push install
  (auth)/login             magic-link sign-in
  (auth)/biometric         Face ID / Touch ID unlock
  (tabs)/_layout           bottom tab bar
  (tabs)/index             Dashboard (KPI + sparkline + activity)
  (tabs)/leads/index       Real-time lead inbox
  (tabs)/leads/[id]        Lead detail (one-tap call, SMS, email, timeline)
  (tabs)/funnels/index     Funnel list
  (tabs)/funnels/[id]      Funnel detail + voice command
  (tabs)/activity/index    Community + system activity feed
  (tabs)/settings/index    Profile, notifications, biometric, sign out
lib/                       client modules (api, auth, storage, push, voice, theme, query)
styles/                    NativeWind global stylesheet
widgets/                   iOS WidgetKit + Android Glance sources
apple-watch/               watchOS companion
assets/                    icons, splash, sounds
tests/                     Jest + React Native Testing Library
```

## Building and submitting

We use **EAS Build** (managed) for both platforms.

```bash
# install EAS CLI once
npm i -g eas-cli
eas login

# development client (one-time, lets you run locally with native modules)
eas build --profile development --platform ios
eas build --profile development --platform android

# production build for App Store / Play Store
eas build --profile production --platform all

# submit
eas submit --platform ios       # uploads to App Store Connect
eas submit --platform android   # uploads to Play Console
```

Apple credentials are stored in EAS; Play credentials live in
`./secrets/google-play-service-account.json` (gitignored).

## Push notifications

Registration runs on first app open after sign-in. The token is POSTed to
`/v1/devices/push`. Four "kinds" are handled by `lib/push-notifications.ts`:

| Kind | Channel (Android) | Routes to | Mutable? |
|------|-------------------|-----------|----------|
| `lead.new` | leads | `/(tabs)/leads/[id]` | yes |
| `milestone.hit` | milestones | `/(tabs)` | yes |
| `ab.winner` | experiments | `/(tabs)/funnels/[id]` | yes |
| `payment.failed` | billing | `/(tabs)/settings` | no (regulatory) |

## Voice commands

Hold the mic button on a funnel detail screen. Audio is recorded with
`expo-av`, uploaded to `/v1/voice/command` (Whisper transcription happens
server-side), and the orchestrator returns a structured `VoiceIntent` it
will act on. The screen refreshes after a successful command to show the
applied change.

## Widgets

See `widgets/README.md`. Three widgets total — Today's leads, Active
campaigns, Conversion ticker. iOS uses WidgetKit (Swift), Android uses
Glance (Kotlin). Both read from a shared snapshot the main app hydrates
on foreground.

## Apple Watch

See `apple-watch/README.md`. Companion app with two quick notification
actions (Mark contacted, Call).

## Brand / design system

Tokens come from `funnel-ai-docs/22-brand-and-design-system.md`:

- One primary brand color (signal-500 `#5B4FFF`).
- Warm slate neutrals.
- Inter typography (variable).
- Skeleton loaders, not spinners. Shimmer respects `prefers-reduced-motion`.
- Tabular figures on numeric UI.
- Minimum 44Ã—44 px touch targets.
- VoiceOver / TalkBack labels on every interactive element.
- `accessibilityRole`, `accessibilityState`, `accessibilityLabel` audited
  per screen (lead detail, funnels detail, settings).

## Testing

```bash
pnpm --filter @funnel/mobile test
pnpm --filter @funnel/mobile typecheck
```

Smoke tests live in `tests/`. They cover:

- Format helpers (`format.test.ts`)
- Auth store hydration (`auth-store.test.ts`)
- API error mapping (`api-error-mapping.test.ts`)
- Dashboard renders empty + populated states (`dashboard.test.tsx`)
- Lead inbox renders rows and handles empty state (`leads-inbox.test.tsx`)
