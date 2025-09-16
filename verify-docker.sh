#!/bin/bash

echo "🔍 Verifying Docker installation for Phase 1..."

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop or OrbStack first."
    echo "   👉 https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# Check Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is installed but not running."
    echo "   👉 Start Docker Desktop or OrbStack app"
    exit 1
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not available"
    exit 1
fi

echo "✅ Docker installation verified!"
echo "   Docker: $(docker --version)"
echo "   Compose: $(docker compose version --short)"
echo ""
echo "🚀 Ready to run Phase 1:"
echo "   make dev-setup"
echo "   make local-demo"
echo ""

# Check available resources
echo "💻 System Resources:"
echo "   Memory: $(system_profiler SPHardwareDataType | grep "Memory:" | awk '{print $2, $3}')"
echo "   Docker Status: $(docker info --format 'Running with {{.ServerVersion}}')"
