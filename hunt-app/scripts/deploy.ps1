# Deploys hunt-app to the dotcloud-docker host over WinRM — the only
# management path this host exposes (22/2376/5986 closed, 5985 open; see
# AUDIT-REPORT.md). Run from the hunt-app directory.
#
# Usage:
#   $cred = Get-Credential   # administrator@192.168.1.195
#   .\scripts\deploy.ps1 -Credential $cred
param(
    [string]$Server = "192.168.1.195",
    [Parameter(Mandatory = $true)][System.Management.Automation.PSCredential]$Credential,
    [string]$RemoteDir = "C:\opt\hunt-app"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$contractOpsRoot = Split-Path -Parent $repoRoot

Write-Host "Connecting to $Server over WinRM..." -ForegroundColor Cyan
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
    # in the build context's parent at build time on the remote host too.
    Write-Host "Copying hunt-app and docs-pack to the remote host (this can take a few minutes)..." -ForegroundColor Cyan
    Copy-Item -Path "$repoRoot\*" -Destination $RemoteDir -Recurse -Force -ToSession $session `
        -Exclude @("node_modules", "dist", ".env")
    Copy-Item -Path "$contractOpsRoot\docs-pack" -Destination (Split-Path -Parent $RemoteDir) -Recurse -Force -ToSession $session

    Write-Host "Checking for an existing .env on the remote host..." -ForegroundColor Cyan
    $hasEnv = Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        Test-Path (Join-Path $dir ".env")
    } -ArgumentList $RemoteDir

    if (-not $hasEnv) {
        Write-Host "No .env found remotely — generating one now via scripts/generate-secrets.ps1." -ForegroundColor Yellow
        Invoke-Command -Session $session -ScriptBlock {
            param($dir)
            Set-Location $dir
            & .\scripts\generate-secrets.ps1
        } -ArgumentList $RemoteDir
        Write-Host "A fresh .env was generated on $Server at $RemoteDir\.env." -ForegroundColor Yellow
        Write-Host "FREELLMAPI_API_KEY (and AZURE_* once an Entra app exists) must be filled in by hand before AI-dependent features will work." -ForegroundColor Yellow
    }

    Write-Host "Building and starting containers..." -ForegroundColor Cyan
    $gitSha = (git rev-parse HEAD 2>$null)
    if (-not $gitSha) { $gitSha = "unknown" }
    Invoke-Command -Session $session -ScriptBlock {
        param($dir, $sha)
        Set-Location $dir
        $env:GIT_SHA = $sha
        docker compose up -d --build
        if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }
    } -ArgumentList $RemoteDir, $gitSha

    Write-Host "Running database migrations..." -ForegroundColor Cyan
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        Set-Location $dir
        docker compose exec -T hunt-app node dist/db/migrate.js
        if ($LASTEXITCODE -ne 0) { throw "migration failed" }
    } -ArgumentList $RemoteDir

    Write-Host "Polling /health..." -ForegroundColor Cyan
    $healthy = $false
    for ($i = 0; $i -lt 12; $i++) {
        Start-Sleep -Seconds 5
        try {
            $result = Invoke-Command -Session $session -ScriptBlock {
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
        Write-Host "  Invoke-Command -Session `$session -ScriptBlock { docker compose -f $RemoteDir\docker-compose.yml logs --tail 100 }"
        exit 1
    }
} finally {
    Remove-PSSession $session
}
