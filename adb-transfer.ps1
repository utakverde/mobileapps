param(
  [ValidateSet('Doctor', 'Upload', 'Download', 'DownloadImages')]
  [string]$Action = 'Doctor',
  [string]$PackageName = 'com.powerread.mobile',
  [string]$PcUploadPath = 'C:\FubcsAndroid\Export\database.db',
  [string]$PcDownloadPath = 'C:\FubcsAndroid\Import\database.db',
  [string]$PcImagesPath = '\\192.168.1.91\MeterPics\MAIN OFFICE',
  [string]$ReaderName = '',
  [string]$DatabaseName = '',
  [string]$BillMonth = '',
  [switch]$FlatImagesPath,
  [string]$Device = ''
)

$ErrorActionPreference = 'Stop'

function Find-Adb {
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(@(
      "$env:ANDROID_HOME\platform-tools\adb.exe",
      "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe",
      "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
      'C:\adb\adb.exe'
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) })

  if ($candidates.Count -gt 0) { return $candidates[0] }
  throw 'adb.exe was not found. Install Android platform-tools or add adb to PATH.'
}

function Invoke-AdbText {
  param([string[]]$ArgsList)
  $allArgs = @()
  if ($Device) { $allArgs += @('-s', $Device) }
  $allArgs += $ArgsList
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $script:Adb @allArgs 2>&1 | ForEach-Object { $_.ToString() }
  } finally {
    $ErrorActionPreference = $oldPreference
  }
}

function Get-SafePathPart {
  param(
    [string]$Value,
    [string]$Fallback
  )
  $clean = ($Value -replace '[<>:"/\\|?*\x00-\x1F]', '-').Trim()
  $clean = ($clean -replace '\s+', ' ')
  $clean = ($clean -replace '-+', '-').Trim('.', ' ')
  if ([string]::IsNullOrWhiteSpace($clean)) { return $Fallback }
  return $clean
}

function Get-ActiveDeviceName {
  if ($Device) { return $Device }
  $devices = @(Invoke-AdbText @('devices') | Where-Object { $_ -match "`tdevice$" })
  if ($devices.Count -eq 1) {
    return ($devices[0] -split "`t")[0]
  }
  return 'device'
}

function Get-ImageDownloadTarget {
  if ($FlatImagesPath) { return $PcImagesPath }

  $dbPart = Get-SafePathPart -Value $DatabaseName -Fallback 'Database'
  $readerPart = Get-SafePathPart -Value $(if ($ReaderName) { $ReaderName } else { Get-ActiveDeviceName }) -Fallback 'Reader'
  $billMonthPart = Get-SafePathPart -Value $BillMonth -Fallback 'BillMonth'
  $datePart = Get-Date -Format 'yyyyMMdd'

  return Join-Path -Path $PcImagesPath -ChildPath (Join-Path -Path $dbPart -ChildPath (Join-Path -Path $readerPart -ChildPath (Join-Path -Path $billMonthPart -ChildPath $datePart)))
}

function Show-Doctor {
  Write-Host "ADB: $script:Adb"
  Write-Host ''
  Write-Host 'Connected devices:'
  $devices = @(Invoke-AdbText @('devices'))
  $devices
  $readyDevices = @($devices | Where-Object { $_ -match "`tdevice$" })
  if ($readyDevices.Count -eq 0) {
    Write-Host ''
    Write-Host 'No ready Android device was found. Connect the phone, enable USB debugging, accept the RSA prompt, then run Doctor again.' -ForegroundColor Yellow
    return
  }
  Write-Host ''
  Write-Host "Checking package: $PackageName"
  Invoke-AdbText @('shell', 'pm', 'path', $PackageName)
  Write-Host ''
  Write-Host 'Release-friendly app files folder:'
  $base = "/sdcard/Android/data/$PackageName/files"
  Invoke-AdbText @(
    'shell', 'mkdir', '-p',
    "$base/Import",
    "$base/Export",
    "$base/Images/meter",
    "$base/Images/house",
    "$base/Images/complaint",
    "$base/Images/disconnection",
    "$base/Images/payment",
    "$base/Images/profile",
    "$base/Images/reading"
  )
  Invoke-AdbText @('shell', 'ls', '-ld', $base, "$base/Import", "$base/Export", "$base/Images")
  Write-Host ''
  Write-Host 'Export file on phone:'
  Invoke-AdbText @('shell', 'ls', '-l', "$base/Export/database.db")
}

$script:Adb = Find-Adb

if ($Action -eq 'Doctor') {
  Show-Doctor
  exit
}

if ($Action -eq 'Download') {
  $downloadDir = Split-Path -Parent $PcDownloadPath
  if (-not (Test-Path -LiteralPath $downloadDir)) {
    New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
  }

  Write-Host "Downloading phone database to $PcDownloadPath"
  $base = "/sdcard/Android/data/$PackageName/files"
  $args = @()
  if ($Device) { $args += @('-s', $Device) }
  $args += @('pull', "$base/Export/database.db", $PcDownloadPath)
  & $script:Adb @args
  if ($LASTEXITCODE -ne 0) { throw 'ADB download failed. Tap Download DB in the app first.' }

  $file = Get-Item -LiteralPath $PcDownloadPath
  Write-Host "Download complete: $($file.FullName) ($($file.Length) bytes)" -ForegroundColor Green
  exit
}

if ($Action -eq 'DownloadImages') {
  $imageTarget = Get-ImageDownloadTarget
  if (-not (Test-Path -LiteralPath $imageTarget)) {
    New-Item -ItemType Directory -Path $imageTarget -Force | Out-Null
  }

  Write-Host "Downloading phone images to $imageTarget"
  $base = "/sdcard/Android/data/$PackageName/files"
  $args = @()
  if ($Device) { $args += @('-s', $Device) }
  $args += @('pull', "$base/Images/.", $imageTarget)
  & $script:Adb @args
  if ($LASTEXITCODE -ne 0) { throw 'ADB image download failed. Open the app once and capture/sync images first.' }

  Write-Host "Image download complete: $imageTarget" -ForegroundColor Green
  exit
}

if ($Action -eq 'Upload') {
  if (-not (Test-Path -LiteralPath $PcUploadPath)) {
    throw "Upload source not found: $PcUploadPath"
  }

  Write-Host "Uploading $PcUploadPath to phone Import/database.db"
  $base = "/sdcard/Android/data/$PackageName/files"
  Invoke-AdbText @('shell', 'mkdir', '-p', "$base/Import")
  $args = @()
  if ($Device) { $args += @('-s', $Device) }
  $args += @('push', $PcUploadPath, "$base/Import/database.db")
  & $script:Adb @args
  if ($LASTEXITCODE -ne 0) { throw 'ADB upload failed.' }

  Write-Host 'Upload complete. Open the app to import the staged database.' -ForegroundColor Green
}
