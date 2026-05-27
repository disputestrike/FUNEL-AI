# Brand rename sweep: FunelAI -> FunelAI, funelai.com (domain) -> funelai.com
# Run with: powershell -ExecutionPolicy Bypass -File scripts/brand-rename.ps1
# Usage: -RepoRoot <path> -LogFile <path>

param(
    [string]$RepoRoot = "C:\Users\benxp\funnel-ai",
    [string]$LogFile = "C:\Users\benxp\funnel-ai\CHANGE_LOG.md",
    [switch]$SkipChangeLog = $false
)

$ErrorActionPreference = 'Stop'

$extensions = @('.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.mdx','.yaml','.yml','.toml','.html','.css','.sh','.ps1','.py','.php','.txt','.xml','.svg','.liquid','.swift','.tf','.prisma','.sql','.env','.example')
$excludeDirs = @('node_modules', '.git', '.next', '.turbo', 'dist', 'build', '.wrangler', '.cache', 'out', 'coverage')

$stats = @{
    FilesModified = 0
    BrandReplacements = 0
    DomainReplacements = 0
    EmailReplacements = 0
    FilesPerformedOn = @{}
}

function ShouldInclude($filePath) {
    foreach ($excl in $excludeDirs) {
        if ($filePath -match "[\\/]$excl[\\/]") { return $false }
    }
    return $true
}

Write-Host "Scanning $RepoRoot for renameable files..." -ForegroundColor Cyan

$allFiles = Get-ChildItem -Path $RepoRoot -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $ext = $_.Extension.ToLower()
        # Match by extension or by name pattern for env files
        if ($extensions -contains $ext) { return ShouldInclude $_.FullName }
        if ($_.Name -match '^\.env') { return ShouldInclude $_.FullName }
        return $false
    }

Write-Host "Found $($allFiles.Count) candidate files" -ForegroundColor Cyan

foreach ($file in $allFiles) {
    try {
        $content = Get-Content -Raw -LiteralPath $file.FullName -ErrorAction Stop
    } catch {
        continue
    }
    if ($null -eq $content -or $content.Length -eq 0) { continue }

    $original = $content
    $brandCount = 0
    $domainCount = 0
    $emailCount = 0

    # 1) Email addresses: anything@funelai.com -> anything@funelai.com
    # Must run before the generic funelai.com replacement
    $emailMatches = [regex]::Matches($content, '@funnel\.ai\b')
    if ($emailMatches.Count -gt 0) {
        $emailCount = $emailMatches.Count
        $content = [regex]::Replace($content, '@funnel\.ai\b', '@funelai.com')
    }

    # 2) Brand-name product references: capital-F variants
    # FunelAI -> FunelAI
    $brandMatches = [regex]::Matches($content, '\bFunnel\.ai\b')
    if ($brandMatches.Count -gt 0) {
        $brandCount += $brandMatches.Count
        $content = [regex]::Replace($content, '\bFunnel\.ai\b', 'FunelAI')
    }
    # FunelAI -> FunelAI
    $brandMatches2 = [regex]::Matches($content, '\bFunnel\.AI\b')
    if ($brandMatches2.Count -gt 0) {
        $brandCount += $brandMatches2.Count
        $content = [regex]::Replace($content, '\bFunnel\.AI\b', 'FunelAI')
    }
    # FunelAI (all-caps brand) -> FunelAI
    $brandMatches3 = [regex]::Matches($content, '\bFUNNEL\.AI\b')
    if ($brandMatches3.Count -gt 0) {
        $brandCount += $brandMatches3.Count
        $content = [regex]::Replace($content, '\bFUNNEL\.AI\b', 'FunelAI')
    }

    # 3) Domain references: lowercase funelai.com. These are URLs/domains/subdomains.
    # Brand uses capital F, so lowercase funelai.com is always domain.
    # Generic replacement: any "funelai.com" -> "funelai.com" handles:
    #   - https://funelai.com -> https://funelai.com
    #   - api.funelai.com -> api.funelai.com
    #   - admin.funelai.com -> admin.funelai.com
    #   - funelai.com/grade -> funelai.com/grade
    #   - funelai.com/wins/ -> funelai.com/wins/
    #   - *.funelai.com -> *.funelai.com
    $domainMatches = [regex]::Matches($content, '\bfunnel\.ai\b')
    if ($domainMatches.Count -gt 0) {
        $domainCount = $domainMatches.Count
        $content = [regex]::Replace($content, '\bfunnel\.ai\b', 'funelai.com')
    }

    if ($content -ne $original) {
        Set-Content -LiteralPath $file.FullName -Value $content -NoNewline -Encoding UTF8
        $stats.FilesModified++
        $stats.BrandReplacements += $brandCount
        $stats.DomainReplacements += $domainCount
        $stats.EmailReplacements += $emailCount
        $rel = $file.FullName.Substring($RepoRoot.Length).TrimStart('\','/')
        $stats.FilesPerformedOn[$rel] = @{ brand = $brandCount; domain = $domainCount; email = $emailCount }
    }
}

# Output summary
Write-Host "----------------------------------------" -ForegroundColor Green
Write-Host "Files modified:        $($stats.FilesModified)" -ForegroundColor Green
Write-Host "Brand replacements:    $($stats.BrandReplacements)" -ForegroundColor Green
Write-Host "Domain replacements:   $($stats.DomainReplacements)" -ForegroundColor Green
Write-Host "Email replacements:    $($stats.EmailReplacements)" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Green

if (-not $SkipChangeLog) {
    $log = @()
    $log += "# Brand Rename CHANGE_LOG"
    $log += ""
    $log += "Sweep run: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $log += "Root: $RepoRoot"
    $log += ""
    $log += "## Summary"
    $log += ""
    $log += "- Total files modified: **$($stats.FilesModified)**"
    $log += "- Brand-name replacements (FunelAI -> FunelAI): **$($stats.BrandReplacements)**"
    $log += "- Domain replacements (funelai.com -> funelai.com): **$($stats.DomainReplacements)**"
    $log += "- Email replacements (@funelai.com -> @funelai.com): **$($stats.EmailReplacements)**"
    $log += ""
    $log += "## Replacement rules applied"
    $log += ""
    $log += '- `FunelAI` / `FunelAI` / `FunelAI` -> `FunelAI`'
    $log += '- `funelai.com` -> `funelai.com` (all domain/subdomain/URL contexts)'
    $log += '- `@funelai.com` -> `@funelai.com` (email addresses)'
    $log += ""
    $log += "## Excluded from rename (intentional)"
    $log += ""
    $log += '- `@funnel/*` npm scope packages'
    $log += '- Lowercase identifier `funnel` (funnelId, funnelJson, FunnelOrchestrator, etc.)'
    $log += '- Repo paths: `funnel-ai/`, `funnel-ai-docs/`'
    $log += '- Skipped dirs: node_modules, .git, .next, .turbo, dist, build, .wrangler, .cache, out, coverage'
    $log += ""
    $log += "## Files modified"
    $log += ""
    $log += "| File | Brand | Domain | Email |"
    $log += "|------|-------|--------|-------|"
    foreach ($k in ($stats.FilesPerformedOn.Keys | Sort-Object)) {
        $v = $stats.FilesPerformedOn[$k]
        $log += ("| ``{0}`` | {1} | {2} | {3} |" -f $k, $v.brand, $v.domain, $v.email)
    }
    Set-Content -LiteralPath $LogFile -Value ($log -join "`n") -Encoding UTF8
    Write-Host "Wrote change log to $LogFile" -ForegroundColor Cyan
}

# Return totals as object for programmatic consumption
$stats
