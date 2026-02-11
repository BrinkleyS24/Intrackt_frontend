param(
  # Where to put built extension outputs (outside OneDrive avoids EPERM rename issues).
  [string]$BaseDir = (Join-Path $env:LOCALAPPDATA 'ThreadHQ\\extension-dev'),
  # Which manifest to copy into the built folder (defaults to dev manifest).
  [ValidateSet('manifest.json', 'manifest.prod.json')]
  [string]$ManifestFile = 'manifest.json',
  # Skip creating/updating the "current" junction and just print the build folder.
  [switch]$NoJunction
)

$ErrorActionPreference = 'Stop'

function Write-Info([string]$msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Warn([string]$msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Err([string]$msg) { Write-Host $msg -ForegroundColor Red }

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$buildsDir = Join-Path $BaseDir 'builds'
$cacheDir = Join-Path $BaseDir 'parcel-cache'
$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$outDir = Join-Path $buildsDir ("v$timestamp")
$currentLink = Join-Path $BaseDir 'current'

New-Item -ItemType Directory -Force -Path $buildsDir | Out-Null
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

Write-Info "Building ThreadHQ extension..."
Write-Info "  Project:  $projectRoot"
Write-Info "  Output:   $outDir"
Write-Info "  Cache:    $cacheDir"
Write-Info "  Manifest: $ManifestFile"

$env:DIST_DIR = $outDir
$env:PARCEL_CACHE_DIR = $cacheDir
$env:MANIFEST_FILE = $ManifestFile

npm run build

if ($NoJunction) {
  Write-Info "Build complete."
  Write-Info "Load unpacked from:"
  Write-Host "  $outDir"
  exit 0
}

Write-Info "Updating dev 'current' junction..."
try {
  if (Test-Path $currentLink) {
    # Remove junction/directory link only (does not delete the target).
    cmd /c "rmdir /s /q `"$currentLink`"" | Out-Null
  }
} catch {
  Write-Warn "Could not remove existing junction at $currentLink."
  Write-Warn "If Chrome is using it, disable the extension, then rerun this script."
  throw
}

cmd /c "mklink /J `"$currentLink`" `"$outDir`"" | Out-Null

Write-Info "Build complete."
Write-Info "Load (or keep loaded) unpacked extension from:"
Write-Host "  $currentLink"
Write-Info "Then in chrome://extensions click the Reload icon after each build."

