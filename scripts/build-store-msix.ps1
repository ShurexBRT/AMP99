param(
    [Parameter(Mandatory = $true)]
    [string]$IdentityName,

    [Parameter(Mandatory = $true)]
    [string]$Publisher,

    [Parameter(Mandatory = $true)]
    [string]$PublisherDisplayName,

    [string]$Version = "0.2.0.15",

    [ValidateSet("x64")]
    [string]$Architecture = "x64",

    [string]$ExecutablePath = "src-tauri/target/release/amp99.exe",

    [string]$TemplatePath = "store/AppxManifest.template.xml",

    [string]$IconDir = "src-tauri/icons",

    [string]$OutputPath = "src-tauri/target/release/bundle/msix/AMP99_0.2.0-alpha.15_x64.msix"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Resolve-RequiredPath([string]$Path, [string]$Description) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Description was not found: $Path"
    }

    return (Resolve-Path -LiteralPath $Path).Path
}

function Find-MakeAppx {
    $command = Get-Command MakeAppx.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $kitsRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
    if (-not (Test-Path -LiteralPath $kitsRoot)) {
        throw "Windows SDK bin directory was not found: $kitsRoot"
    }

    $candidate = Get-ChildItem -LiteralPath $kitsRoot -Recurse -Filter MakeAppx.exe -File |
        Where-Object { $_.FullName -match '[\\/]x64[\\/]MakeAppx\.exe$' } |
        Sort-Object FullName -Descending |
        Select-Object -First 1

    if (-not $candidate) {
        throw "MakeAppx.exe was not found. Install the Windows SDK before building the Store package."
    }

    return $candidate.FullName
}

function Xml-Escape([string]$Value) {
    return [System.Security.SecurityElement]::Escape($Value)
}

if ($Version -notmatch '^\d+\.\d+\.\d+\.\d+$') {
    throw "MSIX version must contain exactly four numeric components, for example 0.2.0.1. Received: $Version"
}

$identityPattern = '^[A-Za-z0-9][A-Za-z0-9.-]{2,49}$'
if ($IdentityName -notmatch $identityPattern) {
    throw "IdentityName must be 3-50 characters using letters, numbers, periods or hyphens. Received: $IdentityName"
}

$resolvedExe = Resolve-RequiredPath $ExecutablePath "AMP99 release executable"
$resolvedTemplate = Resolve-RequiredPath $TemplatePath "MSIX manifest template"
$resolvedIconDir = Resolve-RequiredPath $IconDir "Generated Tauri icon directory"
$makeAppx = Find-MakeAppx

$requiredAssets = @(
    "StoreLogo.png",
    "Square150x150Logo.png",
    "Square44x44Logo.png"
)

foreach ($asset in $requiredAssets) {
    Resolve-RequiredPath (Join-Path $resolvedIconDir $asset) "Store visual asset '$asset'" | Out-Null
}

$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path $PWD $OutputPath))
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$stage = Join-Path $env:TEMP ("AMP99-MSIX-" + [Guid]::NewGuid().ToString("N"))
$verify = Join-Path $env:TEMP ("AMP99-MSIX-VERIFY-" + [Guid]::NewGuid().ToString("N"))

try {
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    $assetsDir = Join-Path $stage "Assets"
    New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

    Copy-Item -LiteralPath $resolvedExe -Destination (Join-Path $stage "amp99.exe")
    foreach ($asset in $requiredAssets) {
        Copy-Item -LiteralPath (Join-Path $resolvedIconDir $asset) -Destination (Join-Path $assetsDir $asset)
    }

    $manifest = Get-Content -LiteralPath $resolvedTemplate -Raw
    $manifest = $manifest.Replace("__IDENTITY_NAME__", (Xml-Escape $IdentityName))
    $manifest = $manifest.Replace("__PUBLISHER__", (Xml-Escape $Publisher))
    $manifest = $manifest.Replace("__PUBLISHER_DISPLAY_NAME__", (Xml-Escape $PublisherDisplayName))
    $manifest = $manifest.Replace("__VERSION__", $Version)
    $manifest = $manifest.Replace("__ARCHITECTURE__", $Architecture)

    $manifestPath = Join-Path $stage "AppxManifest.xml"
    [System.IO.File]::WriteAllText(
        $manifestPath,
        $manifest,
        [System.Text.UTF8Encoding]::new($false)
    )

    if (Test-Path -LiteralPath $resolvedOutput) {
        Remove-Item -LiteralPath $resolvedOutput -Force
    }

    Write-Host "Packing AMP99 MSIX with: $makeAppx"
    & $makeAppx pack /d $stage /p $resolvedOutput /o
    if ($LASTEXITCODE -ne 0) {
        throw "MakeAppx pack failed with exit code $LASTEXITCODE."
    }

    if (-not (Test-Path -LiteralPath $resolvedOutput)) {
        throw "MakeAppx reported success but did not create: $resolvedOutput"
    }

    New-Item -ItemType Directory -Force -Path $verify | Out-Null
    & $makeAppx unpack /p $resolvedOutput /d $verify /o
    if ($LASTEXITCODE -ne 0) {
        throw "MakeAppx unpack verification failed with exit code $LASTEXITCODE."
    }

    foreach ($requiredFile in @("AppxManifest.xml", "amp99.exe")) {
        if (-not (Test-Path -LiteralPath (Join-Path $verify $requiredFile))) {
            throw "MSIX verification failed: package is missing $requiredFile."
        }
    }

    [xml]$verifiedManifest = Get-Content -LiteralPath (Join-Path $verify "AppxManifest.xml") -Raw
    $namespace = New-Object System.Xml.XmlNamespaceManager($verifiedManifest.NameTable)
    $namespace.AddNamespace("f", "http://schemas.microsoft.com/appx/manifest/foundation/windows10")
    $namespace.AddNamespace("uap", "http://schemas.microsoft.com/appx/manifest/uap/windows10")

    $identity = $verifiedManifest.SelectSingleNode("/f:Package/f:Identity", $namespace)
    if (-not $identity -or $identity.Name -ne $IdentityName -or $identity.Publisher -ne $Publisher) {
        throw "MSIX verification failed: packaged identity does not match requested Store identity."
    }

    $fileType = $verifiedManifest.SelectSingleNode("//uap:FileType[text()='.wsz']", $namespace)
    if (-not $fileType) {
        throw "MSIX verification failed: .wsz file association is missing from the packaged manifest."
    }

    $size = (Get-Item -LiteralPath $resolvedOutput).Length
    Write-Host "PASS: AMP99 unsigned Store MSIX preflight created and unpack-verified."
    Write-Host "Package: $resolvedOutput"
    Write-Host "Bytes: $size"
    Write-Host "Identity: $IdentityName"
    Write-Host "Publisher: $Publisher"
    Write-Host "NOTE: This structural package is unsigned. Microsoft Store certification re-signing/final identity happens after Partner Center submission."
}
finally {
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $verify -Recurse -Force -ErrorAction SilentlyContinue
}
