# Deploys hunt-app to the dotcloud-docker host over WinRM — the only
# management path this host exposes (22/2376/5986 closed, 5985 open; see
# AUDIT-REPORT.md). Run from the hunt-app directory.
#
# Docker on this host runs under Docker Desktop in the DotCloud-Docker
# user's own interactive session, not as a system service — a plain
# New-PSSession as `administrator` cannot reach its named pipe (confirmed
# 2026-08-23; matches how AEOS's own deploy-v2.ps1 is written, which
# assumes local/interactive execution). The pattern that DOES work: call
# docker.exe by its full path under DotCloud-Docker's profile, via
# Invoke-Command -ComputerName ... -Authentication Negotiate (not a
# pre-opened session) as `administrator`. File copy still uses a plain
# New-PSSession, which works fine for that.
#
# Usage:
#   $cred = Get-Credential   # administrator@192.168.1.195
#   .\scripts\deploy.ps1 -Credential $cred
param(
    [string]$Server = "192.168.1.195",
    [Parameter(Mandatory = $true)][System.Management.Automation.PSCredential]$Credential,
    [string]$RemoteDir = "C:\opt\hunt-app",
    [string]$DockerPath = "C:\Users\DotCloud-Docker\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$contractOpsRoot = Split-Path -Parent $repoRoot

function Invoke-Remote([scriptblock]$ScriptBlock, [object[]]$ArgumentList = @()) {
    Invoke-Command -ComputerName $Server -Credential $Credential -Authentication Negotiate -ScriptBlock $ScriptBlock -ArgumentList $ArgumentList
}

Write-Host "Connecting to $Server over WinRM to copy files..." -ForegroundColor Cyan
$session = New-PSSession -ComputerName $Server -Credential $Credential

try {
    Write-Host "Ensuring $RemoteDir exists on the remote host..." -ForegroundColor Cyan
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        New-Item -ItemType Directory -Path (Split-Path -Parent $dir) -Force | Out-Null
    } -ArgumentList $RemoteDir

    # hunt-app AND docs-pack (sibling directory) both ship into the image —
    # the Dockerfile's `COPY docs-pack /docs-pack` needs docs-pack present
    # as a sibling of hunt-app in the build context on the remote host too
    # (the compose file's build context is `..` relative to hunt-app/).
    Write-Host "Copying hunt-app and docs-pack to the remote host (this can take a few minutes)..." -ForegroundColor Cyan
    Copy-Item -Path "$repoRoot\*" -Destination $RemoteDir -Recurse -Force -ToSession $session `
        -Exclude @("node_modules", "dist", ".env")
    Copy-Item -Path "$contractOpsRoot\docs-pack" -Destination (Split-Path -Parent $RemoteDir) -Recurse -Force -ToSession $session

    $hasEnv = Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        Test-Path (Join-Path $dir ".env")
    } -ArgumentList $RemoteDir
} finally {
    Remove-PSSession $session
}

if (-not $hasEnv) {
    Write-Host "No .env found remotely — generating one now via scripts/generate-secrets.ps1." -ForegroundColor Yellow
    Invoke-Remote -ScriptBlock {
        param($dir)
        Set-Location $dir
        # Process-scoped only -- does not change the host's persistent
        # execution policy. Needed because .ps1 FILES invoked with the
        # call operator are subject to the execution policy even under
        # -Authentication Negotiate.
        Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
        & .\scripts\generate-secrets.ps1
    } -ArgumentList $RemoteDir
    Write-Host "A fresh .env was generated on $Server at $RemoteDir\.env." -ForegroundColor Yellow
    Write-Host "FREELLMAPI_API_KEY (and AZURE_* once an Entra app exists) must be filled in by hand before AI-dependent features will work." -ForegroundColor Yellow
}

Write-Host "Building and starting containers..." -ForegroundColor Cyan
$gitSha = (git rev-parse HEAD 2>$null)
if (-not $gitSha) { $gitSha = "unknown" }
Invoke-Remote -ScriptBlock {
    param($dir, $sha, $dockerExe)
    Set-Location $dir
    $env:GIT_SHA = $sha
    & $dockerExe compose up -d --build
    if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }
} -ArgumentList $RemoteDir, $gitSha, $DockerPath

Write-Host "Running database migrations..." -ForegroundColor Cyan
Invoke-Remote -ScriptBlock {
    param($dir, $dockerExe)
    Set-Location $dir
    & $dockerExe compose exec -T hunt-app node dist/db/migrate.js
    if ($LASTEXITCODE -ne 0) { throw "migration failed" }
} -ArgumentList $RemoteDir, $DockerPath

Write-Host "Polling /health..." -ForegroundColor Cyan
$healthy = $false
for ($i = 0; $i -lt 12; $i++) {
    Start-Sleep -Seconds 5
    try {
        $result = Invoke-Remote -ScriptBlock {
            (Invoke-WebRequest -Uri "http://localhost:3020/health" -UseBasicParsing -TimeoutSec 5).StatusCode
        }
        if ($result -eq 200) { $healthy = $true; break }
    } catch {
        # keep polling
    }
}

if ($healthy) {
    Write-Host "Deployed successfully. http://${Server}:3020/health is responding." -ForegroundColor Green
} else {
    Write-Host "Containers are up but /health did not respond within 60s — check logs with:" -ForegroundColor Red
    Write-Host "  Invoke-Command -ComputerName $Server -Credential `$cred -Authentication Negotiate -ScriptBlock { & '$DockerPath' compose -f $RemoteDir\docker-compose.yml logs --tail 100 }"
    exit 1
}
