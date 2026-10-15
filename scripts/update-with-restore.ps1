param(
  [ValidateSet('Backup', 'Restore')]
  [string]$Action = 'Backup',
  [string]$BackupPath = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $root 'update-backups'
$paths = @(
  'app',
  'database',
  'services',
  'src',
  'scripts',
  'app.json',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'metro.config.js',
  'babel.config.js'
)

function Get-LatestBackup {
  if (-not (Test-Path -LiteralPath $backupRoot)) { return $null }
  return Get-ChildItem -LiteralPath $backupRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
}

if ($Action -eq 'Backup') {
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  $destination = Join-Path $backupRoot (Get-Date -Format 'yyyyMMdd_HHmmss')
  New-Item -ItemType Directory -Path $destination -Force | Out-Null

  foreach ($relativePath in $paths) {
    $source = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $source)) { continue }
    $target = Join-Path $destination $relativePath
    $targetParent = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
  }

  Write-Output "Restore point created: $destination"
  exit 0
}

if ([string]::IsNullOrWhiteSpace($BackupPath)) {
  $latest = Get-LatestBackup
  if (-not $latest) { throw 'No code restore point was found.' }
  $BackupPath = $latest.FullName
}

if (-not (Test-Path -LiteralPath $BackupPath -PathType Container)) {
  throw "Backup path does not exist: $BackupPath"
}

foreach ($relativePath in $paths) {
  $source = Join-Path $BackupPath $relativePath
  if (-not (Test-Path -LiteralPath $source)) { continue }
  $target = Join-Path $root $relativePath
  Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
}

Write-Output "Code restored from: $BackupPath"
