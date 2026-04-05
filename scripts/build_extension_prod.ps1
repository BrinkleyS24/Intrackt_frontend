param(
  [string]$BaseDir = (Join-Path $env:LOCALAPPDATA 'Applendium\\extension-dev'),
  [switch]$NoJunction
)

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'build_extension_dev.ps1'
$params = @{
  BaseDir = $BaseDir
  ManifestFile = 'manifest.prod.json'
}

if ($NoJunction) {
  $params.NoJunction = $true
}

& $scriptPath @params
