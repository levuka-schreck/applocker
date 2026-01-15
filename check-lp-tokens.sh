#!/bin/bash

# Check LP Token Balances
# This script helps diagnose why LP tokens might not be showing up

echo "========================================"
echo "LP Token Balance Checker"
echo "========================================"
echo ""

# Load addresses from .env if it exists
if [ -f "frontend/.env" ]; then
    source frontend/.env
    VAULT_ADDRESS=$VITE_VAULT_ADDRESS
    USDC_ADDRESS=$VITE_USDC_ADDRESS
else
    echo "⚠️  frontend/.env not found"
    echo "Please provide addresses:"
    read -p "Vault address: " VAULT_ADDRESS
    read -p "Your wallet address: " USER_ADDRESS
fi

if [ -z "$USER_ADDRESS" ]; then
    read -p "Your wallet address (from Web3Auth): " USER_ADDRESS
fi

echo "Vault: $VAULT_ADDRESS"
echo "User: $USER_ADDRESS"
echo ""

# Get LP token address from vault
echo "1. Getting LP Token address from Vault..."
LP_TOKEN=$(cast call $VAULT_ADDRESS "lpToken()(address)" --rpc-url http://localhost:8545)
echo "   LP Token: $LP_TOKEN"
echo ""

# Check LP token total supply
echo "2. Checking LP Token total supply..."
TOTAL_SUPPLY=$(cast call $LP_TOKEN "totalSupply()(uint256)" --rpc-url http://localhost:8545)
TOTAL_SUPPLY_FORMATTED=$(cast --to-unit $TOTAL_SUPPLY ether)
echo "   Total Supply: $TOTAL_SUPPLY_FORMATTED LP tokens"
echo ""

# Check user's LP token balance
echo "3. Checking your LP Token balance..."
USER_BALANCE=$(cast call $LP_TOKEN "balanceOf(address)(uint256)" $USER_ADDRESS --rpc-url http://localhost:8545)
USER_BALANCE_FORMATTED=$(cast --to-unit $USER_BALANCE ether)
echo "   Your Balance: $USER_BALANCE_FORMATTED LP tokens"
echo ""

# Check user's USDC balance
echo "4. Checking your USDC balance..."
USDC_BALANCE=$(cast call $USDC_ADDRESS "balanceOf(address)(uint256)" $USER_ADDRESS --rpc-url http://localhost:8545)
USDC_BALANCE_FORMATTED=$(cast --to-unit $USDC_BALANCE mwei)
echo "   Your USDC: $USDC_BALANCE_FORMATTED USDC"
echo ""

# Check vault's USDC balance
echo "5. Checking Vault's USDC balance..."
VAULT_USDC=$(cast call $USDC_ADDRESS "balanceOf(address)(uint256)" $VAULT_ADDRESS --rpc-url http://localhost:8545)
VAULT_USDC_FORMATTED=$(cast --to-unit $VAULT_USDC mwei)
echo "   Vault USDC: $VAULT_USDC_FORMATTED USDC"
echo ""

# Check vault stats
echo "6. Checking Vault stats..."
VAULT_STATS=$(cast call $VAULT_ADDRESS "getVaultStats()(uint256,uint256,uint256,uint256,uint256,uint256)" --rpc-url http://localhost:8545)
echo "   Raw stats: $VAULT_STATS"
echo ""

echo "========================================"
echo "Diagnosis:"
echo "========================================"

if [ "$TOTAL_SUPPLY_FORMATTED" = "0.000000000000000000" ]; then
    echo "❌ No LP tokens have been minted yet"
    echo "   This means no deposits have been made successfully"
    echo ""
    if [ "$VAULT_USDC_FORMATTED" != "0.000000" ]; then
        echo "   However, the vault HAS USDC: $VAULT_USDC_FORMATTED"
        echo "   This suggests deposits might have failed to mint LP tokens"
        echo "   Possible causes:"
        echo "   - Contract bug"
        echo "   - Transaction reverted but USDC still transferred"
    fi
else
    echo "✅ LP tokens exist: $TOTAL_SUPPLY_FORMATTED total"
    echo ""
    if [ "$USER_BALANCE_FORMATTED" = "0.000000000000000000" ]; then
        echo "❌ But YOU don't have any LP tokens"
        echo "   Possible causes:"
        echo "   - Deposit transaction failed"
        echo "   - Used different wallet address"
        echo "   - LP tokens sent to wrong address"
    else
        echo "✅ You have LP tokens: $USER_BALANCE_FORMATTED"
        echo "   Everything looks good!"
    fi
fi

echo ""
echo "Recent deposit events (last 10 blocks):"
cast logs --from-block -10 \
    --address $VAULT_ADDRESS \
    --event "Deposited(address,uint256,uint256)" \
    --rpc-url http://localhost:8545 2>/dev/null || echo "   (No recent deposits found)"
