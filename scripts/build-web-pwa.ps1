[CmdletBinding()]
param(
  [string]$ApiUrl = "",
  [string]$OutputDir = "dist\web",
  [switch]$SkipTypecheck,
  [switch]$SkipBackendCheck,
  [switch]$StrictBackend
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-LanApiUrl {
  $ip = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress

  if (-not $ip) {
    $ip = "127.0.0.1"
  }

  return "http://$ip`:8080"
}

function Invoke-CheckedCommand([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE"
  }
}

function Update-PwaHtml([string]$IndexPath) {
  if (-not (Test-Path -LiteralPath $IndexPath)) {
    throw "index.html was not found at $IndexPath"
  }

  $html = Get-Content -Raw -Encoding UTF8 -LiteralPath $IndexPath
  $html = $html -replace '<html lang="en">', '<html lang="ru">'

  if ($html -notmatch 'manifest\.webmanifest') {
    $headInsert = @'
    <meta name="theme-color" content="#3F51B5" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="PocketLib" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/pwa/icon-192.png" />
'@
    $html = $html -replace '</head>', "$headInsert`r`n  </head>"
  }

  if ($html -notmatch 'navigator\.serviceWorker\.register') {
    $bodyInsert = @'
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
      }
    </script>
'@
    $html = $html -replace '</body>', "$bodyInsert`r`n  </body>"
  }

  Set-Content -Encoding UTF8 -LiteralPath $IndexPath -Value $html
}

if (-not $ApiUrl.Trim()) {
  if ($env:EXPO_PUBLIC_API_URL) {
    $ApiUrl = $env:EXPO_PUBLIC_API_URL
  } else {
    $ApiUrl = Get-LanApiUrl
  }
}

$ApiUrl = $ApiUrl.Trim().TrimEnd("/")
$env:EXPO_PUBLIC_API_URL = $ApiUrl
$OutputPath = Join-Path $ProjectRoot $OutputDir

Write-Step "PocketLib web app build"
Write-Host "Project: $ProjectRoot"
Write-Host "API URL: $ApiUrl"
Write-Host "Output: $OutputPath"

$usesPlainRemoteHttp = $ApiUrl -match '^http://' -and
  -not $ApiUrl.Contains("localhost") -and
  -not $ApiUrl.Contains("127.0.0.1")
if ($usesPlainRemoteHttp) {
  Write-Warning "If this PWA is hosted over HTTPS, browsers can block this HTTP API URL as mixed content. Use HTTPS for the backend or proxy it through the same HTTPS host."
}

if (-not $SkipTypecheck) {
  Write-Step "TypeScript check"
  Invoke-CheckedCommand "npx.cmd" @("tsc", "--noEmit")
}

if (-not $SkipBackendCheck) {
  Write-Step "Backend health check"
  try {
    $health = Invoke-RestMethod -Uri "$ApiUrl/health" -TimeoutSec 5
    Write-Host "Backend: $($health.status)" -ForegroundColor Green
  } catch {
    $message = "Backend is not responding at $ApiUrl/health. The web app can be built, but this API URL will not work for users."
    if ($StrictBackend) {
      throw $message
    }
    Write-Warning $message
  }
}

Write-Step "Expo web export"
if (Test-Path -LiteralPath $OutputPath) {
  Remove-Item -LiteralPath $OutputPath -Recurse -Force
}
Invoke-CheckedCommand "npx.cmd" @("expo", "export", "--platform", "web", "--clear", "--output-dir", $OutputDir)

Write-Step "PWA assets"
Copy-Item -Path (Join-Path $ProjectRoot "public\*") -Destination $OutputPath -Recurse -Force
Update-PwaHtml (Join-Path $OutputPath "index.html")
Write-Host "Done: $OutputPath" -ForegroundColor Green
