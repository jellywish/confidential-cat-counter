#!/bin/bash

# Version management script for Confidential Cat Counter
# Implements semantic versioning with git tagging and build metadata

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

# Version management functions
get_current_version() {
    node -p "require('./package.json').version"
}

get_git_commit_hash() {
    git rev-parse --short HEAD
}

get_git_branch() {
    git rev-parse --abbrev-ref HEAD
}

get_build_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

generate_build_info() {
    local version=$1
    local commit_hash=$(get_git_commit_hash)
    local branch=$(get_git_branch)
    local timestamp=$(get_build_timestamp)
    local dirty=""
    
    # Check if working directory is dirty
    if ! git diff-index --quiet HEAD --; then
        dirty="-dirty"
    fi
    
    cat > src/web-client/public/build-info.json << EOF
{
  "version": "$version",
  "commit": "$commit_hash$dirty",
  "branch": "$branch",
  "buildTime": "$timestamp",
  "isDirty": $([ -n "$dirty" ] && echo "true" || echo "false"),
  "buildEnvironment": "${BUILD_ENV:-development}",
  "gitUrl": "https://github.com/jellywish/confidential-cat-counter/commit/$commit_hash"
}
EOF
    
    log_success "Generated build-info.json"
}

validate_version() {
    local version=$1
    
    # Validate semantic version format
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
        log_error "Invalid semantic version format: $version"
        log_info "Expected format: MAJOR.MINOR.PATCH[-prerelease][+build]"
        return 1
    fi
    
    return 0
}

check_git_status() {
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        return 1
    fi
    
    # Check if there are uncommitted changes (for release)
    if [[ "$1" == "release" ]] && ! git diff-index --quiet HEAD --; then
        log_warning "Working directory has uncommitted changes"
        log_info "Commit your changes before creating a release"
        return 1
    fi
    
    return 0
}

bump_version() {
    local bump_type=$1
    local current_version=$(get_current_version)
    
    log_info "Current version: $current_version"
    log_info "Bumping $bump_type version..."
    
    # Use npm version to bump
    npm version $bump_type --no-git-tag-version
    
    local new_version=$(get_current_version)
    log_success "New version: $new_version"
    
    return 0
}

create_git_tag() {
    local version=$1
    local tag_name="v$version"
    
    log_info "Creating git tag: $tag_name"
    
    # Add package.json changes
    git add package.json
    
    # Create commit for version bump
    git commit -m "chore: bump version to $tag_name

This release includes:
- Version bump to $version
- Updated build metadata
- Generated changelog entry

For full release notes, see CHANGELOG.md"
    
    # Create annotated tag
    git tag -a "$tag_name" -m "Release $tag_name

$(generate_release_notes $version)"
    
    log_success "Created git tag: $tag_name"
    log_info "Push with: git push origin main --tags"
}

generate_release_notes() {
    local version=$1
    local commit_hash=$(get_git_commit_hash)
    local timestamp=$(get_build_timestamp)
    
    echo "Release Notes for $version

Build Information:
- Version: $version
- Commit: $commit_hash
- Build Time: $timestamp
- Branch: $(get_git_branch)

Key Features:
- Privacy-preserving ML reference architecture
- Client-side encryption with AWS Encryption SDK
- Apache 2.0 licensed YOLO-NAS object detection
- Docker-based deployment with monitoring
- Comprehensive testing and documentation

Security Highlights:
- End-to-end encryption pipeline
- Zero-trust security model
- Supply chain security practices
- Automated vulnerability scanning

For detailed changes, see CHANGELOG.md"
}

show_version_info() {
    local version=$(get_current_version)
    local commit_hash=$(get_git_commit_hash)
    local branch=$(get_git_branch)
    local timestamp=$(get_build_timestamp)
    
    echo "📦 Confidential Cat Counter Version Information"
    echo ""
    echo "Version: $version"
    echo "Commit:  $commit_hash"
    echo "Branch:  $branch"
    echo "Time:    $timestamp"
    echo ""
    
    # Check if working directory is clean
    if git diff-index --quiet HEAD --; then
        echo "Status:  ✅ Clean working directory"
    else
        echo "Status:  ⚠️  Working directory has uncommitted changes"
    fi
    
    # Show recent tags
    echo ""
    echo "Recent tags:"
    git tag --sort=-version:refname | head -5 || echo "No tags found"
}

# Main script logic
case "$1" in
    "info"|"show")
        show_version_info
        ;;
    "patch")
        check_git_status
        bump_version "patch"
        new_version=$(get_current_version)
        generate_build_info "$new_version"
        log_success "Version bumped to $new_version (patch)"
        ;;
    "minor")
        check_git_status
        bump_version "minor"
        new_version=$(get_current_version)
        generate_build_info "$new_version"
        log_success "Version bumped to $new_version (minor)"
        ;;
    "major")
        check_git_status
        bump_version "major"
        new_version=$(get_current_version)
        generate_build_info "$new_version"
        log_success "Version bumped to $new_version (major)"
        ;;
    "release")
        check_git_status "release"
        current_version=$(get_current_version)
        generate_build_info "$current_version"
        create_git_tag "$current_version"
        ;;
    "build-info")
        current_version=$(get_current_version)
        generate_build_info "$current_version"
        log_success "Generated build info for version $current_version"
        ;;
    *)
        echo "Usage: $0 {info|patch|minor|major|release|build-info}"
        echo ""
        echo "Commands:"
        echo "  info       Show current version information"
        echo "  patch      Bump patch version (1.0.0 -> 1.0.1)"
        echo "  minor      Bump minor version (1.0.0 -> 1.1.0)"
        echo "  major      Bump major version (1.0.0 -> 2.0.0)"
        echo "  release    Create git tag for current version"
        echo "  build-info Generate build metadata file"
        echo ""
        echo "Examples:"
        echo "  $0 info              # Show version info"
        echo "  $0 patch             # Bump patch version"
        echo "  $0 release           # Tag current version for release"
        echo ""
        echo "Workflow:"
        echo "  1. Make your changes and commit them"
        echo "  2. Run: $0 minor     # Bump version"
        echo "  3. Run: $0 release   # Create release tag"
        echo "  4. Push: git push origin main --tags"
        exit 1
        ;;
esac
