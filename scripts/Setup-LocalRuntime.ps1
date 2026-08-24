[CmdletBinding()]
param(
    [string]$DistroName = "Ubuntu-24.04",
    [string]$EvidencePath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($ArgumentList -join ' ')"
    }
}

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated PowerShell session."
}

$feature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux
if ($feature.State -ne "Enabled") {
    throw "The Windows Subsystem for Linux feature is not enabled."
}

& wsl.exe --status *> $null
if ($LASTEXITCODE -ne 0) {
    throw "WSL is not active yet. Restart Windows, then run this script again."
}

Invoke-CheckedCommand -FilePath "wsl.exe" -ArgumentList @("--set-default-version", "1")

& winget.exe list --id Canonical.Ubuntu.2404 --exact --accept-source-agreements *> $null
if ($LASTEXITCODE -ne 0) {
    Invoke-CheckedCommand -FilePath "winget.exe" -ArgumentList @(
        "install",
        "--id", "Canonical.Ubuntu.2404",
        "--exact",
        "--accept-source-agreements",
        "--accept-package-agreements",
        "--silent"
    )
}

$registered = @(
    Get-ChildItem -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss" -ErrorAction SilentlyContinue |
        ForEach-Object { (Get-ItemProperty -LiteralPath $_.PSPath).DistributionName }
)
if ($registered -notcontains $DistroName) {
    $launcher = Get-Command "ubuntu2404.exe" -ErrorAction SilentlyContinue
    if (-not $launcher) {
        throw "Ubuntu 24.04 launcher is installed but unavailable in PATH. Start a new elevated PowerShell session and retry."
    }
    Invoke-CheckedCommand -FilePath $launcher.Source -ArgumentList @("install", "--root")
}

Invoke-CheckedCommand -FilePath "wsl.exe" -ArgumentList @("--set-version", $DistroName, "1")
Invoke-CheckedCommand -FilePath "wsl.exe" -ArgumentList @("-d", $DistroName, "-u", "root", "--", "apt-get", "update")
Invoke-CheckedCommand -FilePath "wsl.exe" -ArgumentList @(
    "-d", $DistroName, "-u", "root", "--",
    "env", "DEBIAN_FRONTEND=noninteractive",
    "apt-get", "install", "-y", "postgresql", "redis-server", "ca-certificates", "curl"
)
Invoke-CheckedCommand -FilePath "wsl.exe" -ArgumentList @("-d", $DistroName, "-u", "root", "--", "service", "postgresql", "start")
Invoke-CheckedCommand -FilePath "wsl.exe" -ArgumentList @("-d", $DistroName, "-u", "root", "--", "service", "redis-server", "start")

$postgresOutput = & wsl.exe -d $DistroName -u root -- pg_isready
$postgresExitCode = $LASTEXITCODE
$redisOutput = & wsl.exe -d $DistroName -u root -- redis-cli ping
$redisExitCode = $LASTEXITCODE
if ($postgresExitCode -ne 0 -or $redisExitCode -ne 0 -or $redisOutput.Trim() -ne "PONG") {
    throw "Local data service verification failed."
}

if (-not $EvidencePath) {
    $repositoryRoot = Split-Path -Parent $PSScriptRoot
    $workspaceRoot = Split-Path -Parent $repositoryRoot
    $EvidencePath = Join-Path $workspaceRoot "deliveries\yixing-logistics-workbench-2026-08-24\evidence\local-runtime-setup.json"
}

$evidence = [ordered]@{
    observedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    hostOperatingSystem = "Windows Server 2025 Datacenter"
    distro = $DistroName
    wslVersion = 1
    packages = @("postgresql", "redis-server", "ca-certificates", "curl")
    postgresCheck = ($postgresOutput -join "`n").Trim()
    redisCheck = ($redisOutput -join "`n").Trim()
    secretsCreated = $false
    databaseOrApplicationSchemaCreated = $false
    publicFirewallRuleCreated = $false
    deploymentAttempted = $false
}

$evidence | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $EvidencePath -Encoding utf8
$evidence | ConvertTo-Json -Depth 4
