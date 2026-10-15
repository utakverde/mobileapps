param(
    [string]$AvdName = "phone_m-dpi_5_4in_-_api_33_1",
    [switch]$ListAvds,
    [switch]$Kill,
    [switch]$NoWait,
    [switch]$NoStart,
    [switch]$InstallApk,
    [switch]$ColdBoot,
    [ValidateSet("Debug", "Release")]
    [string]$ApkType = "Debug"
)

$ProjectRoot = $PSScriptRoot
$AppName = "SAMELCO II Mobile"

function Write-Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Info($m) { Write-Host "  $m" -ForegroundColor Gray }
function Write-Success($m) { Write-Host "  $m" -ForegroundColor Green }
function Write-Warn($m) { Write-Host "  WARN: $m" -ForegroundColor Yellow }
function Write-Error($m) { Write-Host "  ERROR: $m" -ForegroundColor Red }

function Get-AndroidSdkPath {
    $paths = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        "$env:LOCALAPPDATA\Android\Sdk",
        "C:\Users\$env:UserName\AppData\Local\Android\Sdk",
        "C:\Android\Sdk"
    )
    $paths | Where-Object { $_ -and (Test-Path "$_\platform-tools\adb.exe") } | Select-Object -First 1
}

function Get-AdbPath {
    $sdk = Get-AndroidSdkPath
    if ($sdk) { return "$sdk\platform-tools\adb.exe" }
    return (Get-Command adb -ErrorAction SilentlyContinue).Source
}

function Get-EmulatorPath {
    $sdk = Get-AndroidSdkPath
    if ($sdk) { return "$sdk\emulator\emulator.exe" }
    return (Get-Command emulator -ErrorAction SilentlyContinue).Source
}

function Get-ConnectedDevices {
    $adb = Get-AdbPath
    if (-not $adb) { return @() }
    $output = & $adb devices 2>$null
    $devices = @()
    $inList = $false
    foreach ($line in $output) {
        if ($line -match "^List of devices attached") { $inList = $true; continue }
        if ($inList -and $line -match "^(\S+)\s+(\S+)$") { $devices += [PSCustomObject]@{ Id = $matches[1]; Status = $matches[2] } }
    }
    return $devices
}

function Wait-ForBoot {
    param([string]$DeviceId)
    $adb = Get-AdbPath
    Write-Info "Waiting for emulator to boot..."
    $maxWait = 180
    $elapsed = 0
    while ($elapsed -lt $maxWait) {
        Start-Sleep -Seconds 5
        $elapsed += 5
        $boot = & $adb -s $DeviceId shell getprop sys.boot_completed 2>$null
        $prop = & $adb -s $DeviceId shell getprop init.svc.bootanim 2>$null
        $boot = $boot.Trim()
        $prop = $prop.Trim()
        if ($boot -eq "1" -and $prop -ne "running") {
            Write-Success "Emulator booted in ${elapsed}s"
            return $true
        }
        Write-Info "  ...still booting (${elapsed}s)"
    }
    Write-Error "Emulator did not boot within ${maxWait}s"
    return $false
}

# === Main ===
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "   $AppName - Emulator Launcher" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$adbPath = Get-AdbPath
$emuPath = Get-EmulatorPath

if (-not $adbPath) { Write-Error "adb not found. Set ANDROID_HOME."; exit 1 }
if (-not $emuPath) { Write-Error "emulator not found."; exit 1 }

Write-Info "ADB: $adbPath"
Write-Info "Emulator: $emuPath"

# List AVDs
if ($ListAvds) {
    Write-Step "Available AVDs"
    $avds = & $emuPath -list-avds 2>&1
    foreach ($a in $avds) { Write-Info "  $a" }
    return
}

# Kill running emulators
if ($Kill) {
    Write-Step "Killing all emulators"
    & $adbPath emu kill 2>$null
    & $adbPath kill-server 2>$null
    Start-Sleep -Seconds 2
    Write-Success "Done"
    if ($NoStart) { return }
}

# Check existing devices
$devices = Get-ConnectedDevices
$emulatorDevice = $devices | Where-Object { $_.Id -match "^emulator-\d+" }

if (-not $emulatorDevice) {
    if ($NoStart) { Write-Info "No emulator running (--no-start set)"; return }

    Write-Step "Starting AVD: $AvdName"
    $avds = & $emuPath -list-avds 2>&1
    if ($avds -notcontains $AvdName) {
        Write-Error "AVD '$AvdName' not found. Use -ListAvds to see available."
        exit 1
    }

   $emuArgs = @("-avd", $AvdName, "-no-audio", "-no-snapshot-load", "-no-boot-anim", "-gpu", "angle_indirect", "-feature", "-Vulkan")
    if ($ColdBoot) { $emuArgs += "-no-snapshot" }

    Write-Info "Launching emulator..."
    $proc = Start-Process -FilePath $emuPath -ArgumentList $emuArgs -PassThru -NoNewWindow
    Write-Info "Emulator PID: $($proc.Id)"

    # Wait for device to appear in adb
    Write-Info "Waiting for emulator to appear in adb..."
    $found = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 2
        $devices = Get-ConnectedDevices
        $emuDevice = $devices | Where-Object { $_.Id -match "^emulator-\d+" -and $_.Status -eq "device" }
        if ($emuDevice) {
            $emulatorDevice = $emuDevice[0]
            $found = $true
            Write-Success "Emulator detected: $($emulatorDevice.Id)"
            break
        }
        $emuDeviceOffline = $devices | Where-Object { $_.Id -match "^emulator-\d+" -and $_.Status -eq "offline" }
        if ($emuDeviceOffline) {
            $emulatorDevice = $emuDeviceOffline[0]
            Write-Info "  Emulator appearing (offline)..." 
        }
    }

    if (-not $found) {
        Write-Error "Emulator did not appear in adb within 120s"
        exit 1
    }

    if (-not $NoWait) {
        $ok = Wait-ForBoot -DeviceId $emulatorDevice.Id
        if (-not $ok) { exit 1 }
    } else {
        Write-Info "Skipping boot wait (-NoWait)"
    }

    # Unlock screen
    & $adbPath -s $emulatorDevice.Id shell input keyevent 82 2>$null
} else {
    Write-Success "Emulator already running: $($emulatorDevice[0].Id) [$($emulatorDevice[0].Status)]"
    $emulatorDevice = $emulatorDevice[0]
    if ($emulatorDevice.Status -ne "device") {
        Write-Warn "Device status: $($emulatorDevice.Status)"
        if (-not $NoWait) { Wait-ForBoot -DeviceId $emulatorDevice.Id }
    }
}

$deviceId = $emulatorDevice.Id

# Install debug APK if requested
if ($InstallApk) {
    Write-Step "Installing APK"
    $apkFile = "$ProjectRoot\android\app\build\outputs\apk\$($ApkType.ToLower())\app-$($ApkType.ToLower()).apk"
    if (-not (Test-Path $apkFile)) {
        Write-Error "APK not found at $apkFile. Run build-apk.ps1 first."
        exit 1
    }
    $size = (Get-Item $apkFile).Length / 1MB
    Write-Info ("APK: $apkFile ({0:N1} MB)" -f $size)
    $result = & $adbPath -s $deviceId install -r $apkFile 2>&1
    if ($result -match "Success") {
        Write-Success "APK installed on $deviceId"
    } else {
        Write-Error "Install failed: $result"
        exit 1
    }
}

Write-Step "Ready for debugging"
Write-Info "Emulator : $deviceId"
Write-Info "Project  : $ProjectRoot"
Write-Info ""
Write-Info "Next steps:"
Write-Info "  Start Expo dev server:    npm start"
Write-Info "  Open on emulator:         Press 'a' in Expo CLI (or --android flag)"
Write-Info "  Reload app:               Press 'r' in Expo CLI"
Write-Info "  Dev menu (emulator):      Ctrl+M"
Write-Info ""
Write-Info "Quick commands:"
Write-Info "  npm start -- --android      Start + open on emulator"
Write-Info "  npx expo run:android        Build & install native debug build"

Write-Host "`nDone." -ForegroundColor Green
