[CmdletBinding()]
param(
  [ValidateSet("debug", "release")]
  [string]$Variant = "debug",

  [string]$ApiUrl = "",

  [string]$OutputDir = "dist\apk",

  [switch]$Clean,
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

if (-not $ApiUrl.Trim()) {
  if ($env:EXPO_PUBLIC_API_URL) {
    $ApiUrl = $env:EXPO_PUBLIC_API_URL
  } else {
    $ApiUrl = Get-LanApiUrl
  }
}

$ApiUrl = $ApiUrl.Trim().TrimEnd("/")
$env:EXPO_PUBLIC_API_URL = $ApiUrl

Write-Step "PocketLib local APK build"
Write-Host "Project: $ProjectRoot"
Write-Host "Variant: $Variant"
Write-Host "API URL: $ApiUrl"
Write-Host "Expo account required: False"

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

$prebuildArgs = @("expo", "prebuild", "--platform", "android")
if ($Clean) {
  $prebuildArgs += "--clean"
}

$gradleTask = if ($Variant -eq "release") { "assembleRelease" } else { "assembleDebug" }
$sourceApk = if ($Variant -eq "release") {
  Join-Path $ProjectRoot "android\app\build\outputs\apk\release\app-release.apk"
} else {
  Join-Path $ProjectRoot "android\app\build\outputs\apk\debug\app-debug.apk"
}

if ($DryRun) {
  Write-Step "Dry run"
  Write-Host "npx.cmd $($prebuildArgs -join ' ')"
  Write-Host "android\gradlew.bat $gradleTask"
  Write-Host "Expected APK: $sourceApk"
  exit 0
}

Write-Step "Android toolchain check"
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java was not found in PATH. Install Android Studio or JDK 17, then open a new PowerShell window."
}
if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
  throw "ANDROID_HOME or ANDROID_SDK_ROOT is not set. Install Android Studio and Android SDK first."
}
Write-Host "Java: OK"
Write-Host "Android SDK: OK"

Write-Step "Expo prebuild"
Invoke-CheckedCommand "npx.cmd" $prebuildArgs

Write-Step "Gradle $gradleTask"
Push-Location (Join-Path $ProjectRoot "android")
try {
  Invoke-CheckedCommand ".\gradlew.bat" @($gradleTask)
} finally {
  Pop-Location
}

if (-not (Test-Path $sourceApk)) {
  throw "APK was not found at $sourceApk"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$targetApk = Join-Path $OutputDir "pocketlib-local-$Variant-$timestamp.apk"
Copy-Item -LiteralPath $sourceApk -Destination $targetApk -Force

Write-Host ""
Write-Host "Done: $targetApk" -ForegroundColor Green
