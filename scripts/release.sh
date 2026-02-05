#!/bin/bash
# Release script for org-press monorepo
# Usage: ./scripts/release.sh <version> [--dry-run]
# Example: ./scripts/release.sh 0.9.9
# Example: ./scripts/release.sh 0.9.9 --dry-run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

DRY_RUN=false
VERSION=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 <version> [--dry-run]"
            echo ""
            echo "Arguments:"
            echo "  version     Semver version (e.g., 0.9.9, 1.0.0-beta.1)"
            echo ""
            echo "Options:"
            echo "  --dry-run   Show what would be done without making changes"
            echo "  --help      Show this help message"
            exit 0
            ;;
        *)
            if [ -z "$VERSION" ]; then
                VERSION="$1"
            else
                echo -e "${RED}Error: Unknown argument: $1${NC}"
                exit 1
            fi
            shift
            ;;
    esac
done

# Check if version argument is provided
if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Version number required${NC}"
    echo "Usage: $0 <version> [--dry-run]"
    echo "Example: $0 0.9.9"
    exit 1
fi

# Validate version format (semver)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    echo -e "${RED}Error: Invalid version format${NC}"
    echo "Expected semver format: X.Y.Z or X.Y.Z-prerelease"
    exit 1
fi

# Get the repo root
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo -e "${GREEN}=== org-press Release Script ===${NC}"
echo -e "Version: ${YELLOW}$VERSION${NC}"
if $DRY_RUN; then
    echo -e "${CYAN}Mode: DRY RUN (no changes will be made)${NC}"
fi
echo ""

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --staged --quiet; then
    echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
    if ! $DRY_RUN; then
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# List of package.json files to update
PACKAGES=(
    "packages/core/package.json"
    "packages/block-echarts/package.json"
    "packages/block-excalidraw/package.json"
    "packages/block-jscad/package.json"
    "packages/block-test/package.json"
    "packages/lsp/package.json"
    "packages/mcp/package.json"
    "packages/react/package.json"
    "packages/tools/package.json"
)

echo -e "${GREEN}Updating package versions...${NC}"

for pkg in "${PACKAGES[@]}"; do
    if [ -f "$pkg" ]; then
        echo "  Updating $pkg"

        if ! $DRY_RUN; then
            # Update version field (compatible with both macOS and Linux sed)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$pkg"
                sed -i '' "s/\"org-press\": \"\\^[^\"]*\"/\"org-press\": \"^$VERSION\"/" "$pkg"
            else
                sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$pkg"
                sed -i "s/\"org-press\": \"\\^[^\"]*\"/\"org-press\": \"^$VERSION\"/" "$pkg"
            fi
        fi
    else
        echo -e "${YELLOW}  Warning: $pkg not found${NC}"
    fi
done

if $DRY_RUN; then
    echo ""
    echo -e "${CYAN}[DRY RUN] Would commit with message:${NC}"
    echo "  chore: release v$VERSION"
    echo ""
    echo -e "${CYAN}[DRY RUN] Would create signed tag: v$VERSION${NC}"
    echo ""
    echo -e "${GREEN}=== Dry run complete ===${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Committing changes...${NC}"
git add -A
git commit -m "chore: release v$VERSION

Bump all packages to version $VERSION"

echo ""
echo -e "${GREEN}Creating signed tag...${NC}"
git tag -s "v$VERSION" -m "Release v$VERSION"

echo ""
echo -e "${GREEN}=== Release v$VERSION complete! ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the commit: git show HEAD"
echo "  2. Review the tag: git tag -v v$VERSION"
echo "  3. Push to remote: git push && git push --tags"
echo "  4. Publish packages: pnpm -r publish --access public"
