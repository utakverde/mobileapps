param(
    [ValidateSet("Debug", "Release")]
    [string]$BuildType = "Debug",
    [switch]$Clean,
    [switch]$Install,
    [switch]$Launch,
    [switch]$ListDevices,
    [switch]$SkipBuild,
    [switch]$SkipChecks,
    [switch]$FixLint,
    [string[]]$Devices = @()
)

$AppName = "SAMELCO II Mobile"
$PackageName = "com.powerread.mobile"
$MainActivity = "com.powerread.mobile.MainActivity"
$ProjectRoot = $PSScriptRoot
$ApkDir = "$ProjectRoot\android\app\build\outputs\apk\$($BuildType.ToLower())"
$ApkFile = "$ApkDir\app-$($BuildType.ToLower()).apk"

function Write-Step($Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Info($Message) {
    Write-Host "  $Message" -ForegroundColor Gray
}

function Write-Success($Message) {
    Write-Host "  $Message" -ForegroundColor Green
}

function Write-Error($Message) {
    Write-Host "  ERROR: $Message" -ForegroundColor Red
}

function Get-AndroidSdkPath {
    $localAppData = "$env:LOCALAPPDATA\Android\Sdk"
    $paths = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        $localAppData,
        "C:\Users\$env:UserName\AppData\Local\Android\Sdk",
        "C:\Android\Sdk"
    )
    $paths | Where-Object { $_ -and (Test-Path "$_\platform-tools\adb.exe") } | Select-Object -First 1
}

function Get-JavaPath {
    foreach ($base in @($env:JAVA_HOME, "C:\Program Files\Java", "C:\Program Files (x86)\Java", "C:\Program Files\Eclipse Adoptium", "C:\Program Files\Microsoft")) {
        if (-not $base) { continue }
        $exe = "$base\bin\java.exe"
        if (Test-Path $exe) { return $exe }
        $jdkDirs = Get-ChildItem "$base\jdk-*" -Directory -ErrorAction SilentlyContinue
        foreach ($d in $jdkDirs) {
            $exe = "$d\bin\java.exe"
            if (Test-Path $exe) { return $exe }
        }
        $jdkDirs = Get-ChildItem "$base\*" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'jdk' -or $_.Name -match 'temurin' -or $_.Name -match 'hotspot' }
        foreach ($d in $jdkDirs) {
            $exe = "$d\bin\java.exe"
            if (Test-Path $exe) { return $exe }
        }
    }
    return (Get-Command java -ErrorAction SilentlyContinue).Source
}

function Get-AdbPath {
    $sdk = Get-AndroidSdkPath
    if ($sdk) { return "$sdk\platform-tools\adb.exe" }
    return (Get-Command adb -ErrorAction SilentlyContinue).Source
}

function Invoke-Gradle {
    param([string]$Task, [switch]$Clean)
    Push-Location "$ProjectRoot\android"
    try {
        $gradle = if (Test-Path ".\gradlew.bat") { ".\gradlew.bat" } else { "gradlew" }
        $javaPath = Get-JavaPath
        if ($javaPath) { $env:JAVA_HOME = (Get-Item $javaPath).Directory.Parent.FullName }
        
        if ($Clean) {
            Write-Info "Cleaning..."
            & $gradle clean 2>&1
        }
        
        Write-Info "Running $Task..."
        $output = & $gradle $Task --no-daemon --max-workers=1 2>&1
        $exitCode = $LASTEXITCODE
        $output | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        return $exitCode -eq 0
    } finally {
        Pop-Location
    }
}

function Get-ConnectedDevices {
    $adb = Get-AdbPath
    if (-not $adb) { return @() }
    $output = & $adb devices 2>$null
    $devices = @()
    $inDeviceList = $false
    foreach ($line in $output) {
        if ($line -match "^List of devices attached") { $inDeviceList = $true; continue }
        if ($inDeviceList -and $line -match "^(\S+)\s+device$") {
            $devices += $matches[1]
        }
    }
    return $devices
}

function Install-ApkOnDevice($DeviceId, $ApkPath) {
    $adb = Get-AdbPath
    if (-not $adb) { return $false }
    Write-Info "Installing on $DeviceId..."
    $result = & $adb -s $DeviceId install -r $ApkPath 2>&1
    if ($result -match "Success") {
        Write-Success "Installed successfully on $DeviceId"
        return $true
    } else {
        Write-Error "Install failed on $DeviceId`: $result"
        return $false
    }
}

function Launch-AppOnDevice($DeviceId) {
    $adb = Get-AdbPath
    if (-not $adb) { return }
    Write-Info "Launching $AppName on $DeviceId..."
    & $adb -s $DeviceId shell am start -n "$PackageName/$MainActivity" 2>$null
    Write-Success "Launched on $DeviceId"
}

function Invoke-NpmScript {
    param([string]$ScriptName, [string]$Label)
    Write-Info "$Label..."
    Push-Location "$ProjectRoot"
    try {
        $output = & "npm" run $ScriptName 2>&1
        $exitCode = $LASTEXITCODE
        $output | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        if ($exitCode -ne 0) {
            Write-Error "$Label failed"
            return $false
        }
        Write-Success "$Label passed"
        return $true
    } finally {
        Pop-Location
    }
}

function Test-HasDotEnv {
    return (Test-Path "$ProjectRoot\.env")
}

function Test-HasNodeModules {
    return (Test-Path "$ProjectRoot\node_modules")
}

function Test-PackageIntegrity {
    Push-Location "$ProjectRoot"
    try {
        $output = & "npm" audit --production 2>&1
        return $true
    } catch {
        return $true  # audit failure is non-fatal
    } finally {
        Pop-Location
    }
}

function Invoke-PreBuildChecks {
    param([switch]$Fix)
    Write-Step "Pre-build Checks"
    $allOk = $true

    # Node modules
    if (-not (Test-HasNodeModules)) {
        Write-Error "node_modules not found. Run npm install first."
        return $false
    }
    Write-Success "node_modules: found"

    # .env file
    if (-not (Test-HasDotEnv)) {
        Write-Error ".env file not found at $ProjectRoot\.env"
        Write-Info  "Copy .env.example to .env and configure your API URL."
        $allOk = $false
    } else {
        Write-Success ".env: found"
        $envContent = Get-Content "$ProjectRoot\.env" -Raw
        if ($envContent -match 'EXPO_PUBLIC_API_URL=https?://') {
            Write-Info  "  EXPO_PUBLIC_API_URL is set"
        } else {
            Write-Warning "  EXPO_PUBLIC_API_URL may not be configured"
        }
    }

    # TypeScript
    if (-not (Invoke-NpmScript "typecheck" "TypeScript check")) { $allOk = $false }

    # Lint
    if ($Fix) { & "npm" run lint -- --fix 2>&1 | Out-Null }
    if (-not (Invoke-NpmScript "lint" "ESLint check")) { $allOk = $false }

    # Expo doctor
    if (-not (Invoke-NpmScript "doctor" "Expo doctor")) { $allOk = $false }

    if ($allOk) {
        Write-Success "All pre-build checks passed"
    } else {
        Write-Error "Some checks failed. Use -SkipChecks to bypass or review issues above."
    }
    return $allOk
}

function Build-Apk {
    param([string]$Type)
    Write-Step "Building $Type APK..."
    
    $task = if ($Type -eq "Debug") { "assembleDebug" } else { "assembleRelease" }
    $ok = Invoke-Gradle $task -Clean:$Clean
    
    if ($ok -and (Test-Path $ApkFile)) {
        $size = (Get-Item $ApkFile).Length / 1MB
        Write-Success ("APK built: $ApkFile ({0:N1} MB)" -f $size)
        return $true
    } else {
        if (-not $ok) { Write-Error "Build failed" }
        else { Write-Error "APK not found at $ApkFile" }
        return $false
    }
}

# === Main ===
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "   $AppName - APK Builder" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# Check requirements
$adbPath = Get-AdbPath
if (-not $adbPath) {
    Write-Error "adb not found. Set ANDROID_HOME or install platform-tools."
} else {
    Write-Info "adb: $adbPath"
}

$javaPath = Get-JavaPath
if ($javaPath) {
    $jv = & $javaPath -version 2>&1
    Write-Info "Java: $($jv -join ' ')"
} else {
    Write-Error "Java not found. Install JDK 17+."
}

$sdkPath = Get-AndroidSdkPath
if ($sdkPath) {
    Write-Info "Android SDK: $sdkPath"
} else {
    Write-Error "Android SDK not found."
}

# List devices mode
if ($ListDevices) {
    Write-Step "Connected Devices"
    $connected = Get-ConnectedDevices
    if ($connected.Count -eq 0) {
        Write-Info "No devices/emulators connected."
    } else {
        foreach ($d in $connected) {
            $model = & $adbPath -s $d shell getprop ro.product.model 2>$null
            $model = $model.Trim()
            Write-Info "$d  [$model]"
        }
    }
    return
}

# Pre-build checks
$checksOk = $true
if (-not $SkipChecks) {
    $checksOk = Invoke-PreBuildChecks -Fix:$FixLint
}

# Build
$buildOk = $true
if ($checksOk -and -not $SkipBuild) {
    $buildOk = Build-Apk $BuildType
} elseif (-not $checksOk -and -not $SkipBuild) {
    Write-Error "Build aborted due to check failures. Use -SkipChecks to bypass."
    $buildOk = $false
}

# Install & Launch
if ($buildOk -and $Install -and (Test-Path $ApkFile)) {
    $connected = Get-ConnectedDevices
    if ($Devices.Count -gt 0) {
        $targets = $Devices | Where-Object { $connected -contains $_ }
        if ($targets.Count -eq 0) {
            Write-Error "Specified devices not found: $($Devices -join ', ')"
        }
    } else {
        $targets = $connected
    }
    
    if ($targets.Count -eq 0) {
        Write-Error "No connected devices/emulators found."
    } else {
        Write-Step "Installing on $($targets.Count) device(s)..."
        foreach ($d in $targets) {
            Install-ApkOnDevice $d $ApkFile
        }
        
        if ($Launch) {
            Write-Step "Launching on all devices..."
            foreach ($d in $targets) {
                Launch-AppOnDevice $d
            }
        }
    }
}

Write-Host "`nDone." -ForegroundColor Green

if (-not $checksOk -or -not $buildOk) {
    exit 1
}

exit 0
