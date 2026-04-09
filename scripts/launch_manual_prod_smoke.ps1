param(
  [string]$ExtensionDir = (Join-Path $PSScriptRoot '..\popup\dist_prod'),
  [string]$ExtensionId = '',
  [string]$ChromePath = '',
  [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'

function Write-Info([string]$Message) {
  Write-Host $Message -ForegroundColor Cyan
}

function Resolve-ChromePath([string]$ExplicitPath) {
  if ($ExplicitPath -and (Test-Path $ExplicitPath)) {
    return (Resolve-Path $ExplicitPath).Path
  }

  $candidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw 'Google Chrome stable was not found on this machine.'
}

function Read-EnvValue([string]$FilePath, [string]$Key) {
  if (-not (Test-Path $FilePath)) {
    return ''
  }

  foreach ($line in Get-Content $FilePath) {
    if ($line -match "^\s*$Key=(.*)$") {
      return $matches[1].Trim().Trim('"').Trim("'")
    }
  }

  return ''
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not $NoBuild) {
  Write-Info 'Building production extension bundle...'
  npm run build:prod
  if ($LASTEXITCODE -ne 0) {
    throw "npm run build:prod failed with exit code $LASTEXITCODE."
  }
}

$resolvedExtensionDir = (Resolve-Path $ExtensionDir).Path
$manifestPath = Join-Path $resolvedExtensionDir 'manifest.json'
if (-not (Test-Path $manifestPath)) {
  throw "Built manifest is missing: $manifestPath"
}

$envFilePath = Join-Path $projectRoot '.env'
if (-not $ExtensionId) {
  $ExtensionId = Read-EnvValue -FilePath $envFilePath -Key 'EXTENSION_EXPECTED_ID_PROD'
}

if (-not $ExtensionId) {
  throw 'Extension ID is required. Set EXTENSION_EXPECTED_ID_PROD in frontend/job_sort/.env or pass -ExtensionId.'
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$popupPath = if ($manifest.action.default_popup) { $manifest.action.default_popup } else { 'popup/public/index.html' }
$popupUrl = "chrome-extension://$ExtensionId/$popupPath"
$startupUrl = 'chrome://extensions/'
$resolvedChromePath = Resolve-ChromePath -ExplicitPath $ChromePath
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$userDataDir = Join-Path $env:TEMP "applendium-manual-prod-smoke-$timestamp"

New-Item -ItemType Directory -Force -Path $userDataDir | Out-Null

$chromeArgs = @(
  "--user-data-dir=$userDataDir",
  '--no-first-run',
  '--disable-default-apps',
  '--new-window',
  $startupUrl
)

Write-Info 'Launching Google Chrome stable for manual production smoke...'
Write-Host "  Chrome:      $resolvedChromePath"
Write-Host "  Extension:   $resolvedExtensionDir"
Write-Host "  ExtensionId: $ExtensionId"
Write-Host "  Startup URL: $startupUrl"
Write-Host "  Popup URL:   $popupUrl"
Write-Host "  Profile:     $userDataDir"
Write-Host ''
Write-Host 'Manual smoke steps:' -ForegroundColor Yellow
Write-Host '  1. Chrome opens to chrome://extensions in a fresh profile.' -ForegroundColor Yellow
Write-Host "  2. Click 'Load unpacked' and select: $resolvedExtensionDir" -ForegroundColor Yellow
Write-Host '  3. Pin or open Applendium from the extension toolbar or puzzle menu.' -ForegroundColor Yellow
Write-Host '  4. Confirm the popup opens signed out.' -ForegroundColor Yellow
Write-Host '  5. Click Login with Google and complete Gmail readonly consent.' -ForegroundColor Yellow
Write-Host '  6. Confirm the popup reaches the signed-in state.' -ForegroundColor Yellow
Write-Host '  7. Click Refresh and verify no failure message appears.' -ForegroundColor Yellow
Write-Host '  8. Simulate offline/degraded network, click Refresh, and confirm a visible failure appears while cached emails remain visible.' -ForegroundColor Yellow
Write-Host '  9. Restore the network, confirm Refresh recovers, then sign out and reopen the popup from the toolbar.' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Note: Chrome stable no longer honors --load-extension, so Load unpacked is the supported smoke path here.' -ForegroundColor Yellow
Write-Host 'Note: the direct popup URL is printed above for debugging only. Do not use it as the startup page.' -ForegroundColor Yellow
Write-Host 'When you are done, close that Chrome window. The temp profile is kept for inspection.' -ForegroundColor Yellow

Start-Process -FilePath $resolvedChromePath -ArgumentList $chromeArgs | Out-Null
