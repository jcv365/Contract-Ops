# HUNT Deployment Script (PowerShell)
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

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$White = "White"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "=== HUNT Deployment Script ===" $Green
Write-ColorOutput "Server: $Server" $White
Write-ColorOutput "Remote Directory: $RemoteDir" $White
Write-Host ""

# Check if password is set
if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-ColorOutput "Error: WINRM_PASSWORD environment variable not set" $Red
    Write-Host "Please set the password: `$env:WINRM_PASSWORD='your_password'" $Yellow
    exit 1
}

# Create PSCredential object
$SecurePassword = ConvertTo-SecureString $Password -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential($Username, $SecurePassword)

# Step 1: Create remote directory
Write-ColorOutput "Step 1: Creating remote directory..." $Yellow
try {
    $session = New-PSSession -ComputerName $Server -Credential $Credential -ErrorAction Stop
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        if (-not (Test-Path $dir)) {
            New-Item -Path $dir -ItemType Directory -Force | Out-Null
        }
    } -ArgumentList $RemoteDir
    Write-ColorOutput "✓ Remote directory created" $Green
} catch {
    Write-ColorOutput "✗ Failed to create remote directory: $_" $Red
    exit 1
}

# Step 2: Copy files to remote server
Write-ColorOutput "Step 2: Copying files to remote server..." $Yellow

$localDir = Get-Location
$filesToCopy = @(
    "package.json",
    "tsconfig.json",
    "Dockerfile",
    "docker-compose.yml",
    ".env.example",
    "README.md",
    ".gitignore",
    "deploy-winrm.ps1",
    "src"
)

foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        try {
            Copy-Item -Path $file -Destination "\\$Server\$RemoteDir\" -Force -ToSession $session
            Write-ColorOutput "  ✓ Copied: $file" $Green
        } catch {
            Write-ColorOutput "  ✗ Failed to copy: $file - $_" $Red
        }
    } else {
        Write-ColorOutput "  ⚠ File not found: $file" $Yellow
    }
}

# Step 3: Create .env file on remote server
Write-ColorOutput "Step 3: Creating .env file..." $Yellow
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
    Write-ColorOutput "✓ .env file created" $Green
} catch {
    Write-ColorOutput "✗ Failed to create .env file: $_" $Red
}

# Step 4: Install Node.js on remote server if not present
Write-ColorOutput "Step 4: Checking Node.js installation..." $Yellow
try {
    $nodeVersion = Invoke-Command -Session $session -ScriptBlock {
        node --version 2>&1
    }
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Node.js is installed: $nodeVersion" $Green
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-ColorOutput "Node.js not installed. Installing Node.js 20..." $Yellow
    try {
        Invoke-Command -Session $session -ScriptBlock {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
            refreshenv
        }
        Write-ColorOutput "✓ Node.js installed" $Green
    } catch {
        Write-ColorOutput "✗ Failed to install Node.js: $_" $Red
    }
}

# Step 5: Install PostgreSQL on remote server if not present
Write-ColorOutput "Step 5: Checking PostgreSQL installation..." $Yellow
try {
    $pgVersion = Invoke-Command -Session $session -ScriptBlock {
        psql --version 2>&1
    }
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ PostgreSQL is installed: $pgVersion" $Green
    } else {
        throw "PostgreSQL not found"
    }
} catch {
    Write-ColorOutput "PostgreSQL not installed. Installing PostgreSQL 15..." $Yellow
    try {
        Invoke-Command -Session $session -ScriptBlock {
            winget install PostgreSQL.PGSQL --accept-package-agreements --accept-source-agreements
            Start-Service postgresql-x64-15
        }
        Write-ColorOutput "✓ PostgreSQL installed" $Green
    } catch {
        Write-ColorOutput "✗ Failed to install PostgreSQL: $_" $Red
    }
}

# Step 6: Create PostgreSQL database
Write-ColorOutput "Step 6: Creating PostgreSQL database..." $Yellow
try {
    Invoke-Command -Session $session -ScriptBlock {
        createdb hunt_db
    }
    Write-ColorOutput "✓ Database created" $Green
} catch {
    Write-ColorOutput "✗ Failed to create database: $_" $Red
}

# Step 7: Install npm dependencies
Write-ColorOutput "Step 7: Installing npm dependencies..." $Yellow
try {
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        Set-Location $dir
        npm install --production
    } -ArgumentList $RemoteDir
    Write-ColorOutput "✓ Dependencies installed" $Green
} catch {
    Write-ColorOutput "✗ Failed to install dependencies: $_" $Red
}

# Step 8: Build TypeScript
Write-ColorOutput "Step 8: Building TypeScript..." $Yellow
try {
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        Set-Location $dir
        npm run build
    } -ArgumentList $RemoteDir
    Write-ColorOutput "✓ TypeScript built" $Green
} catch {
    Write-ColorOutput "✗ Failed to build TypeScript: $_" $Red
}

# Step 9: Start PostgreSQL service
Write-ColorOutput "Step 9: Starting PostgreSQL service..." $Yellow
try {
    Invoke-Command -Session $session -ScriptBlock {
        Start-Service postgresql-x64-15
        Start-Sleep -Seconds 5
    }
    Write-ColorOutput "✓ PostgreSQL service started" $Green
} catch {
    Write-ColorOutput "✗ Failed to start PostgreSQL service: $_" $Red
}

# Step 10: Start the application
Write-ColorOutput "Step 10: Starting HUNT application..." $Yellow
try {
    Invoke-Command -Session $session -ScriptBlock {
        param($dir)
        Set-Location $dir
        Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden
        Start-Sleep -Seconds 10
    } -ArgumentList $RemoteDir
    Write-ColorOutput "✓ Application started" $Green
} catch {
    Write-ColorOutput "✗ Failed to start application: $_" $Red
}

# Step 11: Check health
Write-ColorOutput "Step 11: Checking application health..." $Yellow
try {
    $healthCheck = Invoke-Command -Session $session -ScriptBlock {
        curl -s http://localhost:3000/health
    }

    if ($healthCheck -match "ok") {
        Write-ColorOutput "✓ Application is healthy!" $Green
    } else {
        Write-ColorOutput "✗ Health check failed" $Red
        Write-Host "Logs:" $Yellow
        Invoke-Command -Session $session -ScriptBlock {
            param($dir)
            Set-Location $dir
            Get-Content logs/*.log -Tail 50 -ErrorAction SilentlyContinue
        } -ArgumentList $RemoteDir
        exit 1
    }
} catch {
    Write-ColorOutput "✗ Health check failed: $_" $Red
}

# Step 12: Show status
Write-ColorOutput "Step 12: Showing application status..." $Yellow
try {
    $status = Invoke-Command -Session $session -ScriptBlock {
        curl -s http://localhost:3000/health
    }
    Write-Host "Status: $status" $Green
} catch {
    Write-ColorOutput "✗ Failed to get status: $_" $Red
}

# Clean up session
Remove-PSSession $session

Write-Host ""
Write-ColorOutput "=== Deployment Complete ===" $Green
Write-ColorOutput "Application is running at: http://$Server:3000" $White
Write-ColorOutput "Health check: http://$Server:3000/health" $White
Write-Host ""
Write-ColorOutput "Useful commands:" $Yellow
Write-ColorOutput "  View logs: Invoke-Command -ComputerName $Server -Credential `$Credential -ScriptBlock { Set-Location $RemoteDir; Get-Content logs/*.log -Tail 50 -Wait }" $White
Write-ColorOutput "  Stop: Invoke-Command -ComputerName $Server -Credential `$Credential -ScriptBlock { Stop-Process -Name node -Force }" $White
Write-ColorOutput "  Restart: Invoke-Command -ComputerName $Server -Credential `$Credential -ScriptBlock { Set-Location $RemoteDir; Start-Process -FilePath 'npm' -ArgumentList 'start' -WindowStyle Hidden }" $White
Write-Host ""