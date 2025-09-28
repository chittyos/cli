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
    "sk-[a-zA-Z0-9]{20,}"  # Real API keys are longer
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
        # Only exclude node_modules and .git
        matches=$(rg "$pattern" --type js --type ts --type py --glob '!node_modules' --glob '!.git' . 2>/dev/null || true)
        if [ -n "$matches" ]; then
            echo "❌ Found direct AI provider pattern: $pattern"
            echo "$matches" | head -3
            VIOLATIONS=$((VIOLATIONS + 1))
        fi
    done
else
    # Fallback to grep
    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        if grep -r "$pattern" --include="*.js" --include="*.ts" --include="*.py" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | head -1 | grep -q .; then
            echo "❌ Found direct AI provider pattern: $pattern"
            VIOLATIONS=$((VIOLATIONS + 1))
        fi
    done
fi

if [ $VIOLATIONS -eq 0 ]; then
    echo "✅ No direct AI provider calls detected"
    exit $SUCCESS
else
    echo "🚨 Found $VIOLATIONS direct AI provider violations"
    echo "All AI interactions should go through ChittyOS framework"
    exit $VIOLATION
fi