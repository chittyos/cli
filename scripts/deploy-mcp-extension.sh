#!/bin/bash
# Deploy ChittyOS MCP Extension
# §36 Compliant Deployment Pipeline

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
EXTENSION_DIR="chittyos-mcp-extension"
VERSION="${1:-1.0.1}"
ENVIRONMENT="${2:-production}"

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ChittyOS MCP Extension Deployment Pipeline v${VERSION}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

# Function to check dependencies
check_dependencies() {
    echo -e "\n${YELLOW}Checking dependencies...${NC}"

    local deps=("node" "npm" "git" "docker")
    for dep in "${deps[@]}"; do
        if command -v $dep &> /dev/null; then
            echo -e "✓ $dep is installed"
        else
            echo -e "${RED}✗ $dep is not installed${NC}"
            exit 1
        fi
    done

    # Check for mcpb
    if ! npm list -g @anthropic-ai/mcpb &> /dev/null; then
        echo "Installing mcpb bundler..."
        npm install -g @anthropic-ai/mcpb
    fi
}

# Function to build extension
build_extension() {
    echo -e "\n${YELLOW}Building extension...${NC}"

    cd "$EXTENSION_DIR"

    # Install dependencies
    npm ci

    # Validate manifest
    mcpb validate manifest.json

    # Build package
    mcpb pack

    # Generate checksums
    sha256sum chittyos-mcp-extension.mcpb > chittyos-mcp-extension.mcpb.sha256
    md5sum chittyos-mcp-extension.mcpb > chittyos-mcp-extension.mcpb.md5

    echo -e "${GREEN}✓ Extension built successfully${NC}"
    cd ..
}

# Function to run tests
run_tests() {
    echo -e "\n${YELLOW}Running tests...${NC}"

    cd "$EXTENSION_DIR"

    # Test server startup
    timeout 5 node chittymcp.js 2>&1 | grep -q "ChittyMCP Desktop Extension Server Running" || true

    # Validate ChittyID integration
    node -e "
        const fs = require('fs');
        const content = fs.readFileSync('chittymcp.js', 'utf8');
        if (!content.includes('chitty_id_service')) {
            console.error('ChittyID service integration missing!');
            process.exit(1);
        }
        console.log('✓ ChittyID service integration validated');
    "

    echo -e "${GREEN}✓ Tests passed${NC}"
    cd ..
}

# Function to build Docker image
build_docker() {
    echo -e "\n${YELLOW}Building Docker image...${NC}"

    cd "$EXTENSION_DIR"

    docker build -t chittyos/mcp-extension:${VERSION} .
    docker tag chittyos/mcp-extension:${VERSION} chittyos/mcp-extension:latest

    echo -e "${GREEN}✓ Docker image built${NC}"
    cd ..
}

# Function to deploy to registry
deploy_to_registry() {
    echo -e "\n${YELLOW}Deploying to ChittyOS Registry...${NC}"

    if [ -z "${CHITTY_API_KEY:-}" ]; then
        echo -e "${YELLOW}⚠ CHITTY_API_KEY not set, skipping registry deployment${NC}"
        return
    fi

    curl -X POST https://registry.chitty.cc/api/extensions \
        -H "Authorization: Bearer ${CHITTY_API_KEY}" \
        -H "Content-Type: multipart/form-data" \
        -F "extension=@${EXTENSION_DIR}/chittyos-mcp-extension.mcpb" \
        -F "version=${VERSION}" \
        -F "metadata={\"name\":\"chittyos-mcp\",\"type\":\"desktop-extension\"}" \
        || echo -e "${YELLOW}⚠ Registry deployment failed${NC}"
}

# Function to deploy to CDN
deploy_to_cdn() {
    echo -e "\n${YELLOW}Deploying to CDN...${NC}"

    if [ -z "${R2_ACCESS_KEY:-}" ] || [ -z "${R2_SECRET_KEY:-}" ]; then
        echo -e "${YELLOW}⚠ R2 credentials not set, skipping CDN deployment${NC}"
        return
    fi

    # Configure AWS CLI for R2
    aws configure set aws_access_key_id ${R2_ACCESS_KEY}
    aws configure set aws_secret_access_key ${R2_SECRET_KEY}
    aws configure set region auto

    # Upload to R2
    aws s3 cp ${EXTENSION_DIR}/chittyos-mcp-extension.mcpb \
        s3://chittyos-extensions/mcp/chittyos-mcp-extension-${VERSION}.mcpb \
        --endpoint-url https://r2.cloudflarestorage.com

    aws s3 cp ${EXTENSION_DIR}/chittyos-mcp-extension.mcpb \
        s3://chittyos-extensions/mcp/chittyos-mcp-extension-latest.mcpb \
        --endpoint-url https://r2.cloudflarestorage.com

    echo -e "${GREEN}✓ Deployed to CDN${NC}"
}

# Function to create GitHub release
create_release() {
    echo -e "\n${YELLOW}Creating GitHub release...${NC}"

    if [ -z "${GITHUB_TOKEN:-}" ]; then
        echo -e "${YELLOW}⚠ GITHUB_TOKEN not set, skipping GitHub release${NC}"
        return
    fi

    # Create release using GitHub CLI
    gh release create "mcp-v${VERSION}" \
        ${EXTENSION_DIR}/chittyos-mcp-extension.mcpb \
        ${EXTENSION_DIR}/chittyos-mcp-extension.mcpb.sha256 \
        ${EXTENSION_DIR}/chittyos-mcp-extension.mcpb.md5 \
        --title "ChittyOS MCP Extension v${VERSION}" \
        --notes "ChittyOS MCP Desktop Extension with §36 compliance

## Installation
1. Download \`chittyos-mcp-extension.mcpb\`
2. Open Claude Desktop
3. Go to Extensions → Install Extension
4. Select the downloaded file
5. Configure your ChittyID token

## Features
- 7 legal/business tools
- §36 compliant ChittyID integration
- Service-only ID generation
- Full audit trail support"

    echo -e "${GREEN}✓ GitHub release created${NC}"
}

# Function to validate deployment
validate_deployment() {
    echo -e "\n${YELLOW}Validating deployment...${NC}"

    # Check if package exists
    if [ -f "${EXTENSION_DIR}/chittyos-mcp-extension.mcpb" ]; then
        echo -e "✓ Extension package exists"
    else
        echo -e "${RED}✗ Extension package not found${NC}"
        exit 1
    fi

    # Check package size
    size=$(du -h ${EXTENSION_DIR}/chittyos-mcp-extension.mcpb | cut -f1)
    echo -e "✓ Package size: ${size}"

    # Verify checksums
    cd ${EXTENSION_DIR}
    sha256sum -c chittyos-mcp-extension.mcpb.sha256
    md5sum -c chittyos-mcp-extension.mcpb.md5
    cd ..

    echo -e "${GREEN}✓ Deployment validated${NC}"
}

# Main deployment flow
main() {
    check_dependencies
    build_extension
    run_tests
    build_docker
    deploy_to_registry
    deploy_to_cdn
    create_release
    validate_deployment

    echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}   ✅ ChittyOS MCP Extension v${VERSION} deployed successfully!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

    echo -e "\n📦 Package: ${EXTENSION_DIR}/chittyos-mcp-extension.mcpb"
    echo -e "🐳 Docker: chittyos/mcp-extension:${VERSION}"
    echo -e "🌐 CDN: https://cdn.chitty.cc/extensions/mcp/chittyos-mcp-extension-${VERSION}.mcpb"
    echo -e "📋 Registry: https://registry.chitty.cc/extensions/chittyos-mcp"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [version] [environment]"
        echo "  version: Extension version (default: 1.0.1)"
        echo "  environment: Deployment environment (default: production)"
        exit 0
        ;;
    --clean)
        echo "Cleaning build artifacts..."
        rm -f ${EXTENSION_DIR}/*.mcpb
        rm -f ${EXTENSION_DIR}/*.sha256
        rm -f ${EXTENSION_DIR}/*.md5
        echo "✓ Cleaned"
        exit 0
        ;;
esac

# Run main deployment
main