# Quick Start Guide

Get the Confidential Cat Counter running in under 5 minutes.

## Prerequisites

- **Docker** 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.0+ (included with Docker Desktop)
- **4GB+ RAM** available
- **2GB+ disk space** available

## One-Command Setup

```bash
# Clone the repository
git clone https://github.com/jellywish/confidential-cat-counter.git
cd confidential-cat-counter

# (Recommended) Fetch a minimal model for local builds
./scripts/cache-onnx-model.sh

# Run the setup script
./setup.sh
```

That's it! The setup script will:
1. ✅ Validate your system requirements
2. ✅ Build and start all Docker services
3. ✅ Run health checks
4. ✅ Provide access URLs

## Access the Application

Once setup completes:

- **🌐 Web Application**: http://localhost:3000
- **🤖 ML API**: http://localhost:8000
- **📋 API Docs**: http://localhost:8000/docs

## First Steps

1. **Open the web app** at http://localhost:3000
2. **Accept Terms of Use** (local-only processing agreement)
3. **Upload a cat image** (drag & drop or click to select)
4. **View results** (cat detection + crypto logs)

## Quick Commands

```bash
# View service logs
docker compose logs -f

# Stop services
docker compose down

# Restart services
docker compose restart

# Clean up old data
./scripts/cleanup.sh
```

## Test Images

Use these sample images for testing:
- `tests/fixtures/wikipedia_cat.jpg` - Single cat
- Upload your own cat photos

## Troubleshooting

### Port Already in Use
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :8000

# Stop conflicting services
docker compose down
```

### Docker Issues
```bash
# Reset Docker environment
docker compose down -v
docker system prune -f
./setup.sh
```

### Health Check Failures
```bash
# Check service status
docker compose ps

# View detailed logs
docker compose logs web-client
docker compose logs ml-service
```

## Need Help?

- **📖 Full Documentation**: `docs/README.md`
- **🛠️ Troubleshooting**: `docs/how-to/troubleshooting/`
- **🐛 Issues**: [GitHub Issues](https://github.com/jellywish/confidential-cat-counter/issues)

## What's Next?

- **🏗️ Architecture**: Learn how it works in `docs/explanation/architecture/`
- **🔐 Crypto Deep Dive**: Explore encryption in `docs/explanation/crypto/`
- **🚀 Development**: Contribute using `docs/how-to/development/`
