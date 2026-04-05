param(
  # Where to put built extension outputs (outside OneDrive avoids EPERM rename issues).
  [string]$BaseDir = (Join-Path $env:LOCALAPPDATA 'Applendium\\extension-dev'),
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

function Set-ProcessEnvVar([string]$Name, [string]$Value) {
  if ($null -eq $Value) {
    Remove-Item -Path ("Env:{0}" -f $Name) -ErrorAction SilentlyContinue
    return
  }

  Set-Item -Path ("Env:{0}" -f $Name) -Value $Value
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$buildsDir = Join-Path $BaseDir 'builds'
$cacheDir = Join-Path $BaseDir 'parcel-cache'
$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$outDir = Join-Path $buildsDir ("v$timestamp")
$currentLink = Join-Path $BaseDir 'current'
$isProductionBuild = $ManifestFile -eq 'manifest.prod.json'
$productionBackendUrl = 'https://gmail-tracker-backend-674309673051.us-central1.run.app'
$productionDashboardUrl = 'https://applendium.com'
$managedEnvVars = @(
  'DIST_DIR',
  'PARCEL_CACHE_DIR',
  'MANIFEST_FILE',
  'EXTENSION_BUILD_TARGET',
  'EXTENSION_FORCE_BACKEND_TARGET',
  'BACKEND_BASE_URL',
  'BACKEND_BASE_URL_PROD',
  'PREMIUM_DASHBOARD_URL',
  'PREMIUM_DASHBOARD_URL_PROD'
)
$previousEnvVars = @{}

foreach ($name in $managedEnvVars) {
  $previousEnvVars[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

New-Item -ItemType Directory -Force -Path $buildsDir | Out-Null
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

Write-Info "Building Applendium extension..."
Write-Info "  Project:  $projectRoot"
Write-Info "  Output:   $outDir"
Write-Info "  Cache:    $cacheDir"
Write-Info "  Manifest: $ManifestFile"
Write-Info "  Target:   $(if ($isProductionBuild) { 'production' } else { 'development' })"

try {
  Set-ProcessEnvVar -Name 'DIST_DIR' -Value $outDir
  Set-ProcessEnvVar -Name 'PARCEL_CACHE_DIR' -Value $cacheDir
  Set-ProcessEnvVar -Name 'MANIFEST_FILE' -Value $ManifestFile

  if ($isProductionBuild) {
    Set-ProcessEnvVar -Name 'EXTENSION_BUILD_TARGET' -Value 'production'
    Set-ProcessEnvVar -Name 'EXTENSION_FORCE_BACKEND_TARGET' -Value 'production'
    Set-ProcessEnvVar -Name 'BACKEND_BASE_URL_PROD' -Value $productionBackendUrl
    Set-ProcessEnvVar -Name 'BACKEND_BASE_URL' -Value $productionBackendUrl
    Set-ProcessEnvVar -Name 'PREMIUM_DASHBOARD_URL_PROD' -Value $productionDashboardUrl
    Set-ProcessEnvVar -Name 'PREMIUM_DASHBOARD_URL' -Value $productionDashboardUrl
  } else {
    Set-ProcessEnvVar -Name 'EXTENSION_BUILD_TARGET' -Value $null
    Set-ProcessEnvVar -Name 'EXTENSION_FORCE_BACKEND_TARGET' -Value 'local'
    Set-ProcessEnvVar -Name 'BACKEND_BASE_URL_PROD' -Value $null
    Set-ProcessEnvVar -Name 'PREMIUM_DASHBOARD_URL_PROD' -Value $null
  }

  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed with exit code $LASTEXITCODE."
  }

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
} finally {
  foreach ($name in $managedEnvVars) {
    Set-ProcessEnvVar -Name $name -Value $previousEnvVars[$name]
  }
}


