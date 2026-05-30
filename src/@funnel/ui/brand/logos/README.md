# GoFunnelAI — Brand Logos

The 4 official logo files. Filenames are **load-bearing** — the codebase references these specific paths everywhere.

## Logo files

| Filename | Description | Use cases |
|---|---|---|
| `funelai_primary_logo.png` | Color logo + wordmark (purple→orange gradient on funnel + lightning) | Marketing site hero, headers, social OG images, press kit, decks, color emails |
| `funelai_all_black.png` | All-black logo + wordmark | Light-mode site header, light emails, light favicons, single-color print |
| `funelai_all_white.png` | All-white logo + wordmark | Dark-mode site header, dark emails, dark hero, dark backgrounds |
| `funelai_social_media_profile.png` | Square icon + wordmark for social profile | App icon, mobile icon, favicon source, social profile pics, loading screens, all derivative favicons |

## Where these files are referenced

- `packages/ui/src/brand/Logo.tsx` — React component used by every app
- `packages/ui/src/brand/index.ts` — `LOGO_URLS` constant for non-React contexts
- `packages/ui/scripts/build-icons.ts` — generates favicons from `funelai_social_media_profile.png`
- `packages/email/src/templates/*` — every transactional email
- `apps/mobile/assets/icon.png` — mobile app icon (build copies `funelai_social_media_profile.png`)
- `apps/web/public/og-default.png` — social share OG image
- `apps/grader/public/og-default.png` — Funnel Grader share preview
- Press kit PDF generator
- GoFunnelAI Awards case-study pages
- Academy certificate PDFs

## Auto-generated derivatives

The build pipeline auto-generates from `funelai_social_media_profile.png` into `../favicons/`:
- `favicon.ico` (multi-res)
- `favicon-16.png`, `favicon-32.png`
- `favicon-192.png`, `favicon-512.png` (Android)
- `apple-touch-icon.png` (180×180)
- `mstile-150.png`, `mstile-310.png` (Windows)
- `og-default.png` (1200×630 social card with primary logo centered)

Run `pnpm --filter @funnel/ui build:icons` to regenerate after dropping new source PNGs.

## To replace logos

1. Drop new PNGs here with the exact filenames above
2. Run `pnpm --filter @funnel/ui build:icons` to regenerate favicons
3. Run `pwsh ./scripts/install-logos.ps1` to propagate to all apps + mobile + mirror to OneDrive
