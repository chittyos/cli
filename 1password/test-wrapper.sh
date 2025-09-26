#!/bin/bash
# Test the command wrapper behavior

echo "Testing Command Wrapper Behavior"
echo "================================"

# Simulate being in ChittyChat directory with .env.op
export CLAUDE_USE_1PASSWORD=true
export CLAUDE_1PASSWORD_ENV_FILE="/Users/nb/configured/claude/mcp-servers/chittychat/.env.op"

echo -e "\nEnvironment set:"
echo "CLAUDE_USE_1PASSWORD: $CLAUDE_USE_1PASSWORD"
echo "CLAUDE_1PASSWORD_ENV_FILE: $CLAUDE_1PASSWORD_ENV_FILE"

echo -e "\nTesting npm command wrapping:"
echo "Command: npm --version"
echo "Expected: Should wrap with 'op run --env-file=...'"
echo -e "\nActual result:"

# Test the wrapper
/Users/nb/.claude/1password/hooks/command-wrapper.sh npm --version