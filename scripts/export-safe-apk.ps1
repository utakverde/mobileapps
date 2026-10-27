param(
    [string]$OutputPath = "dist\SAMELCO-II-Mobile-1.0.7-sanitized.apk"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DatabasePath = Join-Path $ProjectRoot "assets\database\database.db"
$EnvironmentPath = Join-Path $ProjectRoot ".env"
$SchemaPath = Join-Path $ProjectRoot "assets\database\database.schema.sql"
$TemporaryRoot = Join-Path $env:TEMP ("mobileapp-safe-apk-" + [guid]::NewGuid().ToString("N"))
$DatabaseBackup = Join-Path $TemporaryRoot "database.original.db"
$EnvironmentBackup = Join-Path $TemporaryRoot ".env.original"
$SanitizedDatabase = Join-Path $TemporaryRoot "database.sanitized.db"
$ResolvedOutputPath = Join-Path $ProjectRoot $OutputPath
$HadEnvironment = Test-Path -LiteralPath $EnvironmentPath
$EnvironmentMoved = $false
$BuildSucceeded = $false

function Get-Sha256([string]$Path) {
    $Stream = [System.IO.File]::OpenRead($Path)
    try {
        $Hasher = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($Hasher.ComputeHash($Stream))).Replace("-", "")
        } finally {
            $Hasher.Dispose()
        }
    } finally {
        $Stream.Dispose()
    }
}

if (-not (Test-Path -LiteralPath $DatabasePath)) {
    throw "Required database asset not found: $DatabasePath"
}

New-Item -ItemType Directory -Path $TemporaryRoot | Out-Null
$OriginalDatabaseHash = Get-Sha256 $DatabasePath

try {
    Copy-Item -LiteralPath $DatabasePath -Destination $DatabaseBackup
    python (Join-Path $PSScriptRoot "create_sanitized_database.py") $SchemaPath $SanitizedDatabase
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create the sanitized database."
    }

    Copy-Item -LiteralPath $SanitizedDatabase -Destination $DatabasePath -Force
    if ($HadEnvironment) {
        Move-Item -LiteralPath $EnvironmentPath -Destination $EnvironmentBackup
        $EnvironmentMoved = $true
    }

    @(
        "EXPO_PUBLIC_ALLOW_CLEARTEXT",
        "EXPO_PUBLIC_API_KEY",
        "EXPO_PUBLIC_API_URL",
        "EXPO_PUBLIC_DEMO_PASSWORD",
        "EXPO_PUBLIC_DEMO_USERNAME",
        "EXPO_PUBLIC_INTERNAL_API_SECRET"
    ) | ForEach-Object {
        Remove-Item -LiteralPath ("Env:" + $_) -ErrorAction SilentlyContinue
    }

    $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.16+8"
    $env:ANDROID_HOME = "C:\Android\Sdk"
    $env:ANDROID_SDK_ROOT = "C:\Android\Sdk"
    $GradleTemporaryDirectory = Join-Path $ProjectRoot ".gradle-temp"
    if (-not (Test-Path -LiteralPath $GradleTemporaryDirectory)) {
        New-Item -ItemType Directory -Path $GradleTemporaryDirectory | Out-Null
    }
    $env:TEMP = $GradleTemporaryDirectory
    $env:TMP = $GradleTemporaryDirectory

    Push-Location (Join-Path $ProjectRoot "android")
    try {
        .\gradlew.bat :app:assembleRelease :app:lintRelease :app:testReleaseUnitTest --no-daemon --max-workers=1
        if ($LASTEXITCODE -ne 0) {
            throw "Gradle failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }

    $BuiltApk = Join-Path $ProjectRoot "android\app\build\outputs\apk\release\app-release.apk"
    if (-not (Test-Path -LiteralPath $BuiltApk)) {
        throw "Gradle completed but the APK was not found: $BuiltApk"
    }

    $OutputDirectory = Split-Path -Parent $ResolvedOutputPath
    if (-not (Test-Path -LiteralPath $OutputDirectory)) {
        New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
    }
    Copy-Item -LiteralPath $BuiltApk -Destination $ResolvedOutputPath -Force
    $BuildSucceeded = $true
} finally {
    Copy-Item -LiteralPath $DatabaseBackup -Destination $DatabasePath -Force
    if ($EnvironmentMoved) {
        Move-Item -LiteralPath $EnvironmentBackup -Destination $EnvironmentPath -Force
    }

    $RestoredDatabaseHash = Get-Sha256 $DatabasePath
    Write-Output "ORIGINAL_DB_SHA256=$OriginalDatabaseHash"
    Write-Output "RESTORED_DB_SHA256=$RestoredDatabaseHash"
    if ($RestoredDatabaseHash -ne $OriginalDatabaseHash) {
        throw "Original database restoration checksum mismatch. Recovery copy: $DatabaseBackup"
    }

    Remove-Item -LiteralPath $DatabaseBackup -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $SanitizedDatabase -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $EnvironmentBackup -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $TemporaryRoot -Force -ErrorAction SilentlyContinue
}

if ($BuildSucceeded) {
    $ArtifactHash = Get-Sha256 $ResolvedOutputPath
    $ArtifactSize = (Get-Item -LiteralPath $ResolvedOutputPath).Length
    Write-Output "APK_OUTPUT=$ResolvedOutputPath"
    Write-Output "APK_SIZE_BYTES=$ArtifactSize"
    Write-Output "APK_SHA256=$ArtifactHash"
}
