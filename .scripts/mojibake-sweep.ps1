param(
  [string]$Root = "C:\Users\benxp\funnel-ai"
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

# Build mojibake -> replacement pairs using explicit codepoints to avoid
# any reliance on how this script file's literals are interpreted.
function FromCps {
  param([int[]]$cps)
  -join ($cps | ForEach-Object { [char]$_ })
}

# CP1252 byte values reinterpreted as UTF-8 characters.
$A_TILDE      = [char]0x00C3   # Ã
$CIRC         = [char]0x00C2   # Â
$A_HAT        = [char]0x00E2   # â
$EURO         = [char]0x20AC   # €
$DAGGER_BAR   = [char]0x2020   # †  (NOTE: not used — see below)
$TM           = [char]0x2122   # ™  (not used)
$NBSP         = [char]0x00A0   # NBSP
$EM_DASH      = [char]0x2014   # —
$EN_DASH      = [char]0x2013   # –
$LDQUO        = [char]0x201C   # “
$RDQUO        = [char]0x201D   # ”
$LSQUO        = [char]0x2018   # ‘
$RSQUO        = [char]0x2019   # ’
$HELLIP       = [char]0x2026   # …
$BULL         = [char]0x2022   # •
$DAGGER       = [char]0x2020   # †

# When UTF-8 (3-byte) for U+2014 (— is 0xE2 0x80 0x94) is mis-decoded as CP1252,
# you get the sequence: â € " (0x00E2 0x20AC 0x0022). So the mojibake string is
# literally ""\""  i.e. â + € + ".
#
# 0x80 in CP1252 = € (U+20AC). 0x93 = “ (U+201C). 0x94 = — (U+201D). 0x99 = ™.
# 0x9C = œ. 0x9D = (none). 0xA0 = NBSP. 0x94 = ”.  And so on.
#
# Build the replacements:
$pairs = @(
  # Double-encoded em-dash (decoded twice): "Ã¢â‚¬\"" -> ""\"" -> "—"
  @{ from = "$A_TILDE$A_HAT$A_HAT$EURO`"";        to = $EM_DASH },
  # The classic single-decoded forms
  @{ from = "$A_HAT$EURO`"";                       to = $EM_DASH },   # â € " (right quotation mark surrogate) -> em-dash
  @{ from = "$A_HAT$EURO" + [char]0x201C;          to = $LDQUO },     # â € “
  @{ from = "$A_HAT$EURO" + [char]0x201D;          to = $RDQUO },     # â € ”
  @{ from = "$A_HAT$EURO" + [char]0x2122;          to = $RSQUO },     # â € ™  (apostrophe in CP1252 0x99)
  @{ from = "$A_HAT$EURO" + [char]0x02DC;          to = $LSQUO },     # â € ˜
  @{ from = "$A_HAT$EURO" + [char]0x00A6;          to = $HELLIP },    # â € ¦
  @{ from = "$A_HAT$EURO" + [char]0x00A2;          to = $BULL },      # â € ¢
  # Catch-all closing-quote variants — must run AFTER multi-char "-prefixed sequences
  @{ from = "$A_HAT$EURO";                         to = $RDQUO },
  # NBSP from 0xA0 mis-decoded
  @{ from = "$CIRC ";                              to = " " },
  @{ from = "$CIRC$EM_DASH";                       to = $EM_DASH }
)

$exts = @("*.ts","*.tsx","*.js","*.jsx","*.json","*.md","*.mdx","*.yaml","*.yml","*.toml","*.css","*.html","*.txt","*.mjs","*.cjs")
$skipDirs = "node_modules|\\.next|\\.turbo|dist|build|\\.cache|out|coverage|\\.git|\\.wrangler|\\.scripts"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$fixedCount = 0
$fixedFiles = New-Object System.Collections.Generic.List[string]

Get-ChildItem -LiteralPath $Root -Recurse -Include $exts -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch $skipDirs } |
  ForEach-Object {
    $path = $_.FullName
    try {
      $content = [System.IO.File]::ReadAllText($path, $utf8NoBom)
    } catch { return }
    if ($null -eq $content) { return }
    $original = $content
    foreach ($p in $pairs) {
      $content = $content.Replace($p.from, $p.to)
    }
    if ($content -ne $original) {
      [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
      $fixedCount++
      $fixedFiles.Add($path)
    }
  }

Write-Output "FIXED_COUNT=$fixedCount"
Write-Output "---FILES---"
foreach ($f in $fixedFiles) { Write-Output $f }
