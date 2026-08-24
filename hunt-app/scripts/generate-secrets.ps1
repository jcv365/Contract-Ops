# Generates a fresh .env on the target host from .env.example, filling
# in random secrets. Run this ON THE DEPLOY HOST (192.168.1.195), not on a
# dev machine — the values it generates should never leave that host.
# Modelled on AEOS's scripts/generate-secrets.sh.
param(
    [string]$EnvPath = ".env"
)

function New-RandomSecret([int]$Bytes = 32) {
    # RandomNumberGenerator.Fill() is .NET Core+ only — the target host
    # runs Windows PowerShell 5.1 on .NET Framework, where only the
    # instance-based RNGCryptoServiceProvider.GetBytes() exists.
    $buffer = New-Object byte[] $Bytes
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    try {
        $rng.GetBytes($buffer)
    } finally {
        $rng.Dispose()
    }
    return [Convert]::ToBase64String($buffer).Substring(0, $Bytes)
}

if (Test-Path $EnvPath) {
    Write-Host "$EnvPath already exists — refusing to overwrite. Delete it first if you really want to regenerate." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path ".env.example")) {
    Write-Host ".env.example not found — run this from the hunt-app directory." -ForegroundColor Red
    exit 1
}

$content = Get-Content ".env.example" -Raw
# ENCRYPTION_KEY must be EXACTLY 32 bytes (env.ts: z.string().length(32)) —
# AES-256-GCM's key length, not an arbitrary secret length.
$content = $content -replace 'POSTGRES_PASSWORD=', "POSTGRES_PASSWORD=$(New-RandomSecret 24)"
$content = $content -replace 'ENCRYPTION_KEY=', "ENCRYPTION_KEY=$(New-RandomSecret 32)"
$content = $content -replace 'JWT_SECRET=', "JWT_SECRET=$(New-RandomSecret 40)"
$content = $content -replace '(?m)^API_KEY=$', "API_KEY=$(New-RandomSecret 32)"
$content = $content -replace '(?m)^SESSION_SECRET=$', "SESSION_SECRET=$(New-RandomSecret 32)"
# PORTAL_PASSWORD is typed by a human at a login form, not carried in a
# header — a full base64 blob is needless to type. 16 random alphanumeric
# characters, rate-limited to 5 attempts/15min at the login route
# (src/portal/auth.ts), is proportionate.
$portalPassword = -join ((New-RandomSecret 24) -replace '[^a-zA-Z0-9]', '').Substring(0, 16)
$content = $content -replace '(?m)^PORTAL_PASSWORD=$', "PORTAL_PASSWORD=$portalPassword"

Set-Content -Path $EnvPath -Value $content -Encoding utf8 -NoNewline
Write-Host "Wrote $EnvPath. Now fill in FREELLMAPI_API_KEY (and AZURE_* once an Entra app exists) by hand." -ForegroundColor Green
Write-Host "Portal password: $portalPassword" -ForegroundColor Cyan
