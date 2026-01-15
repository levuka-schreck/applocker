#!/bin/bash

# Contract Diagnostic Script
# This checks if contracts are actually deployed at the addresses

echo "========================================"
echo "Contract Deployment Verification"
echo "========================================"
echo ""

# Your deployed addresses
VAULT="0x4c5859f0F772848b2D91F1D83E2Fe57935348029"
USDC="0x36C02dA8a0983159322a80FFE9F24b1acfF8B570"
APPEX="0x809d550fca64d94Bd9F66E60752A544199cfAC3D"

echo "Checking if Anvil is running..."
if ! curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null 2>&1; then
  echo "❌ ERROR: Anvil is not running on port 8545"
  echo "Start it with: anvil"
  exit 1
fi
echo "✅ Anvil is running"
echo ""

echo "Checking contract deployments..."
echo ""

# Check VAULT
echo "1. Checking Vault at $VAULT"
VAULT_CODE=$(cast code $VAULT --rpc-url http://localhost:8545)
if [ "$VAULT_CODE" = "0x" ]; then
  echo "   ❌ NO CONTRACT DEPLOYED"
  echo "   The vault address has no bytecode!"
else
  echo "   ✅ Contract deployed (${#VAULT_CODE} bytes)"
fi
echo ""

# Check USDC
echo "2. Checking USDC at $USDC"
USDC_CODE=$(cast code $USDC --rpc-url http://localhost:8545)
if [ "$USDC_CODE" = "0x" ]; then
  echo "   ❌ NO CONTRACT DEPLOYED"
else
  echo "   ✅ Contract deployed (${#USDC_CODE} bytes)"
fi
echo ""

# Check APPEX
echo "3. Checking APPEX at $APPEX"
APPEX_CODE=$(cast code $APPEX --rpc-url http://localhost:8545)
if [ "$APPEX_CODE" = "0x" ]; then
  echo "   ❌ NO CONTRACT DEPLOYED"
else
  echo "   ✅ Contract deployed (${#APPEX_CODE} bytes)"
fi
echo ""

# Try to call lpToken
echo "4. Testing vault.lpToken() call"
LP_TOKEN=$(cast call $VAULT "lpToken()(address)" --rpc-url http://localhost:8545 2>&1)
if [[ $LP_TOKEN == 0x* ]] && [[ ${#LP_TOKEN} -eq 42 ]]; then
  echo "   ✅ lpToken() returned: $LP_TOKEN"
else
  echo "   ❌ lpToken() call failed"
  echo "   Error: $LP_TOKEN"
fi
echo ""

echo "========================================"
echo "Diagnosis:"
echo "========================================"

if [ "$VAULT_CODE" = "0x" ] || [ "$USDC_CODE" = "0x" ] || [ "$APPEX_CODE" = "0x" ]; then
  echo ""
  echo "❌ PROBLEM FOUND: Contracts are NOT deployed at those addresses!"
  echo ""
  echo "This happens when:"
  echo "  1. Anvil was restarted (resets blockchain state)"
  echo "  2. You're using addresses from a previous Anvil session"
  echo ""
  echo "SOLUTION:"
  echo "  1. Keep Anvil running (don't restart it)"
  echo "  2. Redeploy contracts: ./deploy.sh"
  echo "  3. Update frontend/.env with NEW addresses"
  echo "  4. Restart frontend: npm run dev"
  echo ""
else
  echo ""
  echo "✅ All contracts are deployed at the expected addresses"
  echo ""
  if [[ ! $LP_TOKEN == 0x* ]]; then
    echo "But lpToken() call is failing. This shouldn't happen."
    echo "Try redeploying: ./deploy.sh"
  fi
fi
