[CmdletBinding()]
param(
  [string]$ApiUrl = "",
  [switch]$NoDockerBuild,
  [switch]$NoExpoClear
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

function Wait-Backend([string]$Url) {
  for ($i = 1; $i -le 30; $i++) {
    try {
      $health = Invoke-RestMethod -Uri "$Url/health" -TimeoutSec 2
      if ($health.status -eq "ok") {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  return $false
}

if (-not $ApiUrl.Trim()) {
  $ApiUrl = Get-LanApiUrl
}
$ApiUrl = $ApiUrl.Trim().TrimEnd("/")
$env:EXPO_PUBLIC_API_URL = $ApiUrl

Write-Step "Start backend"
$composeArgs = @("compose", "-f", "Backend/services-up/docker-compose.yml", "up", "-d")
if (-not $NoDockerBuild) {
  $composeArgs += "--build"
}
& docker @composeArgs
if ($LASTEXITCODE -ne 0) {
  throw "docker compose failed with exit code $LASTEXITCODE"
}

Write-Step "Wait for backend $ApiUrl"
if (Wait-Backend $ApiUrl) {
  Write-Host "Backend ready: $ApiUrl" -ForegroundColor Green
} else {
  Write-Warning "Backend is not responding yet. Check Docker Desktop and logs: docker compose -f Backend/services-up/docker-compose.yml logs api"
}

Write-Step "Start Expo"
Write-Host "EXPO_PUBLIC_API_URL=$ApiUrl"
$expoArgs = @("expo", "start", "--lan")
if (-not $NoExpoClear) {
  $expoArgs += "-c"
}
& npx.cmd @expoArgs
