#!/bin/bash
# Setup script for kaspa-wasm SDK
# Downloads and installs the latest Kaspa WASM SDK from GitHub releases

set -e

KASPA_WASM_VERSION="${KASPA_WASM_VERSION:-v1.1.0-rc.2}"
SDK_URL="https://github.com/kaspanet/rusty-kaspa/releases/download/${KASPA_WASM_VERSION}/kaspa-wasm32-sdk-${KASPA_WASM_VERSION}.zip"

echo "Setting up Kaspa WASM SDK ${KASPA_WASM_VERSION}..."

# Download if not exists
if [ ! -f "kaspa-wasm-sdk.zip" ]; then
  echo "Downloading from ${SDK_URL}..."
  curl -L "${SDK_URL}" -o kaspa-wasm-sdk.zip
fi

# Extract
echo "Extracting..."
unzip -o kaspa-wasm-sdk.zip -d kaspa-wasm-sdk

# Copy to node_modules
echo "Installing to node_modules/kaspa-wasm..."
mkdir -p node_modules
cp -r kaspa-wasm-sdk/kaspa-wasm32-sdk/nodejs/kaspa node_modules/kaspa-wasm

echo "Done! Kaspa WASM SDK installed."
