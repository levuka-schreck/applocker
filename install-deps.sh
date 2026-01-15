#!/bin/bash

# Install OpenZeppelin contracts and Forge Standard Library
# This script should be run before deploying contracts

set -e

echo "📦 Installing dependencies..."
echo ""

# Create lib directory if it doesn't exist
mkdir -p lib

# Install OpenZeppelin Contracts
if [ ! -d "lib/openzeppelin-contracts" ]; then
    echo "Installing OpenZeppelin Contracts..."
    git clone https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts
    cd lib/openzeppelin-contracts
    git checkout v5.0.0  # Use a stable version
    cd ../..
    echo "✓ OpenZeppelin Contracts installed"
else
    echo "✓ OpenZeppelin Contracts already installed"
fi

# Install Forge Standard Library
if [ ! -d "lib/forge-std" ]; then
    echo "Installing Forge Standard Library..."
    git clone https://github.com/foundry-rs/forge-std.git lib/forge-std
    echo "✓ Forge Standard Library installed"
else
    echo "✓ Forge Standard Library already installed"
fi

echo ""
echo "✅ All dependencies installed successfully!"
echo ""
echo "You can now compile contracts with:"
echo "  forge build"
