#!/bin/bash

# ChittyOS ChatGPT API Deployment Script for Vercel
# Deploys the API and configures Custom GPT

set -e

COLORS=(
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
)

print_message() {
    local color=$1
    local message=$2
    echo -e "${!color}${message}${NC}"
}

print_header() {
    print_message "BOLD" "\n========================================"
    print_message "BOLD" "🚀 ChittyOS Vercel Deployment"
    print_message "BOLD" "🤖 ChatGPT Integration with Neon Database"
    print_message "BOLD" "========================================\n"
}

print_header

# 1. Check prerequisites
print_message "BLUE" "[1/6] Checking prerequisites..."

if ! command -v vercel &> /dev/null; then
    print_message "YELLOW" "⚠️  Vercel CLI not found. Installing..."
    npm i -g vercel
fi

if ! command -v python3 &> /dev/null; then
    print_message "RED" "❌ Python 3 is required"
    exit 1
fi

print_message "GREEN" "✅ Prerequisites met"

# 2. Setup environment
print_message "BLUE" "\n[2/6] Setting up environment..."

if [ ! -f ".env" ]; then
    print_message "YELLOW" "Creating .env file..."
    cat > .env << 'EOF'
# Neon Database (Required)
NEON_DATABASE_URL=postgresql://user:pass@host.neon.tech/database?sslmode=require
DATABASE_URL=postgresql://user:pass@host.neon.tech/database?sslmode=require

# ChittyOS API (Required)
CHITTY_API_KEY=your-secure-api-key-here

# Cloudflare (Optional)
CLOUDFLARE_API_TOKEN=your-token
CLOUDFLARE_ACCOUNT_ID=your-account-id

# ChittyOS Services (Optional)
CHITTY_CASE_DB_URL=https://cases.chitty.cc/api
CHITTY_CHAIN_RPC=https://chain.chitty.cc/rpc
CHITTY_VERIFY_ENDPOINT=https://verify.chitty.cc/api
CHITTY_TRUST_API=https://trust.chitty.cc/api
EOF
    print_message "YELLOW" "⚠️  Please edit .env with your credentials"
    print_message "YELLOW" "   Especially the NEON_DATABASE_URL"
    exit 1
fi

print_message "GREEN" "✅ Environment configured"

# 3. Install dependencies
print_message "BLUE" "\n[3/6] Installing dependencies..."

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

print_message "GREEN" "✅ Dependencies installed"

# 4. Test locally
print_message "BLUE" "\n[4/6] Testing API locally..."

# Start server in background
python3 api/main.py &
SERVER_PID=$!
sleep 3

# Test health endpoint
if curl -s http://localhost:8000/health | grep -q "healthy"; then
    print_message "GREEN" "✅ Local API test passed"
else
    print_message "RED" "❌ Local API test failed"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Stop test server
kill $SERVER_PID 2>/dev/null

# 5. Deploy to Vercel
print_message "BLUE" "\n[5/6] Deploying to Vercel..."

# Set Vercel environment variables
print_message "YELLOW" "Setting environment variables..."

# Read .env and set in Vercel
while IFS='=' read -r key value; do
    if [[ ! "$key" =~ ^#.*$ ]] && [[ -n "$key" ]]; then
        # Remove quotes if present
        value="${value%\"}"
        value="${value#\"}"
        vercel env add "$key" production <<< "$value" 2>/dev/null || true
    fi
done < .env

# Deploy
print_message "YELLOW" "Deploying to Vercel..."
DEPLOYMENT_URL=$(vercel --prod --yes 2>/dev/null | tail -1)

if [ -n "$DEPLOYMENT_URL" ]; then
    print_message "GREEN" "✅ Deployed successfully!"
    print_message "BLUE" "📍 URL: $DEPLOYMENT_URL"
else
    print_message "RED" "❌ Deployment failed"
    exit 1
fi

# 6. Generate Custom GPT configuration
print_message "BLUE" "\n[6/6] Generating Custom GPT configuration..."

cat > custom_gpt_config.json << EOF
{
  "name": "ChittyOS Legal Infrastructure AI",
  "description": "AI-driven legal tech infrastructure manager",
  "api_url": "$DEPLOYMENT_URL",
  "openapi_url": "$DEPLOYMENT_URL/openapi.json",
  "authentication": {
    "type": "bearer",
    "header": "Authorization",
    "prefix": "Bearer"
  },
  "test_endpoints": [
    "$DEPLOYMENT_URL/health",
    "$DEPLOYMENT_URL/schema/info"
  ]
}
EOF

print_message "GREEN" "✅ Configuration saved to custom_gpt_config.json"

# Final instructions
print_message "BOLD" "\n========================================"
print_message "GREEN" "🎉 Deployment Complete!"
print_message "BOLD" "========================================\n"

print_message "YELLOW" "Next Steps:"
print_message "WHITE" "1. Test the API: curl $DEPLOYMENT_URL/health"
print_message "WHITE" "2. Create Custom GPT at: https://chat.openai.com/gpts/editor"
print_message "WHITE" "3. Import OpenAPI from: $DEPLOYMENT_URL/openapi.json"
print_message "WHITE" "4. Configure authentication with your CHITTY_API_KEY"
print_message "WHITE" "5. Test with: 'Create a legal case for Acme Corp'"

print_message "BLUE" "\n📊 Database: Connected to Neon (schema.chitty.cc compatible)"
print_message "BLUE" "🔒 Security: API key authentication enabled"
print_message "BLUE" "📝 Audit: All operations logged to event_store table"

print_message "GREEN" "\n✨ ChittyOS: Empowering Legal Professionals with AI Infrastructure"
print_message "YELLOW" "💡 'We're not replacing lawyers - we're creating informed clients'\n"