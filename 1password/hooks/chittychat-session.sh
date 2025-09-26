#!/bin/bash
# ChittyChat Session Hook
# Automatically configures environment when in ChittyChat directories

set -euo pipefail

# Configuration
HOOK_NAME="ChittyChat Session"
LOG_FILE="$HOME/.claude/1password/logs/chittychat-session.log"

# Create logs directory
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if we're in a ChittyChat or projects directory
is_chittychat_dir() {
    local current_dir="$PWD"
    local dir_name=$(basename "$current_dir")

    # Check if directory name contains 'chittychat' or 'projects' (case insensitive)
    local dir_lc=$(printf "%s" "$dir_name" | tr "[:upper:]" "[:lower:]")
    if [[ "$dir_lc" == *"chittychat"* ]] || [[ "$dir_lc" == *"projects"* ]]; then
        return 0
    fi

    # Check parent directories (up to 3 levels)
    for level in 1 2 3; do
        local parent_dir=$(dirname "$current_dir")
        local parent_name=$(basename "$parent_dir")
        local parent_lc=$(printf "%s" "$parent_name" | tr "[:upper:]" "[:lower:]")
        if [[ "$parent_lc" == *"chittychat"* ]] || [[ "$parent_lc" == *"projects"* ]]; then
            return 0
        fi
        current_dir="$parent_dir"
        if [[ "$current_dir" == "/" ]]; then
            break
        fi
    done

    return 1
}

# Main session setup
main() {
    log "Starting $HOOK_NAME hook"
    
    # Check if we're in a ChittyChat or projects directory
    if is_chittychat_dir; then
        log "Detected ChittyChat/projects directory at: $PWD"
        
        # Set environment variables for ChittyChat
        export CLAUDE_PROJECT="chittychat"
        export CLAUDE_USE_1PASSWORD=true
        
        # Look for .env.op file
        if [[ -f "$PWD/.env.op" ]]; then
            export CLAUDE_1PASSWORD_ENV_FILE="$PWD/.env.op"
            log "Found .env.op file at: $PWD/.env.op"
        else
            log "No .env.op file found in current directory"
        fi
        
        # Check for package.json to understand project structure
        if [[ -f "$PWD/package.json" ]]; then
            log "Found package.json - Node.js project detected"
            
            # Check if node_modules exists
            if [[ ! -d "$PWD/node_modules" ]]; then
                echo "💡 Tip: Run 'npm install' to install dependencies"
            fi
        fi
        
        # Create CLAUDE.md if it doesn't exist
        if [[ ! -f "$PWD/CLAUDE.md" ]]; then
            log "Creating CLAUDE.md for ChittyChat project"
            cat > "$PWD/CLAUDE.md" << 'EOF'
# ChittyChat Project

This is a ChittyChat project with 1Password integration enabled.

## Environment Variables

This project uses `.env.op` file for secret management with 1Password.

## Common Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run linting
- `npm run typecheck` - Run type checking

## 1Password Integration

Secrets are automatically injected when running npm/node commands.
EOF
            echo "📝 Created CLAUDE.md with project information"
        fi
        
        # Export ChittyChat functions globally
        if [[ -f "$PWD/bin/chittychat.sh" ]]; then
            source "$PWD/bin/chittychat.sh"
            log "Loaded ChittyChat functions from bin/chittychat.sh"
        elif [[ -f "$PWD/scripts/chittychat.sh" ]]; then
            source "$PWD/scripts/chittychat.sh"
            log "Loaded ChittyChat functions from scripts/chittychat.sh"
        elif [[ -f "$PWD/chittychat.sh" ]]; then
            source "$PWD/chittychat.sh"
            log "Loaded ChittyChat functions from chittychat.sh"
        fi
        
        # Export common ChittyChat aliases/functions
        alias cc='npm run chittychat'
        alias cc-start='npm run start'
        alias cc-dev='npm run dev'
        alias cc-build='npm run build'
        alias cc-test='npm run test'
        
        # Export function to run ChittyChat with 1Password
        chittychat() {
            if [[ -n "${CLAUDE_1PASSWORD_ENV_FILE:-}" ]]; then
                op run --env-file="$CLAUDE_1PASSWORD_ENV_FILE" -- npm run chittychat "$@"
            else
                npm run chittychat "$@"
            fi
        }
        export -f chittychat
        
        # Export Juniversal intake function if available
        juniversal-intake() {
            if [[ -n "${CLAUDE_1PASSWORD_ENV_FILE:-}" ]]; then
                op run --env-file="$CLAUDE_1PASSWORD_ENV_FILE" -- npm run juniversal-intake "$@"
            else
                npm run juniversal-intake "$@"
            fi
        }
        export -f juniversal-intake
        
        echo "🚀 ChittyChat environment configured!"
        echo "🔐 1Password integration: ENABLED"
        echo "🌍 Global functions: chittychat, juniversal-intake"
        echo "📦 Aliases: cc, cc-start, cc-dev, cc-build, cc-test"
    else
        log "Not in a ChittyChat directory - no special configuration applied"
    fi
    
    log "$HOOK_NAME hook completed"
}

# Run main
main "$@"