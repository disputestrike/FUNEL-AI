# scripts/install-logos.ps1
#
# Run this AFTER you drop your logo PNGs into packages/ui/src/brand/logos/
# Copies logos everywhere they need to live, generates favicon derivatives, mirrors to OneDrive.
#
# Usage:
#   pwsh ./scripts/install-logos.ps1
#
# Prereqs:
#   1. Logos placed in packages/ui/src/brand/logos/:
#      - funelai_primary_logo.png        (color)
#      - funelai_all_black.png           (black)
#      - funelai_all_white.png           (white)
#      - funelai_social_media_profile.png (square - icon source)
#   2. Run `pnpm install` at repo root.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logosDir = Join-Path $root "packages/ui/src/brand/logos"

Write-Host "Installing GoFunnelAI brand logos..." -ForegroundColor Cyan

# Verify required files exist
$required = @(
    "funelai_primary_logo.png",
    "funelai_all_black.png",
    "funelai_all_white.png",
    "funelai_social_media_profile.png"
)
$missing = $required | Where-Object { -not (Test-Path (Join-Path $logosDir $_)) }
if ($missing.Count -gt 0) {
    Write-Host "Missing required logo files in ${logosDir}:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "All required logo files present" -ForegroundColor Green

# 1. Build favicons + derivatives (requires sharp installed)
Write-Host "`nBuilding favicons + app icon derivatives..." -ForegroundColor Cyan
try {
    & pnpm --filter "@funnel/ui" build:icons
} catch {
    Write-Host "  WARN: build:icons failed (sharp not installed yet?). Continuing without favicons." -ForegroundColor Yellow
    Write-Host "  Run after pnpm install: pnpm --filter @funnel/ui build:icons" -ForegroundColor Yellow
}

# 2. Copy favicons + logos to each Next.js app's /public folder
$apps = @("web", "grader", "admin", "developer-portal", "academy")
$faviconsSrc = Join-Path $root "packages/ui/src/brand/favicons"
foreach ($app in $apps) {
    $appPublic = Join-Path $root "apps/$app/public"
    if (Test-Path $appPublic) {
        $brandDest = Join-Path $appPublic "brand/logos"
        New-Item -ItemType Directory -Force -Path $brandDest | Out-Null
        Copy-Item -Path (Join-Path $logosDir "*.png") -Destination $brandDest -Force
        if (Test-Path $faviconsSrc) {
            Copy-Item -Path (Join-Path $faviconsSrc "*") -Destination $appPublic -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-Host "  Copied to apps/$app/public" -ForegroundColor Green
    }
}

# 3. Copy icon source to mobile app
$mobileAssets = Join-Path $root "apps/mobile/assets"
if (Test-Path $mobileAssets) {
    $iconSrc = Join-Path $logosDir "funelai_social_media_profile.png"
    Copy-Item -Path $iconSrc -Destination (Join-Path $mobileAssets "icon.png") -Force
    Copy-Item -Path $iconSrc -Destination (Join-Path $mobileAssets "adaptive-icon.png") -Force
    Copy-Item -Path $iconSrc -Destination (Join-Path $mobileAssets "splash.png") -Force
    Copy-Item -Path $iconSrc -Destination (Join-Path $mobileAssets "favicon.png") -Force
    Write-Host "  Copied to apps/mobile/assets" -ForegroundColor Green
}

# 4. Mirror to OneDrive
$oneDrive = "C:\Users\benxp\OneDrive\Desktop\GoFunnelAI"
if (Test-Path $oneDrive) {
    Write-Host "`nMirroring to OneDrive..." -ForegroundColor Cyan
    robocopy $root $oneDrive /MIR /XD node_modules .next .turbo dist .cache build out coverage .git .wrangler /XF *.log *.tsbuildinfo /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    Write-Host "  Mirrored to $oneDrive" -ForegroundColor Green
}

Write-Host "`nLogos installed everywhere. Brand pipeline complete." -ForegroundColor Green
