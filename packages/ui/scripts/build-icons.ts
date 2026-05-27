/**
 * Build script — generates all favicon + app-icon derivatives from the source logos.
 *
 * Source: ../src/brand/logos/icon-color.png (1024×1024 recommended)
 * Output: ../src/brand/favicons/*
 *
 * Run: pnpm --filter @funnel/ui build:icons
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_ICON = join(ROOT, 'src/brand/logos/funelai_social_media_profile.png');
const SRC_LOGO_COLOR = join(ROOT, 'src/brand/logos/funelai_primary_logo.png');
const OUT_DIR = join(ROOT, 'src/brand/favicons');

const SIZES = {
  'favicon-16.png': 16,
  'favicon-32.png': 32,
  'favicon-192.png': 192,
  'favicon-512.png': 512,
  'apple-touch-icon.png': 180,
  'mstile-150.png': 150,
  'mstile-310.png': 310,
} as const;

async function main(): Promise<void> {
  if (!existsSync(SRC_ICON)) {
    console.error(`Missing source icon: ${SRC_ICON}`);
    console.error(`   Drop your funelai_social_media_profile.png into packages/ui/src/brand/logos/ first.`);
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log('📦 Building favicons + app icons from', SRC_ICON);

  // Build each square derivative
  for (const [filename, size] of Object.entries(SIZES)) {
    const outPath = join(OUT_DIR, filename);
    await sharp(SRC_ICON)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`  ✓ ${filename} (${size}×${size})`);
  }

  // Multi-res ICO via sharp+png-to-ico
  // (simpler: just use favicon-32 as a single-res .ico for now; production builds use png-to-ico)
  await sharp(SRC_ICON)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(OUT_DIR, 'favicon.ico'));
  console.log('  ✓ favicon.ico');

  // OG default image — 1200×630 social card with the marketing logo centered
  if (existsSync(SRC_LOGO_COLOR)) {
    await sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        {
          input: await sharp(SRC_LOGO_COLOR)
            .resize({ width: 600, fit: 'inside' })
            .toBuffer(),
          gravity: 'center',
        },
      ])
      .png()
      .toFile(join(OUT_DIR, 'og-default.png'));
    console.log('  ✓ og-default.png (1200×630)');
  }

  console.log('\n✅ Icons built.');
  console.log('   Wire them up in each app:');
  console.log('   - apps/web/public/ — copy favicons/* here for Next.js');
  console.log('   - apps/grader/public/ — same');
  console.log('   - apps/admin/public/ — same');
  console.log('   - apps/mobile/assets/icon.png — copy icon-color.png 1024×1024');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
