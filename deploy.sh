#!/bin/bash

# AppEx Protocol Deployment Script
# This script helps deploy contracts and setup the frontend

set -e

echo "🚀 AppEx Protocol Deployment"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Anvil is running
if ! nc -z localhost 8545 2>/dev/null; then
    echo -e "${RED}❌ Anvil is not running on port 8545${NC}"
    echo "Please start Anvil in another terminal:"
    echo "  anvil"
    exit 1
fi

echo -e "${GREEN}✓${NC} Anvil is running"

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo -e "${RED}❌ Forge not found${NC}"
    echo "Please install Foundry: https://book.getfoundry.sh/getting-started/installation"
    exit 1
fi

echo -e "${GREEN}✓${NC} Forge is installed"
echo ""

# Deploy contracts
echo "📦 Deploying smart contracts..."
echo ""

PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

forge script script/Deploy.s.sol \
    --rpc-url http://localhost:8545 \
    --private-key $PRIVATE_KEY \
    --broadcast \
    -vvv

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓${NC} Contracts deployed successfully!"
echo ""

# Check if deployments.txt exists
if [ ! -f "deployments.txt" ]; then
    echo -e "${RED}❌ deployments.txt not found${NC}"
    exit 1
fi

# Display addresses
echo "📋 Contract Addresses:"
echo "======================"
cat deployments.txt
echo ""

# Setup frontend
echo "🎨 Setting up frontend..."
echo ""

cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
    echo ""
fi

echo -e "${GREEN}✓${NC} Frontend setup complete"
echo ""

# Final instructions
echo "🎉 Deployment Complete!"
echo "======================="
echo ""
echo "Next steps:"
echo "1. Start the frontend:"
echo "   cd frontend && npm run dev"
echo ""
echo "2. Open http://localhost:3000 in your browser"
echo ""
echo "3. Go to the Setup page and load the deployments.txt file"
echo ""
echo "4. Get test USDC from the faucet on the LP Dashboard"
echo ""
echo "5. Start testing the protocol!"
echo ""
echo -e "${YELLOW}Note:${NC} Contract addresses have been saved to deployments.txt"
