#!/bin/bash

# HUNT Deployment Script
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

# Step 1: Build Docker image locally
echo -e "${YELLOW}Step 1: Building Docker image...${NC}"
docker build -t hunt-app:latest .

# Step 2: Create tarball of the application
echo -e "${YELLOW}Step 2: Creating deployment package...${NC}"
tar -czf hunt-deploy.tar.gz \
    docker-compose.yml \
    .env \
    Dockerfile \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='*.log' \
    --exclude='.git'

# Step 3: Copy to remote server using WinRM
echo -e "${YELLOW}Step 3: Copying to remote server...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "mkdir -p $REMOTE_DIR"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "mkdir -p $REMOTE_DIR/data"

# Copy files using PowerShell
powershell -Command "
    $password = ConvertTo-SecureString '$PASSWORD' -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential('$USERNAME', $password)
    $session = New-PSSession -ComputerName $SERVER -Credential $credential
    Copy-Item -Path '$LOCAL_DIR/hunt-deploy.tar.gz' -Destination '$REMOTE_DIR/' -ToSession $session
    Remove-PSSession $session
"

# Step 4: Extract on remote server
echo -e "${YELLOW}Step 4: Extracting on remote server...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "cd $REMOTE_DIR && tar -xzf hunt-deploy.tar.gz"

# Step 5: Stop existing containers
echo -e "${YELLOW}Step 5: Stopping existing containers...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "cd $REMOTE_DIR && docker-compose down"

# Step 6: Start containers
echo -e "${YELLOW}Step 6: Starting containers...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "cd $REMOTE_DIR && docker-compose up -d"

# Step 7: Wait for health check
echo -e "${YELLOW}Step 7: Waiting for application to be healthy...${NC}"
sleep 10

# Step 8: Check health
echo -e "${YELLOW}Step 8: Checking application health...${NC}"
HEALTH_CHECK=$(winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "curl -s http://localhost:3000/health")
if echo "$HEALTH_CHECK" | grep -q "ok"; then
    echo -e "${GREEN}✓ Application is healthy!${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Logs:"
    winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "docker-compose logs --tail=50"
    exit 1
fi

# Step 9: Show status
echo -e "${YELLOW}Step 9: Showing container status...${NC}"
winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER "docker-compose ps"

# Cleanup
echo -e "${YELLOW}Cleaning up local files...${NC}"
rm -f hunt-deploy.tar.gz

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo "Application is running at: http://$SERVER:3000"
echo "Health check: http://$SERVER:3000/health"
echo ""
echo "Useful commands:"
echo "  View logs: winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER 'cd $REMOTE_DIR && docker-compose logs -f'"
echo "  Stop: winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER 'cd $REMOTE_DIR && docker-compose down'"
echo "  Restart: winrs -u:$USERNAME -p:$PASSWORD -r:$SERVER 'cd $REMOTE_DIR && docker-compose restart'"
echo ""