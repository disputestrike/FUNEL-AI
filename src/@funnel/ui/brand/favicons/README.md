# Auto-generated favicons

Don't drop files here directly — these are auto-generated from `../logos/icon-color.png` by the build pipeline.

## Generate

```bash
pnpm --filter @funnel/ui build:icons
```

This produces:
- `favicon.ico` (multi-res: 16, 32, 48)
- `favicon-16.png`, `favicon-32.png`
- `favicon-192.png` (Android)
- `favicon-512.png` (Android maskable)
- `apple-touch-icon.png` (180×180)
- `safari-pinned-tab.svg`
- `mstile-150.png`, `mstile-310.png` (Windows)
- `og-default.png` (1200×630 social card)

The build script is at `packages/ui/scripts/build-icons.ts`. It reads `../logos/icon-color.png` as the source and uses `sharp` to produce all derivatives.
