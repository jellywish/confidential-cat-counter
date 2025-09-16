# System Requirements

## Minimum Requirements

### Hardware
- **CPU**: 2+ cores (x86_64 or ARM64)
- **RAM**: 4GB available memory
- **Storage**: 2GB available disk space
- **Network**: Internet connection (for initial setup)

### Operating Systems

#### ✅ Supported
- **macOS**: 10.15+ (Catalina or newer)
- **Linux**: Ubuntu 18.04+, CentOS 8+, Debian 10+
- **Windows**: Windows 10+ with WSL2

#### ⚠️ Compatibility Notes
- **Apple Silicon (M1/M2)**: Fully supported with native ARM64 containers
- **Windows**: Requires WSL2 for optimal performance
- **Linux ARM64**: Supported (Raspberry Pi 4+ with 8GB RAM)

## Software Dependencies

### Required
- **Docker**: 20.10+ 
  - [Install Docker Desktop](https://docs.docker.com/get-docker/) (recommended)
  - Or [Install Docker Engine](https://docs.docker.com/engine/install/) (Linux)
- **Docker Compose**: 2.0+
  - Included with Docker Desktop
  - Or install separately: [Docker Compose](https://docs.docker.com/compose/install/)

### Optional
- **Git**: For cloning the repository
- **curl**: For health checks and API testing
- **jq**: For JSON response formatting

## Performance Expectations

### ML Processing
- **Small images** (<1MB): ~0.5-2 seconds
- **Large images** (3-5MB): ~2-5 seconds
- **Batch processing**: ~10-50 images/minute

### Resource Usage
- **Idle state**: ~500MB RAM, minimal CPU
- **Processing**: ~2-3GB RAM, high CPU (brief spikes)
- **Storage growth**: ~10-50MB/day (with auto-cleanup)

## Network Requirements

### Ports Used
- **3000**: Web client (HTTP)
- **8000**: ML service API (HTTP)
- **6379**: Redis cache (internal only)

### Firewall
No inbound connections required - all services run locally.

### Internet Access
Required only for:
- Initial Docker image downloads (~500MB)
- Optional: ML model updates
- Optional: Documentation updates

## Development Requirements

Additional requirements for development:

### Node.js Environment
- **Node.js**: 18.17+ (for local development)
- **npm**: 9+ (package management)

### Python Environment
- **Python**: 3.11+ (for ML service development)
- **pip**: 23+ (package management)

### Development Tools
- **Git**: Version control
- **Code Editor**: VS Code, IntelliJ, etc.
- **Browser**: Chrome/Firefox/Safari (latest)

## Cloud Deployment

For cloud deployment, consider:

### Minimum Cloud Instance
- **AWS**: t3.medium (2 vCPU, 4GB RAM)
- **GCP**: e2-medium (2 vCPU, 4GB RAM)
- **Azure**: B2s (2 vCPU, 4GB RAM)

### Recommended Cloud Instance
- **AWS**: t3.large (2 vCPU, 8GB RAM)
- **GCP**: e2-standard-2 (2 vCPU, 8GB RAM)
- **Azure**: B2ms (2 vCPU, 8GB RAM)

## Security Considerations

### Local Development
- All data processing happens locally
- No external API calls for ML inference
- No data transmission to external services

### Production Deployment
- Consider firewall rules for web access
- HTTPS termination (nginx/ALB)
- Regular security updates
- Monitoring and logging

## Troubleshooting

### Common Issues

#### Insufficient Memory
**Symptoms**: Services crash, slow performance
**Solution**: 
- Close other applications
- Increase Docker Desktop memory limit
- Use cleanup script: `./scripts/cleanup.sh`

#### Port Conflicts
**Symptoms**: "Port already in use" errors
**Solution**:
```bash
# Find conflicting processes
lsof -i :3000
lsof -i :8000

# Stop Docker services
docker compose down
```

#### Docker Daemon Issues
**Symptoms**: "Cannot connect to Docker daemon"
**Solution**:
- Start Docker Desktop
- Check Docker service status
- Restart Docker daemon

### Performance Optimization

#### Docker Settings
- **Memory**: Allocate 6-8GB to Docker Desktop
- **CPU**: Use all available cores
- **Disk**: Enable Docker Desktop file sharing optimization

#### System Optimization
- **SSD Storage**: Recommended for better I/O performance
- **Background Apps**: Close unnecessary applications
- **Antivirus**: Exclude Docker directories from real-time scanning

## Verification

Run the system requirements check:

```bash
# Using the setup script
./setup.sh --help

# Manual verification
docker --version
docker compose --version
free -h  # Linux
vm_stat  # macOS
df -h    # Disk space
```

Expected output:
```
Docker version 24.0.0+
Docker Compose version 2.20.0+
Available RAM: 4GB+
Available disk: 2GB+
```
