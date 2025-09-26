#!/bin/bash
# 1Password Command Wrapper
# Intercepts commands and runs them with secret injection when appropriate

set -euo pipefail

# Original command passed to the wrapper
ORIGINAL_CMD="$@"

# Check if we should use 1Password
if [[ "${CLAUDE_USE_1PASSWORD:-}" == "true" ]] && [[ -n "${CLAUDE_1PASSWORD_ENV_FILE:-}" ]]; then
    # Commands that should use 1Password secret injection
    case "$1" in
        npm|node|yarn|pnpm|bun)
            echo "🔐 Running with 1Password secrets: $ORIGINAL_CMD"
            exec op run --env-file="$CLAUDE_1PASSWORD_ENV_FILE" -- "$@"
            ;;
        python|python3|pip|pip3)
            echo "🔐 Running with 1Password secrets: $ORIGINAL_CMD"
            exec op run --env-file="$CLAUDE_1PASSWORD_ENV_FILE" -- "$@"
            ;;
        docker|docker-compose)
            echo "🔐 Running with 1Password secrets: $ORIGINAL_CMD"
            exec op run --env-file="$CLAUDE_1PASSWORD_ENV_FILE" -- "$@"
            ;;
        wrangler|vercel|railway|heroku)
            echo "🔐 Running with 1Password secrets: $ORIGINAL_CMD"
            exec op run --env-file="$CLAUDE_1PASSWORD_ENV_FILE" -- "$@"
            ;;
        *)
            # For other commands, run normally
            exec "$@"
            ;;
    esac
else
    # No 1Password integration needed
    exec "$@"
fi