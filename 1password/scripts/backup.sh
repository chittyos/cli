#!/bin/bash
# ChittyChat Backup Script
# Performs automated backups of database and file storage

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-chittychat-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Function to backup PostgreSQL database
backup_database() {
    log "Starting database backup..."
    
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
    
    BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"
    
    # Perform backup
    PGPASSWORD="${DB_PASS}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        | gzip > "${BACKUP_FILE}"
    
    if [ $? -eq 0 ]; then
        success "Database backup completed: ${BACKUP_FILE}"
        echo "${BACKUP_FILE}"
    else
        error "Database backup failed"
    fi
}

# Function to backup file storage
backup_files() {
    log "Starting file storage backup..."
    
    FILES_BACKUP="${BACKUP_DIR}/files_backup_${TIMESTAMP}.tar.gz"
    
    # Backup uploaded files from S3
    if command -v aws &> /dev/null; then
        aws s3 sync "s3://${S3_BUCKET}" "${BACKUP_DIR}/files_temp/" --quiet
        tar -czf "${FILES_BACKUP}" -C "${BACKUP_DIR}/files_temp" .
        rm -rf "${BACKUP_DIR}/files_temp"
        
        if [ $? -eq 0 ]; then
            success "File storage backup completed: ${FILES_BACKUP}"
            echo "${FILES_BACKUP}"
        else
            warning "File storage backup failed"
        fi
    else
        warning "AWS CLI not installed, skipping S3 backup"
    fi
}

# Function to backup Redis data
backup_redis() {
    log "Starting Redis backup..."
    
    REDIS_BACKUP="${BACKUP_DIR}/redis_backup_${TIMESTAMP}.rdb"
    
    # Get Redis connection info
    REDIS_HOST="${REDIS_HOST:-redis}"
    REDIS_PORT="${REDIS_PORT:-6379}"
    
    # Trigger Redis BGSAVE
    redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" BGSAVE
    
    # Wait for backup to complete
    while [ $(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" LASTSAVE) -eq $(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" LASTSAVE) ]; do
        sleep 1
    done
    
    # Copy the dump file
    if command -v kubectl &> /dev/null; then
        kubectl cp redis-0:/data/dump.rdb "${REDIS_BACKUP}" -n chittychat
        
        if [ $? -eq 0 ]; then
            success "Redis backup completed: ${REDIS_BACKUP}"
            echo "${REDIS_BACKUP}"
        else
            warning "Redis backup failed"
        fi
    else
        warning "kubectl not available, skipping Redis backup"
    fi
}

# Function to upload backups to S3
upload_to_s3() {
    local file=$1
    log "Uploading ${file} to S3..."
    
    if command -v aws &> /dev/null; then
        aws s3 cp "${file}" "s3://${S3_BACKUP_BUCKET}/$(basename ${file})" \
            --storage-class GLACIER_IR \
            --metadata "backup-date=${TIMESTAMP},retention-days=${RETENTION_DAYS}"
        
        if [ $? -eq 0 ]; then
            success "Uploaded to S3: $(basename ${file})"
        else
            error "Failed to upload to S3: $(basename ${file})"
        fi
    else
        warning "AWS CLI not installed, skipping S3 upload"
    fi
}

# Function to clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Clean local backups
    find "${BACKUP_DIR}" -type f -mtime +${RETENTION_DAYS} -delete
    
    # Clean S3 backups
    if command -v aws &> /dev/null; then
        aws s3 ls "s3://${S3_BACKUP_BUCKET}/" | while read -r line; do
            createDate=$(echo $line | awk '{print $1" "$2}')
            createDate=$(date -d "$createDate" +%s)
            olderThan=$(date -d "${RETENTION_DAYS} days ago" +%s)
            
            if [[ $createDate -lt $olderThan ]]; then
                fileName=$(echo $line | awk '{print $4}')
                if [ ! -z "$fileName" ]; then
                    aws s3 rm "s3://${S3_BACKUP_BUCKET}/${fileName}"
                    log "Deleted old backup: ${fileName}"
                fi
            fi
        done
    fi
    
    success "Cleanup completed"
}

# Function to verify backup
verify_backup() {
    local file=$1
    log "Verifying backup: ${file}"
    
    if [ -f "${file}" ]; then
        size=$(stat -f%z "${file}" 2>/dev/null || stat -c%s "${file}" 2>/dev/null)
        if [ "${size}" -gt 0 ]; then
            success "Backup verified: ${file} (${size} bytes)"
            return 0
        else
            error "Backup file is empty: ${file}"
            return 1
        fi
    else
        error "Backup file not found: ${file}"
        return 1
    fi
}

# Function to send notification
send_notification() {
    local status=$1
    local message=$2
    
    # Slack notification
    if [ ! -z "${SLACK_WEBHOOK}" ]; then
        curl -X POST "${SLACK_WEBHOOK}" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"ChittyChat Backup ${status}: ${message}\"}" \
            --silent --output /dev/null
    fi
    
    # Email notification (if configured)
    if [ ! -z "${BACKUP_EMAIL}" ] && command -v mail &> /dev/null; then
        echo "${message}" | mail -s "ChittyChat Backup ${status}" "${BACKUP_EMAIL}"
    fi
}

# Main backup process
main() {
    log "=== ChittyChat Backup Started ==="
    log "Timestamp: ${TIMESTAMP}"
    log "Backup directory: ${BACKUP_DIR}"
    
    # Perform backups
    DB_BACKUP=$(backup_database)
    FILES_BACKUP=$(backup_files)
    REDIS_BACKUP=$(backup_redis)
    
    # Verify backups
    BACKUP_STATUS="SUCCESS"
    BACKUP_MESSAGE="All backups completed successfully"
    
    if [ ! -z "${DB_BACKUP}" ]; then
        verify_backup "${DB_BACKUP}" && upload_to_s3 "${DB_BACKUP}"
    else
        BACKUP_STATUS="PARTIAL"
        BACKUP_MESSAGE="Database backup failed"
    fi
    
    if [ ! -z "${FILES_BACKUP}" ]; then
        verify_backup "${FILES_BACKUP}" && upload_to_s3 "${FILES_BACKUP}"
    fi
    
    if [ ! -z "${REDIS_BACKUP}" ]; then
        verify_backup "${REDIS_BACKUP}" && upload_to_s3 "${REDIS_BACKUP}"
    fi
    
    # Clean old backups
    cleanup_old_backups
    
    # Send notification
    send_notification "${BACKUP_STATUS}" "${BACKUP_MESSAGE}"
    
    log "=== ChittyChat Backup Completed ==="
}

# Run main function
main "$@"