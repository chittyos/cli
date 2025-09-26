#!/bin/bash
# Test script for 1Password hook integration

echo "Testing 1Password Hook Integration"
echo "=================================="

# Test 1: Check if hooks are set up
echo -e "\n1. Checking hooks configuration:"
if [[ -f "$HOME/.claude/settings.json" ]]; then
    echo "✓ Settings file exists"
    cat "$HOME/.claude/settings.json" | jq .hooks
else
    echo "✗ Settings file not found"
fi

# Test 2: Run pre-auth hook
echo -e "\n2. Testing pre-auth hook:"
if [[ -f "$HOME/.claude/1password/hooks/onepassword-preauth.sh" ]]; then
    echo "✓ Pre-auth hook exists"
    source "$HOME/.claude/1password/hooks/onepassword-preauth.sh"
    if [[ "${CLAUDE_USE_1PASSWORD:-}" == "true" ]]; then
        echo "✓ 1Password integration detected"
        echo "  ENV file: $CLAUDE_1PASSWORD_ENV_FILE"
    else
        echo "⚠ No .env.op file found in current directory"
    fi
else
    echo "✗ Pre-auth hook not found"
fi

# Test 3: Test command wrapper
echo -e "\n3. Testing command wrapper with npm:"
cd /Users/nb/configured/claude/mcp-servers/chittychat 2>/dev/null || {
    echo "⚠ ChittyChat directory not found"
    exit 1
}

# Source pre-auth to set environment
source "$HOME/.claude/1password/hooks/onepassword-preauth.sh"

# Test npm command
echo -e "\nRunning: npm --version"
if [[ -f "$HOME/.claude/1password/hooks/command-wrapper.sh" ]]; then
    "$HOME/.claude/1password/hooks/command-wrapper.sh" npm --version
else
    echo "✗ Command wrapper not found"
fi

echo -e "\n=================================="
echo "Hook integration test complete!"