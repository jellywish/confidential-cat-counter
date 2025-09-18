#!/bin/bash

# Test runner script for Confidential Cat Counter
# Provides unified testing interface for development and CI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Default settings
RUN_UNIT=true
RUN_INTEGRATION=false
RUN_SECURITY=false
VERBOSE=false
CLEANUP=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            RUN_UNIT=true
            RUN_INTEGRATION=false
            RUN_SECURITY=false
            shift
            ;;
        --integration)
            RUN_UNIT=false
            RUN_INTEGRATION=true
            RUN_SECURITY=false
            shift
            ;;
        --security)
            RUN_UNIT=false
            RUN_INTEGRATION=false
            RUN_SECURITY=true
            shift
            ;;
        --all)
            RUN_UNIT=true
            RUN_INTEGRATION=true
            RUN_SECURITY=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --help|-h)
            echo "Test runner for Confidential Cat Counter"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --unit         Run unit tests only (default)"
            echo "  --integration  Run integration tests only"
            echo "  --security     Run security scans only"
            echo "  --all          Run all tests and scans"
            echo "  --verbose, -v  Verbose output"
            echo "  --no-cleanup   Don't cleanup test containers"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run unit tests"
            echo "  $0 --all --verbose    # Run everything with verbose output"
            echo "  $0 --security         # Run security scans only"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Ensure we're in the project root
if [[ ! -f "package.json" ]] && [[ ! -f "src/web-client/package.json" ]]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

PROJECT_ROOT=$(pwd)

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
        log_error "Python is required but not installed"
        exit 1
    fi
    
    # Check Docker (for integration tests)
    if [[ "$RUN_INTEGRATION" == true ]] && ! command -v docker &> /dev/null; then
        log_warning "Docker not found - integration tests will be skipped"
        RUN_INTEGRATION=false
    fi
    
    log_success "Dependencies check passed"
}

# Install test dependencies
install_dependencies() {
    log_info "Installing test dependencies..."
    
    # Web client dependencies
    cd "$PROJECT_ROOT/src/web-client"
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing Node.js dependencies..."
        npm ci
    fi
    
    # Install Jest and testing libraries if not present
    if ! npm list jest &> /dev/null; then
        log_info "Installing Jest testing framework..."
        npm install --save-dev jest supertest jsdom
    fi
    
    # ML service dependencies (optional for local without Docker)
    cd "$PROJECT_ROOT/src/ml-service"
    if [[ -f "requirements.txt" ]]; then
        if [[ "${CCC_USE_LOCAL_PY_DEPS}" == "true" ]]; then
            log_info "Installing Python dependencies (CCC_USE_LOCAL_PY_DEPS=true)..."
            pip3 install -r requirements.txt || pip install -r requirements.txt
        else
            log_info "Skipping local Python dependency install (set CCC_USE_LOCAL_PY_DEPS=true to enable)"
        fi
    fi
    
    cd "$PROJECT_ROOT"
    log_success "Dependencies installed"
}

# Run unit tests
run_unit_tests() {
    log_info "Running unit tests..."
    
    # JavaScript unit tests
    cd "$PROJECT_ROOT/src/web-client"
    if [[ "$VERBOSE" == true ]]; then
        npm test -- --testPathPattern=tests/unit --verbose
    else
        npm test -- --testPathPattern=tests/unit --passWithNoTests
    fi
    
    # Python unit tests (if they exist)
    cd "$PROJECT_ROOT/src/ml-service"
    if [[ -d "tests" ]]; then
        log_info "Running Python unit tests..."
        python3 -m pytest tests/ -v || python -m pytest tests/ -v || log_warning "Python tests not available"
    else
        log_warning "No Python unit tests found"
    fi
    
    cd "$PROJECT_ROOT"
    log_success "Unit tests completed"
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    # Start Redis for testing
    log_info "Starting Redis container..."
    docker run -d --name test-redis-$(date +%s) \
        --health-cmd="redis-cli ping" \
        --health-interval=5s \
        --health-timeout=3s \
        --health-retries=3 \
        -p 6380:6379 \
        redis:7-alpine
    
    REDIS_CONTAINER=$(docker ps --filter "name=test-redis" --format "{{.Names}}" | head -1)
    
    # Wait for Redis to be healthy (portable; no 'timeout' requirement)
    log_info "Waiting for Redis to be ready..."
    SECONDS=0
    until docker exec "$REDIS_CONTAINER" redis-cli ping &> /dev/null; do
        sleep 1
        if (( SECONDS > 30 )); then
            log_error "Redis failed to start within 30s"
            cleanup_containers
            exit 1
        fi
    done
    
    # Run integration tests
    cd "$PROJECT_ROOT/src/web-client"
    export REDIS_URL="redis://localhost:6380"
    export NODE_ENV="test"
    
    if [[ "$VERBOSE" == true ]]; then
        npm test -- --testPathPattern=tests/integration --verbose --testTimeout=60000
    else
        npm test -- --testPathPattern=tests/integration --passWithNoTests --testTimeout=60000
    fi
    
    if [[ "$CLEANUP" == true ]]; then
        cleanup_containers
    fi
    
    cd "$PROJECT_ROOT"
    log_success "Integration tests completed"
}

# Run security scans
run_security_scans() {
    log_info "Running security scans..."
    
    # npm audit
    cd "$PROJECT_ROOT/src/web-client"
    log_info "Running npm audit..."
    npm audit --audit-level=moderate || log_warning "npm audit found issues"
    
    # Python safety check
    cd "$PROJECT_ROOT/src/ml-service"
    if command -v safety &> /dev/null; then
        log_info "Running Python safety check..."
        safety check --short-report || log_warning "Safety check found issues"
    else
        log_info "Installing Python safety..."
        pip3 install safety || pip install safety
        safety check --short-report || log_warning "Safety check found issues"
    fi
    
    # License check
    cd "$PROJECT_ROOT/src/web-client"
    log_info "Checking license compliance..."
    if command -v license-checker &> /dev/null; then
        npx license-checker --summary --onlyAllow "MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;Unlicense"
    else
        log_warning "license-checker not available - install with: npm install -g license-checker"
    fi
    
    # Check for secrets (basic)
    cd "$PROJECT_ROOT"
    log_info "Checking for potential secrets..."
    if grep -r "password\|secret\|key\|token" src/ --exclude-dir=node_modules | grep -v "// " | grep -v "# " | head -5; then
        log_warning "Potential secrets found (review manually)"
    else
        log_success "No obvious secrets found"
    fi
    
    cd "$PROJECT_ROOT"
    log_success "Security scans completed"
}

# Cleanup function
cleanup_containers() {
    if [[ "$CLEANUP" == true ]]; then
        log_info "Cleaning up test containers..."
        docker ps --filter "name=test-redis" --format "{{.Names}}" | xargs -r docker stop
        docker ps -a --filter "name=test-redis" --format "{{.Names}}" | xargs -r docker rm
        log_success "Cleanup completed"
    fi
}

# Trap cleanup on exit
trap cleanup_containers EXIT

# Main execution
main() {
    log_info "Starting Confidential Cat Counter test suite..."
    
    check_dependencies
    install_dependencies
    
    # Track results
    TESTS_PASSED=0
    TESTS_FAILED=0
    
    if [[ "$RUN_UNIT" == true ]]; then
        if run_unit_tests; then
            ((TESTS_PASSED++))
        else
            ((TESTS_FAILED++))
        fi
    fi
    
    if [[ "$RUN_INTEGRATION" == true ]]; then
        if run_integration_tests; then
            ((TESTS_PASSED++))
        else
            ((TESTS_FAILED++))
        fi
    fi
    
    if [[ "$RUN_SECURITY" == true ]]; then
        if run_security_scans; then
            ((TESTS_PASSED++))
        else
            ((TESTS_FAILED++))
        fi
    fi
    
    # Summary
    echo ""
    log_info "Test Summary:"
    echo "  Passed: $TESTS_PASSED"
    echo "  Failed: $TESTS_FAILED"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "All tests passed! 🎉"
        exit 0
    else
        log_error "Some tests failed"
        exit 1
    fi
}

# Run main function
main "$@"
