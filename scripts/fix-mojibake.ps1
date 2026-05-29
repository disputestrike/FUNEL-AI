# Strips UTF-8 mojibake and authoring-error character substitutions from source files.
# Idempotent: safe to re-run; reports "0" when clean.

$ErrorActionPreference = 'Continue'

$exts = @("*.ts", "*.tsx", "*.js", "*.jsx", "*.json", "*.md", "*.mdx", "*.yaml", "*.yml", "*.toml", "*.css", "*.html", "*.txt", "*.env*", "*.ps1", "*.sh")
$skipDirs = "node_modules|\.next|\.turbo|dist|build|\.cache|out|coverage|\.git|\.wrangler"

# Target characters
$emDash = [char]0x2014
$enDash = [char]0x2013
$ldquo = [char]0x201C
$rdquo = [char]0x201D
$lsquo = [char]0x2018
$rsquo = [char]0x2019
$hellip = [char]0x2026
$bullet = [char]0x2022

# UTF-8-as-CP1252 mojibake sequences
$pA = [string][char]0xE2 + [char]0x20AC + [char]0x201D  # "" => em dash (from 0xE2 0x80 0x94)
$pC = [string][char]0xE2 + [char]0x20AC + [char]0x0153  # “ => left double quote
$pD = [string][char]0xE2 + [char]0x20AC + [char]0x2122  # ’ => right single quote (apostrophe)
$pE = [string][char]0xE2 + [char]0x20AC + [char]0x02DC  # ‘ => left single quote
$pF = [string][char]0xE2 + [char]0x20AC + [char]0xA6    # … => ellipsis
$pG = [string][char]0xE2 + [char]0x20AC + [char]0xA2    # • => bullet
$pH = [string][char]0xC2 + ' '                          #   => nbsp -> space
$pI = [string][char]0xC2 + [char]0x2014                 # — => em dash
$pJ = [string][char]0xE2 + [char]0x20AC                 # leftover " => "

# Authoring-error substitution: right-double-quote used as em-dash separator
$sep1 = ' ' + $rdquo + ' '
$sepEm = ' ' + $emDash + ' '

$fixed = 0
$errors = 0
$files = Get-ChildItem -Path "C:\Users\benxp\FUNEL-AI-review" -Recurse -Include $exts -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch $skipDirs }

foreach ($f in $files) {
  try {
    $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.UTF8Encoding]::new($false))
  } catch {
    $errors++
    continue
  }
  if ($null -eq $content -or $content.Length -eq 0) { continue }
  $original = $content
  $content = $content.Replace($pA, $emDash)
  $content = $content.Replace($pC, $ldquo)
  $content = $content.Replace($pD, $rsquo)
  $content = $content.Replace($pE, $lsquo)
  $content = $content.Replace($pF, $hellip)
  $content = $content.Replace($pG, $bullet)
  $content = $content.Replace($pI, $emDash)
  $content = $content.Replace($pH, ' ')
  $content = $content.Replace($pJ, '"')
  # Authoring error: " used as em-dash separator
  $content = $content.Replace($sep1, $sepEm)
  if ($content -ne $original) {
    try {
      [System.IO.File]::WriteAllText($f.FullName, $content, [System.Text.UTF8Encoding]::new($false))
      $fixed++
    } catch {
      $errors++
    }
  }
}
Write-Output "Fixed mojibake in $fixed files (errors: $errors)"
