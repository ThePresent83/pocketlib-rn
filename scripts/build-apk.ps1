[CmdletBinding()]
param(
  [ValidateSet("apk", "preview", "production")]
  [string]$Profile = "apk",

  [string]$ApiUrl = "",

  [string]$OutputDir = "dist\apk",

  [switch]$Local,
  [switch]$NoDownload,
  [switch]$DryRun,
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

function Get-EasProjectId {
  $appJsonPath = Join-Path $ProjectRoot "app.json"
  if (-not (Test-Path $appJsonPath)) {
    return ""
  }

  try {
    $appConfig = Get-Content -Raw -Encoding UTF8 $appJsonPath | ConvertFrom-Json
    $projectId = $appConfig.expo.extra.eas.projectId
    if ($projectId) {
      return [string]$projectId
    }
  } catch {
    return ""
  }

  return ""
}

function Ensure-JsonProperty([object]$Object, [string]$Name, [object]$Value) {
  if (-not $Object.PSObject.Properties[$Name]) {
    $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $Value
  }
}

function Set-EasProfileApiUrl([string]$ProfileName, [string]$Url) {
  $easJsonPath = Join-Path $ProjectRoot "eas.json"
  if (-not (Test-Path $easJsonPath)) {
    throw "eas.json was not found"
  }

  $config = Get-Content -Raw -Encoding UTF8 $easJsonPath | ConvertFrom-Json
  Ensure-JsonProperty $config "build" ([pscustomobject]@{})
  Ensure-JsonProperty $config.build $ProfileName ([pscustomobject]@{})
  Ensure-JsonProperty $config.build.$ProfileName "env" ([pscustomobject]@{})

  if ($config.build.$ProfileName.env.PSObject.Properties["EXPO_PUBLIC_API_URL"]) {
    $config.build.$ProfileName.env.EXPO_PUBLIC_API_URL = $Url
  } else {
    $config.build.$ProfileName.env | Add-Member -MemberType NoteProperty -Name "EXPO_PUBLIC_API_URL" -Value $Url
  }

  $config | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $easJsonPath
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

Write-Step "PocketLib APK build"
Write-Host "Project: $ProjectRoot"
Write-Host "Profile: $Profile"
Write-Host "API URL: $ApiUrl"

$usesLocalAddress = $ApiUrl.Contains("localhost") -or $ApiUrl.Contains("127.0.0.1") -or $ApiUrl.Contains("10.0.2.2")
Write-Host "Phone-safe API URL: $(-not $usesLocalAddress)"
if ($usesLocalAddress) {
  Write-Warning "This API URL will not work on a real phone. Use your PC LAN IP or a public server URL."
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
    $message = "Backend is not responding at $ApiUrl/health. The APK can be built, but the app will not see this server URL."
    if ($StrictBackend) {
      throw $message
    }
    Write-Warning $message
  }
}

Write-Step "EAS Android build"
if (-not $env:EXPO_TOKEN) {
  try {
    & npx.cmd eas-cli@latest whoami --non-interactive | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "not logged in"
    }
  } catch {
    Write-Host ""
    Write-Host "EAS cloud build requires an Expo account." -ForegroundColor Yellow
    Write-Host "Run: npx eas-cli@latest login"
    Write-Host ""
    Write-Host "No Expo account? Build locally instead:" -ForegroundColor Green
    Write-Host "npm run build:apk:easy"
    exit 1
  }
}

$easProjectId = Get-EasProjectId
if (-not $easProjectId) {
  Write-Host ""
  Write-Host "EAS project is not configured yet." -ForegroundColor Yellow
  Write-Host "Run once in this project:"
  Write-Host "npx eas-cli@latest init"
  Write-Host ""
  Write-Host "Then run the build again:"
  Write-Host "npm run build:apk:eas"
  Write-Host ""
  Write-Host "No Expo cloud needed? Use local APK build instead:" -ForegroundColor Green
  Write-Host "npm run build:apk:easy"
  exit 1
}
Write-Host "EAS project ID: $easProjectId"

$buildArgs = @("eas-cli@latest", "build", "--platform", "android", "--profile", $Profile, "--non-interactive", "--wait")
if ($Local) {
  $buildArgs += "--local"
}
if ($DryRun) {
  Write-Host "Would write EXPO_PUBLIC_API_URL=$ApiUrl to eas.json profile '$Profile'"
  Write-Host "Dry run command: npx.cmd $($buildArgs -join ' ')" -ForegroundColor Yellow
  exit 0
}
Set-EasProfileApiUrl $Profile $ApiUrl
Write-Host "EAS env EXPO_PUBLIC_API_URL: $ApiUrl"
Invoke-CheckedCommand "npx.cmd" $buildArgs

if ($NoDownload -or $Local) {
  Write-Host ""
  Write-Host "Build finished. For local builds, EAS CLI prints the artifact path." -ForegroundColor Green
  exit 0
}

Write-Step "Download latest Android artifact"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$extension = if ($Profile -eq "production") { "aab" } else { "apk" }
$artifactPath = Join-Path $OutputDir "pocketlib-$Profile-$timestamp.$extension"

try {
  Invoke-CheckedCommand "npx.cmd" @("eas-cli@latest", "build:download", "--platform", "android", "--latest", "--path", $artifactPath, "--non-interactive")
  Write-Host ""
  Write-Host "Done: $artifactPath" -ForegroundColor Green
} catch {
  Write-Warning "Could not download the artifact automatically. Open the latest Android build in EAS and download it manually."
  throw
}
