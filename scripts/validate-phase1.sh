#!/bin/bash
set -e

echo "🔍 Phase 1 Validation Starting..."

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not installed"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose not installed"; exit 1; }

# Start services
echo "🚀 Starting services..."
make dev-setup

# Wait for services to be ready
echo "⏳ Waiting for services..."
sleep 10

# Run health checks
echo "🏥 Running health checks..."
curl -f http://localhost:3000/health || { echo "❌ Web client unhealthy"; exit 1; }
curl -f http://localhost:8000/health || { echo "❌ ML service unhealthy"; exit 1; }

# Run confidentiality tests
echo "🔒 Running confidentiality tests..."
make test-confidentiality

# Run integration tests
echo "🧪 Running integration tests..."
cd tests/integration && python -m pytest test_full_workflow.py -v

# Performance test
echo "⚡ Running performance test..."
time curl -X POST -F "image=@../fixtures/cat.jpg" http://localhost:3000/upload

echo "✅ Phase 1 validation complete!"
echo "🎯 Ready for Phase 2 development"
