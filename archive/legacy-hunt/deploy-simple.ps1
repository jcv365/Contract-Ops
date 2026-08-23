# HUNT Deployment Script (PowerShell) - Simple Version
# This script deploys the HUNT application to a remote server using WinRM

param(
    [Parameter(Mandatory=$false)]
    [string]$Password = $env:WINRM_PASSWORD,

    [Parameter(Mandatory=$false)]
    [string]$Server = "192.168.1.195",

    [Parameter(Mandatory=$false)]
    [string]$Username = "administrator",

    [Parameter(Mandatory=$false)]
    [string]$RemoteDir = "C:\opt\hunt"
)

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

Write-Log "=== HUNT Deployment Script ===" "Green"
Write-Log "Server: $Server" "White"
Write-Log "Remote Directory: $RemoteDir" "White"
Write-Host ""

if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Log "Error: WINRM_PASSWORD environment variable not set" "Red"
    Write-Host "Please set the password: `$env:WINRM_PASSWORD='your_password'" "Yellow"
    exit 1
}

$SecurePassword = ConvertTo-SecureString $Password -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential($Username, $SecurePassword)

Write-Log "Step 1: Creating remote directory..." "Yellow"
try {
    $session = New-PSSession -ComputerName $Server -Credential $Credential -ErrorAction Stop
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        if (-not (Test-Path $dir)) {
            New-Item -Path $dir -ItemType Directory -Force | Out-Null
        }
    } -ArgumentList $RemoteDir
    Write-Log "✓ Remote directory created" "Green"
} catch {
    Write-Log "✗ Failed to create remote directory: $_" "Red"
    exit 1
}

Write-Log "Step 2: Copying files to remote server..." "Yellow"
$filesToCopy = @("package.json", "tsconfig.json", "Dockerfile", "docker-compose.yml", ".env.example", "README.md", ".gitignore", "deploy-winrm.ps1", "src")
foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        try {
            Copy-Item -Path $file -Destination "\\$Server\$RemoteDir\" -Force -ToSession $session
            Write-Log "  ✓ Copied: $file" "Green"
        } catch {
            Write-Log "  ✗ Failed to copy: $file - $_" "Red"
        }
    } else {
        Write-Log "  ⚠ File not found: $file" "Yellow"
    }
}

Write-Log "Step 3: Creating .env file..." "Yellow"
$envContent = @"
DATABASE_URL=postgresql://hunt_user:hunt_password@localhost:5432/hunt_db
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
"@
try {
    Invoke-Command -Session $session -ScriptBlock {
        param($content)
        Set-Content -Path "C:\opt\hunt\.env" -Value $content -Force
    } -ArgumentList $envContent
    Write-Log "✓ .env file created" "Green"
} catch {
    Write-Log "✗ Failed to create .env file: $_" "Red"
}

Write-Log "Step 4: Checking Node.js..." "Yellow"
try {
    $nodeVersion = Invoke-Command -Session $session -ScriptBlock { node --version 2>&1 }
    if ($LASTEXITCODE -eq 0) {
        Write-Log "✓ Node.js is installed: $nodeVersion" "Green"
    } else { throw "Node.js not found" }
} catch {
    Write-Log "Installing Node.js 20..." "Yellow"
    try {
        Invoke-Command -Session $session -ScriptBlock {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
            refreshenv
        }
        Write-Log "✓ Node.js installed" "Green"
    } catch { Write-Log "✗ Failed to install Node.js: $_" "Red" }
}

Write-Log "Step 5: Checking PostgreSQL..." "Yellow"
try {
    $pgVersion = Invoke-Command -Session $session -ScriptBlock { psql --version 2>&1 }
    if ($LASTEXITCODE -eq 0) {
        Write-Log "✓ PostgreSQL is installed: $pgVersion" "Green"
    } else { throw "PostgreSQL not found" }
} catch {
    Write-Log "Installing PostgreSQL 15..." "Yellow"
    try {
        Invoke-Command -Session $session -ScriptBlock {
            winget install PostgreSQL.PGSQL --accept-package-agreements --accept-source-agreements
            Start-Service postgresql-x64-15
        }
        Write-Log "✓ PostgreSQL installed" "Green"
    } catch { Write-Log "✗ Failed to install PostgreSQL: $_" "Red" }
}

Write-Log "Step 6: Creating database..." "Yellow"
try {
    Invoke-Command -Session $session -ScriptBlock { createdb hunt_db }
    Write-Log "✓ Database created" "Green"
} catch { Write-Log "✗ Failed to create database: $_" "Red" }

Write-Log "Step 7: Installing dependencies..." "Yellow"
try {
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        Set-Location $dir
        npm install --production
    } -ArgumentList $RemoteDir
    Write-Log "✓ Dependencies installed" "Green"
} catch { Write-Log "✗ Failed to install dependencies: $_" "Red" }

Write-Log "Step 8: Building TypeScript..." "Yellow"
try {
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        Set-Location $dir
        npm run build
    } -ArgumentList $RemoteDir
    Write-Log "✓ TypeScript built" "Green"
} catch { Write-Log "✗ Failed to build TypeScript: $_" "Red" }

Write-Log "Step 9: Starting PostgreSQL..." "Yellow"
try {
    Invoke-Command -Session $session -ScriptBlock {
        Start-Service postgresql-x64-15
        Start-Sleep -Seconds 5
    }
    Write-Log "✓ PostgreSQL service started" "Green"
} catch { Write-Log "✗ Failed to start PostgreSQL: $_" "Red" }

Write-Log "Step 10: Starting application..." "Yellow"
try {
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        Set-Location $dir
        Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden
        Start-Sleep -Seconds 10
    } -ArgumentList $RemoteDir
    Write-Log "✓ Application started" "Green"
} catch { Write-Log "✗ Failed to start application: $_" "Red" }

Write-Log "Step 11: Checking health..." "Yellow"
try {
    $healthCheck = Invoke-Command -Session $session -ScriptBlock { curl -s http://localhost:3000/health }
    if ($healthCheck -match "ok") {
        Write-Log "✓ Application is healthy!" "Green"
    } else {
        Write-Log "✗ Health check failed" "Red"
        Invoke-Command -Session $session -ScriptBlock {
            param($dir)
            Set-Location $dir
            Get-Content logs/*.log -Tail 50 -ErrorAction SilentlyContinue
        } -ArgumentList $RemoteDir
        exit 1
    }
} catch { Write-Log "✗ Health check failed: $_" "Red" }

Write-Log "Step 12: Showing status..." "Yellow"
try {
    $status = Invoke-Command -Session $session -ScriptBlock { curl -s http://localhost:3000/health }
    Write-Host "Status: $status" "Green"
} catch { Write-Log "✗ Failed to get status: $_" "Red" }

Remove-PSSession $session

Write-Host ""
Write-Log "=== Deployment Complete ===" "Green"
Write-Log "Application is running at: http://$Server:3000" "White"
Write-Log "Health check: http://$Server:3000/health" "White"
Write-Host ""
Write-Log "Useful commands:" "Yellow"
Write-Log "  View logs: Invoke-Command -ComputerName $Server -Credential `$Credential -ScriptBlock { Set-Location $RemoteDir; Get-Content logs/*.log -Tail 50 -Wait }" "White"
Write-Log "  Stop: Invoke-Command -ComputerName $Server -Credential `$Credential -ScriptBlock { Stop-Process -Name node -Force }" "White"
Write-Log "  Restart: Invoke-Command -ComputerName $Server -Credential `$Credential -ScriptBlock { Set-Location $RemoteDir; Start-Process -FilePath 'npm' -ArgumentList 'start' -WindowStyle Hidden }" "White"
Write-Host ""