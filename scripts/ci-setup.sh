#!/bin/bash
# CI Setup Script
# Handles the common build order issue where orgp binary isn't available
# until core is built and bin links are recreated.
#
# Usage: ./scripts/ci-setup.sh [--skip-install] [--include-docs]

set -e

SKIP_INSTALL=false
INCLUDE_DOCS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --include-docs)
      INCLUDE_DOCS=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "[ci-setup] Starting CI setup..."

# Step 1: Install dependencies
if [ "$SKIP_INSTALL" = false ]; then
  echo "[ci-setup] Installing dependencies..."
  pnpm install --frozen-lockfile
fi

# Step 2: Build core package first (provides orgp CLI)
echo "[ci-setup] Building core package..."
pnpm --filter org-press build

# Step 3: Rebuild bin links so orgp is available
echo "[ci-setup] Rebuilding bin links..."
pnpm install --frozen-lockfile

# Step 4: Build remaining packages (they depend on orgp)
echo "[ci-setup] Building remaining packages..."
if [ "$INCLUDE_DOCS" = true ]; then
  pnpm -r --filter '!org-press' build
else
  pnpm -r --filter '!org-press' --filter '!@org-press/docs' build
fi

echo "[ci-setup] Setup complete!"
