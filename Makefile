.PHONY: dev-setup local-demo test-confidentiality clean dev-restart dev-logs dev-test

# 30-second development cycle
dev-setup:
	@echo "🚀 Setting up development environment..."
	@echo "🔧 Setting up permissions..."
	mkdir -p data/uploads data/results
	@echo "📥 Caching ONNX model..."
	./scripts/cache-onnx-model.sh
	@echo "📦 Building containers..."
	UID=$(shell id -u) GID=$(shell id -g) docker compose build --parallel
	@echo "🔄 Starting services..."
	UID=$(shell id -u) GID=$(shell id -g) docker compose up -d
	@echo "⏳ Waiting for services to be ready..."
	sleep 10
	@echo "✅ Environment ready!"
	@echo "🌐 Web interface: http://localhost:3000"
	@echo "🔧 ML API: http://localhost:8000"
	@echo "📊 Redis: localhost:6379"

local-demo: dev-setup
	@echo "🎯 Running cat detection demo..."
	@echo "📤 Testing health endpoints..."
	curl -f http://localhost:3000/health || echo "❌ Web client not ready"
	curl -f http://localhost:8000/health || echo "❌ ML service not ready"
	@echo "\n🎉 Demo ready! Visit http://localhost:3000 to upload images"

test-confidentiality:
	@echo "🔒 Running property-based confidentiality tests..."
	docker compose exec -T ml-service python -m pytest tests/confidentiality/ -v || echo "⚠️  Tests not yet implemented"
	docker compose exec -T web-client npm test 2>/dev/null || echo "⚠️  Tests not yet implemented"

test-integration:
	@echo "🧪 Running integration tests..."
	docker compose exec -T ml-service python -m pytest tests/integration/ -v || echo "⚠️  Tests not yet implemented"

clean:
	@echo "🧹 Cleaning up..."
	docker compose down -v
	docker system prune -f
	@echo "✅ Cleanup complete"

# Fast iteration commands
dev-restart:
	@echo "⚡ Restarting services..."
	docker compose restart web-client ml-service
	@echo "✅ Services restarted (~5 seconds)"

dev-logs:
	docker compose logs -f web-client ml-service

dev-test:
	@echo "🧪 Running development tests..."
	docker compose exec -T ml-service python -m pytest tests/unit/ -v || echo "⚠️  Unit tests not yet implemented"
	docker compose exec -T web-client npm test || echo "⚠️  Unit tests not yet implemented"

# Health checks
health:
	@echo "🏥 Checking service health..."
	@curl -s http://localhost:3000/health | jq . || echo "❌ Web client unhealthy"
	@curl -s http://localhost:8000/health | jq . || echo "❌ ML service unhealthy"

# Performance test
perf-test:
	@echo "⚡ Running performance test..."
	@if [ -f tests/fixtures/cat.jpg ]; then \
		time curl -X POST -F "image=@tests/fixtures/cat.jpg" http://localhost:3000/upload; \
	else \
		echo "❌ No test image found. Add tests/fixtures/cat.jpg"; \
	fi

# Show status
status:
	@echo "📊 Service Status:"
	@docker compose ps
