#!/bin/bash

# HUNT Deployment Script (WinRM)
# This script deploys the HUNT application to a remote server using WinRM

set -e

# Configuration
SERVER="192.168.1.195"
USERNAME="administrator"
PASSWORD="${WINRM_PASSWORD:-}"
REMOTE_DIR="/opt/hunt"
LOCAL_DIR="$(pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== HUNT Deployment Script ===${NC}"
echo "Server: $SERVER"
echo "Remote Directory: $REMOTE_DIR"
echo ""

# Check if password is set
if [ -z "$PASSWORD" ]; then
    echo -e "${RED}Error: WINRM_PASSWORD environment variable not set${NC}"
    echo "Please set the password: export WINRM_PASSWORD='your_password'"
    exit 1
fi

# Step 1: Create remote directory
echo -e "${YELLOW}Step 1: Creating remote directory...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "mkdir -p $REMOTE_DIR"

# Step 2: Copy files to remote server using WinRM
echo -e "${YELLOW}Step 2: Copying files to remote server...${NC}"

# Copy package.json
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "mkdir -p $REMOTE_DIR"
powershell -Command "
    $password = ConvertTo-SecureString '$PASSWORD' -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential('$USERNAME', $password)
    $session = New-PSSession -ComputerName $SERVER -Credential $credential
    Copy-Item -Path '$LOCAL_DIR/package.json' -Destination '$REMOTE_DIR/' -ToSession $session
    Copy-Item -Path '$LOCAL_DIR/tsconfig.json' -Destination '$REMOTE_DIR/' -ToSession $session
    Copy-Item -Path '$LOCAL_DIR/Dockerfile' -Destination '$REMOTE_DIR/' -ToSession $session
    Copy-Item -Path '$LOCAL_DIR/docker-compose.yml' -Destination '$REMOTE_DIR/' -ToSession $session
    Copy-Item -Path '$LOCAL_DIR/.env.example' -Destination '$REMOTE_DIR/' -ToSession $session
    Copy-Item -Path '$LOCAL_DIR/README.md' -Destination '$REMOTE_DIR/' -ToSession $session
    Copy-Item -Path '$LOCAL_DIR/.gitignore' -Destination '$REMOTE_DIR/' -ToSession $session
    Copy-Item -Path '$LOCAL_DIR/deploy-winrm.sh' -Destination '$REMOTE_DIR/' -ToSession $session
    Copy-Item -Path '$LOCAL_DIR/src' -Destination '$REMOTE_DIR/' -ToSession $session -Recurse
    Remove-PSSession $session
"

# Step 3: Create .env file on remote server
echo -e "${YELLOW}Step 3: Creating .env file...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "echo 'DATABASE_URL=postgresql://hunt_user:hunt_password@localhost:5432/hunt_db' > $REMOTE_DIR/.env"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "echo 'PORT=3000' >> $REMOTE_DIR/.env"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "echo 'NODE_ENV=production' >> $REMOTE_DIR/.env"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "echo 'LOG_LEVEL=info' >> $REMOTE_DIR/.env"

# Step 4: Install Node.js on remote server if not present
echo -e "${YELLOW}Step 4: Checking Node.js installation...${NC}"
NODE_VERSION=$(winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "node --version 2>&1 || echo 'not_installed'")
if [ "$NODE_VERSION" = "not_installed" ]; then
    echo -e "${YELLOW}Installing Node.js 20 on remote server...${NC}"
    winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements"
    winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "refreshenv"
fi

# Step 5: Install PostgreSQL on remote server if not present
echo -e "${YELLOW}Step 5: Checking PostgreSQL installation...${NC}"
PG_VERSION=$(winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "psql --version 2>&1 || echo 'not_installed'")
if [ "$PG_VERSION" = "not_installed" ]; then
    echo -e "${YELLOW}Installing PostgreSQL 15 on remote server...${NC}"
    winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "winget install PostgreSQL.PGSQL --accept-package-agreements --accept-source-agreements"
    winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "net start postgresql-x64-15"
fi

# Step 6: Create PostgreSQL database
echo -e "${YELLOW}Step 6: Creating PostgreSQL database...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "createdb hunt_db"

# Step 7: Install npm dependencies
echo -e "${YELLOW}Step 7: Installing npm dependencies...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "cd $REMOTE_DIR && npm install --production"

# Step 8: Build TypeScript
echo -e "${YELLOW}Step 8: Building TypeScript...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "cd $REMOTE_DIR && npm run build"

# Step 9: Start PostgreSQL service
echo -e "${YELLOW}Step 9: Starting PostgreSQL service...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "net start postgresql-x64-15"

# Step 10: Start the application
echo -e "${YELLOW}Step 10: Starting HUNT application...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "cd $REMOTE_DIR && npm start &"

# Step 11: Wait for application to start
echo -e "${YELLOW}Step 11: Waiting for application to start...${NC}"
sleep 10

# Step 12: Check health
echo -e "${YELLOW}Step 12: Checking application health...${NC}"
HEALTH_CHECK=$(winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "curl -s http://localhost:3000/health")
if echo "$HEALTH_CHECK" | grep -q "ok"; then
    echo -e "${GREEN}✓ Application is healthy!${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Logs:"
    winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "cd $REMOTE_DIR && tail -n 50 logs/*.log 2>/dev/null || echo 'No logs found'"
    exit 1
fi

# Step 13: Show status
echo -e "${YELLOW}Step 13: Showing application status...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "curl -s http://localhost:3000/health"

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo "Application is running at: http://$SERVER:3000"
echo "Health check: http://$SERVER:3000/health"
echo ""
echo "Useful commands:"
echo "  View logs: winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER 'cd $REMOTE_DIR && tail -f logs/*.log'"
echo "  Stop: winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER 'taskkill /F /IM node.exe'"
echo "  Restart: winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER 'cd $REMOTE_DIR && npm start &'"
echo ""