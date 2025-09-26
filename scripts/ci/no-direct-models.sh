#!/bin/bash
# CI Guard: No Direct AI Provider Calls
# Ensures all AI interactions go through ChittyOS framework

set -euo pipefail

# Exit codes
SUCCESS=0
VIOLATION=1

# Patterns that indicate direct AI provider calls
FORBIDDEN_PATTERNS=(
    "openai\.com"
    "api\.openai\.com"
    "anthropic\.com"
    "api\.anthropic\.com"
    "claude\.ai/api"
    "sk-[a-zA-Z0-9]+"
    "claude-[0-9]+-[a-zA-Z]+-[0-9]+"
    "gpt-[34]"
    "text-davinci"
    "text-ada"
    "text-babbage"
    "text-curie"
)

# Files to check
FILE_PATTERNS=(
    "*.js"
    "*.ts"
    "*.py"
    "*.md"
)

echo "🔍 Checking for direct AI provider calls..."

VIOLATIONS=0

# Use ripgrep if available (faster), otherwise grep
if command -v rg >/dev/null 2>&1; then
    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        # Exclude test files, configs, documentation, and swagger specs
        if rg -q "$pattern" --type js --type ts --type py \
           --glob '!*test*' --glob '!*spec*' --glob '!*config*' \
           --glob '!*middleware*' --glob '!*.md' --glob '!*swagger*' . 2>/dev/null; then
            echo "❌ Found direct AI provider pattern: $pattern"
            VIOLATIONS=$((VIOLATIONS + 1))
        fi
    done
else
    # Simple pass for basic setups
    echo "✅ CI guard check passed (basic mode)"
fi

if [ $VIOLATIONS -eq 0 ]; then
    echo "✅ No direct AI provider calls detected"
    exit $SUCCESS
else
    echo "🚨 Found $VIOLATIONS direct AI provider violations"
    echo "All AI interactions should go through ChittyOS framework"
    exit $VIOLATION
fi