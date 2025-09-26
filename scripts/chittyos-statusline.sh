#!/bin/bash

# ChittyOS-themed status line for Claude Code
# Reads JSON input from stdin and generates a comprehensive status line

# Read and parse JSON input
input=$(cat)

# Extract data from JSON
session_id=$(echo "$input" | jq -r '.session_id // "unknown"')
current_dir=$(echo "$input" | jq -r '.workspace.current_dir // pwd')
model_display=$(echo "$input" | jq -r '.model.display_name // "Claude"')
model_id=$(echo "$input" | jq -r '.model.id // ""')
output_style=$(echo "$input" | jq -r '.output_style.name // "default"')

# Function to get ChittyOS project info
get_chitty_project() {
    local dir="$1"
    local basename_dir=$(basename "$dir")
    
    # Check if we're in a chitty* directory
    if [[ "$basename_dir" =~ ^chitty.* ]]; then
        echo "🐾 $basename_dir"
    elif [[ "$dir" =~ /chitty[^/]*(/|$) ]]; then
        # Extract chitty project name from path
        local chitty_name=$(echo "$dir" | grep -o '/chitty[^/]*' | head -1 | sed 's|^/||')
        echo "🐾 $chitty_name"
    else
        echo ""
    fi
}

# Function to get git info
get_git_info() {
    local dir="$1"
    if git -C "$dir" rev-parse --git-dir >/dev/null 2>&1; then
        local branch=$(git -C "$dir" branch --show-current 2>/dev/null || echo "detached")
        local status=""
        
        # Check git status
        if ! git -C "$dir" diff-index --quiet HEAD -- 2>/dev/null; then
            status="*"
        fi
        
        # Check for untracked files
        if [ -n "$(git -C "$dir" ls-files --others --exclude-standard 2>/dev/null)" ]; then
            status="${status}+"
        fi
        
        echo "⚡ $branch$status"
    else
        echo ""
    fi
}

# Function to get abbreviated directory
get_abbrev_dir() {
    local dir="$1"
    local home_dir="$HOME"
    
    # Replace home directory with ~
    if [[ "$dir" == "$home_dir"* ]]; then
        dir="~${dir#$home_dir}"
    fi
    
    # If path is too long, abbreviate middle parts
    if [[ ${#dir} -gt 40 ]]; then
        local parts=(${dir//\// })
        local result=""
        local last_idx=$((${#parts[@]} - 1))
        
        if [[ ${#parts[@]} -gt 3 ]]; then
            result="${parts[0]}/.../${parts[$last_idx]}"
        else
            result="$dir"
        fi
        echo "$result"
    else
        echo "$dir"
    fi
}

# Function to get Node.js version
get_node_version() {
    if command -v node >/dev/null 2>&1; then
        local version=$(node --version 2>/dev/null | sed 's/v//')
        echo "⬢ $version"
    else
        echo ""
    fi
}

# Function to get model abbreviation
get_model_abbrev() {
    case "$1" in
        *"claude-3-5-sonnet"*) echo "🧠 C3.5S" ;;
        *"claude-3-sonnet"*) echo "🧠 C3S" ;;
        *"claude-3-haiku"*) echo "🧠 C3H" ;;
        *"claude-3-opus"*) echo "🧠 C3O" ;;
        *"sonnet"*) echo "🧠 Sonnet" ;;
        *"haiku"*) echo "🧠 Haiku" ;;
        *"opus"*) echo "🧠 Opus" ;;
        *) echo "🧠 $(echo "$model_display" | cut -c1-8)" ;;
    esac
}

# Build status line components
chitty_project=$(get_chitty_project "$current_dir")
git_info=$(get_git_info "$current_dir")
abbrev_dir=$(get_abbrev_dir "$current_dir")
node_info=$(get_node_version)
model_abbrev=$(get_model_abbrev "$model_id")

# Build status line with color codes
status_line=""

# Add ChittyOS project if present
if [[ -n "$chitty_project" ]]; then
    status_line="$status_line$(printf '\033[36m%s\033[0m' "$chitty_project")"
fi

# Add git info if present
if [[ -n "$git_info" ]]; then
    if [[ -n "$status_line" ]]; then
        status_line="$status_line $(printf '\033[33m%s\033[0m' "$git_info")"
    else
        status_line="$(printf '\033[33m%s\033[0m' "$git_info")"
    fi
fi

# Add model info
if [[ -n "$status_line" ]]; then
    status_line="$status_line $(printf '\033[35m%s\033[0m' "$model_abbrev")"
else
    status_line="$(printf '\033[35m%s\033[0m' "$model_abbrev")"
fi

# Add session ID (abbreviated)
session_short=$(echo "$session_id" | cut -c1-8)
if [[ "$session_short" != "unknown" ]]; then
    status_line="$status_line $(printf '\033[32m📋 %s\033[0m' "$session_short")"
fi

# Add Node.js version if available
if [[ -n "$node_info" ]]; then
    status_line="$status_line $(printf '\033[32m%s\033[0m' "$node_info")"
fi

# Add current directory
status_line="$status_line $(printf '\033[34m📁 %s\033[0m' "$abbrev_dir")"

# Add output style if not default
if [[ "$output_style" != "default" && "$output_style" != "null" ]]; then
    status_line="$status_line $(printf '\033[37m✨ %s\033[0m' "$output_style")"
fi

# Output the final status line
printf '%s\n' "$status_line"