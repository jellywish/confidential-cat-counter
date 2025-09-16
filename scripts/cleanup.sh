#!/bin/bash
# PE Recommendation: Data lifecycle cleanup script
# Cleans upload and results directories for privacy and disk space management

set -euo pipefail

# Configuration
MAX_AGE_HOURS="${CLEANUP_MAX_AGE_HOURS:-24}"  # Default: 24 hours
DRY_RUN="${CLEANUP_DRY_RUN:-false}"
UPLOADS_DIR="./data/uploads"
RESULTS_DIR="./data/results"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

cleanup_directory() {
    local dir="$1"
    local description="$2"
    
    if [[ ! -d "$dir" ]]; then
        warn "$description directory does not exist: $dir"
        return 0
    fi
    
    log "Cleaning $description in $dir (files older than ${MAX_AGE_HOURS}h)"
    
    # Find files older than MAX_AGE_HOURS
    local find_cmd="find \"$dir\" -type f -mmin +$((MAX_AGE_HOURS * 60))"
    local file_count
    file_count=$(eval "$find_cmd" | wc -l)
    
    if [[ $file_count -eq 0 ]]; then
        log "No old files found in $description"
        return 0
    fi
    
    log "Found $file_count old files in $description"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        warn "DRY RUN MODE - Files that would be deleted:"
        eval "$find_cmd" | while read -r file; do
            echo "  - $file ($(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file") vs $(date +%s))"
        done
    else
        # Calculate total size before deletion
        local total_size
        total_size=$(eval "$find_cmd" -exec du -bc {} + 2>/dev/null | tail -1 | cut -f1 || echo "0")
        
        # Delete the files
        eval "$find_cmd" -delete
        
        success "Cleaned $file_count files from $description ($(numfmt --to=iec $total_size 2>/dev/null || echo "$total_size bytes"))"
    fi
}

cleanup_empty_dirs() {
    local dir="$1"
    local description="$2"
    
    if [[ ! -d "$dir" ]]; then
        return 0
    fi
    
    log "Removing empty directories in $description"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        local empty_dirs
        empty_dirs=$(find "$dir" -type d -empty 2>/dev/null || true)
        if [[ -n "$empty_dirs" ]]; then
            warn "DRY RUN MODE - Empty directories that would be removed:"
            echo "$empty_dirs" | while read -r empty_dir; do
                echo "  - $empty_dir"
            done
        fi
    else
        local removed_count
        removed_count=$(find "$dir" -type d -empty -delete -print 2>/dev/null | wc -l || echo "0")
        if [[ $removed_count -gt 0 ]]; then
            success "Removed $removed_count empty directories from $description"
        fi
    fi
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

PE Recommendation: Data lifecycle cleanup for privacy and disk space management

OPTIONS:
    -h, --help              Show this help message
    -d, --dry-run          Show what would be deleted without actually deleting
    -a, --max-age HOURS    Maximum age of files to keep (default: 24 hours)
    
ENVIRONMENT VARIABLES:
    CLEANUP_MAX_AGE_HOURS   Maximum age in hours (default: 24)
    CLEANUP_DRY_RUN        Set to 'true' for dry run mode (default: false)

EXAMPLES:
    $0                      # Clean files older than 24 hours
    $0 --dry-run           # Preview what would be cleaned
    $0 --max-age 48        # Clean files older than 48 hours
    
    # Environment variable usage:
    CLEANUP_MAX_AGE_HOURS=1 $0    # Clean files older than 1 hour
    CLEANUP_DRY_RUN=true $0       # Dry run mode
EOF
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -d|--dry-run)
                DRY_RUN="true"
                shift
                ;;
            -a|--max-age)
                MAX_AGE_HOURS="$2"
                shift 2
                ;;
            *)
                error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Validate max age
    if ! [[ "$MAX_AGE_HOURS" =~ ^[0-9]+$ ]] || [[ "$MAX_AGE_HOURS" -le 0 ]]; then
        error "Invalid max age: $MAX_AGE_HOURS (must be positive integer)"
        exit 1
    fi
    
    log "Starting data lifecycle cleanup"
    log "Configuration: MAX_AGE_HOURS=$MAX_AGE_HOURS, DRY_RUN=$DRY_RUN"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        warn "Running in DRY RUN mode - no files will actually be deleted"
    fi
    
    # Clean uploads directory
    cleanup_directory "$UPLOADS_DIR" "uploaded images"
    
    # Clean results directory  
    cleanup_directory "$RESULTS_DIR" "processing results"
    
    # Remove empty directories
    cleanup_empty_dirs "$UPLOADS_DIR" "uploads"
    cleanup_empty_dirs "$RESULTS_DIR" "results"
    
    success "Data lifecycle cleanup completed"
    
    # Show current disk usage
    if command -v du >/dev/null 2>&1; then
        log "Current disk usage:"
        if [[ -d "$UPLOADS_DIR" ]]; then
            echo "  Uploads: $(du -sh "$UPLOADS_DIR" 2>/dev/null | cut -f1 || echo "0B")"
        fi
        if [[ -d "$RESULTS_DIR" ]]; then
            echo "  Results: $(du -sh "$RESULTS_DIR" 2>/dev/null | cut -f1 || echo "0B")"
        fi
    fi
}

# Handle signals gracefully
trap 'error "Cleanup interrupted"; exit 130' INT TERM

# Run main function
main "$@"
