#!/bin/bash
# 1Password Pre-Authentication Hook
# Automatically injects secrets before command execution

set -euo pipefail

# Configuration
HOOK_NAME="1Password Pre-Auth"
LOG_FILE="$HOME/.claude/1password/logs/preauth.log"

# Create logs directory
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if we're in a project with .env.op file
detect_project_secrets() {
    local current_dir="$PWD"
    
    # Look for .env.op files
    if [[ -f "$current_dir/.env.op" ]]; then
        echo "$current_dir/.env.op"
        return 0
    fi
    
    # Check for ChittyChat specifically
    if [[ "$current_dir" == *"chittychat"* ]] && [[ -f "$current_dir/.env.op" ]]; then
        echo "$current_dir/.env.op"
        return 0
    fi
    
    # Look in parent directories (up to 3 levels)
    for level in 1 2 3; do
        local parent_dir
        parent_dir=$(dirname "$current_dir")
        if [[ -f "$parent_dir/.env.op" ]]; then
            echo "$parent_dir/.env.op"
            return 0
        fi
        current_dir="$parent_dir"
        if [[ "$current_dir" == "/" ]]; then
            break
        fi
    done
    
    return 1
}

# Main pre-auth logic
main() {
    log "Starting $HOOK_NAME hook"
    
    # Check if 1Password CLI is available
    if ! command -v op &> /dev/null; then
        log "1Password CLI not found - skipping secret injection"
        return 0
    fi
    
    # Check authentication
    if ! op whoami &> /dev/null; then
        log "Not signed in to 1Password - skipping secret injection"
        return 0
    fi
    
    # Detect if we need secret injection
    local env_file
    if env_file=$(detect_project_secrets); then
        log "Found environment file: $env_file"
        
        # Set environment variable to indicate 1Password should be used
        export CLAUDE_USE_1PASSWORD=true
        export CLAUDE_1PASSWORD_ENV_FILE="$env_file"
        
        log "1Password secret injection enabled"
    else
        log "No .env.op file found - normal execution"
    fi
    
    log "$HOOK_NAME hook completed"
}

# Always run main
main "$@"