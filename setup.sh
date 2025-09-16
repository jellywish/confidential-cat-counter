#!/bin/bash
# Confidential Cat Counter - One-Command Setup Script
# Copyright 2025 Spencer (Confidential Cat Counter Contributors)
# Licensed under the Apache License, Version 2.0

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
SETUP_LOG="setup.log"
HEALTH_CHECK_TIMEOUT=60
HEALTH_CHECK_INTERVAL=5

# Global variables
DOCKER_REQUIRED=true
DOCKER_COMPOSE_REQUIRED=true
SKIP_HEALTH_CHECK=false
VERBOSE=false

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$SETUP_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$SETUP_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$SETUP_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$SETUP_LOG"
}

log_info() {
    echo -e "${CYAN}[INFO]${NC} $1" | tee -a "$SETUP_LOG"
}

show_banner() {
    cat << 'EOF'
   ____            __ _     _            _   _       _    ____      _            
  / ___|___  _ __ / _(_) __| | ___ _ __ | |_(_) __ _| |  / ___|__ _| |_ 
 | |   / _ \| '_ \ |_| |/ _` |/ _ \ '_ \| __| |/ _` | | | |   / _` | __|
 | |__| (_) | | | |  | | (_| |  __/ | | | |_| | (_| | | | |__| (_| | |_ 
  \____\___/|_| |_|_|_|\__,_|\___|_| |_|\__|_|\__,_|_|  \____\__,_|\__|
                                                                       
   ____                  _                                            
  / ___|___  _   _ _ __ | |_ ___ _ __                                  
 | |   / _ \| | | | '_ \| __/ _ \ '__|                                 
 | |__| (_) | |_| | | | | ||  __/ |                                   
  \____\___/ \__,_|_| |_|\__\___|_|                                   

Privacy-Preserving ML Reference Architecture
Copyright 2025 Spencer (Confidential Cat Counter Contributors)
Licensed under the Apache License, Version 2.0

EOF
}

show_usage() {
    cat << EOF
${BOLD}Confidential Cat Counter Setup${NC}

${BOLD}USAGE:${NC}
    $0 [OPTIONS]

${BOLD}OPTIONS:${NC}
    -h, --help              Show this help message
    -v, --verbose           Enable verbose output
    -s, --skip-health       Skip health check validation
    --dev                   Setup for development (includes dev dependencies)
    --prod                  Setup for production (optimized builds)

${BOLD}DESCRIPTION:${NC}
    This script sets up the Confidential Cat Counter privacy-preserving ML
    reference architecture with a single command. It handles all dependencies,
    Docker setup, and service initialization.

${BOLD}REQUIREMENTS:${NC}
    - Docker (version 20.10+)
    - Docker Compose (version 2.0+)
    - 4GB+ available RAM
    - 2GB+ available disk space

${BOLD}EXAMPLES:${NC}
    $0                      # Standard setup
    $0 --verbose           # Setup with detailed output  
    $0 --dev               # Development setup
    $0 --skip-health       # Skip health validation

${BOLD}WHAT THIS SCRIPT DOES:${NC}
    1. Validates system requirements
    2. Checks Docker and Docker Compose installation
    3. Downloads required ML models
    4. Builds Docker containers
    5. Starts all services (web-client, ml-service, redis)
    6. Runs health checks and validation
    7. Provides access instructions

${BOLD}SERVICES:${NC}
    - Web Client:     http://localhost:3000
    - ML Service:     http://localhost:8000  
    - Redis Cache:    localhost:6379

EOF
}

check_system_requirements() {
    log "Checking system requirements..."
    
    # Check available RAM
    if command -v free >/dev/null 2>&1; then
        # Linux
        local available_ram=$(free -m | awk '/^Mem:/{print $7}')
        if [[ $available_ram -lt 4000 ]]; then
            log_warn "Low available RAM: ${available_ram}MB (recommended: 4000MB+)"
        fi
    elif command -v vm_stat >/dev/null 2>&1; then
        # macOS
        local page_size=$(vm_stat | grep "page size" | awk '{print $8}')
        local free_pages=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        local available_ram=$((free_pages * page_size / 1024 / 1024))
        if [[ $available_ram -lt 4000 ]]; then
            log_warn "Low available RAM: ${available_ram}MB (recommended: 4000MB+)"
        fi
    fi
    
    # Check available disk space
    local available_disk=$(df . | tail -1 | awk '{print $4}')
    if [[ $available_disk -lt 2000000 ]]; then  # 2GB in KB
        log_warn "Low available disk space: $(($available_disk/1024))MB (recommended: 2000MB+)"
    fi
    
    log_success "System requirements check completed"
}

check_docker() {
    log "Checking Docker installation..."
    
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed"
        log_info "Please install Docker from: https://docs.docker.com/get-docker/"
        return 1
    fi
    
    # Check Docker version
    local docker_version=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    local major_version=$(echo $docker_version | cut -d. -f1)
    local minor_version=$(echo $docker_version | cut -d. -f2)
    
    if [[ $major_version -lt 20 ]] || [[ $major_version -eq 20 && $minor_version -lt 10 ]]; then
        log_warn "Docker version $docker_version detected (recommended: 20.10+)"
    fi
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        log_info "Please start Docker and try again"
        return 1
    fi
    
    log_success "Docker is available (version: $docker_version)"
    return 0
}

check_docker_compose() {
    log "Checking Docker Compose installation..."
    
    # Check for Docker Compose V2 (preferred)
    if docker compose version >/dev/null 2>&1; then
        local compose_version=$(docker compose version --short)
        log_success "Docker Compose is available (version: $compose_version)"
        return 0
    fi
    
    # Fallback to legacy docker-compose
    if command -v docker-compose >/dev/null 2>&1; then
        local compose_version=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        log_warn "Using legacy docker-compose (version: $compose_version)"
        log_info "Consider upgrading to Docker Compose V2"
        return 0
    fi
    
    log_error "Docker Compose is not installed"
    log_info "Please install Docker Compose from: https://docs.docker.com/compose/install/"
    return 1
}

download_models() {
    log "Checking ML models..."
    
    # Check if YOLO-NAS model exists
    if [[ -f "src/ml-service/models/yolo_nas_l.onnx" ]]; then
        log_success "YOLO-NAS model found"
        return 0
    fi
    
    log_warn "YOLO-NAS model not found - using fallback YOLOv5s"
    log_info "The application will work with reduced accuracy"
    log_info "To add YOLO-NAS model, see: docs/how-to/development/model-upgrades.md"
}

build_containers() {
    log "Building Docker containers..."
    
    # Clean any existing containers
    if docker compose ps -q >/dev/null 2>&1; then
        log_info "Stopping existing containers..."
        docker compose down >/dev/null 2>&1 || true
    fi
    
    # Build containers
    log_info "Building containers (this may take a few minutes)..."
    if [[ "$VERBOSE" == "true" ]]; then
        docker compose build
    else
        docker compose build >/dev/null 2>&1
    fi
    
    log_success "Docker containers built successfully"
}

start_services() {
    log "Starting services..."
    
    # Start services in background
    if [[ "$VERBOSE" == "true" ]]; then
        docker compose up -d
    else
        docker compose up -d >/dev/null 2>&1
    fi
    
    log_success "Services started"
    log_info "Web Client: http://localhost:3000"
    log_info "ML Service: http://localhost:8000"
    log_info "Redis Cache: localhost:6379"
}

wait_for_service() {
    local service_name="$1"
    local url="$2"
    local timeout="$3"
    local interval="$4"
    
    log_info "Waiting for $service_name to be ready..."
    
    local elapsed=0
    while [[ $elapsed -lt $timeout ]]; do
        if curl -s -f "$url" >/dev/null 2>&1; then
            log_success "$service_name is ready"
            return 0
        fi
        
        sleep "$interval"
        elapsed=$((elapsed + interval))
        
        if [[ $((elapsed % 15)) -eq 0 ]]; then
            log_info "Still waiting for $service_name... (${elapsed}s elapsed)"
        fi
    done
    
    log_error "$service_name failed to start within ${timeout}s"
    return 1
}

run_health_checks() {
    if [[ "$SKIP_HEALTH_CHECK" == "true" ]]; then
        log_warn "Skipping health checks as requested"
        return 0
    fi
    
    log "Running health checks..."
    
    # Wait for services to be ready
    wait_for_service "Web Client" "http://localhost:3000/health" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL" || return 1
    wait_for_service "ML Service" "http://localhost:8000/health" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL" || return 1
    
    # Test basic functionality
    log_info "Testing basic functionality..."
    
    # Test file upload (using a small test image)
    if [[ -f "tests/fixtures/wikipedia_cat.jpg" ]]; then
        local upload_result=$(curl -s -X POST http://localhost:3000/upload -F "image=@tests/fixtures/wikipedia_cat.jpg")
        if echo "$upload_result" | grep -q "jobId"; then
            log_success "File upload test passed"
        else
            log_error "File upload test failed"
            return 1
        fi
    else
        log_warn "Test image not found - skipping upload test"
    fi
    
    log_success "All health checks passed"
}

show_success_message() {
    cat << EOF

${GREEN}${BOLD}🎉 Setup Complete!${NC}

${BOLD}Your Confidential Cat Counter is ready to use:${NC}

${CYAN}🌐 Web Application:${NC}     http://localhost:3000
${CYAN}🤖 ML Service API:${NC}      http://localhost:8000
${CYAN}📋 API Documentation:${NC}   http://localhost:8000/docs

${BOLD}Quick Start:${NC}
1. Open http://localhost:3000 in your browser
2. Accept the Terms of Use (local-only processing)
3. Upload an image containing cats
4. View the detection results and crypto logs

${BOLD}Useful Commands:${NC}
• View logs:           ${YELLOW}docker compose logs -f${NC}
• Stop services:       ${YELLOW}docker compose down${NC}
• Restart services:    ${YELLOW}docker compose restart${NC}
• Clean up data:       ${YELLOW}./scripts/cleanup.sh${NC}

${BOLD}Documentation:${NC}
• Architecture Guide:  ${YELLOW}docs/explanation/architecture/${NC}
• API Reference:       ${YELLOW}docs/reference/api/${NC}
• Troubleshooting:     ${YELLOW}docs/how-to/troubleshooting/${NC}

${BOLD}Need Help?${NC}
• GitHub Issues:       https://github.com/jellywish/confidential-cat-counter/issues
• Documentation:       docs/README.md

${GREEN}Happy privacy-preserving ML development! 🐱🔒${NC}

EOF
}

show_failure_message() {
    cat << EOF

${RED}${BOLD}❌ Setup Failed${NC}

The setup process encountered an error. Please check the logs above.

${BOLD}Common Issues:${NC}
• Docker not running:     Start Docker Desktop/daemon
• Port conflicts:         Stop services using ports 3000, 8000, 6379
• Insufficient resources: Ensure 4GB+ RAM and 2GB+ disk space available
• Network issues:         Check internet connection for Docker image downloads

${BOLD}Troubleshooting:${NC}
• View setup log:         ${YELLOW}cat setup.log${NC}
• View service logs:      ${YELLOW}docker compose logs${NC}
• Reset environment:      ${YELLOW}docker compose down -v && docker system prune -f${NC}

${BOLD}Manual Setup:${NC}
If automated setup fails, try manual setup:
1. ${YELLOW}docker compose build${NC}
2. ${YELLOW}docker compose up -d${NC}
3. ${YELLOW}curl http://localhost:3000/health${NC}

${BOLD}Get Help:${NC}
• Documentation:          docs/how-to/troubleshooting/
• GitHub Issues:          https://github.com/jellywish/confidential-cat-counter/issues

EOF
}

cleanup() {
    if [[ $? -ne 0 ]]; then
        show_failure_message
    fi
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -s|--skip-health)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            --dev)
                log_info "Development mode enabled"
                export NODE_ENV=development
                shift
                ;;
            --prod)
                log_info "Production mode enabled"
                export NODE_ENV=production
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Initialize setup log
    echo "Confidential Cat Counter Setup - $(date)" > "$SETUP_LOG"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Show banner
    show_banner
    
    log "Starting Confidential Cat Counter setup..."
    log_info "Setup log: $SETUP_LOG"
    
    # Run setup steps
    check_system_requirements || exit 1
    check_docker || exit 1
    check_docker_compose || exit 1
    download_models
    build_containers || exit 1
    start_services || exit 1
    run_health_checks || exit 1
    
    # Show success message
    show_success_message
    
    log_success "Setup completed successfully!"
}

# Handle signals gracefully
trap 'log_error "Setup interrupted"; exit 130' INT TERM

# Run main function
main "$@"
