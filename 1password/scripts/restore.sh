#!/bin/bash
# ChittyChat Restore Script
# Restores database and files from backup

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-chittychat-backups}"
LOG_FILE="${BACKUP_DIR}/restore_$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${LOG_FILE}"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "${LOG_FILE}"
}

# Function to list available backups
list_backups() {
    log "Listing available backups..."
    
    # List local backups
    echo -e "\n${BLUE}Local backups:${NC}"
    ls -lah "${BACKUP_DIR}/"*.gz 2>/dev/null || echo "No local backups found"
    
    # List S3 backups
    if command -v aws &> /dev/null; then
        echo -e "\n${BLUE}S3 backups:${NC}"
        aws s3 ls "s3://${S3_BACKUP_BUCKET}/" | grep -E '\.(gz|rdb)$' | sort -r | head -20
    fi
}

# Function to download backup from S3
download_from_s3() {
    local filename=$1
    local local_path="${BACKUP_DIR}/${filename}"
    
    info "Downloading ${filename} from S3..."
    
    if command -v aws &> /dev/null; then
        aws s3 cp "s3://${S3_BACKUP_BUCKET}/${filename}" "${local_path}"
        
        if [ $? -eq 0 ]; then
            success "Downloaded: ${local_path}"
            echo "${local_path}"
        else
            error "Failed to download: ${filename}"
        fi
    else
        error "AWS CLI not installed"
    fi
}

# Function to restore database
restore_database() {
    local backup_file=$1
    
    log "Starting database restore from ${backup_file}..."
    
    # Verify backup file
    if [ ! -f "${backup_file}" ]; then
        error "Backup file not found: ${backup_file}"
    fi
    
    # Get database credentials from 1Password
    if command -v op &> /dev/null; then
        DB_URL=$(op item get "ChittyChat Production" --fields "Database URL")
    else
        DB_URL="${DATABASE_URL}"
    fi
    
    if [ -z "${DB_URL}" ]; then
        error "Database URL not found"
    fi
    
    # Parse database URL
    DB_HOST=$(echo $DB_URL | sed -E 's/.*@([^:]+):.*/\1/')
    DB_PORT=$(echo $DB_URL | sed -E 's/.*:([0-9]+)\/.*/\1/')
    DB_NAME=$(echo $DB_URL | sed -E 's/.*\/([^?]+).*/\1/')
    DB_USER=$(echo $DB_URL | sed -E 's/.*:\/\/([^:]+):.*/\1/')
    DB_PASS=$(echo $DB_URL | sed -E 's/.*:\/\/[^:]+:([^@]+)@.*/\1/')
    
    # Create restore database
    RESTORE_DB="${DB_NAME}_restore_$(date +%Y%m%d_%H%M%S)"
    
    warning "Creating temporary database: ${RESTORE_DB}"
    PGPASSWORD="${DB_PASS}" createdb \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        "${RESTORE_DB}"
    
    # Restore to temporary database
    info "Restoring to temporary database..."
    gunzip -c "${backup_file}" | PGPASSWORD="${DB_PASS}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${RESTORE_DB}" \
        -v ON_ERROR_STOP=1
    
    if [ $? -eq 0 ]; then
        success "Database restored to: ${RESTORE_DB}"
        
        # Prompt for confirmation
        echo -e "\n${YELLOW}Database has been restored to temporary database: ${RESTORE_DB}${NC}"
        echo -e "To complete the restore, you need to:"
        echo -e "1. Stop the application"
        echo -e "2. Rename current database: ${DB_NAME} -> ${DB_NAME}_backup"
        echo -e "3. Rename restored database: ${RESTORE_DB} -> ${DB_NAME}"
        echo -e "4. Start the application"
        echo -e "\nDo you want to proceed? (yes/no): "
        read -r confirm
        
        if [ "${confirm}" = "yes" ]; then
            perform_database_swap "${DB_NAME}" "${RESTORE_DB}"
        else
            warning "Restore cancelled. Temporary database ${RESTORE_DB} preserved."
        fi
    else
        error "Database restore failed"
        # Clean up failed restore
        PGPASSWORD="${DB_PASS}" dropdb \
            -h "${DB_HOST}" \
            -p "${DB_PORT}" \
            -U "${DB_USER}" \
            "${RESTORE_DB}" 2>/dev/null || true
    fi
}

# Function to swap databases
perform_database_swap() {
    local current_db=$1
    local restore_db=$2
    local backup_db="${current_db}_backup_$(date +%Y%m%d_%H%M%S)"
    
    info "Performing database swap..."
    
    # Stop application
    if command -v kubectl &> /dev/null; then
        info "Scaling down application..."
        kubectl scale deployment chittychat --replicas=0 -n chittychat
        sleep 10
    fi
    
    # Rename databases
    info "Renaming databases..."
    PGPASSWORD="${DB_PASS}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d postgres \
        -c "ALTER DATABASE ${current_db} RENAME TO ${backup_db};"
    
    PGPASSWORD="${DB_PASS}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d postgres \
        -c "ALTER DATABASE ${restore_db} RENAME TO ${current_db};"
    
    # Start application
    if command -v kubectl &> /dev/null; then
        info "Scaling up application..."
        kubectl scale deployment chittychat --replicas=3 -n chittychat
    fi
    
    success "Database swap completed. Old database backed up as: ${backup_db}"
}

# Function to restore files
restore_files() {
    local backup_file=$1
    
    log "Starting file restore from ${backup_file}..."
    
    # Verify backup file
    if [ ! -f "${backup_file}" ]; then
        error "Backup file not found: ${backup_file}"
    fi
    
    # Create temporary directory
    TEMP_DIR="${BACKUP_DIR}/files_restore_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "${TEMP_DIR}"
    
    # Extract files
    tar -xzf "${backup_file}" -C "${TEMP_DIR}"
    
    if [ $? -eq 0 ]; then
        # Sync to S3
        if command -v aws &> /dev/null; then
            info "Syncing files to S3..."
            aws s3 sync "${TEMP_DIR}" "s3://${S3_BUCKET}/" --delete
            
            if [ $? -eq 0 ]; then
                success "Files restored to S3: ${S3_BUCKET}"
            else
                error "Failed to sync files to S3"
            fi
        fi
        
        # Clean up
        rm -rf "${TEMP_DIR}"
    else
        error "Failed to extract file backup"
    fi
}

# Function to restore Redis
restore_redis() {
    local backup_file=$1
    
    log "Starting Redis restore from ${backup_file}..."
    
    # Verify backup file
    if [ ! -f "${backup_file}" ]; then
        error "Backup file not found: ${backup_file}"
    fi
    
    REDIS_HOST="${REDIS_HOST:-redis}"
    REDIS_PORT="${REDIS_PORT:-6379}"
    
    if command -v kubectl &> /dev/null; then
        # Copy backup to Redis pod
        kubectl cp "${backup_file}" redis-0:/data/restore.rdb -n chittychat
        
        # Stop Redis
        kubectl exec redis-0 -n chittychat -- redis-cli SHUTDOWN NOSAVE
        
        # Replace dump file
        kubectl exec redis-0 -n chittychat -- mv /data/restore.rdb /data/dump.rdb
        
        # Restart Redis
        kubectl delete pod redis-0 -n chittychat
        
        # Wait for Redis to be ready
        sleep 10
        
        success "Redis restored from backup"
    else
        warning "kubectl not available, skipping Redis restore"
    fi
}

# Interactive restore menu
interactive_restore() {
    while true; do
        echo -e "\n${BLUE}=== ChittyChat Restore Menu ===${NC}"
        echo "1. List available backups"
        echo "2. Restore database"
        echo "3. Restore files"
        echo "4. Restore Redis"
        echo "5. Full restore (all components)"
        echo "6. Exit"
        echo -n "Select option: "
        read -r option
        
        case $option in
            1)
                list_backups
                ;;
            2)
                echo -n "Enter database backup filename: "
                read -r filename
                if [[ $filename == s3://* ]]; then
                    local_file=$(download_from_s3 "$(basename ${filename})")
                    restore_database "${local_file}"
                else
                    restore_database "${BACKUP_DIR}/${filename}"
                fi
                ;;
            3)
                echo -n "Enter files backup filename: "
                read -r filename
                if [[ $filename == s3://* ]]; then
                    local_file=$(download_from_s3 "$(basename ${filename})")
                    restore_files "${local_file}"
                else
                    restore_files "${BACKUP_DIR}/${filename}"
                fi
                ;;
            4)
                echo -n "Enter Redis backup filename: "
                read -r filename
                if [[ $filename == s3://* ]]; then
                    local_file=$(download_from_s3 "$(basename ${filename})")
                    restore_redis "${local_file}"
                else
                    restore_redis "${BACKUP_DIR}/${filename}"
                fi
                ;;
            5)
                echo -n "Enter backup timestamp (e.g., 20240115_120000): "
                read -r timestamp
                
                # Download all backups for timestamp
                db_backup=$(download_from_s3 "db_backup_${timestamp}.sql.gz")
                files_backup=$(download_from_s3 "files_backup_${timestamp}.tar.gz")
                redis_backup=$(download_from_s3 "redis_backup_${timestamp}.rdb")
                
                # Restore all components
                [ -f "${db_backup}" ] && restore_database "${db_backup}"
                [ -f "${files_backup}" ] && restore_files "${files_backup}"
                [ -f "${redis_backup}" ] && restore_redis "${redis_backup}"
                ;;
            6)
                echo "Exiting..."
                exit 0
                ;;
            *)
                warning "Invalid option"
                ;;
        esac
    done
}

# Main
main() {
    log "=== ChittyChat Restore Utility ==="
    
    # Create backup directory
    mkdir -p "${BACKUP_DIR}"
    
    # Check if running with arguments
    if [ $# -eq 0 ]; then
        interactive_restore
    else
        case $1 in
            list)
                list_backups
                ;;
            database)
                restore_database "$2"
                ;;
            files)
                restore_files "$2"
                ;;
            redis)
                restore_redis "$2"
                ;;
            *)
                error "Unknown command: $1"
                ;;
        esac
    fi
}

# Run main function
main "$@"