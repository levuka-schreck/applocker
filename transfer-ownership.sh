#!/bin/bash

# Transfer Vault Ownership Script
# Use this to transfer ownership from deployer to your Web3Auth wallet

echo "========================================"
echo "Vault Ownership Transfer"
echo "========================================"
echo ""

# Load addresses
if [ -f "frontend/.env" ]; then
    source frontend/.env
    VAULT_ADDRESS=$VITE_VAULT_ADDRESS
else
    read -p "Vault address: " VAULT_ADDRESS
fi

# Get current owner
echo "1. Checking current owner..."
CURRENT_OWNER=$(cast call $VAULT_ADDRESS "owner()(address)" --rpc-url http://localhost:8545)
echo "   Current owner: $CURRENT_OWNER"
echo ""

# Get new owner address
read -p "New owner address (your Web3Auth wallet): " NEW_OWNER
echo ""

# Confirm
echo "Transfer ownership?"
echo "  From: $CURRENT_OWNER"
echo "  To:   $NEW_OWNER"
read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Cancelled"
    exit 0
fi

echo ""
echo "2. Transferring ownership..."

# Use deployer's private key (Anvil account 0)
DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

cast send $VAULT_ADDRESS \
    "transferOwnership(address)" \
    $NEW_OWNER \
    --private-key $DEPLOYER_KEY \
    --rpc-url http://localhost:8545

echo ""
echo "3. Verifying new owner..."
NEW_OWNER_CHECK=$(cast call $VAULT_ADDRESS "owner()(address)" --rpc-url http://localhost:8545)
echo "   New owner: $NEW_OWNER_CHECK"

if [ "$NEW_OWNER_CHECK" = "$NEW_OWNER" ]; then
    echo ""
    echo "✅ Ownership transferred successfully!"
    echo ""
    echo "You can now use admin functions from your Web3Auth wallet:"
    echo "  - Approve borrowers"
    echo "  - Revoke borrowers"
    echo "  - Update borrower limits"
else
    echo ""
    echo "❌ Ownership transfer failed"
fi
