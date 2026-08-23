# WinRM Setup Guide for Remote Server (192.168.1.195)

Run these commands **on the remote server (192.168.1.195)** as Administrator to enable WinRM:

## Quick Setup (Run as Administrator on 192.168.1.195)

```powershell
# Enable WinRM and configure for remote access
Enable-PSRemoting -Force

# Configure trusted hosts (allows connections from any host - use specific IP in production)
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force

# Restart WinRM service
Restart-Service WinRM

# Verify WinRM is running
Get-Service WinRM

# Test local WinRM
Test-WSMan localhost
```

## Alternative: Configure WinRM with Specific IP

```powershell
# Enable WinRM
Enable-PSRemoting -Force

# Configure trusted hosts for specific IP (more secure)
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "192.168.1.*" -Force

# Configure WinRM listener for HTTP
winrm quickconfig -q

# Restart WinRM
Restart-Service WinRM
```

## Firewall Configuration

```powershell
# Allow WinRM through firewall
New-NetFirewallRule -DisplayName "WinRM HTTP" -Direction Inbound -LocalPort 5985 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "WinRM HTTPS" -Direction Inbound -LocalPort 5986 -Protocol TCP -Action Allow
```

## Verify WinRM Configuration

```powershell
# Check WinRM configuration
winrm enumerate winrm/config/listener

# Test WinRM connectivity
Test-WSMan 192.168.1.195
```

## After WinRM is Configured on Remote Server

Run the deployment from your local machine:

```powershell
# Set password
$env:WINRM_PASSWORD = "your_actual_password"

# Run deployment
cd "g:\OneDrive - DotCloud Consulting\Code\Contract ops\HUNT"
.\deploy-simple.ps1 -Password $env:WINRM_PASSWORD
```

## Troubleshooting

### If you get "Access is denied":
1. Make sure you're running PowerShell as Administrator on the remote server
2. Check that the user account has administrative privileges
3. Verify the password is correct

### If you get "The WinRM client cannot process the request":
```powershell
# On local machine, configure trusted hosts
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "192.168.1.195" -Force
Restart-Service WinRM
```

### If you get "Connecting to remote server failed":
1. Check network connectivity: `Test-Connection 192.168.1.195`
2. Verify WinRM service is running on remote: `Get-Service WinRM`
3. Check firewall rules on both machines

### For Workgroup (non-domain) environments:
```powershell
# On both local and remote machines:
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force
Restart-Service WinRM

# On remote machine, also run:
Enable-PSRemoting -Force -SkipNetworkProfileCheck
```

## Manual Deployment Alternative

If WinRM setup is not possible, you can manually deploy:

1. **Copy files to remote server** (using file share, USB, or other method):
   ```
   Copy the entire HUNT folder to C:\opt\hunt on 192.168.1.195
   ```

2. **On remote server (192.168.1.195), run as Administrator**:
   ```powershell
   cd C:\opt\hunt
   
   # Install Node.js if not present
   winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
   refreshenv
   
   # Install PostgreSQL if not present
   winget install PostgreSQL.PGSQL --accept-package-agreements --accept-source-agreements
   Start-Service postgresql-x64-15
   
   # Create database
   createdb hunt_db
   
   # Create .env file
   @"
   DATABASE_URL=postgresql://hunt_user:hunt_password@localhost:5432/hunt_db
   PORT=3000
   NODE_ENV=production
   LOG_LEVEL=info
   "@ | Set-Content .env
   
   # Install dependencies and build
   npm install --production
   npm run build
   
   # Start application
   npm start
   ```

3. **Verify deployment**:
   ```powershell
   curl http://localhost:3000/health
   ```

## Security Notes

- Change the default database password in production
- Use HTTPS for WinRM in production (port 5986)
- Restrict TrustedHosts to specific IPs
- Use strong passwords for all services
- Consider using SSH instead of WinRM for better security