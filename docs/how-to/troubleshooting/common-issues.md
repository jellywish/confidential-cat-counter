# Common Issues & Solutions

## Setup Issues

### Docker Not Running

**Error**: `Cannot connect to the Docker daemon`

**Solutions**:
```bash
# macOS/Windows: Start Docker Desktop
open -a Docker  # macOS
# Or click Docker Desktop icon

# Linux: Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

### Port Already in Use

**Error**: `Port 3000/8000 is already allocated`

**Solutions**:
```bash
# Find what's using the port
lsof -i :3000
lsof -i :8000

# Kill conflicting processes
kill $(lsof -t -i :3000)

# Or stop all Docker services
docker compose down
```

### Insufficient Resources

**Error**: Services crash or slow performance

**Solutions**:
1. **Increase Docker memory** (Docker Desktop → Settings → Resources)
2. **Close other applications** to free RAM
3. **Clean up Docker**:
   ```bash
   docker system prune -f
   docker volume prune -f
   ```

## Application Issues

### Upload Fails

**Error**: File upload returns error

**Diagnosis**:
```bash
# Check service status
docker compose ps

# Check logs
docker compose logs web-client
```

**Solutions**:
1. **File size too large** (>10MB limit):
   - Use smaller images
   - Check file type (images only)

2. **Service not ready**:
   ```bash
   # Wait for services to start
   curl http://localhost:3000/health
   curl http://localhost:8000/health
   ```

3. **Rate limiting**:
   - Wait 15 minutes for rate limit reset
   - Or restart web-client: `docker compose restart web-client`

### ML Detection Not Working

**Error**: No cats detected in obvious cat images

**Diagnosis**:
```bash
# Check ML service logs
docker compose logs ml-service

# Test ML service directly
curl http://localhost:8000/health
```

**Solutions**:
1. **Wrong model loaded**:
   - Check logs for model loading messages
   - YOLO-NAS may need pre-trained weights

2. **Image quality issues**:
   - Use clear, well-lit images
   - Try different cat photos
   - Check image format (JPEG/PNG)

3. **Model confidence too high**:
   - This is normal for reference implementation
   - See: `docs/explanation/research/optimal-model-configuration.md`

### Crypto Logs Not Showing

**Error**: Encryption/decryption logs not visible

**Solutions**:
1. **Open crypto drawer**: Click "🔐 Crypto Logs" button
2. **Browser console errors**: Check F12 → Console
3. **JavaScript disabled**: Enable JavaScript in browser

## Browser Issues

### Choose Image Button Broken

**Error**: File picker doesn't open when clicking "Choose Image"

**Solutions**:
1. **Use drag & drop**: Drag image files onto upload area
2. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
3. **Try different browser**: Chrome, Firefox, Safari
4. **Check browser console**: F12 → Console for errors

### Crypto Drawer Covering Content

**Error**: Crypto logs overlay blocks other content

**Solutions**:
1. **Close drawer**: Click crypto logs button again
2. **Scroll down**: Page has padding for drawer
3. **Browser zoom**: Reduce zoom level if needed

### CORS Errors

**Error**: Cross-origin request blocked

**Solutions**:
1. **Use correct URL**: http://localhost:3000 (not 127.0.0.1)
2. **Check ALLOWED_ORIGINS**: Environment variable
3. **Restart services**:
   ```bash
   docker compose restart web-client
   ```

## Data Issues

### Upload Directory Full

**Error**: No space left on device

**Solutions**:
```bash
# Clean up old uploads
./scripts/cleanup.sh

# Manual cleanup
rm -rf data/uploads/*
rm -rf data/results/*

# Check disk usage
du -sh data/
```

### Redis Connection Errors

**Error**: Redis connection refused

**Solutions**:
```bash
# Check Redis status
docker compose ps redis

# Restart Redis
docker compose restart redis

# Check Redis logs
docker compose logs redis
```

## Performance Issues

### Slow Image Processing

**Symptoms**: Long processing times (>10 seconds)

**Solutions**:
1. **Reduce image size**: Resize images before upload
2. **Check system resources**: 
   ```bash
   docker stats
   htop  # Linux/macOS
   ```
3. **Close other applications**: Free up CPU/RAM
4. **Use SSD storage**: Better I/O performance

### High Memory Usage

**Symptoms**: System becomes unresponsive

**Solutions**:
1. **Increase Docker memory limit**
2. **Run cleanup script**: `./scripts/cleanup.sh`
3. **Restart services**: `docker compose restart`
4. **Check for memory leaks**: `docker stats`

## Network Issues

### Cannot Access Application

**Error**: Connection refused to localhost:3000

**Diagnosis**:
```bash
# Check if services are running
docker compose ps

# Check port binding
docker compose port web-client 3000
```

**Solutions**:
1. **Services not started**: `docker compose up -d`
2. **Wrong URL**: Use http://localhost:3000 (not https)
3. **Firewall blocking**: Check local firewall settings
4. **Port forwarding**: If using VM/remote server

### API Requests Failing

**Error**: ML service API unreachable

**Solutions**:
```bash
# Test API directly
curl -v http://localhost:8000/health

# Check service logs
docker compose logs ml-service

# Restart ML service
docker compose restart ml-service
```

## Development Issues

### Hot Reload Not Working

**Error**: Code changes not reflected

**Solutions**:
1. **Development mode**: Use `./setup.sh --dev`
2. **Volume mounts**: Check docker-compose.yml volumes
3. **Restart containers**: `docker compose restart`

### Linting Errors

**Error**: ESLint/Prettier errors

**Solutions**:
```bash
# Fix JavaScript formatting
cd src/web-client
npm run lint:fix

# Fix Python formatting
cd src/ml-service
black app.py
ruff check --fix .
```

## Recovery Procedures

### Complete Reset

If all else fails, complete environment reset:

```bash
# Stop all services
docker compose down -v

# Remove all Docker data
docker system prune -a -f
docker volume prune -f

# Remove application data
rm -rf data/

# Restart setup
./setup.sh
```

### Backup & Restore

```bash
# Backup configuration
cp docker-compose.yml docker-compose.yml.bak
cp -r data/ data.bak/

# Restore from backup
cp docker-compose.yml.bak docker-compose.yml
rm -rf data/
cp -r data.bak/ data/
```

## Getting Help

### Log Collection

When reporting issues, include:

```bash
# System information
uname -a
docker --version
docker compose --version

# Service status
docker compose ps

# Recent logs
docker compose logs --tail=50

# System resources
docker stats --no-stream
df -h
free -h  # Linux
vm_stat  # macOS
```

### Support Channels

1. **📖 Documentation**: Check relevant docs first
2. **🔍 Search Issues**: [GitHub Issues](https://github.com/jellywish/confidential-cat-counter/issues)
3. **🐛 Report Bug**: Create new issue with logs
4. **💬 Discussions**: Community support

### Issue Template

When creating issues, include:

- **Environment**: OS, Docker version
- **Steps to reproduce**: Exact commands run
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happened
- **Logs**: Relevant log output
- **Screenshots**: If UI-related
