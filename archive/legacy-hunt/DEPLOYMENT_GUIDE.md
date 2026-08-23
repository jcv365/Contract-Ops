# HUNT Deployment Guide

This guide provides step-by-step instructions for deploying the HUNT Contract Acquisition OS application to a remote server.

## Prerequisites

### Local Machine
- Windows 10/11 or Linux/macOS
- PowerShell 5.1+ (Windows) or Bash (Linux/macOS)
- WinRM enabled on the remote server
- Remote server credentials (username and password)

### Remote Server Requirements
- Windows Server 2016+ or Windows 10/11
- Node.js 20+ installed
- PostgreSQL 15+ installed
- Sufficient disk space (at least 2GB)
- Network connectivity between local and remote machines

## Deployment Methods

### Method 1: PowerShell Deployment (Recommended)

This method uses PowerShell with WinRM to deploy the application to the remote server.

#### Step 1: Set WINRM Password

```powershell
# Set the WinRM password as an environment variable
$env:WINRM_PASSWORD = "your_password_here"
```

#### Step 2: Run Deployment Script

```powershell
# Deploy to default server (192.168.1.195)
.\deploy-winrm.ps1

# Deploy to custom server
.\deploy-winrm.ps1 -Server "192.168.1.200" -Username "admin" -Password "custom_password"
```

#### Step 3: Verify Deployment

```powershell
# Check health endpoint
Invoke-WebRequest -Uri "http://192.168.1.195:3000/health" | Select-Object -ExpandProperty Content
```

### Method 2: Manual Deployment

If you prefer to deploy manually, follow these steps:

#### Step 1: Build the Application Locally

```powershell
# Install dependencies
npm install

# Build TypeScript
npm run build
```

#### Step 2: Copy Files to Remote Server

```powershell
# Create remote directory
New-Item -Path "\\192.168.1.195\opt\hunt" -ItemType Directory -Force

# Copy files
Copy-Item -Path "package.json", "tsconfig.json", "Dockerfile", "docker-compose.yml", ".env.example", "README.md", ".gitignore", "src" -Destination "\\192.168.1.195\opt\hunt\" -Recurse -Force
```

#### Step 3: Create Environment File

```powershell
# Create .env file on remote server
@"
DATABASE_URL=postgresql://hunt_user:hunt_password@localhost:5432/hunt_db
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
"@ | Set-Content "\\192.168.1.195\opt\hunt\.env"
```

#### Step 4: Install Dependencies on Remote Server

```powershell
# Open PowerShell on remote server
Enter-PSSession -ComputerName 192.168.1.195 -Credential (Get-Credential)

# Navigate to application directory
cd C:\opt\hunt

# Install dependencies
npm install --production

# Build TypeScript
npm run build

# Start PostgreSQL service
Start-Service postgresql-x64-15

# Start the application
npm start
```

## Configuration

### Environment Variables

Create a `.env` file in the application directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://hunt_user:hunt_password@localhost:5432/hunt_db

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# OpenAI API Configuration (Optional)
OPENAI_API_KEY=your_openai_api_key_here

# Microsoft Graph API Configuration (Optional)
GRAPH_CLIENT_ID=your_graph_client_id
GRAPH_CLIENT_SECRET=your_graph_client_secret
GRAPH_TENANT_ID=your_tenant_id

# Email Configuration (Optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASSWORD=your_email_password
```

### Database Setup

The deployment script automatically creates the PostgreSQL database. If you need to set up the database manually:

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE hunt_db;

-- Create user
CREATE USER hunt_user WITH PASSWORD 'hunt_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE hunt_db TO hunt_user;

-- Connect to hunt_db
\c hunt_db

-- Create tables (schema is auto-created on first run)
```

## Application Management

### View Logs

```powershell
# Using WinRM
Invoke-Command -ComputerName 192.168.1.195 -Credential $Credential -ScriptBlock {
    Set-Location C:\opt\hunt
    Get-Content logs/*.log -Tail 50 -Wait
}

# Or using PowerShell remoting
Enter-PSSession -ComputerName 192.168.1.195 -Credential $Credential
cd C:\opt\hunt
Get-Content logs/*.log -Tail 50 -Wait
```

### Stop the Application

```powershell
# Using WinRM
Invoke-Command -ComputerName 192.168.1.195 -Credential $Credential -ScriptBlock {
    Stop-Process -Name node -Force
}

# Or using PowerShell remoting
Enter-PSSession -ComputerName 192.168.1.195 -Credential $Credential
Stop-Process -Name node -Force
```

### Restart the Application

```powershell
# Using WinRM
Invoke-Command -ComputerName 192.168.1.195 -Credential $Credential -ScriptBlock {
    Set-Location C:\opt\hunt
    Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden
}

# Or using PowerShell remoting
Enter-PSSession -ComputerName 192.168.1.195 -Credential $Credential
cd C:\opt\hunt
Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden
```

### Check Application Status

```powershell
# Check health endpoint
Invoke-WebRequest -Uri "http://192.168.1.195:3000/health" | Select-Object -ExpandProperty Content

# Check if process is running
Invoke-Command -ComputerName 192.168.1.195 -Credential $Credential -ScriptBlock {
    Get-Process node -ErrorAction SilentlyContinue
}
```

## Troubleshooting

### Common Issues

#### 1. WinRM Connection Failed

**Error:** `The WinRM client cannot process the request`

**Solution:**
```powershell
# Enable WinRM on remote server
Enable-PSRemoting -Force

# Configure WinRM to allow remote connections
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force
```

#### 2. Node.js Not Installed

**Error:** `node: The term 'node' is not recognized`

**Solution:**
```powershell
# Install Node.js using winget
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements

# Verify installation
node --version
npm --version
```

#### 3. PostgreSQL Not Installed

**Error:** `psql: The term 'psql' is not recognized`

**Solution:**
```powershell
# Install PostgreSQL using winget
winget install PostgreSQL.PGSQL --accept-package-agreements --accept-source-agreements

# Start PostgreSQL service
Start-Service postgresql-x64-15

# Verify installation
psql --version
```

#### 4. Database Connection Failed

**Error:** `connection refused` or `authentication failed`

**Solution:**
```sql
-- Check if PostgreSQL is running
Get-Service postgresql-x64-15

-- Check if database exists
psql -U postgres -c "\l" | grep hunt_db

-- Check if user exists
psql -U postgres -c "\du" | grep hunt_user

-- Restart PostgreSQL service
Restart-Service postgresql-x64-15
```

#### 5. Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID> /F

# Or change the port in .env file
PORT=3001
```

#### 6. npm Install Fails

**Error:** `npm ERR! code ELIFECYCLE`

**Solution:**
```powershell
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Getting Help

If you encounter issues not covered in this guide:

1. Check the application logs: `Get-Content logs/*.log -Tail 100`
2. Verify all prerequisites are met
3. Check network connectivity between machines
4. Review the application README.md for additional information

## Security Considerations

- Never commit `.env` files to version control
- Use strong passwords for database and API keys
- Enable HTTPS in production
- Regularly update dependencies
- Configure firewall rules to restrict access
- Monitor application logs for suspicious activity

## Backup and Recovery

### Backup Database

```powershell
# Backup PostgreSQL database
pg_dump -U hunt_user hunt_db > backup_$(Get-Date -Format "yyyyMMdd").sql

# Copy backup to remote server
Copy-Item backup_*.sql "\\192.168.1.195\opt\hunt\backups\"
```

### Restore Database

```powershell
# Restore PostgreSQL database
psql -U hunt_user hunt_db < backup_20240101.sql
```

## Performance Optimization

### Database Optimization

```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_opportunities_source ON opportunities(source);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_score ON opportunities(score DESC);
CREATE INDEX idx_opportunities_created_at ON opportunities(created_at DESC);

-- Analyze database statistics
ANALYZE;
```

### Application Optimization

- Enable caching for frequently accessed data
- Use connection pooling for database connections
- Implement rate limiting for API endpoints
- Monitor application performance and optimize slow queries

## Monitoring

### Health Checks

```powershell
# Check application health
Invoke-WebRequest -Uri "http://192.168.1.195:3000/health" | Select-Object -ExpandProperty Content

# Check database connection
Invoke-WebRequest -Uri "http://192.168.1.195:3000/health/db" | Select-Object -ExpandProperty Content
```

### Log Monitoring

```powershell
# Monitor logs in real-time
Invoke-Command -ComputerName 192.168.1.195 -Credential $Credential -ScriptBlock {
    Set-Location C:\opt\hunt
    Get-Content logs/*.log -Tail 50 -Wait
}
```

## Support

For additional support, please refer to:
- Application README.md
- PostgreSQL documentation
- Node.js documentation
- Microsoft documentation for WinRM and PowerShell remoting